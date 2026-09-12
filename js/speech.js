/**
 * ============================================================================
 * MODUL TRANSKRIPSI & ANALISIS KATA (SPEECH) - PODIUM
 * ============================================================================
 * File: js/speech.js
 * Deskripsi:
 * Menggunakan Web Speech API bawaan Google Chrome (webkitSpeechRecognition) untuk:
 * 1. Menangkap suara secara berkelanjutan (continuous: true) dalam bahasa Indonesia (id-ID).
 * 2. Mengambil hasil sementara (interimResults: true) dan hasil final.
 * 3. Menghitung jumlah kata dan estimasi kecepatan berbicara (WPM - Words Per Minute).
 * 4. Mendeteksi kata pengisi (filler words) seperti "eee", "emm", "anu", dll.
 * 5. Menangani auto-restart otomatis saat event onend terpicu oleh browser.
 *
 * ============================================================================
 * KONTRAK SIKLUS HIDUP MODUL ANALISIS (BERLAKU UNTUK SEMUA MODUL)
 * ============================================================================
 * Setiap modul analisis Podium (speech, audio, face, pose, dan nanti materi)
 * WAJIB mengekspor lima fungsi berikut dengan makna yang persis sama:
 *
 *   start(callbacks)  Inisialisasi + NOL-kan seluruh akumulator. Dipanggil tepat
 *                     sekali di awal sesi. Ini satu-satunya fungsi yang boleh
 *                     menghapus data yang sudah terkumpul.
 *   pause()           Berhenti sementara. Sampling/pengenalan dimatikan, TAPI
 *                     seluruh akumulator dipertahankan apa adanya.
 *   resume()          Lanjut dari kondisi terjeda. Tidak boleh menyentuh akumulator.
 *   stop()            Hentikan total dan lepas resource. Akumulator tetap utuh
 *                     supaya getResults() masih bisa dibaca sesudahnya.
 *   getResults()      Kembalikan AGREGAT jadi (angka/persentase), bukan data per frame.
 *
 * KENAPA KONTRAK INI ADA:
 * Sebelumnya tombol Jeda memanggil stop() lalu start() lagi. Karena start()
 * me-reset akumulator, satu kali menjeda sesi menghapus seluruh hitungan kata,
 * kata pengisi, dan frame yang sudah terkumpul. Bug itu bukan milik satu modul,
 * melainkan cacat kontrak: modul mana pun yang ditambahkan kemudian akan
 * mewarisinya. Karena itu aturannya dibuat mutlak: TOMBOL JEDA TIDAK PERNAH
 * MEMANGGIL start().
 *
 * ATURAN STATUS:
 * Setiap modul memegang satu variabel status bernilai 'berjalan' | 'dijeda' |
 * 'berhenti'. Semua loop, interval, dan handler asinkron harus memeriksa status
 * ini, bukan menebak dari ada tidaknya timer. Khusus speech.js, handler onend
 * milik Chrome hanya boleh menghidupkan ulang pengenalan saat status bernilai
 * 'berjalan'; inilah yang mencegah pause() tanpa sengaja memicu auto-restart.
 * ============================================================================
 */

// Pemeriksaan dukungan Web Speech API
const SpeechRecognitionClass = window.webkitSpeechRecognition || window.SpeechRecognition;

// Objek recognition yang sedang berlaku. Selalu tepat satu instans di seluruh
// aplikasi (lihat Bagian 5.4 brief: dilarang membuat listener Web Speech kedua).
let recognition = null;

// Status siklus hidup modul: 'berjalan' | 'dijeda' | 'berhenti'
let status = 'berhenti';

// Akumulasi data
let transkripFinalGabungan = '';
let transkripInterimTerbaru = '';
let kataPerWaktu = []; // [{ timestamp, kata }] untuk perhitungan WPM per 30 detik
let rincianFiller = {}; // { 'eee': 4, 'anu': 2, ... }
let totalFiller = 0;

