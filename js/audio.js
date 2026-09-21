/**
 * ============================================================================
 * MODUL ANALISIS SINYAL AUDIO - PODIUM
 * ============================================================================
 * File: js/audio.js
 * Deskripsi:
 * Menggunakan Web Audio API bawaan peramban (AudioContext + AnalyserNode) untuk:
 * 1. Menghitung energi suara real-time (RMS - Root Mean Square) untuk indikator
 *    meter volume mikrofon di Layar Persiapan.
 * 2. Mengukur suara ruangan (noise floor) sebelum sesi, lalu menurunkan
 *    AMBANG BICARA yang menyesuaikan diri dengan mikrofon dan ruangan pengguna.
 * 3. Mendeteksi jeda hening panjang di tengah presentasi, lengkap dengan cap
 *    waktunya (event untuk timeline Tahap 4B).
 * 4. Menilai volume rata-rata saat berbicara (label: pelan / ideal).
 *
 * Modul ini mengikuti KONTRAK SIKLUS HIDUP yang didokumentasikan lengkap di
 * kepala js/speech.js: start / pause / resume / stop / getResults, dengan aturan
 * mutlak bahwa hanya start() yang boleh mengosongkan akumulator.
 *
 * - initAudio(stream): Menghubungkan aliran mikrofon ke AnalyserNode.
 * - ukurNoiseFloor(config): Mengukur suara ruangan dan menetapkan ambang bicara.
 * - start(callbacks, config): Mengosongkan akumulator lalu memulai loop pemantauan.
 * - pause(): Menghentikan sampling sementara tanpa membuang akumulator.
 * - resume(): Melanjutkan sampling dari akumulator yang sama.
 * - stop(): Menghentikan pemantauan (node audio dilepas terpisah via cleanupAudio).
 * - getResults(config): Mengembalikan agregat jeda dan volume untuk rapor.
 *
 * ----------------------------------------------------------------------------
 * KEPUTUSAN DESAIN: DETEKSI BUNYI RAGU ("eee", "emm") DIBATALKAN
 * (dicatat 14 September 2026, Tahap 3)
 * ----------------------------------------------------------------------------
 * - Web Speech API id-ID tidak mentranskripsikan bunyi ragu. Terbukti dua kali:
 *   di Safari 12 September 2026 (commit 5417122, 0 dari 10 percobaan), lalu di
 *   Chrome 17 September 2026 (0 dari 10 bunyi berdiri sendiri, 0 dari 2 di dalam
 *   kalimat, pada transkrip final). Ini perilaku sengaja pada pengenal suara
 *   komersial, bukan bug.
 * - Deteksi akustik langsung (kestabilan nada dasar F0 + kestabilan spektrum,
 *   metode Goto dkk. 1999) secara teknis mungkin, tetapi butuh kalibrasi per
 *   pengguna dan per ruangan, dengan risiko nyata gagal mencapai akurasi layak.
 *   Biaya waktunya tidak sepadan dengan sisa tenggat lomba.
 * - Sebagai gantinya, JEDA HENING PANJANG dipakai sebagai indikator hesitasi.
 *   Lebih murah, lebih andal, dan tetap bermakna: berhenti lama di tengah
 *   presentasi adalah gejala yang sama dengan mengisi jeda pakai "eee".
 * - Kata pengisi berupa kata asli ("kayak", "gitu", "anu") tetap dihitung dari
 *   transkrip di js/speech.js.
 *
 * ----------------------------------------------------------------------------
 * KEPUTUSAN DESAIN: VOLUME DINILAI SECARA RELATIF (20 September 2026)
 * ----------------------------------------------------------------------------
 * Versi pertama menilai volume dari angka RMS mutlak lewat ambangVolumePelan.
 * Itu tidak bisa dipindahkan antar perangkat: suara yang sama menghasilkan RMS
 * yang jauh berbeda tergantung penguatan mikrofon, jarak duduk, dan setelan
 * sistem, sehingga satu angka yang benar di satu laptop akan salah di laptop
 * lain. Padahal modul ini sudah punya jawabannya untuk ambang bicara, yaitu
 * mengukur suara ruangan lebih dulu lalu menyatakan segalanya sebagai kelipatan
 * dari situ.
 *
 * Label volume kini memakai pola yang sama: rasio = volumeRataRms dibagi
 * noiseFloorRms, dibandingkan dengan CONFIG.audio.pengaliVolumePelan. Dengan
 * begitu seluruh ambang di modul ini diturunkan dari SATU pengukuran yang sama.
 *
 * HASIL UJI KALIBRASI PERTAMA, 21 September 2026 (Chrome, autoGainControl
 * MENYALA): metriknya GAGAL memisahkan ketiga kondisi.
 *   bicara normal        : rasio 3,79x  (suara ruangan 0,0101)
 *   hampir berbisik      : rasio 2,85x  (suara ruangan 0,0160)
 *   normal, dua kali jauh: rasio 3,00x  (suara ruangan 0,0132)
 * Berbisik dan duduk jauh nyaris tidak terbedakan, dan suara ruangan hasil
 * kalibrasi sendiri bergeser 58% antar sesi di ruangan yang sama.
 *
 * Penyebabnya kendali penguatan otomatis: ia menguatkan masukan yang pelan dan
 * menahan yang keras, sehingga meratakan justru perbedaan yang ingin diukur,
 * sekaligus membuat penyebut rasio ikut bergerak. Karena itu autoGainControl
 * dimatikan lewat CONFIG.audio.autoGainControl dan kalibrasinya diulang.
 *
 * HASIL UJI KEDUA, 21 September 2026 (autoGainControl DIMATIKAN): suara ruangan
 * jadi stabil (0,0033 / 0,0022 / 0,0022, dari sebelumnya bergeser 58%), tetapi
 * rasionya justru makin rapat:
 *   bicara normal        : rasio 4,13x  (RMS bicara 0,0136)
 *   hampir berbisik      : rasio 3,91x  (RMS bicara 0,0088)
 *   normal, dua kali jauh: rasio 3,86x  (RMS bicara 0,0084)
 *
 * KEPUTUSAN: METRIK VOLUME DIHENTIKAN. Dua sebab, keduanya mendasar:
 *
 * 1. Rasio ini menormalkan dirinya sendiri. Rata-ratanya diambil dari frame yang
 *    BERADA DI ATAS ambang bicara, sedangkan ambang itu sendiri 2,5x suara
 *    ruangan. Berbisik menghasilkan lebih sedikit frame di atas garis, tetapi
 *    frame yang lolos tetap sekitar 4x suara ruangan. Rancangannya membuang
 *    persis perbedaan yang ingin diukurnya.
 * 2. Bahkan pada angka RMS mentah, berbisik (0,0088) dan duduk dua kali lebih
 *    jauh (0,0084) tidak terbedakan. Ini fisika, bukan cacat kode: memelankan
 *    suara dan menjauh menurunkan tingkat mikrofon dengan cara yang sama.
 *    Memisahkan keduanya butuh pengukuran jarak, yang tidak ada di sini.
 *
 * Karena itu pengaliVolumePelan dibiarkan null SELAMANYA, dan kartu volume di
 * rapor berbunyi "tidak dinilai" beserta alasannya. RMS mentah, suara ruangan,
 * dan rasionya tetap dihitung dan dilaporkan getResults() — angkanya sah sebagai
 * bahan mentah, yang tidak sah adalah melabelinya "pelan" atau "ideal".
 *
 * autoGainControl tetap dimatikan: ia tidak menyelamatkan metrik ini, tetapi
 * membuat suara ruangan hasil kalibrasi jauh lebih stabil, dan itu menguntungkan
 * deteksi jeda yang memang bergantung padanya.
 *
 * ----------------------------------------------------------------------------
 * KEPUTUSAN DESAIN: APA YANG DIHITUNG SEBAGAI "JEDA PANJANG"
 * ----------------------------------------------------------------------------
 * Jeda panjang = hening yang DIAPIT SUARA BICARA di kedua sisinya, di dalam satu
 * rentang sesi yang berjalan. Akibatnya tiga jenis hening sengaja tidak dihitung:
 * 1. Hening di awal sesi sebelum pengguna mulai bicara (sedang bersiap).
 * 2. Hening di akhir sesi, termasuk waktu membaca dialog konfirmasi "Selesai".
 *    Tanpa aturan ini, hampir setiap sesi akan ditutup dengan satu jeda palsu.
 * 3. Hening yang terpotong tombol Jeda, karena itu istirahat yang disengaja.
 * Yang ingin diukur adalah hesitasi DI TENGAH presentasi, bukan waktu persiapan.
 *
 * Satu lonjakan pendek di tengah hening (ketukan meja, klik mouse, napas keras)
 * tidak dianggap bicara. Suara baru diakui sebagai bicara setelah bertahan di
 * atas ambang minimal CONFIG.audio.minDurasiSuaraMs. Tanpa penyaring ini, satu
 * ketukan bisa memecah hening 5 detik menjadi dua hening 2,5 detik yang
 * masing-masing lolos dari hitungan.
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

// Ambang bicara hasil pengukuran suara ruangan. null berarti belum diukur atau
// pengukurannya gagal; selama null, jeda dan volume TIDAK dilaporkan.
let ambangBicara = null;
let noiseFloorRms = null;

// Metrik akumulasi selama sesi.
// Volume rata-rata hanya dijumlahkan dari frame BICARA (RMS di atas ambang).
// Frame hening dikeluarkan dari pembagi, supaya pengguna yang bersuara normal
// tetapi sering berhenti tidak dilabeli "pelan".
let totalRmsAkumulasi = 0;
let jumlahSampleRms = 0;
let jedaDaftar = [];            // [{ mulaiDetik, durasiDetik }], event jarang untuk timeline
let terlamaJedaDetik = 0;

// Mesin status deteksi jeda (lihat prosesSampelJeda)
let sudahBicara = false;        // Sudah ada suara bicara sejak rentang berjalan ini dimulai
let heningMulaiDetik = null;    // Kapan hening yang sedang berlangsung dimulai
let suaraMulaiDetik = null;     // Kapan deretan suara di atas ambang yang sedang berlangsung dimulai

// Konfigurasi aktif. Nilai bawaan hanya jaring pengaman; nilai sebenarnya
// selalu dari CONFIG.audio di app.js.
const KONFIG_BAWAAN = {
  pengaliAmbangBicara: 2.5,
  ambangBicaraMaks: 0.08,
  durasiJedaPanjangMs: 3000,
  minDurasiSuaraMs: 200,
  durasiUkurNoiseMs: 2000,
  pengaliVolumePelan: null,
  debug: false
};
let konfig = { ...KONFIG_BAWAAN };

// Penanda log debug per detik
let detikDebugTerakhir = -1;
let debugRmsMaks = 0;
let debugSampel = 0;
let debugSampelBicara = 0;

// Callbacks yang didaftarkan saat start()
let eventCallbacks = {
  onVolumeTick: null     // Callback real-time setiap frame (mengirim nilai RMS 0-1)
};

// ----------------------------------------------------------------------------
// JAM SESI: berjalan hanya saat status 'berjalan', sehingga cap waktu jeda
// berarti "detik ke sekian sejak sesi dimulai, tanpa menghitung waktu terjeda".
// Pola yang sama dipakai di js/speech.js dan js/face.js, supaya ketiga modul
// menaruh event mereka di sumbu waktu yang sama pada timeline.
// ----------------------------------------------------------------------------
let waktuMulaiSegmenJam = null;
let detikSegmenSelesai = 0;

function detikSesiSekarang() {
  const berjalan = (waktuMulaiSegmenJam !== null)
    ? (Date.now() - waktuMulaiSegmenJam) / 1000
    : 0;
  return detikSegmenSelesai + berjalan;
}

function tutupSegmenJam() {
  if (waktuMulaiSegmenJam === null) return;
  detikSegmenSelesai += (Date.now() - waktuMulaiSegmenJam) / 1000;
  waktuMulaiSegmenJam = null;
}

/**
 * Menggabungkan CONFIG dari app.js dengan nilai bawaan.
 * Menerima objek CONFIG utuh (lalu mengambil bagian `audio`-nya) atau langsung
 * objek CONFIG.audio.
 */
