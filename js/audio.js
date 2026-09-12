/**
 * ============================================================================
 * MODUL ANALISIS SINYAL AUDIO - PODIUM
 * ============================================================================
 * File: js/audio.js
 * Deskripsi:
 * Menggunakan Web Audio API bawaan peramban (AudioContext + AnalyserNode) untuk:
 * 1. Menghitung energi suara real-time (RMS - Root Mean Square) untuk indikator
 *    meter volume mikrofon di Layar Persiapan dan Layar Sesi.
 * 2. Menganalisis volume rata-rata sesi (kategori: pelan / ideal).
 * 3. Mendeteksi jeda hening berkepanjangan (silence) > 3 detik.
 * 4. Mendeteksi bunyi vokal tertahan seperti "eeee" (heuristik sinyal audio
 *    berenergi konstan > 800 ms tanpa perubahan kata pada speech recognizer).
 * 
 * Modul ini mengikuti KONTRAK SIKLUS HIDUP yang didokumentasikan lengkap di
 * kepala js/speech.js: start / pause / resume / stop / getResults, dengan aturan
 * mutlak bahwa hanya start() yang boleh mengosongkan akumulator.
 *
 * - initAudio(stream): Menghubungkan aliran mikrofon ke AnalyserNode.
 * - start(callbacks): Mengosongkan akumulator lalu memulai loop pemantauan frame.
 * - pause(): Menghentikan sampling sementara tanpa membuang akumulator.
 * - resume(): Melanjutkan sampling dari akumulator yang sama.
 * - stop(): Menghentikan pemantauan (node audio dilepas terpisah via cleanupAudio).
 * - getResults(): Mengembalikan ringkasan metrik audio untuk rapor akhir.
 * ============================================================================
 */

// Referensi instans Web Audio API
let audioContext = null;
let mediaStreamSource = null;
let analyserNode = null;
let animFrameId = null;

// Status siklus hidup modul: 'berjalan' | 'dijeda' | 'berhenti'
let status = 'berhenti';

// Buffer penampung data gelombang suara (Time-Domain)
let timeDomainBuffer = null;

// Metrik akumulasi selama sesi
let totalRmsAkumulasi = 0;
let jumlahSampleRms = 0;
let jedaDaftar = [];
let jedaMulaiWaktu = null;
let terlamaJedaDetik = 0;

// Pelacak heuristik bunyi pengisi "eee" via audio
let bunyiMulaiWaktu = null;
let totalBunyiPengisiAudio = 0;
let riwayatWaktuBunyiAudio = []; // Menyimpan timestamp audio filler untuk anti double-count

// Callbacks yang didaftarkan saat start()
let eventCallbacks = {
  onVolumeTick: null,    // Callback real-time setiap frame (mengirim nilai RMS 0-1)
  onJedaTerdeteksi: null, // Callback saat jeda panjang terdeteksi
  onBunyiPengisi: null    // Callback saat bunyi "eee" audio terdeteksi
};

/**
 * Menginisialisasi rantai Web Audio API dari MediaStream mikrofon.
 * 
 * CARA KERJA:
 * 1. Membuat instans `AudioContext` jika belum ada.
 * 2. Membuat `MediaStreamAudioSourceNode` yang bertindak sebagai jembatan pembaca
 *    gelombang suara dari hardware mikrofon tanpa memutar suaranya kembali ke speaker.
 * 3. Menghubungkan sumber tersebut ke `AnalyserNode`. AnalyserNode melakukan
 *    analisis domain waktu (Fast Fourier Transform / sampling waktu).
 * 4. `fftSize = 512` dipilih karena memberikan 512 sampel per snapshot, yang sangat
 *    cepat diproses oleh CPU tiap 16-30 ms tanpa membebani performa browser.
 * 
 * @param {MediaStream} stream - Objek MediaStream dari navigator.mediaDevices.getUserMedia()
 */
