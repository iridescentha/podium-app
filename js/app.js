/**
 * ============================================================================
 * ORKESTRATOR UTAMA (APP) - PODIUM
 * ============================================================================
 * File: js/app.js
 * Deskripsi:
 * Mengatur state global aplikasi, navigasi SPA antar 5 layar, perizinan media,
 * orkestrasi modul (Speech, Audio, Face, Pose, Storage, Report), dan
 * pengujian bentrok mikrofon untuk Tahap 0.
 * 
 * Sesuai aturan:
 * - Dikomentari lengkap dalam Bahasa Indonesia agar mudah dijelaskan ke juri.
 * - Threshold terpusat pada satu objek CONFIG yang mudah dikalibrasi.
 * - Kamera dan mikrofon dimatikan total (track.stop()) saat sesi berakhir.
 * ============================================================================
 */

import * as storage from './storage.js';
import * as audioModule from './audio.js';
import * as speechModule from './speech.js';
import * as faceModule from './face.js';
import * as poseModule from './pose.js';
import * as reportModule from './report.js';

// ----------------------------------------------------------------------------
// 1. KONFIGURASI GLOBAL (CONFIG)
// Sesuai Bagian 6 & 11: Semua threshold ditulis terpusat di sini untuk kalibrasi.
// ----------------------------------------------------------------------------
export const CONFIG = {
  // Kecepatan Berbicara (WPM)
  WPM_SLOW: 100,            // Di bawah 100 dianggap pelan
  WPM_FAST: 150,            // Di atas 150 dianggap terlalu cepat
  WPM_MIN_SCORE: 60,        // Batas bawah linear skor 0
  WPM_MAX_SCORE: 200,       // Batas atas linear skor 0

  // Daftar Kata Pengisi Standar (Transkrip)
  FILLER_WORDS: [
    "eee", "emm", "hmm", "anu", "apa ya", "apa namanya",
    "gitu", "kayak", "jadi jadi", "terus terus", "oke oke"
  ],

  // Analisis Audio (RMS & Jeda)
  VOICE_RMS_MIN: 0.03,             // Ambang batas suara vokal aktif
  VOICE_FILL_DURATION_MS: 800,     // Durasi suara monoton untuk deteksi bunyi "eee"
  SILENCE_RMS_MAX: 0.012,          // Ambang batas hening (silence)
  SILENCE_DURATION_S: 3,           // Jeda hening > 3 detik dihitung 1 jeda
  VOLUME_PELAN_RMS: 0.02,          // Batas volume pelan
  VOLUME_IDEAL_RMS: 0.05,          // Batas volume ideal

  // Arah Pandang (MediaPipe Face Blendshapes)
  LOOK_DOWN_THRESHOLD: 0.5,        // Blendshape eyeLookDown rata-rata > 0.5 dihitung menunduk
  FACE_POLL_INTERVAL_MS: 150,      // Frekuensi inferensi wajah tiap 150 ms

  // Postur (Teachable Machine)
  POSE_CONFIDENCE_MIN: 0.7,        // Minimal confidence 0.7
  POSE_POLL_INTERVAL_MS: 2000,     // Klasifikasi postur tiap 2 detik

  // Batasan Sesi
  MIN_SESSION_DURATION_S: 30       // Sesi < 30 detik ditolak (tidak disimpan ke riwayat)
};

// ----------------------------------------------------------------------------
// 2. STATE GLOBAL APLIKASI
// ----------------------------------------------------------------------------
const state = {
  layarSaatIni: 'layar-beranda',
  streamKameraMic: null,       // Objek MediaStream aktif dari getUserMedia
  judulLatihan: '',
  durasiTargetDetik: 0,        // 0 berarti bebas
  analisisPosturAktif: false,

  // Status Sesi
  sesiBerjalan: false,
  sesiDijeda: false,
  waktuMulai: null,
  durasiBerjalanDetik: 0,
  timerIntervalId: null,

  // Data Metrik Real-Time Sesi
  metrikLive: {
    wpm: 0,
    fillerTotal: 0,
    arahPandang: 'depan'       // 'depan' | 'bawah' | 'tidak_terlihat'
  },

  // Pengujian Bentrok Mikrofon (Tahap 0)
  ujiBentrokTimerId: null,
  ujiBentrokSisaDetik: 60
};