function gabungKonfig(config) {
  const bagianAudio = (config && config.audio) ? config.audio : (config || {});
  return { ...KONFIG_BAWAAN, ...bagianAudio };
}

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
 * Mengukur suara ruangan (noise floor) dan menetapkan ambang bicara.
 *
 * CARA KERJA:
 * 1. Selama CONFIG.audio.durasiUkurNoiseMs (awal 2 detik), RMS dibaca tiap 50 ms
 *    sementara pengguna diminta tidak bicara. Hasilnya sekitar 40 sampel energi
 *    ruangan: dengung kipas laptop, AC, lalu lintas di luar.
 * 2. Noise floor diambil dari MEDIAN sampel, bukan rata-rata. Median kebal
 *    terhadap satu-dua lonjakan singkat (klik mouse, batuk kecil) yang akan
 *    menarik rata-rata ke atas dan membuat ambang terlalu tinggi.
 * 3. ambangBicara = noiseFloor × CONFIG.audio.pengaliAmbangBicara (awal 2.5).
 *    Ambang relatif ini yang membuat deteksi jeda tetap bekerja di ruangan
 *    berisik maupun sunyi, dan pada mikrofon dengan penguatan berbeda-beda.
 *    Konstanta absolut tidak bisa: gain mikrofon antar laptop berbeda jauh.
 * 4. Bila pengukuran gagal, ambang dibiarkan null dan modul melaporkan diri
 *    tidak tersedia alih-alih menebak. Empat sebab kegagalan:
 *    - 'mikrofon-tidak-siap': rantai Web Audio belum terbentuk.
 *    - 'tidak-ada-sampel'   : tidak satu pun pembacaan sempat terkumpul.
 *    - 'mikrofon-bisu'      : energi tepat nol, mikrofon kemungkinan dimatikan.
 *    - 'ruangan-berisik'    : ambang hasil hitungan melewati
 *      CONFIG.audio.ambangBicaraMaks, artinya suara ruangan setinggi suara
 *      bicara dan tidak ada acuan yang bisa dipercaya.
 *    Acuan TIDAK PERNAH disimpan sebagian: nilai lama sudah dibuang di awal.
 *
 * Nilai ambang lama selalu dibuang lebih dulu, supaya kegagalan pengukuran
 * ulang tidak diam-diam memakai ambang dari mikrofon atau ruangan sebelumnya.
 *
 * @param {Object} config - Objek CONFIG dari app.js
 * @returns {Promise<{berhasil: boolean, noiseFloorRms: number|null, ambangBicara: number|null}>}
 */