// Daftar kata pengisi standar bahasa Indonesia (sesuai Bagian 6.1)
const DAFTAR_FILLER_DEFAULT = [
  "eee", "emm", "hmm", "anu", "apa ya", "apa namanya",
  "gitu", "kayak", "jadi jadi", "terus terus", "oke oke"
];

// Callbacks
let eventCallbacks = {
  onInterim: null,        // Callback transkrip berjalan (untuk indikator live & uji bentrok)
  onFinal: null,          // Callback potongan transkrip yang sudah final
  onWpmUpdate: null,      // Callback saat estimasi WPM bergulir diperbarui
  onFillerUpdate: null,   // Callback saat kata pengisi baru terdeteksi
  onError: null,          // Callback penanganan error recognition
  onStatusChange: null    // Callback status recognition (aktif/restart/berhenti)
};

/**
 * Memeriksa apakah peramban saat ini mendukung Web Speech API.
 *
 * @returns {boolean} True jika webkitSpeechRecognition tersedia
 */
export function isSupported() {
  return Boolean(SpeechRecognitionClass);
}

/**
 * Memulai sesi pengenalan suara dari nol.
 *
 * CARA KERJA:
 * 1. Mengosongkan seluruh akumulator sesi. Ini SATU-SATUNYA fungsi yang boleh
 *    melakukannya, sesuai kontrak di kepala berkas.
 * 2. Menyetel status ke 'berjalan' sebelum instans dibuat, supaya handler onend
 *    tahu bahwa auto-restart memang diinginkan.
 * 3. Membuat instans recognition baru dan menyalakannya.
 *
 * @param {Object} callbacks - Kumpulan fungsi callback untuk memproses data suara
 * @returns {boolean} True jika pengenalan berhasil dijalankan
 */
export function start(callbacks = {}) {
  if (!isSupported()) {
    console.error('Web Speech API tidak didukung di browser ini.');
    if (typeof callbacks.onError === 'function') {
      callbacks.onError(new Error('Browser tidak mendukung Web Speech API.'));
    }
    return false;
  }

  eventCallbacks = { ...eventCallbacks, ...callbacks };

  // Reset data sesi (hanya di sini, tidak pernah di resume)
  transkripFinalGabungan = '';
  transkripInterimTerbaru = '';
  kataPerWaktu = [];
  rincianFiller = {};
  totalFiller = 0;

  status = 'berjalan';
  return inisialisasiRecognition();
}

/**
 * Menjeda pengenalan suara tanpa kehilangan satu pun data yang sudah terkumpul.
 *
 * CARA KERJA:
 * Status diubah menjadi 'dijeda' TERLEBIH DAHULU, baru instans dimatikan.
 * Urutan ini yang menentukan segalanya: Chrome akan memicu event onend begitu
 * pengenalan berhenti, dan handler onend hanya menghidupkan ulang bila status
 * bernilai 'berjalan'. Dengan status sudah 'dijeda' saat onend tiba, auto-restart
 * tidak pernah terpicu, dan mikrofon benar-benar berhenti didengarkan.
 *
 * @returns {boolean} True jika modul memang sedang berjalan dan berhasil dijeda
 */
export function pause() {
  if (status !== 'berjalan') return false;
  status = 'dijeda';
  lepasInstansRecognition();
  if (typeof eventCallbacks.onStatusChange === 'function') {
    eventCallbacks.onStatusChange('paused');
  }
  return true;
}

/**
 * Melanjutkan pengenalan suara setelah dijeda.
 *
 * CARA KERJA:
 * Membuat instans recognition baru lalu menyalakannya, TANPA menyentuh satu pun
 * akumulator. Instans dibuat ulang alih-alih memakai yang lama karena objek
 * SpeechRecognition yang sudah berakhir bisa menolak start() dengan
 * InvalidStateError; membuat yang baru jauh lebih dapat diprediksi.
 *
 * @returns {boolean} True jika berhasil dilanjutkan
 */
export function resume() {
  if (status !== 'dijeda') return false;
  status = 'berjalan';
  return inisialisasiRecognition();
}

