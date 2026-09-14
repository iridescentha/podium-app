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
 * 4. Mendeteksi kata pengisi berupa KATA ASLI seperti "kayak", "gitu", "anu".
 *    Bunyi ragu non-leksikal ("eee", "emm") berada di luar jangkauan modul ini
 *    karena pengenal suara Chrome membuangnya sebelum teks sampai ke aplikasi.
 *    Deteksi akustiknya dibatalkan; lihat keputusan desain di kepala js/audio.js.
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
let kataPerWaktu = []; // [{ detikSesi, kata }] untuk perhitungan WPM
let rincianFiller = {}; // { 'eee': 4, 'anu': 2, ... }
let totalFiller = 0;

// ----------------------------------------------------------------------------
// JAM SESI: waktu berjalan yang MENGABAIKAN durasi jeda.
//
// Kenapa tidak memakai jam dinding: kalau pengguna menjeda sesi lima menit lalu
// melanjutkan, jam dinding menganggap lima menit itu waktu bicara dan seluruh
// hitungan kecepatan bicara jadi kacau. Jam ini hanya berjalan saat status
// bernilai 'berjalan', sehingga cap waktu tiap kata selalu berarti "detik ke
// sekian sejak sesi dimulai, tanpa menghitung jeda".
// ----------------------------------------------------------------------------
let waktuMulaiSegmen = null;   // Kapan segmen berjalan saat ini dimulai (jam dinding)
let detikSegmenSelesai = 0;    // Total detik dari segmen-segmen sebelum jeda terakhir

/**
 * Mengembalikan posisi waktu sekarang dalam detik sejak sesi dimulai,
 * tidak termasuk waktu yang dihabiskan dalam kondisi terjeda.
 */
function detikSesiSekarang() {
  const segmenBerjalan = (waktuMulaiSegmen !== null)
    ? (Date.now() - waktuMulaiSegmen) / 1000
    : 0;
  return detikSegmenSelesai + segmenBerjalan;
}

/**
 * Menutup segmen waktu yang sedang berjalan dan memindahkan durasinya ke
 * akumulator. Dipanggil saat pause() dan stop() supaya jam berhenti bertambah.
 */
function tutupSegmenWaktu() {
  if (waktuMulaiSegmen === null) return;
  detikSegmenSelesai += (Date.now() - waktuMulaiSegmen) / 1000;
  waktuMulaiSegmen = null;
}

// Daftar kata pengisi bawaan, dipakai hanya bila app.js tidak mengoper
// CONFIG.FILLER_WORDS saat start(). Isinya harus tetap sama dengan CONFIG.
//
// Hanya kata asli yang didaftarkan di sini. Bunyi ragu seperti "eee" dan "emm"
// terbukti tidak pernah muncul di transkrip id-ID (uji 12 September 2026), jadi
// mencarinya di sini hanya menghasilkan nol selamanya. Deteksi akustiknya
// dibatalkan di Tahap 3; jeda hening panjang di js/audio.js menjadi penggantinya.
const DAFTAR_FILLER_DEFAULT = [
  "anu", "apa ya", "apa namanya",
  "gitu", "kayak", "jadi jadi", "terus terus", "oke oke"
];

// Ambang bawaan, dipakai hanya jika CONFIG tidak dioper dari app.js.
const KONFIG_BAWAAN = {
  FILLER_WORDS: DAFTAR_FILLER_DEFAULT,
  FILLER_PREFIX_MIN: 4,
  WPM_BUCKET_DETIK: 30,
  WPM_BUCKET_MIN_DETIK: 10
};

// Salinan CONFIG yang sedang berlaku untuk sesi ini.
let konfig = { ...KONFIG_BAWAAN };

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
 * @param {Object} config - Objek CONFIG dari app.js (ambang dan daftar kata pengisi)
 * @returns {boolean} True jika pengenalan berhasil dijalankan
 */