export function ukurNoiseFloor(config = {}) {
  const k = gabungKonfig(config);
  ambangBicara = null;
  noiseFloorRms = null;

  return new Promise((selesai) => {
    if (!analyserNode) {
      selesai({ berhasil: false, alasan: 'mikrofon-tidak-siap', noiseFloorRms: null, ambangBicara: null });
      return;
    }

    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }

    const sampel = [];
    const idInterval = setInterval(() => sampel.push(hitungRMS()), 50);

    setTimeout(() => {
      clearInterval(idInterval);

      if (sampel.length === 0) {
        selesai({ berhasil: false, alasan: 'tidak-ada-sampel', noiseFloorRms: null, ambangBicara: null });
        return;
      }

      const urut = sampel.slice().sort((a, b) => a - b);
      const tengah = Math.floor(urut.length / 2);
      const median = (urut.length % 2 === 0)
        ? (urut[tengah - 1] + urut[tengah]) / 2
        : urut[tengah];

      if (k.debug) {
        console.log(
          `[audio] noise floor: ${sampel.length} sampel, ` +
          `min=${urut[0].toFixed(4)} median=${median.toFixed(4)} maks=${urut[urut.length - 1].toFixed(4)}`
        );
      }

      if (!(median > 0)) {
        console.warn('[audio] Suara ruangan terukur nol. Mikrofon kemungkinan bisu; jeda tidak akan dilaporkan.');
        selesai({ berhasil: false, alasan: 'mikrofon-bisu', noiseFloorRms: null, ambangBicara: null });
        return;
      }

      // Ruangan terlalu berisik: ambang bicara yang diturunkan dari suara
      // ruangan sudah melewati batas yang masih masuk akal dicapai suara
      // manusia pada mikrofon laptop. Kalau ini dibiarkan, seluruh sesi akan
      // terbaca hening dan jeda palsu bermunculan. Lebih jujur menolak
      // menyimpan acuan daripada menyimpan acuan yang pasti salah.
      const calonAmbang = median * k.pengaliAmbangBicara;
      if (calonAmbang > k.ambangBicaraMaks) {
        console.warn(`[audio] Suara ruangan terlalu tinggi: ambang ${calonAmbang.toFixed(4)} melewati batas ${k.ambangBicaraMaks}.`);
        selesai({ berhasil: false, alasan: 'ruangan-berisik', noiseFloorRms: median, ambangBicara: null });
        return;
      }

      noiseFloorRms = median;
      ambangBicara = calonAmbang;

      if (k.debug) {
        console.log(`[audio] ambang bicara = ${median.toFixed(4)} × ${k.pengaliAmbangBicara} = ${ambangBicara.toFixed(4)}`);
      }

      selesai({ berhasil: true, noiseFloorRms, ambangBicara });
    }, k.durasiUkurNoiseMs);
  });
}