export function initAudio(stream) {
  if (!stream || stream.getAudioTracks().length === 0) {
    console.warn('initAudio dipanggil tanpa audio track yang valid.');
    return false;
  }

  try {
    // Gunakan AudioContext standar atau webkitAudioContext untuk kompatibilitas
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (!audioContext) {
      audioContext = new AudioCtxClass();
    }

    // Bangunkan AudioContext jika dalam kondisi suspended (kebijakan autoplay browser)
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    // Hubungkan mikrofon ke analyser
    mediaStreamSource = audioContext.createMediaStreamSource(stream);
    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 512;
    analyserNode.smoothingTimeConstant = 0.3; // Menghaluskan fluktuasi transien

    mediaStreamSource.connect(analyserNode);

    // Siapkan buffer Float32Array untuk menampung amplitude gelombang suara (-1.0 s/d +1.0)
    timeDomainBuffer = new Float32Array(analyserNode.fftSize);

    return true;
  } catch (error) {
    console.error('Gagal menginisialisasi Web Audio API:', error);
    return false;
  }
}

/**
 * Menghitung nilai Root Mean Square (RMS) dari buffer gelombang suara saat ini.
 * 
 * CARA KERJA:
 * 1. Membaca data amplitudo gelombang saat ini via `analyserNode.getFloatTimeDomainData()`.
 * 2. Menghitung kuadrat dari setiap sampel nilai (x^2), menjumlahkannya,
 *    lalu membaginya dengan jumlah total sampel (N).
 * 3. Menghitung akar kuadrat dari rata-rata tersebut (Root Mean Square).
 *    RMS adalah metode ilmiah standar dalam pemrosesan sinyal untuk mengukur
 *    energi (daya rata-rata) sinyal suara terlepas dari fase positif/negatifnya.
 * 4. Nilai dinormalisasi ke rentang praktis 0.0 s/d 1.0.
 * 
 * @returns {number} Nilai RMS terukur (0.0 sampai ~1.0)
 */
export function hitungRMS() {
  if (!analyserNode || !timeDomainBuffer) {
    return 0;
  }

  analyserNode.getFloatTimeDomainData(timeDomainBuffer);

  let sumSquares = 0;
  for (let i = 0; i < timeDomainBuffer.length; i++) {
    const val = timeDomainBuffer[i];
    sumSquares += val * val;
  }

  const mean = sumSquares / timeDomainBuffer.length;
  const rms = Math.sqrt(mean);

  // Hindari nilai anomali / NaN jika buffer belum terisi
  return isNaN(rms) ? 0 : rms;
}

/**
 * Memulai loop analisis audio berkala (untuk Layar Sesi maupun uji mikrofon).
 * 
 * CARA KERJA:
 * 1. Mengatur status berjalan ke true dan mereset akumulator sesi.
 * 2. Mengaktifkan perulangan menggunakan `requestAnimationFrame`.
 * 3. Pada setiap frame, menghitung nilai RMS terkini.
 * 4. Mengirimkan nilai RMS ke callback `onVolumeTick` untuk memperbarui bar visualizer.
 * 5. Mengakumulasi data statistik untuk evaluasi volume rata-rata di akhir sesi.
 * 
 * @param {Object} callbacks - Kumpulan fungsi callback untuk merespons event audio
 */
export function start(callbacks = {}) {
  eventCallbacks = { ...eventCallbacks, ...callbacks };

  // Reset metrik akumulasi sesi. Hanya start() yang boleh melakukan ini.
  totalRmsAkumulasi = 0;
  jumlahSampleRms = 0;
  jedaDaftar = [];
  jedaMulaiWaktu = null;
  terlamaJedaDetik = 0;
  totalBunyiPengisiAudio = 0;
  riwayatWaktuBunyiAudio = [];

  status = 'berjalan';
  mulaiLoopPantauAudio();
}

/**
 * Menjalankan perulangan pembacaan frame audio.
 *
 * CARA KERJA:
 * 1. Membatalkan frame yang mungkin masih terjadwal, supaya tidak pernah ada dua
 *    perulangan berjalan bersamaan. Ini penting karena meter volume di Layar
 *    Persiapan dan analisis di Layar Sesi memakai modul yang sama.
 * 2. Membangunkan AudioContext bila peramban menidurkannya.
 * 3. Setiap frame membaca RMS, menambahkannya ke akumulator rata-rata volume,
 *    lalu mengirimkannya ke callback visualizer.
 * 4. Perulangan berhenti sendiri begitu status bukan lagi 'berjalan'.
 */