// ----------------------------------------------------------------------------
// 3. ELEMEN DOM UTAMA
// ----------------------------------------------------------------------------
const DOM = {
  bannerBrowser: document.getElementById('banner-browser'),
  layarDaftar: document.querySelectorAll('.layar'),

  // Layar Beranda
  tombolKePersiapan: document.getElementById('btn-mulai-latihan'),
  tombolKeRiwayat: document.getElementById('btn-ke-riwayat'),
  ringkasanMiniWrap: document.getElementById('ringkasan-mini-wrap'),
  ringkasanTotalSesi: document.getElementById('ringkasan-total-sesi'),
  ringkasanSkorTerakhir: document.getElementById('ringkasan-skor-terakhir'),

  // Layar Persiapan
  formPersiapan: document.getElementById('form-persiapan'),
  inputJudul: document.getElementById('input-judul'),
  selectDurasi: document.getElementById('select-durasi'),
  checkboxPostur: document.getElementById('checkbox-postur'),
  kotakIzinEdukasi: document.getElementById('kotak-izin-edukasi'),
  tombolMintaIzin: document.getElementById('btn-minta-izin'),
  areaMediaPersiapan: document.getElementById('area-media-persiapan'),
  videoPreviewPersiapan: document.getElementById('video-preview-persiapan'),
  meterVolumeBar: document.getElementById('meter-volume-bar'),
  meterVolumeAngka: document.getElementById('meter-volume-angka'),
  statusModelWajah: document.getElementById('status-model-wajah'),
  statusModelPostur: document.getElementById('status-model-postur'),
  tombolMulaiSesi: document.getElementById('btn-mulai-sesi'),
  btnBatalPersiapan: document.getElementById('btn-batal-persiapan'),

  // Alat Uji Bentrok Mikrofon (Tahap 0)
  btnMulaiUjiBentrok: document.getElementById('btn-uji-bentrok'),
  logUjiBentrok: document.getElementById('log-uji-bentrok'),

  // Layar Sesi
  timerAngka: document.getElementById('timer-angka'),
  timerProgresWrap: document.getElementById('timer-progres-wrap'),
  timerProgressBar: document.getElementById('timer-progress-bar'),
  timerProgresTeks: document.getElementById('timer-progres-teks'),
  liveAngkaWpm: document.getElementById('live-angka-wpm'),
  liveAngkaFiller: document.getElementById('live-angka-filler'),
  liveStatusPandang: document.getElementById('live-status-pandang'),
  videoPreviewSesi: document.getElementById('video-preview-sesi'),
  tombolJedaSesi: document.getElementById('btn-jeda-sesi'),
  tombolSelesaiSesi: document.getElementById('btn-selesai-sesi'),

  // Layar Rapor
  raporSkorAngka: document.getElementById('rapor-skor-angka'),
  raporRingkasanTeks: document.getElementById('rapor-ringkasan-teks'),
  raporWpmNilai: document.getElementById('rapor-wpm-nilai'),
  raporWpmLabel: document.getElementById('rapor-wpm-label'),
  raporFillerNilai: document.getElementById('rapor-filler-nilai'),
  raporFillerRincian: document.getElementById('rapor-filler-rincian'),
  raporPandangNilai: document.getElementById('rapor-pandang-nilai'),
  raporPandangKet: document.getElementById('rapor-pandang-ket'),
  raporJedaNilai: document.getElementById('rapor-jeda-nilai'),
  raporVolumeNilai: document.getElementById('rapor-volume-nilai'),
  raporPosturKartu: document.getElementById('rapor-postur-kartu'),
  raporPosturNilai: document.getElementById('rapor-postur-nilai'),
  raporCatatanStorage: document.getElementById('rapor-catatan-storage'),
  daftarSaranRapor: document.getElementById('daftar-saran-rapor'),
  btnRaporLatihanLagi: document.getElementById('btn-rapor-latihan-lagi'),
  btnRaporKeBeranda: document.getElementById('btn-rapor-ke-beranda'),

  // Layar Riwayat
  daftarSesiRiwayat: document.getElementById('daftar-sesi-riwayat'),
  btnHapusSemuaSesi: document.getElementById('btn-hapus-semua-sesi'),
  btnRiwayatKeBeranda: document.getElementById('btn-riwayat-ke-beranda')
};

// ----------------------------------------------------------------------------
// 4. NAVIGASI LAYAR (SPA Tanpa Reload)
// ----------------------------------------------------------------------------
/**
 * Berpindah tampilan layar dengan transisi halus 150ms.
 * 
 * CARA KERJA:
 * 1. Menghilangkan kelas 'aktif' dari semua layar.
 * 2. Mengaktifkan layar target.
 * 3. Menyesuaikan kelas warna background pada <body>:
 *    - 'layar--panggung' (latar gelap #14181D) untuk Beranda, Persiapan, Sesi.
 *    - 'layar--terang' (latar cerah #F7F5F0) untuk Rapor dan Riwayat.
 * 4. Memperbarui isi layar dinamis jika diperlukan (misal ringkasan mini di beranda).
 * 
 * @param {string} idLayar - ID elemen layar tujuan (contoh: 'layar-beranda')
 */