/**
 * Memulai loop analisis audio berkala (untuk Layar Persiapan maupun Layar Sesi).
 *
 * CARA KERJA:
 * 1. Mengosongkan seluruh akumulator: volume, daftar jeda, dan mesin status
 *    deteksi jeda. Sesuai kontrak di CLAUDE.md, hanya fungsi ini yang boleh.
 * 2. Menyalakan jam sesi dari nol.
 * 3. Menjalankan perulangan requestAnimationFrame yang tiap frame membaca RMS,
 *    mengirimnya ke visualizer, lalu memprosesnya untuk volume dan jeda.
 *
 * Ambang bicara TIDAK dikosongkan di sini. Ambang itu milik mikrofon dan
 * ruangan, diukur sekali di Layar Persiapan, bukan milik satu sesi.
 *
 * @param {Object} callbacks - Kumpulan fungsi callback untuk merespons event audio
 * @param {Object} config - Objek CONFIG dari app.js
 */
export function start(callbacks = {}, config = {}) {
  eventCallbacks = { ...eventCallbacks, ...callbacks };
  konfig = gabungKonfig(config);

  // Reset metrik akumulasi sesi. Hanya start() yang boleh melakukan ini.
  totalRmsAkumulasi = 0;
  jumlahSampleRms = 0;
  jedaDaftar = [];
  terlamaJedaDetik = 0;
  sudahBicara = false;
  heningMulaiDetik = null;
  suaraMulaiDetik = null;
  detikDebugTerakhir = -1;
  debugRmsMaks = 0;
  debugSampel = 0;
  debugSampelBicara = 0;

  detikSegmenSelesai = 0;
  waktuMulaiSegmenJam = Date.now();

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
 * 3. Setiap frame membaca RMS, mengirimkannya ke callback visualizer, lalu
 *    memprosesnya untuk akumulator volume dan deteksi jeda.
 * 4. Perulangan berhenti sendiri begitu status bukan lagi 'berjalan'.
 *
 * Keterbatasan yang diketahui: Chrome menghentikan requestAnimationFrame saat
 * tab tidak terlihat. Bila pengguna berpindah tab di tengah hening, sampling
 * berhenti dan hening itu bisa terukur lebih panjang dari aslinya. Durasi tetap
 * dihitung dari jam sesi, bukan jumlah frame, sehingga tidak ada galat lain.
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

    // Beritahu visualizer UI
    if (typeof eventCallbacks.onVolumeTick === 'function') {
      eventCallbacks.onVolumeTick(rms);
    }

    // Volume dan jeda hanya bisa dinilai bila ambang bicara sudah diukur
    if (ambangBicara !== null) {
      const detik = detikSesiSekarang();
      const bersuara = rms > ambangBicara;

      // Akumulasi volume: hanya frame bicara yang masuk pembagi
      if (bersuara) {
        totalRmsAkumulasi += rms;
        jumlahSampleRms++;
      }

      prosesSampelJeda(bersuara, detik);
      cetakDebugPerDetik(rms, bersuara, detik);
    }

    // Lanjutkan frame berikutnya
    animFrameId = requestAnimationFrame(loopPantauAudio);
  }

  loopPantauAudio();
}