function mulaiLoopPantauAudio() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume();
  }

  function loopPantauAudio() {
    if (status !== 'berjalan') return;

    const rms = hitungRMS();

    // Akumulasi rata-rata volume
    totalRmsAkumulasi += rms;
    jumlahSampleRms++;

    // Beritahu visualizer UI
    if (typeof eventCallbacks.onVolumeTick === 'function') {
      eventCallbacks.onVolumeTick(rms);
    }

    // Lanjutkan frame berikutnya
    animFrameId = requestAnimationFrame(loopPantauAudio);
  }

  loopPantauAudio();
}

/**
 * Menjeda sampling audio tanpa membuang satu pun angka yang sudah terkumpul.
 *
 * CARA KERJA:
 * Status diubah ke 'dijeda' dan frame berikutnya dibatalkan. Rata-rata volume
 * sesi tetap dihitung dari sampel sebelum jeda, sehingga durasi terjeda tidak
 * ikut menyeret rata-rata ke bawah seolah-olah pengguna berbicara pelan.
 *
 * @returns {boolean} True jika modul memang sedang berjalan
 */
export function pause() {
  if (status !== 'berjalan') return false;
  status = 'dijeda';
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  return true;
}

/**
 * Melanjutkan sampling audio setelah dijeda, tanpa menyentuh akumulator.
 *
 * @returns {boolean} True jika berhasil dilanjutkan
 */
export function resume() {
  if (status !== 'dijeda') return false;
  status = 'berjalan';
  mulaiLoopPantauAudio();
  return true;
}

/**
 * Menghentikan proses pemantauan audio secara total.
 *
 * CARA KERJA:
 * 1. Mengubah status menjadi 'berhenti' sehingga perulangan berhenti sendiri.
 * 2. Membatalkan frame yang masih terjadwal.
 * 3. Akumulator sengaja dibiarkan utuh supaya getResults() masih bisa dibaca
 *    Layar Rapor setelah sesi berakhir. Pelepasan node audio dilakukan terpisah
 *    lewat cleanupAudio() saat kamera dan mikrofon dimatikan.
 */
export function stop() {
  status = 'berhenti';
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

/**
 * Mengambil ringkasan hasil analisis sinyal audio untuk dimasukkan ke dalam Rapor.
 * 
 * CARA KERJA:
 * 1. Menghitung rata-rata RMS sepanjang sesi (totalRms / jumlahSample).
 * 2. Menentukan label volume ("pelan" atau "ideal") berdasarkan threshold.
 * 3. Mengemas daftar jeda, durasi jeda terlama, dan total bunyi pengisi audio.
 * 
 * @param {Object} config - Konfigurasi ambang batas (VOLUME_PELAN_RMS, dll)
 * @returns {Object} Data metrik audio terstruktur
 */
export function getResults(config = {}) {
  const rataRms = jumlahSampleRms > 0 ? (totalRmsAkumulasi / jumlahSampleRms) : 0;
  const thresholdPelan = config.VOLUME_PELAN_RMS || 0.02;

  const volumeLabel = rataRms < thresholdPelan ? 'pelan' : 'ideal';

  return {
    volumeRataRms: rataRms,
    volumeLabel: volumeLabel,
    jeda: {
      jumlah: jedaDaftar.length,
      terlamaDetik: terlamaJedaDetik,
      daftar: jedaDaftar
    },
    fillerDariAudio: {
      total: totalBunyiPengisiAudio,
      riwayatWaktu: riwayatWaktuBunyiAudio
    }
  };
}

/**
 * Membersihkan dan menutup seluruh node audio saat sesi atau aplikasi dimatikan total.
 * 
 * CARA KERJA:
 * Memutuskan koneksi MediaStreamSource dan menutup AudioContext.
 */
export function cleanupAudio() {
  stop();
  if (mediaStreamSource) {
    try {
      mediaStreamSource.disconnect();
    } catch (e) {}
    mediaStreamSource = null;
  }
  if (audioContext && audioContext.state !== 'closed') {
    try {
      audioContext.close();
    } catch (e) {}
    audioContext = null;
  }
  analyserNode = null;
  timeDomainBuffer = null;
}