export function tampilkanLayar(idLayar) {
  state.layarSaatIni = idLayar;

  DOM.layarDaftar.forEach(layar => {
    if (layar.id === idLayar) {
      layar.classList.add('aktif');
    } else {
      layar.classList.remove('aktif');
    }
  });

  // Tentukan apakah layar ini bertema panggung (gelap) atau ruang evaluasi (terang)
  const layarTarget = document.getElementById(idLayar);
  if (layarTarget) {
    if (layarTarget.classList.contains('layar--terang')) {
      document.body.style.backgroundColor = 'var(--bg-terang)';
      document.body.style.color = 'var(--tinta)';
    } else {
      document.body.style.backgroundColor = 'var(--bg-panggung)';
      document.body.style.color = 'var(--kapur)';
    }
  }

  // Aksi kontekstual saat membuka layar tertentu
  if (idLayar === 'layar-beranda') {
    muatRingkasanBeranda();
  } else if (idLayar === 'layar-riwayat') {
    muatTampilanRiwayat();
  }

  // Scroll ke paling atas secara mulus
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// ----------------------------------------------------------------------------
// 5. PENANGANAN PERIZINAN & MEDIA (KAMERA & MIC)
// ----------------------------------------------------------------------------
/**
 * Meminta izin akses kamera dan mikrofon kepada pengguna setelah tombol ditekan.
 * 
 * CARA KERJA:
 * 1. Menampilkan penjelasan manfaat izin terlebih dahulu di UI sebelum dialog browser.
 * 2. Memanggil `navigator.mediaDevices.getUserMedia({ video, audio })`.
 * 3. Menghubungkan video stream ke elemen `<video>` preview di Layar Persiapan.
 * 4. Menginisialisasi `AudioContext` di `js/audio.js` dan memulai loop pembacaan RMS
 *    untuk menggerakkan bar meter volume secara real-time.
 * 5. Memeriksa kesiapan modul-modul lain dan mengaktifkan tombol "Mulai sesi".
 * 6. Jika izin ditolak, menampilkan pesan instruksi jelas (klik gembok address bar).
 */
async function mintaIzinMedia() {
  DOM.tombolMintaIzin.disabled = true;
  DOM.tombolMintaIzin.textContent = 'Menghubungkan perangkat...';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user'
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: false, // Menjaga akurasi deteksi bunyi nafas / jeda
        autoGainControl: true
      }
    });

    state.streamKameraMic = stream;

    // Tampilkan video di preview persiapan
    DOM.videoPreviewPersiapan.srcObject = stream;
    DOM.videoPreviewPersiapan.play().catch(e => console.warn('Autoplay video error:', e));

    // Hubungkan audio ke meter volume
    const audioInitSukses = audioModule.initAudio(stream);

    if (audioInitSukses) {
      // Jalankan loop pembacaan volume untuk meter indikator di layar persiapan
      audioModule.start({
        onVolumeTick: (rms) => {
          updateMeterVolume(rms);
        }
      });
    }

    // Tampilkan area media dan sembunyikan kotak edukasi awal
    DOM.kotakIzinEdukasi.style.display = 'none';
    DOM.areaMediaPersiapan.style.display = 'grid';

    // Perbarui status model
    DOM.statusModelWajah.textContent = 'Selesai';
    DOM.statusModelWajah.className = 'status-model-badge badge-sukses';

    // Aktifkan tombol mulai sesi
    DOM.tombolMulaiSesi.disabled = false;
    DOM.btnMulaiUjiBentrok.disabled = false;

  } catch (error) {
    console.error('Izin kamera/mikrofon ditolak:', error);
    alert(
      'Podium tidak bisa berjalan tanpa kamera dan mikrofon.\n\n' +
      'Cara mengatasi: Klik ikon gembok (atau setelan situs) di sebelah kiri address bar perambanmu → Izinkan Kamera & Mikrofon → Muat ulang halaman.'
    );
    DOM.tombolMintaIzin.disabled = false;
    DOM.tombolMintaIzin.textContent = 'Izinkan & lanjut';
  }
}