/**
 * Mesin status deteksi jeda panjang, dijalankan sekali per frame audio.
 *
 * CARA KERJA:
 * Tiap frame sudah diputuskan "bersuara" (RMS di atas ambang bicara) atau tidak.
 *
 * Saat frame BERSUARA:
 *   - Catat kapan deretan suara ini dimulai (suaraMulaiDetik).
 *   - Deretan baru diakui sebagai bicara setelah bertahan minimal
 *     CONFIG.audio.minDurasiSuaraMs. Ketukan meja atau klik mouse berlangsung
 *     jauh lebih singkat dari itu, jadi tidak memutus hening.
 *   - Begitu bicara diakui dan ada hening yang sedang terbuka, hening itu
 *     ditutup. Titik akhirnya adalah AWAL deretan suara, bukan saat pengakuan,
 *     supaya penundaan penyaring tidak ikut memperpanjang durasi jeda.
 *
 * Saat frame HENING:
 *   - Deretan suara yang belum sempat diakui dibatalkan.
 *   - Bila pengguna sudah pernah bicara dan belum ada hening terbuka, hening
 *     baru dibuka di detik ini. Syarat "sudah pernah bicara" yang membuat hening
 *     di awal sesi tidak pernah dihitung.
 *
 * Hening yang masih terbuka ketika pause() atau stop() dipanggil dibuang,
 * karena belum diapit suara di sisi kanannya (lihat keputusan desain di kepala
 * berkas).
 *
 * @param {boolean} bersuara - Apakah RMS frame ini di atas ambang bicara
 * @param {number} detik - Posisi jam sesi saat frame ini dibaca
 */
