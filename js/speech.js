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
 * Modul ini mengekspor antarmuka standar:
 * - isSupported(): Memeriksa ketersediaan webkitSpeechRecognition di browser.
 * - start(callbacks): Memulai recognition stream.
 * - stop(): Menghentikan recognition dan mematikan auto-restart.
 * - getResults(): Mengembalikan agregat data kata, WPM, dan rincian kata pengisi.
 * ============================================================================
 */

// Pemeriksaan dukungan Web Speech API
const SpeechRecognitionClass = window.webkitSpeechRecognition || window.SpeechRecognition;

// Objek recognition aktif
let recognition = null;

// Status internal
let sesiBerjalan = false;
let sengajaBerhenti = false;

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
 * Menginisialisasi dan memulai pengenalan suara.
 * 
 * CARA KERJA:
 * 1. Membuat instans baru dari `webkitSpeechRecognition`.
 * 2. Mengatur konfigurasi:
 *    - `continuous = true`: Pengenalan tidak berhenti setelah satu kalimat selesai.
 *    - `interimResults = true`: Memberikan hasil praduga sebelum kalimat difinalisasi.
 *    - `lang = 'id-ID'`: Mengarahkan model bahasa ke Bahasa Indonesia.
 * 3. Mendaftarkan event listener penting:
 *    - `onresult`: Memproses potongan kata interim dan final.
 *    - `onerror`: Menangkap galat jaringan atau perizinan.
 *    - `onend`: Mengimplementasikan auto-restart otomatis jika sesi masih aktif
 *      (mengatasi kebiasaan Chrome yang memutus recognition di sesi panjang).
 * 
 * @param {Object} callbacks - Kumpulan fungsi callback untuk memproses data suara
 * @param {Object} opsi - Opsi tambahan (misal daftar kata pengisi khusus)
 */
export function start(callbacks = {}, opsi = {}) {
  if (!isSupported()) {
    console.error('Web Speech API tidak didukung di browser ini.');
    if (typeof callbacks.onError === 'function') {
      callbacks.onError(new Error('Browser tidak mendukung Web Speech API.'));
    }
    return false;
  }

  eventCallbacks = { ...eventCallbacks, ...callbacks };
  sesiBerjalan = true;
  sengajaBerhenti = false;

  // Reset data sesi
  transkripFinalGabungan = '';
  transkripInterimTerbaru = '';
  kataPerWaktu = [];
  rincianFiller = {};
  totalFiller = 0;

  inisialisasiRecognition();
  return true;
}

/**
 * Fungsi internal pembuat instans recognition.
 */
function inisialisasiRecognition() {
  try {
    if (recognition) {
      try { recognition.abort(); } catch (e) {}
    }

    recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'id-ID';

    // ------------------------------------------------------------------------
    // Event: onresult
    // ------------------------------------------------------------------------
    recognition.onresult = (event) => {
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
    recognition.onerror = (event) => {
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
    recognition.onend = () => {
      // Jika sesi masih berjalan dan bukan sengaja dimatikan oleh tombol jeda/selesai,
      // hidupkan kembali secara instan agar pengguna tidak merasakan jeda.
      if (sesiBerjalan && !sengajaBerhenti) {
        try {
          recognition.start();
          if (typeof eventCallbacks.onStatusChange === 'function') {
            eventCallbacks.onStatusChange('restarted');
          }
        } catch (e) {
          // Bila restart instan gagal, coba lagi dalam jeda waktu singkat 100ms
          setTimeout(() => {
            if (sesiBerjalan && !sengajaBerhenti) {
              try { recognition.start(); } catch (err) {}
            }
          }, 100);
        }
      } else {
        if (typeof eventCallbacks.onStatusChange === 'function') {
          eventCallbacks.onStatusChange('stopped');
        }
      }
    };

    recognition.start();
    if (typeof eventCallbacks.onStatusChange === 'function') {
      eventCallbacks.onStatusChange('active');
    }
  } catch (err) {
    console.error('Gagal menjalankan recognition.start():', err);
    if (typeof eventCallbacks.onError === 'function') {
      eventCallbacks.onError(err);
    }
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
 * Menghentikan pengenalan suara secara sengaja.
 * 
 * CARA KERJA:
 * 1. Mengubah flag `sesiBerjalan` menjadi false dan `sengajaBerhenti` menjadi true
 *    agar handler `onend` tidak melakukan auto-restart.
 * 2. Memanggil `recognition.stop()`.
 */
export function stop() {
  sesiBerjalan = false;
  sengajaBerhenti = true;
  if (recognition) {
    try {
      recognition.stop();
    } catch (e) {
      try { recognition.abort(); } catch (err) {}
    }
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