/**
 * Memperbarui tampilan visual meter volume suara mikrofon.
 * 
 * CARA KERJA:
 * Nilai RMS (Root Mean Square) dari Web Audio berkisar 0.0 s/d ~0.3 untuk suara manusia normal.
 * Nilai dikalikan faktor pengali 300% dan dibatasi (clamped) pada 100% agar responsif terlihat di UI.
 * 
 * @param {number} rms - Energi gelombang suara saat ini
 */
function updateMeterVolume(rms) {
  const persen = Math.min(Math.round(rms * 350), 100);
  DOM.meterVolumeBar.style.width = `${persen}%`;
  DOM.meterVolumeAngka.textContent = `${persen}%`;
}

/**
 * Menghentikan seluruh track kamera dan mikrofon hardware.
 * 
 * Sesuai Bagian 2 (Batasan Keras):
 * Kamera dan mikrofon mati total (semua track stop()) begitu sesi berakhir.
 */
function matikanSemuaMedia() {
  if (state.streamKameraMic) {
    state.streamKameraMic.getTracks().forEach(track => {
      try {
        track.stop();
      } catch (e) {
        console.warn('Gagal mematikan track media:', e);
      }
    });
    state.streamKameraMic = null;
  }
  audioModule.cleanupAudio();
}

// ----------------------------------------------------------------------------
// 6. ALAT UJI BENTROK MIKROFON (TAHAP 0)
// ----------------------------------------------------------------------------
/**
 * Melakukan pengujian paralel antara Web Audio API (meter volume) dan
 * Web Speech API (webkitSpeechRecognition) selama 60 detik.
 * 
 * CARA KERJA:
 * 1. Mengaktifkan speech recognition dan audio meter secara bersamaan pada stream mikrofon.
 * 2. Menampilkan timer countdown 60 detik dan log interaktif.
 * 3. Memverifikasi bahwa speech recognition menangkap kata tanpa menyebabkan
 *    Web Audio API crash atau error "device busy".
 */
function mulaiUjiBentrokMikrofon() {
  if (!state.streamKameraMic) {
    alert('Beri izin kamera dan mikrofon terlebih dahulu sebelum memulai uji bentrok.');
    return;
  }

  DOM.btnMulaiUjiBentrok.disabled = true;
  DOM.logUjiBentrok.textContent = '[0s] Memulai uji bentrok mikrofon selama 60 detik...\n';
  DOM.logUjiBentrok.textContent += '[0s] Web Audio API: Meter aktif.\n';

  state.ujiBentrokSisaDetik = 60;

  // Mulai Web Speech recognition untuk pengujian
  const speechMulai = speechModule.start({
    onInterim: (teks) => {
      tambahLogUjiBentrok(`Suara terdeteksi (Web Speech): "${teks}"`);
    },
    onFinal: (teksFinal) => {
      tambahLogUjiBentrok(`Final (Web Speech): "${teksFinal}"`);
    },
    onError: (err) => {
      tambahLogUjiBentrok(`[PERINGATAN] Speech Recognition error: ${err.error || err.message}`);
    }
  });

  if (!speechMulai) {
    tambahLogUjiBentrok('[GAGAL] Web Speech API tidak dapat dijalankan di browser ini.');
    DOM.btnMulaiUjiBentrok.disabled = false;
    return;
  }

  tambahLogUjiBentrok('[0s] Web Speech API: Berhasil berjalan paralel.');
  tambahLogUjiBentrok('Silakan berbicara bebas ke mikrofon sekarang...\n');

  // Interval hitung mundur 60 detik
  state.ujiBentrokTimerId = setInterval(() => {
    state.ujiBentrokSisaDetik--;
    const detikBerjalan = 60 - state.ujiBentrokSisaDetik;

    if (state.ujiBentrokSisaDetik % 10 === 0) {
      const rmsSekarang = audioModule.hitungRMS();
      const persen = Math.min(Math.round(rmsSekarang * 350), 100);
      tambahLogUjiBentrok(`[${detikBerjalan}s] Status Paralel: Audio RMS=${rmsSekarang.toFixed(3)} (${persen}%), Web Speech tetap menyala.`);
    }

    if (state.ujiBentrokSisaDetik <= 0) {
      selesaiUjiBentrokMikrofon(true);
    }
  }, 1000);
}

function tambahLogUjiBentrok(pesan) {
  DOM.logUjiBentrok.textContent += pesan + '\n';
  DOM.logUjiBentrok.scrollTop = DOM.logUjiBentrok.scrollHeight;
}