function prosesSampelJeda(bersuara, detik) {
  if (bersuara) {
    if (suaraMulaiDetik === null) suaraMulaiDetik = detik;

    const lamaSuaraMs = (detik - suaraMulaiDetik) * 1000;
    if (lamaSuaraMs >= konfig.minDurasiSuaraMs) {
      if (heningMulaiDetik !== null) {
        catatJedaBilaPanjang(heningMulaiDetik, suaraMulaiDetik);
        heningMulaiDetik = null;
      }
      sudahBicara = true;
    }
  } else {
    suaraMulaiDetik = null;
    if (sudahBicara && heningMulaiDetik === null) {
      heningMulaiDetik = detik;
    }
  }
}

/**
 * Menyimpan satu hening sebagai jeda panjang bila durasinya melewati ambang.
 *
 * CARA KERJA:
 * Hening lebih dari CONFIG.audio.durasiJedaPanjangMs dimasukkan ke daftar event
 * { mulaiDetik, durasiDetik } dan durasi terlama diperbarui. Hening yang lebih
 * pendek adalah napas atau jeda kalimat yang wajar, jadi dibuang tanpa jejak.
 * Penyaringan inilah yang menjaga daftar tetap jarang, beberapa item per sesi.
 */
function catatJedaBilaPanjang(mulai, selesai) {
  const durasi = selesai - mulai;
  if (durasi * 1000 <= konfig.durasiJedaPanjangMs) return;

  const durasiBulat = Math.round(durasi * 10) / 10;
  jedaDaftar.push({ mulaiDetik: Math.round(mulai), durasiDetik: durasiBulat });
  if (durasiBulat > terlamaJedaDetik) terlamaJedaDetik = durasiBulat;

  if (konfig.debug) {
    console.log(`[audio] JEDA PANJANG #${jedaDaftar.length}: mulai detik ${mulai.toFixed(1)}, durasi ${durasi.toFixed(1)} s`);
  }
}