/**
 * Menghentikan pengenalan suara secara total.
 *
 * CARA KERJA:
 * Status diubah ke 'berhenti' lebih dulu agar onend tidak menghidupkan ulang,
 * lalu instans dilepas. Akumulator sengaja TIDAK dikosongkan supaya
 * getResults() masih bisa dibaca oleh Layar Rapor setelah sesi selesai.
 */
export function stop() {
  status = 'berhenti';
  lepasInstansRecognition();
  if (typeof eventCallbacks.onStatusChange === 'function') {
    eventCallbacks.onStatusChange('stopped');
  }
}

/**
 * Membuat dan menyalakan satu instans SpeechRecognition baru.
 *
 * CARA KERJA:
 * 1. Melepas instans lama lebih dulu supaya tidak pernah ada dua pendengar aktif.
 * 2. Menyetel konfigurasi:
 *    - continuous = true: pengenalan tidak berhenti setelah satu kalimat.
 *    - interimResults = true: hasil praduga dikirim sebelum kalimat difinalkan.
 *    - lang = 'id-ID': mengarahkan model bahasa ke Bahasa Indonesia.
 * 3. Memasang handler onresult, onerror, dan onend.
 *
 * Setiap handler onend menyimpan rujukan ke instans miliknya sendiri, lalu
 * memeriksa apakah instans itu masih instans yang berlaku. Tanpa pemeriksaan ini,
 * handler milik instans lama bisa ikut menghidupkan ulang instans baru saat
 * resume(), dan aplikasi berakhir dengan dua pengenalan berjalan bersamaan.
 *
 * @returns {boolean} True jika recognition.start() berhasil dipanggil
 */
function inisialisasiRecognition() {
  lepasInstansRecognition();

  try {
    const instans = new SpeechRecognitionClass();
    instans.continuous = true;
    instans.interimResults = true;
    instans.lang = 'id-ID';

    // ------------------------------------------------------------------------
    // Event: onresult
    // ------------------------------------------------------------------------
    instans.onresult = (event) => {
      let interimSegment = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        const teks = item[0].transcript;

        if (item.isFinal) {
          transkripFinalGabungan += ' ' + teks;
          prosesPotonganFinal(teks);
          if (typeof eventCallbacks.onFinal === 'function') {
            eventCallbacks.onFinal(teks, transkripFinalGabungan.trim());
          }
        } else {
          interimSegment += ' ' + teks;
        }
      }

      transkripInterimTerbaru = interimSegment.trim();
      if (typeof eventCallbacks.onInterim === 'function') {
        eventCallbacks.onInterim(transkripInterimTerbaru);
      }
    };

    // ------------------------------------------------------------------------
    // Event: onerror
    // ------------------------------------------------------------------------
    instans.onerror = (event) => {
      // Galat 'no-speech' normal terjadi saat jeda hening dan tidak perlu mematikan sesi
      if (event.error === 'no-speech') {
        return;
      }
      console.warn('Speech Recognition error:', event.error);
      if (typeof eventCallbacks.onError === 'function') {
        eventCallbacks.onError(event);
      }
    };

    // ------------------------------------------------------------------------
    // Event: onend (Auto-Restart Bagian 8.4)
    // ------------------------------------------------------------------------
    instans.onend = () => {
      // Handler milik instans yang sudah dilepas wajib diam total.
      if (instans !== recognition) return;

      // Hanya status 'berjalan' yang boleh memicu auto-restart. Saat pause() atau
      // stop() dipanggil, status sudah berubah lebih dulu sehingga baris ini
      // tidak pernah menghidupkan mikrofon kembali tanpa diminta.
      if (status !== 'berjalan') return;

      try {
        instans.start();
        if (typeof eventCallbacks.onStatusChange === 'function') {
          eventCallbacks.onStatusChange('restarted');
        }
      } catch (e) {
        // Bila restart instan gagal, coba lagi dalam jeda waktu singkat 100ms
        setTimeout(() => {
          if (instans === recognition && status === 'berjalan') {
            try { instans.start(); } catch (err) {}
          }
        }, 100);
      }
    };

    recognition = instans;
    instans.start();

    if (typeof eventCallbacks.onStatusChange === 'function') {
      eventCallbacks.onStatusChange('active');
    }
    return true;
  } catch (err) {
    console.error('Gagal menjalankan recognition.start():', err);
    if (typeof eventCallbacks.onError === 'function') {
      eventCallbacks.onError(err);
    }
    return false;
  }
}