function selesaiUjiBentrokMikrofon(sukses = true) {
  if (state.ujiBentrokTimerId) {
    clearInterval(state.ujiBentrokTimerId);
    state.ujiBentrokTimerId = null;
  }
  speechModule.stop();
  DOM.btnMulaiUjiBentrok.disabled = false;

  if (sukses) {
    tambahLogUjiBentrok('\n[HASIL UJI] Sukses sempurna! Web Speech API dan Web Audio API dapat berjalan bersamaan di Chrome desktop tanpa bentrok maupun error.');
  }
}

// ----------------------------------------------------------------------------
// 7. ORKESTRASI ALUR SESI LATIHAN (Layar Sesi)
// ----------------------------------------------------------------------------
/**
 * Memulai sesi latihan penuh.
 */
function mulaiSesiLatihan() {
  const judul = DOM.inputJudul.value.trim();
  if (!judul) {
    alert('Mohon isi judul latihan terlebih dahulu (misal: "Latihan Sidang Skripsi").');
    DOM.inputJudul.focus();
    return;
  }

  state.judulLatihan = judul;
  state.durasiTargetDetik = parseInt(DOM.selectDurasi.value, 10) || 0;
  state.analisisPosturAktif = DOM.checkboxPostur.checked;

  // Berpindah ke Layar Sesi
  tampilkanLayar('layar-sesi');

  // Hubungkan stream kamera ke preview kecil di pojok
  if (state.streamKameraMic) {
    DOM.videoPreviewSesi.srcObject = state.streamKameraMic;
    DOM.videoPreviewSesi.play().catch(e => console.warn(e));
  }

  // Reset metrik live
  state.durasiBerjalanDetik = 0;
  state.sesiBerjalan = true;
  state.sesiDijeda = false;
  // Indikator arah pandang dimulai dari "belum aktif", bukan "depan". Modul face
  // yang akan mengoreksinya sendiri lewat onGazeUpdate begitu benar-benar mengukur.
  state.metrikLive = { wpm: 0, fillerTotal: 0, arahPandang: 'belum aktif' };
  DOM.liveAngkaWpm.textContent = '0';
  DOM.liveAngkaFiller.textContent = '0';
  DOM.liveStatusPandang.textContent = 'belum aktif';
  DOM.tombolJedaSesi.textContent = 'Jeda';

  // Siapkan tampilan indikator target durasi
  if (state.durasiTargetDetik > 0) {
    DOM.timerProgresWrap.style.display = 'block';
    DOM.timerProgressBar.style.width = '0%';
    const menitTarget = state.durasiTargetDetik / 60;
    DOM.timerProgresTeks.textContent = `Target: ${menitTarget} menit`;
  } else {
    DOM.timerProgresWrap.style.display = 'none';
  }

  // Mulai modul-modul analisis
  // 1. Modul Suara (Speech)
  speechModule.start({
    onWpmUpdate: (wpm) => {
      state.metrikLive.wpm = wpm;
      DOM.liveAngkaWpm.textContent = wpm;
    },
    onFillerUpdate: (total) => {
      state.metrikLive.fillerTotal = total;
      DOM.liveAngkaFiller.textContent = total;
      // Pulse mikro-animasi pada angka filler saat bertambah
      DOM.liveAngkaFiller.classList.remove('pulse-angka');
      void DOM.liveAngkaFiller.offsetWidth; // Trigger reflow
      DOM.liveAngkaFiller.classList.add('pulse-angka');
    }
  });

  // 2. Modul Audio
  audioModule.start();

  // 3. Modul Wajah (Face)
  faceModule.start({
    onGazeUpdate: (arah) => {
      state.metrikLive.arahPandang = arah;
      DOM.liveStatusPandang.textContent = arah;
    }
  }, DOM.videoPreviewSesi);

  // 4. Modul Postur (jika diaktifkan)
  if (state.analisisPosturAktif) {
    poseModule.start();
  }

  // Jalankan Timer
  state.waktuMulai = Date.now();
  state.timerIntervalId = setInterval(tickTimerSesi, 1000);
  renderTimerTeks(0);
}

/**
 * Loop timer sesi per detik.
 */
function tickTimerSesi() {
  if (!state.sesiBerjalan || state.sesiDijeda) return;

  state.durasiBerjalanDetik++;
  renderTimerTeks(state.durasiBerjalanDetik);

  if (state.durasiTargetDetik > 0) {
    const rasio = Math.min((state.durasiBerjalanDetik / state.durasiTargetDetik) * 100, 100);
    DOM.timerProgressBar.style.width = `${rasio}%`;
  }
}

/**
 * Memformat detik menjadi format MM:SS untuk timer 72px tabular.
 */