/**
 * Membuang hening yang masih terbuka tanpa mencatatnya, dan membatalkan deretan
 * suara yang belum diakui. Dipanggil saat pause() dan stop().
 */
function buangHeningTerbuka() {
  if (konfig.debug && heningMulaiDetik !== null) {
    const durasi = detikSesiSekarang() - heningMulaiDetik;
    console.log(`[audio] hening terbuka ${durasi.toFixed(1)} s dibuang (tidak diapit suara bicara)`);
  }
  heningMulaiDetik = null;
  suaraMulaiDetik = null;
}

/**
 * Mode debug untuk kalibrasi CONFIG.audio.
 *
 * CARA KERJA:
 * Sekali per detik jam sesi, mencetak RMS tertinggi dalam detik itu, porsi frame
 * yang terhitung bersuara, dan status hening. Dari log ini bisa dilihat apakah
 * ambang bicara terlalu tinggi (bicara terbaca hening) atau terlalu rendah
 * (hening terbaca bicara), sehingga pengali dan penyaring ditetapkan dari angka
 * nyata, bukan tebakan.
 */
function cetakDebugPerDetik(rms, bersuara, detik) {
  if (!konfig.debug) return;

  debugSampel++;
  if (bersuara) debugSampelBicara++;
  if (rms > debugRmsMaks) debugRmsMaks = rms;

  const detikBulat = Math.floor(detik);
  if (detikBulat === detikDebugTerakhir) return;

  if (detikDebugTerakhir >= 0) {
    const lamaHening = (heningMulaiDetik !== null) ? `hening ${(detik - heningMulaiDetik).toFixed(1)} s` : 'tidak hening';
    console.log(
      `[audio] t=${detikDebugTerakhir}s rmsMaks=${debugRmsMaks.toFixed(4)} ambang=${ambangBicara.toFixed(4)} ` +
      `bersuara=${debugSampelBicara}/${debugSampel} frame, ${lamaHening}`
    );
  }
  detikDebugTerakhir = detikBulat;
  debugRmsMaks = 0;
  debugSampel = 0;
  debugSampelBicara = 0;
}

/**
 * Menjeda sampling audio tanpa membuang satu pun angka yang sudah terkumpul.
 *
 * CARA KERJA:
 * Status diubah ke 'dijeda', jam sesi ditutup, dan frame berikutnya dibatalkan.
 * Daftar jeda dan akumulator volume dibiarkan utuh. Hening yang sedang terbuka
 * dibuang karena dipotong oleh istirahat yang disengaja, dan penanda
 * "sudah bicara" dimatikan supaya hening saat pengguna bersiap lagi sesudah
 * resume() juga tidak terhitung, sama seperti di awal sesi.
 *
 * @returns {boolean} True jika modul memang sedang berjalan
 */
export function pause() {
  if (status !== 'berjalan') return false;
  status = 'dijeda';
  buangHeningTerbuka();
  sudahBicara = false;
  tutupSegmenJam();
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  return true;
}

/**
 * Melanjutkan sampling audio setelah dijeda, tanpa menyentuh akumulator.
 * Jam sesi berjalan lagi dari titik terakhir sebelum jeda.
 *
 * @returns {boolean} True jika berhasil dilanjutkan
 */
export function resume() {
  if (status !== 'dijeda') return false;
  status = 'berjalan';
  waktuMulaiSegmenJam = Date.now();
  mulaiLoopPantauAudio();
  return true;
}

/**
 * Menghentikan proses pemantauan audio secara total.
 *
 * CARA KERJA:
 * 1. Mengubah status menjadi 'berhenti' sehingga perulangan berhenti sendiri.
 * 2. Membuang hening terbuka di ekor sesi, yang biasanya berisi waktu menekan
 *    tombol Selesai dan membaca dialog konfirmasi, bukan hesitasi.
 * 3. Membatalkan frame yang masih terjadwal.
 * 4. Akumulator sengaja dibiarkan utuh supaya getResults() masih bisa dibaca
 *    Layar Rapor setelah sesi berakhir. Pelepasan node audio dilakukan terpisah
 *    lewat cleanupAudio() saat kamera dan mikrofon dimatikan.
 */