export function start(callbacks = {}, config = {}) {
  if (!isSupported()) {
    console.error('Web Speech API tidak didukung di browser ini.');
    if (typeof callbacks.onError === 'function') {
      callbacks.onError(new Error('Browser tidak mendukung Web Speech API.'));
    }
    return false;
  }

  eventCallbacks = { ...eventCallbacks, ...callbacks };

  // Ambang dan daftar kata pengisi selalu berasal dari CONFIG di app.js bila
  // dioper, supaya kalibrasi cukup dilakukan di satu tempat (Bagian 9 brief).
  konfig = { ...KONFIG_BAWAAN, ...config };
  if (!Array.isArray(konfig.FILLER_WORDS) || konfig.FILLER_WORDS.length === 0) {
    konfig.FILLER_WORDS = DAFTAR_FILLER_DEFAULT;
  }

  // Reset data sesi (hanya di sini, tidak pernah di resume)
  transkripFinalGabungan = '';
  transkripInterimTerbaru = '';
  kataPerWaktu = [];
  rincianFiller = {};
  totalFiller = 0;

  // Jam sesi dimulai dari nol
  detikSegmenSelesai = 0;
  waktuMulaiSegmen = Date.now();

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
  tutupSegmenWaktu();
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
  waktuMulaiSegmen = Date.now(); // jam sesi berjalan lagi dari titik terakhir
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
  tutupSegmenWaktu();
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

  // Semua kata dalam satu potongan final diberi cap waktu yang sama, yaitu saat
  // potongan itu difinalkan. Ini perkiraan, bukan waktu ucap sebenarnya, karena
  // Chrome memfinalkan kalimat beberapa saat setelah kalimatnya selesai diucapkan.
  const detikSesi = detikSesiSekarang();
  const daftarKata = teksBersih.split(/\s+/).filter(Boolean);

  // Catat kata untuk perhitungan WPM
  for (const k of daftarKata) {
    kataPerWaktu.push({ detikSesi, kata: k });
  }

  // Deteksi kata pengisi
  const adaPenambahanFiller = hitungKataPengisi(teksBersih);

  if (adaPenambahanFiller && typeof eventCallbacks.onFillerUpdate === 'function') {
    eventCallbacks.onFillerUpdate(totalFiller, rincianFiller);
  }

  // Hitung WPM rata-rata bergulir 30 detik terakhir
  hitungWpmBergulir();
}

/**
 * Menghitung kata pengisi di dalam satu potongan transkrip final.
 *
 * CARA KERJA — dua fase, karena daftar kata pengisi berisi dua jenis entri.
 *
 * FASE 1, entri berupa frasa seperti "apa ya" dan "jadi jadi".
 * Dicocokkan sebagai frasa utuh dengan batas kata di kedua ujungnya. Batas
 * penutup itu penting: tanpa dia, "apa ya" akan ikut mencocoki "apa yang" yang
 * sangat lazim dalam kalimat biasa. Potongan teks yang sudah cocok dibuang dari
 * teks kerja supaya kata-katanya tidak dihitung ulang di fase dua.
 *
 * FASE 2, entri berupa satu kata seperti "kayak", "gitu", dan "anu".
 * Dicocokkan dengan PENCOCOKAN AWALAN, bukan kesamaan persis. Alasannya
 * afiksasi Bahasa Indonesia: "kayaknya", "gitulah", dan "anunya" adalah kata
 * pengisi yang sama dengan bentuk dasarnya, dan mendaftarkan tiap variasinya
 * satu per satu akan membuat daftar membengkak tanpa pernah lengkap.
 *
 * Dua pengaman melekat pada fase dua:
 * 1. Entri yang lebih pendek dari CONFIG.FILLER_PREFIX_MIN hanya dicocokkan
 *    persis. Entri pendek yang dibiarkan mencocok awalan akan menyeret kata
 *    yang tidak ada hubungannya, misalnya "anu" menarik "anugerah".
 * 2. Satu kata terucap dihitung PALING BANYAK SEKALI, diatribusikan ke entri
 *    terpanjang yang cocok. Ini mencegah satu kata menambah dua hitungan saat
 *    ada dua entri yang sama-sama menjadi awalannya.
 *
 * Rincian di rapor selalu dicatat memakai bentuk dasarnya, bukan bentuk yang
 * terucap, supaya daftarnya tetap pendek dan terbaca.
 *
 * @param {string} teksBersih - Potongan transkrip final yang sudah huruf kecil
 * @returns {boolean} True bila ada kata pengisi baru yang terhitung
 */