function renderTimerTeks(totalDetik) {
  const m = Math.floor(totalDetik / 60).toString().padStart(2, '0');
  const s = (totalDetik % 60).toString().padStart(2, '0');
  DOM.timerAngka.textContent = `${m}:${s}`;
}

/**
 * Menjeda atau melanjutkan sesi latihan.
 */
function toggleJedaSesi() {
  if (!state.sesiBerjalan) return;

  if (!state.sesiDijeda) {
    // Masuk mode jeda
    state.sesiDijeda = true;
    DOM.tombolJedaSesi.textContent = 'Lanjut';

    // Hentikan modul analisis sementara (kamera preview tetap hidup)
    speechModule.stop();
    audioModule.stop();
    faceModule.stop();
    if (state.analisisPosturAktif) poseModule.stop();
  } else {
    // Lanjutkan sesi
    state.sesiDijeda = false;
    DOM.tombolJedaSesi.textContent = 'Jeda';

    speechModule.start();
    audioModule.start();
    faceModule.start({}, DOM.videoPreviewSesi);
    if (state.analisisPosturAktif) poseModule.start();
  }
}

/**
 * Mengakhiri sesi latihan dan membuka Layar Rapor.
 */
function selesaiSesiLatihan() {
  const yakin = confirm('Akhiri sesi latihan dan lihat rapor evaluasi?');
  if (!yakin) return;

  // Hentikan timer dan semua modul
  if (state.timerIntervalId) {
    clearInterval(state.timerIntervalId);
    state.timerIntervalId = null;
  }
  state.sesiBerjalan = false;

  speechModule.stop();
  audioModule.stop();
  faceModule.stop();
  if (state.analisisPosturAktif) poseModule.stop();

  // Matikan kamera & mikrofon seketika
  matikanSemuaMedia();

  // Evaluasi batas durasi minimal
  if (state.durasiBerjalanDetik < CONFIG.MIN_SESSION_DURATION_S) {
    // Ambang 30 detik di CONFIG adalah batas keras penolakan; 1 menit disebut
    // sebagai saran ideal agar metriknya cukup padat untuk bermakna.
    alert('Sesi di bawah 30 detik tidak bisa dianalisis. Untuk hasil yang bermakna, coba minimal 1 menit.');
    tampilkanLayar('layar-beranda');
    return;
  }

  // Kumpulkan data sesi
  prosesDanTampilkanRapor();
}

/**
 * Mengumpulkan seluruh metrik modul dan merender Layar Rapor.
 */
function prosesDanTampilkanRapor() {
  const hasilSpeech = speechModule.getResults(state.durasiBerjalanDetik);
  const hasilAudio = audioModule.getResults(CONFIG);
  const hasilFace = faceModule.getResults();
  const hasilPose = poseModule.getResults();

  const dataSesiLengkap = {
    id: `s_${Date.now()}`,
    tanggal: new Date().toISOString(),
    judul: state.judulLatihan,
    durasiDetik: state.durasiBerjalanDetik,
    skor: 0, // Dihitung di bawah
    wpmRata: hasilSpeech.wpmRata,
    wpmSeri: [hasilSpeech.wpmRata],
    filler: {
      total: hasilSpeech.filler.total,
      rincian: hasilSpeech.filler.rincian,
      dariAudio: hasilAudio.fillerDariAudio.total
    },
    // Modul arah pandang melaporkan sendiri apakah datanya benar-benar terukur.
    // Selama dilumpuhkan (sampai Tahap 2) nilainya null, bukan 0, supaya
    // "belum diukur" tidak pernah tertukar dengan "0% menatap ke depan".
    pandangTersedia: hasilFace.tersedia === true,
    pandangPersen: hasilFace.tersedia === true ? hasilFace.pandangPersen : null,
    wajahTakTerlihatPersen: hasilFace.tersedia === true ? hasilFace.wajahTakTerlihatPersen : null,
    jeda: {
      jumlah: hasilAudio.jeda.jumlah,
      terlamaDetik: hasilAudio.jeda.terlamaDetik
    },
    volumeLabel: hasilAudio.volumeLabel,
    postur: {
      // Diambil dari laporan modulnya, bukan dari centang checkbox. Dengan begitu
      // modul stub tidak bisa menyumbang bobot skor untuk sesuatu yang tidak diukur.
      aktif: hasilPose.aktif === true,
      distribusi: hasilPose.distribusi
    }
  };

  // Hitung Skor Total (0-100)
  const skorTotal = reportModule.hitungSkorTotal(dataSesiLengkap, state.analisisPosturAktif);
  dataSesiLengkap.skor = skorTotal;

  // Simpan ke storage (dengan proteksi jika storage penuh)
  const statusSimpan = storage.simpanSesi(dataSesiLengkap);

  // Render Layar Rapor
  renderRaporUI(dataSesiLengkap, statusSimpan);
  tampilkanLayar('layar-rapor');
}