export function stop() {
  if (status === 'berjalan') buangHeningTerbuka();
  status = 'berhenti';
  tutupSegmenJam();
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

/**
 * Mengambil agregat jeda dan volume untuk Rapor.
 *
 * CARA KERJA:
 * 1. Bila ambang bicara belum pernah terukur, modul TIDAK mengembalikan angka
 *    apa pun ({ tersedia: false }). Tanpa ambang, "0 jeda" tidak berarti
 *    pengguna lancar, melainkan tidak ada yang mengukur; report.js akan
 *    mengeluarkan bobot jeda dari rumus skor.
 * 2. Volume rata-rata dihitung dari frame bicara saja. Bila tidak ada satu pun
 *    frame bicara, volumeRataRms bernilai null.
 * 3. Label volume dinilai dari RASIO terhadap suara ruangan, bukan dari angka
 *    RMS mutlak: volumeRataRms dibagi noiseFloorRms. Alasannya sama dengan
 *    ambang bicara (lihat catatan desain di kepala berkas): RMS mentah sangat
 *    bergantung pada penguatan mikrofon, jarak duduk, dan setelan sistem, jadi
 *    satu angka mutlak yang benar di satu laptop akan salah di laptop lain.
 *    Rasio di bawah CONFIG.audio.pengaliVolumePelan dilabeli "pelan".
 *    Selama pengali itu belum ditetapkan dari hasil uji (masih null), labelnya
 *    null dan kartu rapor berbunyi "belum aktif". Rasio dan RMS mentah tetap
 *    dilaporkan sebagai bahan kalibrasi.
 * 4. Daftar jeda disalin supaya pemanggil tidak bisa mengubah akumulator modul.
 *
 * @param {Object} config - Objek CONFIG dari app.js
 * @returns {Object} { tersedia: false } atau agregat jeda dan volume
 */
export function getResults(config = {}) {
  const k = gabungKonfig(config);

  if (ambangBicara === null) {
    return { tersedia: false };
  }

  const volumeRataRms = jumlahSampleRms > 0 ? (totalRmsAkumulasi / jumlahSampleRms) : null;

  // Rasio terhadap suara ruangan: inilah angka yang bisa dibandingkan antar
  // perangkat, karena pembilang dan penyebutnya diukur mikrofon yang sama pada
  // sesi yang sama. "Tiga kali lebih keras daripada ruanganmu" berarti hal yang
  // kurang lebih sama di laptop mana pun; "RMS 0,05" tidak.
  const rasioVolume = (volumeRataRms !== null && noiseFloorRms > 0)
    ? volumeRataRms / noiseFloorRms
    : null;

  let volumeLabel = null;
  if (rasioVolume !== null && typeof k.pengaliVolumePelan === 'number') {
    volumeLabel = rasioVolume < k.pengaliVolumePelan ? 'pelan' : 'ideal';
  }

  if (k.debug) {
    console.log(
      `[audio] hasil: volumeRataRms=${volumeRataRms === null ? 'null' : volumeRataRms.toFixed(4)} ` +
      `dari ${jumlahSampleRms} frame bicara, noiseFloor=${noiseFloorRms === null ? 'null' : noiseFloorRms.toFixed(4)}, ` +
      `RASIO=${rasioVolume === null ? 'null' : rasioVolume.toFixed(2)}× suara ruangan, ` +
      `pengaliVolumePelan=${k.pengaliVolumePelan}, ` +
      `jeda=${jedaDaftar.length}, daftar=${JSON.stringify(jedaDaftar)}`
    );
  }

  return {
    tersedia: true,
    volumeRataRms,
    noiseFloorRms,
    rasioVolume,
    volumeLabel,
    jeda: {
      jumlah: jedaDaftar.length,
      terlamaDetik: terlamaJedaDetik,
      daftar: jedaDaftar.slice()
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