/**
 * Melepas instans recognition yang sedang berlaku.
 *
 * CARA KERJA:
 * Rujukan modul dikosongkan LEBIH DULU, baru instansnya dimatikan. Dengan urutan
 * ini, handler onend milik instans tersebut langsung gagal pada pemeriksaan
 * identitas dan tidak melakukan apa-apa, berapa pun lama Chrome menunda eventnya.
 */
function lepasInstansRecognition() {
  if (!recognition) return;
  const lama = recognition;
  recognition = null;
  try {
    lama.stop();
  } catch (e) {
    try { lama.abort(); } catch (err) {}
  }
}

/**
 * Memproses teks final untuk menghitung kata, kecepatan berbicara, dan kata pengisi.
 *
 * @param {string} potonganTeks - Potongan kalimat final yang baru saja diterima
 */
function prosesPotonganFinal(potonganTeks) {
  const teksBersih = potonganTeks.toLowerCase().trim();
  if (!teksBersih) return;

  const waktuSekarang = Date.now();
  const daftarKata = teksBersih.split(/\s+/).filter(Boolean);

  // Catat kata untuk perhitungan WPM
  for (const k of daftarKata) {
    kataPerWaktu.push({ timestamp: waktuSekarang, kata: k });
  }

  // Deteksi kata pengisi (filler words)
  let adaPenambahanFiller = false;
  for (const filler of DAFTAR_FILLER_DEFAULT) {
    // Gunakan regex batas kata sederhana untuk mencocokkan frasa filler
    const regex = new RegExp(`\\b${filler}\\b`, 'gi');
    const cocok = teksBersih.match(regex);
    if (cocok && cocok.length > 0) {
      const jumlah = cocok.length;
      rincianFiller[filler] = (rincianFiller[filler] || 0) + jumlah;
      totalFiller += jumlah;
      adaPenambahanFiller = true;
    }
  }

  if (adaPenambahanFiller && typeof eventCallbacks.onFillerUpdate === 'function') {
    eventCallbacks.onFillerUpdate(totalFiller, rincianFiller);
  }

  // Hitung WPM rata-rata bergulir 30 detik terakhir
  hitungWpmBergulir();
}

/**
 * Menghitung kecepatan berbicara bergulir dalam rentang 30 detik terakhir.
 */
function hitungWpmBergulir() {
  const sekarang = Date.now();
  const jendelaMulai = sekarang - 30000; // 30 detik ke belakang

  const kataDalamJendela = kataPerWaktu.filter(item => item.timestamp >= jendelaMulai);
  // (jumlah kata dalam 30 detik) * 2 = perkiraan WPM
  const perkiraanWpm = kataDalamJendela.length * 2;

  if (typeof eventCallbacks.onWpmUpdate === 'function') {
    eventCallbacks.onWpmUpdate(perkiraanWpm);
  }
}

/**
 * Mengambil ringkasan hasil analisis ucapan untuk rapor.
 *
 * @param {number} durasiDetik - Durasi latihan dalam detik
 * @returns {Object} Data metrik suara lengkap
 */
export function getResults(durasiDetik = 1) {
  const totalSemuaKata = kataPerWaktu.length;
  const durasiMenit = Math.max(durasiDetik / 60, 0.1);
  const wpmRataRata = Math.round(totalSemuaKata / durasiMenit);

  return {
    totalKata: totalSemuaKata,
    wpmRata: wpmRataRata,
    filler: {
      total: totalFiller,
      rincian: { ...rincianFiller }
    },
    transkripRingkas: transkripFinalGabungan.trim()
  };
}