function hitungKataPengisi(teksBersih) {
  const minAwalan = konfig.FILLER_PREFIX_MIN;
  const semua = konfig.FILLER_WORDS.map(f => String(f).trim().toLowerCase()).filter(Boolean);
  const daftarFrasa = semua.filter(f => /\s/.test(f));
  const daftarTunggal = semua.filter(f => !/\s/.test(f));

  let adaPenambahan = false;
  let sisaTeks = teksBersih;

  // --- Fase 1: frasa ---
  for (const frasa of daftarFrasa) {
    const pola = frasa.split(/\s+/).map(amankanRegex).join('\\s+');
    const regex = new RegExp(`\\b${pola}\\b`, 'gi');

    let jumlah = 0;
    sisaTeks = sisaTeks.replace(regex, () => { jumlah++; return ' '; });

    if (jumlah > 0) {
      rincianFiller[frasa] = (rincianFiller[frasa] || 0) + jumlah;
      totalFiller += jumlah;
      adaPenambahan = true;
    }
  }

  // --- Fase 2: kata tunggal dengan pencocokan awalan ---
  const tokenSisa = sisaTeks
    .split(/\s+/)
    .map(t => t.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ''))
    .filter(Boolean);

  for (const kata of tokenSisa) {
    let entriTerpilih = null;

    for (const entri of daftarTunggal) {
      const cocok = (entri.length >= minAwalan)
        ? kata.startsWith(entri)
        : kata === entri;

      if (cocok && (entriTerpilih === null || entri.length > entriTerpilih.length)) {
        entriTerpilih = entri;
      }
    }

    if (entriTerpilih) {
      rincianFiller[entriTerpilih] = (rincianFiller[entriTerpilih] || 0) + 1;
      totalFiller += 1;
      adaPenambahan = true;
    }
  }

  return adaPenambahan;
}

/**
 * Melindungi karakter khusus regex di dalam kata pengisi.
 *
 * CARA KERJA:
 * Daftar kata pengisi dimaksudkan untuk disunting tangan saat kalibrasi. Bila
 * seseorang menambahkan tanda kurung atau tanda tanya, string itu akan ditafsirkan
 * sebagai pola regex dan bisa melempar galat yang mematikan seluruh penghitungan.
 * Fungsi ini menyisipkan garis miring terbalik di depan setiap karakter berbahaya
 * sehingga kata tersebut dicocokkan apa adanya.
 */