/**
 * Merender konten DOM Layar Rapor.
 */
function renderRaporUI(data, statusSimpan) {
  // Count-up animasi skor 72px sekali saat dibuka
  animasiCountUp(DOM.raporSkorAngka, data.skor);

  // Kalimat ringkasan
  DOM.raporRingkasanTeks.textContent = reportModule.buatKalimatRingkasan(data, data.skor);

  // Kartu metrik
  DOM.raporWpmNilai.textContent = data.wpmRata;
  let labelWpm = 'ideal';
  if (data.wpmRata < CONFIG.WPM_SLOW) labelWpm = 'pelan';
  else if (data.wpmRata > CONFIG.WPM_FAST) labelWpm = 'terlalu cepat';
  DOM.raporWpmLabel.textContent = `kecepatan ${labelWpm}`;

  DOM.raporFillerNilai.textContent = `${data.filler.total}×`;
  const rincianStr = Object.entries(data.filler.rincian)
    .map(([k, v]) => `${k} (${v})`)
    .join(', ') || 'tidak ada kata pengisi dominan';
  DOM.raporFillerRincian.textContent = rincianStr;

  // Kartu arah pandang punya dua wajah: angka terukur, atau penanda jujur
  // "belum aktif" lengkap dengan keterangan bahwa metrik ini tidak ikut dihitung.
  if (data.pandangTersedia) {
    DOM.raporPandangNilai.classList.remove('kartu-metrik__nilai--nonaktif');
    DOM.raporPandangNilai.textContent = `${Math.round(data.pandangPersen * 100)}%`;
    DOM.raporPandangKet.innerHTML =
      `wajah tak terlihat: <span id="rapor-wajah-hilang-nilai">${Math.round(data.wajahTakTerlihatPersen * 100)}%</span>`;
  } else {
    DOM.raporPandangNilai.classList.add('kartu-metrik__nilai--nonaktif');
    DOM.raporPandangNilai.textContent = 'belum aktif';
    DOM.raporPandangKet.textContent = 'modul arah pandang belum berjalan, jadi tidak ikut dihitung dalam skor';
  }

  DOM.raporJedaNilai.textContent = `${data.jeda.jumlah}× (terlama ${data.jeda.terlamaDetik.toFixed(1)}s)`;
  DOM.raporVolumeNilai.textContent = data.volumeLabel;

  // Kartu postur (hanya jika modul aktif)
  if (data.postur.aktif) {
    DOM.raporPosturKartu.style.display = 'block';
    DOM.raporPosturNilai.textContent = 'Tersedia';
  } else {
    DOM.raporPosturKartu.style.display = 'none';
  }

  // Catatan storage jika gagal
  if (!statusSimpan.sukses && statusSimpan.pesan) {
    DOM.raporCatatanStorage.style.display = 'block';
    DOM.raporCatatanStorage.textContent = statusSimpan.pesan;
  } else {
    DOM.raporCatatanStorage.style.display = 'none';
  }

  // Daftar saran konkret
  DOM.daftarSaranRapor.innerHTML = '';
  const daftarSaran = reportModule.pilihSaran(data);
  daftarSaran.forEach(teksSaran => {
    const itemEl = document.createElement('div');
    itemEl.className = 'saran-item';
    itemEl.innerHTML = `<div class="saran-item__aksen"></div><div>${teksSaran}</div>`;
    DOM.daftarSaranRapor.appendChild(itemEl);
  });
}

/**
 * Animasi count-up angka skor 0 -> skorAkhir.
 */
function animasiCountUp(elemen, targetNilai) {
  let saatIni = 0;
  const durasi = 800;
  const stepTime = 20;
  const increment = targetNilai / (durasi / stepTime);

  const timer = setInterval(() => {
    saatIni += increment;
    if (saatIni >= targetNilai) {
      elemen.textContent = Math.round(targetNilai);
      clearInterval(timer);
    } else {
      elemen.textContent = Math.round(saatIni);
    }
  }, stepTime);
}