function amankanRegex(teks) {
  return String(teks).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Menghitung kecepatan berbicara bergulir dalam jendela 30 detik terakhir.
 *
 * CARA KERJA:
 * Jendela diukur memakai jam sesi, bukan jam dinding, sehingga waktu yang
 * dihabiskan dalam kondisi terjeda tidak pernah ikut mengencerkan hitungan.
 * Jumlah kata dalam jendela dikonversi ke satuan per menit.
 */
function hitungWpmBergulir() {
  const panjangJendela = konfig.WPM_BUCKET_DETIK;
  const batasBawah = detikSesiSekarang() - panjangJendela;

  const kataDalamJendela = kataPerWaktu.filter(item => item.detikSesi >= batasBawah);
  const perkiraanWpm = Math.round(kataDalamJendela.length * (60 / panjangJendela));

  if (typeof eventCallbacks.onWpmUpdate === 'function') {
    eventCallbacks.onWpmUpdate(perkiraanWpm);
  }
}

/**
 * Menyusun deret kecepatan bicara per potongan waktu sepanjang sesi.
 *
 * CARA KERJA:
 * 1. Sesi dibagi menjadi potongan-potongan selebar CONFIG.WPM_BUCKET_DETIK,
 *    dihitung dari jam sesi sehingga jeda tidak pernah menciptakan potongan kosong.
 * 2. Setiap kata dimasukkan ke potongan sesuai cap waktunya.
 * 3. Jumlah kata tiap potongan dikonversi ke satuan per menit memakai DURASI
 *    NYATA potongan itu, bukan selalu 30 detik. Ini penting untuk potongan
 *    terakhir yang hampir selalu terpotong di tengah: mengalikannya seolah-olah
 *    berdurasi penuh akan membuat titik terakhir grafik anjlok tanpa sebab.
 * 4. Potongan terakhir yang lebih pendek dari CONFIG.WPM_BUCKET_MIN_DETIK dibuang,
 *    karena beberapa detik terakhir terlalu sedikit datanya untuk bermakna.
 *
 * @param {number} totalDetik - Durasi sesi yang dipakai sebagai batas akhir
 * @returns {Array<{detikMulai: number, detikSelesai: number, wpm: number}>}
 */
function hitungDeretWpm(totalDetik) {
  const lebar = konfig.WPM_BUCKET_DETIK;
  const minimal = konfig.WPM_BUCKET_MIN_DETIK;
  const durasi = Math.max(totalDetik, 0);
  if (durasi <= 0) return [];

  const jumlahPotongan = Math.ceil(durasi / lebar);
  const deret = [];

  for (let i = 0; i < jumlahPotongan; i++) {
    const mulai = i * lebar;
    const selesai = Math.min((i + 1) * lebar, durasi);
    const lebarNyata = selesai - mulai;

    // Buang ekor yang terlalu pendek untuk dibaca sebagai satu titik grafik
    if (lebarNyata < minimal && i > 0) continue;
    if (lebarNyata <= 0) continue;

    // Potongan terakhir tidak diberi batas atas, supaya kata yang cap waktunya
    // sedikit melewati durasi sesi (selisih pembulatan timer) tetap terhitung.
    const batasAtas = (selesai >= durasi) ? Infinity : selesai;
    const jumlahKata = kataPerWaktu.filter(
      item => item.detikSesi >= mulai && item.detikSesi < batasAtas
    ).length;

    deret.push({
      detikMulai: Math.round(mulai),
      detikSelesai: Math.round(selesai),
      wpm: Math.round(jumlahKata * (60 / lebarNyata))
    });
  }

  return deret;
}

/**
 * Mengambil ringkasan hasil analisis ucapan untuk rapor.
 *
 * CARA KERJA:
 * 1. Kecepatan rata-rata dihitung dari seluruh kata dibagi durasi sesi.
 * 2. Deret kecepatan per potongan waktu disusun DI SINI, di dalam modul yang
 *    memegang cap waktu tiap kata. report.js tidak boleh menyusunnya sendiri
 *    dari satu angka rata-rata, karena hasilnya cuma garis datar palsu.
 * 3. Durasi yang dipakai diambil dari timer sesi bila dioper app.js; bila tidak,
 *    modul memakai jam sesinya sendiri yang juga sudah mengabaikan jeda.
 *
 * @param {number} durasiDetik - Durasi latihan dalam detik dari timer sesi
 * @returns {Object} Data metrik suara lengkap
 */
export function getResults(durasiDetik = null) {
  const durasi = (typeof durasiDetik === 'number' && durasiDetik > 0)
    ? durasiDetik
    : detikSesiSekarang();

  const totalSemuaKata = kataPerWaktu.length;
  const durasiMenit = Math.max(durasi / 60, 0.1);
  const wpmRataRata = Math.round(totalSemuaKata / durasiMenit);
  const deret = hitungDeretWpm(durasi);

  return {
    totalKata: totalSemuaKata,
    wpmRata: wpmRataRata,
    durasiBicaraDetik: Math.round(durasi),
    // Deret lengkap untuk grafik Tahap 4, plus bentuk ringkas berupa angka saja
    // supaya skema penyimpanan Bagian 6.3 tetap berisi wpmSeri: [120, 131, 140]
    deretWpm: deret,
    wpmSeri: deret.map(d => d.wpm),
    filler: {
      total: totalFiller,
      rincian: { ...rincianFiller }
    },
    transkripRingkas: transkripFinalGabungan.trim()
  };
}