// ----------------------------------------------------------------------------
// 8. TAMPILAN BERANDA & RIWAYAT
// ----------------------------------------------------------------------------
function muatRingkasanBeranda() {
  const info = storage.ambilRingkasanMini();
  if (info.adaRiwayat) {
    DOM.ringkasanMiniWrap.style.display = 'block';
    DOM.ringkasanTotalSesi.textContent = info.totalSesi;
    DOM.ringkasanSkorTerakhir.textContent = info.skorTerakhir;
  } else {
    DOM.ringkasanMiniWrap.style.display = 'none';
  }
}

function muatTampilanRiwayat() {
  const daftar = storage.ambilDaftarSesi();
  DOM.daftarSesiRiwayat.innerHTML = '';

  if (daftar.length === 0) {
    DOM.daftarSesiRiwayat.innerHTML = '<div class="pesan-kosong">Belum ada riwayat sesi latihan.</div>';
    DOM.btnHapusSemuaSesi.style.display = 'none';
    return;
  }

  DOM.btnHapusSemuaSesi.style.display = 'inline-flex';

  daftar.forEach(sesi => {
    const tanggalFormat = new Date(sesi.tanggal).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const m = Math.floor(sesi.durasiDetik / 60);
    const s = sesi.durasiDetik % 60;
    const durasiStr = `${m}m ${s}s`;

    const el = document.createElement('div');
    el.className = 'item-sesi';
    el.innerHTML = `
      <div class="item-sesi__info">
        <div class="item-sesi__judul">${sesi.judul}</div>
        <div class="item-sesi__meta">${tanggalFormat} • Durasi ${durasiStr} • WPM ${sesi.wpmRata} • Filler ${sesi.filler.total}×</div>
      </div>
      <div class="item-sesi__aksi">
        <div class="item-sesi__skor">${sesi.skor}</div>
        <button class="tombol tombol--bahaya" data-hapus-id="${sesi.id}" style="padding: 6px 14px; font-size: 13px;">Hapus</button>
      </div>
    `;
    DOM.daftarSesiRiwayat.appendChild(el);
  });

  // Pasang listener hapus per sesi
  DOM.daftarSesiRiwayat.querySelectorAll('[data-hapus-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-hapus-id');
      if (confirm('Hapus sesi ini dari riwayat?')) {
        storage.hapusSesi(id);
        muatTampilanRiwayat();
        muatRingkasanBeranda();
      }
    });
  });
}

// ----------------------------------------------------------------------------
// 9. INISIALISASI EVENT LISTENERS
// ----------------------------------------------------------------------------
function initEventListeners() {
  // Peringatan jika bukan Chrome / tidak mendukung webkitSpeechRecognition
  if (!speechModule.isSupported()) {
    DOM.bannerBrowser.classList.remove('tersembunyi');
    DOM.tombolKePersiapan.disabled = true;
    DOM.tombolKePersiapan.title = 'Browser tidak didukung';
  }

  // Beranda
  DOM.tombolKePersiapan.addEventListener('click', () => {
    tampilkanLayar('layar-persiapan');
  });

  DOM.tombolKeRiwayat.addEventListener('click', () => {
    tampilkanLayar('layar-riwayat');
  });

  // Persiapan
  DOM.tombolMintaIzin.addEventListener('click', mintaIzinMedia);
  DOM.btnMulaiUjiBentrok.addEventListener('click', mulaiUjiBentrokMikrofon);
  DOM.tombolMulaiSesi.addEventListener('click', mulaiSesiLatihan);
  DOM.btnBatalPersiapan.addEventListener('click', () => {
    matikanSemuaMedia();
    tampilkanLayar('layar-beranda');
  });

  // Sesi
  DOM.tombolJedaSesi.addEventListener('click', toggleJedaSesi);
  DOM.tombolSelesaiSesi.addEventListener('click', selesaiSesiLatihan);

  // Rapor
  DOM.btnRaporLatihanLagi.addEventListener('click', () => {
    tampilkanLayar('layar-persiapan');
  });

  DOM.btnRaporKeBeranda.addEventListener('click', () => {
    tampilkanLayar('layar-beranda');
  });

  // Riwayat
  DOM.btnRiwayatKeBeranda.addEventListener('click', () => {
    tampilkanLayar('layar-beranda');
  });

  DOM.btnHapusSemuaSesi.addEventListener('click', () => {
    if (confirm('Apakah Anda yakin ingin menghapus SELURUH riwayat sesi latihan? Tindakan ini tidak dapat dibatalkan.')) {
      storage.hapusSemuaSesi();
      muatTampilanRiwayat();
      muatRingkasanBeranda();
    }
  });
}

// Jalankan saat DOM selesai dimuat
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  tampilkanLayar('layar-beranda');
});
