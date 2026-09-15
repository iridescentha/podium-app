/**
 * ============================================================================
 * MODUL ANALISIS WAJAH & ARAH PANDANG (FACE) - PODIUM
 * ============================================================================
 * File: js/face.js
 *
 * Memakai MediaPipe Tasks Vision (FaceLandmarker dengan blendshapes) untuk
 * mengukur berapa besar porsi waktu pengguna menatap ke depan, dan seberapa
 * sering wajahnya keluar dari jangkauan kamera.
 *
 * ----------------------------------------------------------------------------
 * CARA KERJA SINGKAT
 * ----------------------------------------------------------------------------
 * FaceLandmarker mengembalikan dua hal untuk tiap frame: titik-titik wajah, dan
 * sekumpulan "blendshape", yaitu nilai 0..1 yang menyatakan seberapa kuat sebuah
 * ekspresi sedang terjadi. Modul ini hanya memakai dua di antaranya,
 * eyeLookDownLeft dan eyeLookDownRight, lalu merata-ratakan keduanya. Bila
 * rata-ratanya melewati CONFIG.LOOK_DOWN_THRESHOLD, frame itu dihitung menunduk.
 *
 * Kenapa blendshape mata, bukan kemiringan kepala: pengguna yang membaca catatan
 * sering menunduk hanya dengan matanya sementara kepalanya tetap tegak, dan
 * justru gerakan mata itu yang menandakan perhatiannya lepas dari audiens.
 *
 * ----------------------------------------------------------------------------
 * ATURAN PEMBAGI (Bagian 6.1 GEMINI.md + CLAUDE.md)
 * ----------------------------------------------------------------------------
 * Frame yang wajahnya TIDAK terdeteksi dikeluarkan dari pembagi persentase
 * kontak pandang, bukan dihitung sebagai menunduk. Menutup kamera atau keluar
 * dari bingkai bukan berarti menunduk, dan menghitungnya begitu akan menghukum
 * pengguna untuk sesuatu yang tidak pernah diukur. Kejadian itu dilaporkan
 * terpisah lewat wajahTakTerlihatPersen.
 *
 * ----------------------------------------------------------------------------
 * TEMUAN UJI 15 SEPTEMBER 2026: KEDIPAN TERBACA SEBAGAI MENUNDUK
 * ----------------------------------------------------------------------------
 * Uji manual Tahap 2 menunjukkan pola yang konsisten: menatap ke depan dengan
 * mata terbuka tidak pernah terdaftar menunduk, tetapi begitu mata ditutup
 * sejenak lalu dibuka, frame itu langsung terdaftar menunduk. Pencahayaan
 * bukan faktornya.
 *
 * Penyebabnya: blendshape eyeLookDownLeft/Right IKUT NAIK saat kelopak mata
 * menutup. Dari sudut pandang model, kelopak yang turun menutupi bola mata
 * terlihat mirip dengan bola mata yang bergulir ke bawah. Karena itu kedipan
 * harus disaring sebelum arah pandang diputuskan.
 *
 * Dua perbaikan diterapkan, dan keduanya perlu:
 * 1. SARING KEDIPAN. Bila eyeBlinkLeft ATAU eyeBlinkRight melewati
 *    CONFIG.FACE_BLINK_THRESHOLD, frame itu tidak dihitung menunduk maupun
 *    menatap depan, dan dikeluarkan dari pembagi persentase, persis seperti
 *    frame tanpa wajah. Saat mata tertutup, arah pandang memang tidak bisa
 *    diukur. Frame berkedip dicatat di penghitung sendiri (frameBerkedip),
 *    TIDAK digabung ke "wajah tidak terlihat" karena itu kejadian berbeda.
 * 2. PENGHALUSAN TEMPORAL. Status depan/menunduk hanya berganti setelah
 *    CONFIG.FACE_SMOOTHING_FRAMES frame berturut-turut konsisten. Ini menangani
 *    frame meleset karena sebab lain (gerak cepat, blur, awal/akhir kedipan
 *    yang nilainya belum melewati ambang kedip).
 *
 * Risiko yang harus diawasi saat kalibrasi: saat benar-benar menunduk membaca
 * catatan, kelopak mata ikut turun sehingga eyeBlink juga naik. Ambang kedip
 * yang terlalu rendah akan menyaring menunduk sungguhan sebagai kedipan.
 *
 * ----------------------------------------------------------------------------
 * CATATAN SEJARAH (jangan dihapus)
 * ----------------------------------------------------------------------------
 * Sampai commit 6fe98e0 (12 September 2026) modul ini mengarang data: sebuah
 * setInterval mencatat SETIAP frame sebagai "menatap depan" tanpa pernah
 * menyentuh kamera, sehingga kontak pandang selalu 100% dan skor total
 * terdongkrak angka yang tidak pernah diukur. Modul lalu dilumpuhkan sampai
 * implementasi asli ini siap. Pola kegagalan itu yang melahirkan aturan
 * "modul tidak boleh mengembalikan angka karangan" di CLAUDE.md.
 *
 * Antarmuka standar sesuai kontrak di CLAUDE.md:
 * loadModel() / isReady() / start() / pause() / resume() / stop() / getResults()
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// SUMBER MODEL
// Versi dipatok agar pembaruan CDN tidak diam-diam mengubah perilaku. Ketiganya
// sudah diverifikasi ada pada 14 September 2026.
// ----------------------------------------------------------------------------
const VERSI_TASKS_VISION = '0.10.14';
const URL_BUNDLE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSI_TASKS_VISION}/vision_bundle.mjs`;
const URL_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSI_TASKS_VISION}/wasm`;
const URL_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// Nama blendshape yang dibutuhkan. Nama ini berasal dari berkas model, bukan
// dari pustaka JS, jadi tidak bisa diverifikasi sebelum model benar-benar
// dimuat. Bila salah satu tidak ditemukan, modul menolak melaporkan angka
// alih-alih menebak (lihat blendshapeTersedia di bawah).
const NAMA_LOOK_DOWN = ['eyeLookDownLeft', 'eyeLookDownRight'];
const NAMA_BLINK = ['eyeBlinkLeft', 'eyeBlinkRight'];

// ----------------------------------------------------------------------------
// STATE MODUL
// ----------------------------------------------------------------------------
let landmarker = null;
let tersedia = false;              // Model benar-benar dimuat dan siap
let blendshapeTersedia = true;     // Nama blendshape yang dibutuhkan ditemukan
let sedangMemuat = null;           // Promise pemuatan, mencegah pemuatan ganda
let intervalId = null;

// Status siklus hidup: 'berjalan' | 'dijeda' | 'berhenti'
let status = 'berhenti';

// Penghitung frame sesi
let totalFrameDianalisis = 0;
let frameMenatapDepan = 0;
let frameMenunduk = 0;
let frameWajahTakTerlihat = 0;
let frameBerkedip = 0;             // Dikeluarkan dari pembagi; tidak ditampilkan di UI

// Penghalusan temporal (lihat terapkanPenghalusan)
let statusStabil = null;           // null | 'depan' | 'menunduk'
let kandidat = null;               // Status mentah yang sedang "mengantre" untuk menggantikan statusStabil
let kandidatJumlah = 0;            // Jumlah frame berturut-turut milik kandidat, belum masuk penghitung
let kandidatMulaiDetik = null;     // Kapan deretan kandidat dimulai

// Segmen menunduk panjang sebagai event bertimestamp (untuk timeline Tahap 4B)
let menundukSegmen = [];           // [{ mulaiDetik, durasiDetik }]
let menundukMulaiDetik = null;     // Penanda segmen menunduk yang sedang berjalan

// Elemen video sumber frame, dan penjaga agar frame yang sama tidak diproses dua kali
let videoSumber = null;
let waktuVideoTerakhir = -1;
let timestampTerakhir = 0;

// Konfigurasi aktif
const KONFIG_BAWAAN = {
  LOOK_DOWN_THRESHOLD: 0.5,
  FACE_BLINK_THRESHOLD: 0.5,
  FACE_SMOOTHING_FRAMES: 3,
  FACE_POLL_INTERVAL_MS: 150,
  MENUNDUK_EVENT_MIN_DETIK: 3,
  FACE_DEBUG: false
};
let konfig = { ...KONFIG_BAWAAN };
let sudahCetakDaftarBlendshape = false;

let callbacksEksternal = {
  onGazeUpdate: null // 'depan' | 'menunduk' | 'tidak terlihat' | 'belum aktif'
};

// ----------------------------------------------------------------------------
// JAM SESI: berjalan hanya saat status 'berjalan', sehingga cap waktu segmen
// menunduk berarti "detik ke sekian sejak sesi dimulai, tanpa menghitung jeda".
// Pola yang sama dipakai di js/speech.js.
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
 * Memeriksa apakah model siap dipakai.
 *
 * CARA KERJA:
 * Dua syarat digabung: saklar `tersedia` menyala DAN objek landmarker benar-benar
 * terbentuk. Digabung supaya mustahil ada jalur kode yang menganggap modul siap
 * padahal modelnya kosong.
 */
export function isReady() {
  return Boolean(tersedia && landmarker);
}

/**
 * Memuat MediaPipe Tasks Vision dan model Face Landmarker secara lazy.
 *
 * CARA KERJA:
 * 1. Mengimpor bundle Tasks Vision dari CDN lewat import dinamis, jadi berkasnya
 *    baru diunduh saat pengguna benar-benar akan berlatih, bukan saat halaman dibuka.
 * 2. FilesetResolver mengunduh berkas WebAssembly yang menjalankan inferensinya.
 *    Seluruh pemrosesan terjadi di perangkat; tidak ada frame yang dikirim ke mana pun.
 * 3. Membuat FaceLandmarker dengan runningMode 'VIDEO' (dioptimalkan untuk aliran
 *    frame berurutan), numFaces 1, dan outputFaceBlendshapes true karena nilai
 *    blendshape itulah yang dipakai menentukan arah pandang.
 * 4. Mencoba delegate GPU lebih dulu, lalu jatuh ke CPU bila perangkat menolak.
 *    Tanpa jalur mundur ini, laptop tanpa akselerasi grafis akan gagal total.
 *
 * Pemanggilan berulang aman: promise pemuatan disimpan dan dipakai ulang.
 *
 * @returns {Promise<boolean>} True bila model siap dipakai
 */
export async function loadModel() {
  if (isReady()) return true;
  if (sedangMemuat) return sedangMemuat;

  sedangMemuat = (async () => {
    try {
      const { FilesetResolver, FaceLandmarker } = await import(URL_BUNDLE);
      const berkasVisi = await FilesetResolver.forVisionTasks(URL_WASM);

      const opsiDasar = (delegate) => ({
        baseOptions: { modelAssetPath: URL_MODEL, delegate },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false
      });

      try {
        landmarker = await FaceLandmarker.createFromOptions(berkasVisi, opsiDasar('GPU'));
      } catch (galatGpu) {
        console.warn('Face Landmarker: GPU ditolak perangkat, beralih ke CPU.', galatGpu);
        landmarker = await FaceLandmarker.createFromOptions(berkasVisi, opsiDasar('CPU'));
      }

      tersedia = true;
      return true;
    } catch (err) {
      console.error('Gagal memuat Face Landmarker:', err);
      landmarker = null;
      tersedia = false;
      return false;
    } finally {
      sedangMemuat = null;
    }
  })();

  return sedangMemuat;
}

/**
 * Memulai analisis arah pandang dari nol.
 *
 * CARA KERJA:
 * Mengosongkan seluruh penghitung dan daftar segmen, menyalakan jam sesi, lalu
 * menjalankan loop inferensi berkala. Sesuai kontrak di CLAUDE.md, hanya fungsi
 * ini yang boleh mengosongkan akumulator.
 *
 * @param {Object} callbacks - { onGazeUpdate }
 * @param {HTMLVideoElement} videoElement - Sumber frame kamera sesi
 * @param {Object} config - Objek CONFIG dari app.js
 * @returns {boolean} True bila loop inferensi benar-benar berjalan
 */
export function start(callbacks = {}, videoElement = null, config = {}) {
  callbacksEksternal = { ...callbacksEksternal, ...callbacks };
  konfig = { ...KONFIG_BAWAAN, ...config };

  totalFrameDianalisis = 0;
  frameMenatapDepan = 0;
  frameMenunduk = 0;
  frameWajahTakTerlihat = 0;
  frameBerkedip = 0;
  statusStabil = null;
  resetKandidat();
  menundukSegmen = [];
  menundukMulaiDetik = null;
  waktuVideoTerakhir = -1;
  sudahCetakDaftarBlendshape = false;
  blendshapeTersedia = true;

  detikSegmenSelesai = 0;
  waktuMulaiSegmenJam = null;

  videoSumber = videoElement;

  if (!isReady() || !videoSumber) {
    status = 'berhenti';
    laporkanArah('belum aktif');
    return false;
  }

  status = 'berjalan';
  waktuMulaiSegmenJam = Date.now();
  jalankanLoopInferensi();
  return true;
}

/**
 * Menjeda inferensi tanpa membuang penghitung.
 *
 * CARA KERJA:
 * Jam sesi ditutup dan interval dilepas, sehingga tidak ada frame yang dicatat
 * selama jeda. Segmen menunduk yang sedang berjalan ditutup di sini, karena
 * membiarkannya terbuka akan membuat durasinya ikut menelan waktu jeda.
 * Frame kandidat yang belum dikonfirmasi diserahkan ke status stabil, lalu
 * status stabil dikosongkan: sesudah resume(), status harus dibangun ulang
 * dari frame baru, dan segmen menunduk bisa dibuka lagi dengan benar.
 */
export function pause() {
  if (status !== 'berjalan') return false;
  lepasKandidatKe(statusStabil);
  tutupSegmenMenunduk();
  statusStabil = null;
  status = 'dijeda';
  tutupSegmenJam();
  hentikanLoopInferensi();
  return true;
}

/**
 * Melanjutkan inferensi dari penghitung yang sama.
 */
export function resume() {
  if (status !== 'dijeda') return false;
  status = 'berjalan';
  waktuMulaiSegmenJam = Date.now();
  waktuVideoTerakhir = -1; // paksa frame pertama sesudah jeda diproses
  jalankanLoopInferensi();
  return true;
}

/**
 * Menghentikan analisis secara total.
 *
 * Penghitung dan daftar segmen dibiarkan utuh agar getResults() masih bisa
 * dibaca Layar Rapor setelah sesi berakhir.
 *
 * Objek landmarker sengaja TIDAK dilepas di sini. Ia tidak memegang kamera
 * maupun mikrofon, hanya memori WebAssembly, sementara perangkat kerasnya sudah
 * dimatikan terpisah lewat matikanSemuaMedia() di app.js. Mempertahankannya
 * membuat sesi berikutnya mulai seketika tanpa mengunduh model lagi.
 */
export function stop() {
  if (status === 'berjalan') {
    lepasKandidatKe(statusStabil);
    tutupSegmenMenunduk();
    statusStabil = null;
  }
  status = 'berhenti';
  tutupSegmenJam();
  hentikanLoopInferensi();
}

/**
 * Menjalankan loop inferensi berkala.
 *
 * CARA KERJA:
 * Interval dipilih ketimbang requestAnimationFrame karena laju sampling di sini
 * memang tidak perlu setinggi laju gambar layar. Sampling tiap
 * CONFIG.FACE_POLL_INTERVAL_MS sudah cukup halus untuk mengukur porsi waktu,
 * sekaligus menyisakan CPU untuk pengenalan suara yang berjalan bersamaan.
 */
function jalankanLoopInferensi() {
  hentikanLoopInferensi();
  intervalId = setInterval(prosesSatuFrame, konfig.FACE_POLL_INTERVAL_MS);
}

function hentikanLoopInferensi() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/**
 * Memproses satu frame kamera dan memperbarui seluruh penghitung.
 *
 * CARA KERJA:
 * 1. Berhenti bila status bukan 'berjalan' atau video belum punya gambar.
 * 2. Melewati frame yang isinya sama dengan frame sebelumnya. Kamera biasanya
 *    mengirim 30 gambar per detik sementara kita menyampel lebih sering dari
 *    itu; tanpa penjagaan ini, satu gambar yang sama akan dihitung berkali-kali
 *    dan membuat persentase condong ke keadaan yang kebetulan sedang berlangsung.
 * 3. Timestamp yang dikirim ke MediaPipe wajib selalu naik. Bila tidak, pustaka
 *    melempar galat dan loop berhenti diam-diam.
 * 4. Bila tidak ada wajah, frame dicatat sebagai "wajah tidak terlihat",
 *    segmen menunduk yang sedang berjalan ditutup, dan status stabil
 *    dikosongkan supaya dibangun ulang saat wajah kembali.
 * 5. Bila salah satu mata berkedip (eyeBlink di atas CONFIG.FACE_BLINK_THRESHOLD),
 *    frame dicatat di frameBerkedip dan berhenti di situ: tidak menunduk, tidak
 *    menatap depan, tidak mengubah status. Lihat temuan uji di kepala berkas.
 * 6. Selain itu, rata-rata dua blendshape eyeLookDown dibandingkan dengan ambang
 *    untuk mendapat status MENTAH frame ini, lalu diserahkan ke penghalusan
 *    temporal yang memutuskan kapan status benar-benar berganti.
 */
function prosesSatuFrame() {
  if (status !== 'berjalan' || !landmarker || !videoSumber) return;
  if (videoSumber.readyState < 2 || !videoSumber.videoWidth) return;
  if (videoSumber.currentTime === waktuVideoTerakhir) return;
  waktuVideoTerakhir = videoSumber.currentTime;

  // MediaPipe menolak timestamp yang tidak naik, termasuk yang sama persis
  const sekarang = performance.now();
  const timestamp = Math.max(sekarang, timestampTerakhir + 1);
  timestampTerakhir = timestamp;

  let hasil = null;
  try {
    hasil = landmarker.detectForVideo(videoSumber, timestamp);
  } catch (err) {
    console.warn('Face Landmarker gagal memproses frame:', err);
    return;
  }

  totalFrameDianalisis++;

  const adaWajah = Boolean(hasil && hasil.faceLandmarks && hasil.faceLandmarks.length > 0);
  if (!adaWajah) {
    frameWajahTakTerlihat++;
    lepasKandidatKe(statusStabil);
    tutupSegmenMenunduk();
    statusStabil = null;
    laporkanArah('tidak terlihat');
    return;
  }

  const kategori = (hasil.faceBlendshapes && hasil.faceBlendshapes[0])
    ? hasil.faceBlendshapes[0].categories
    : null;

  const nilaiKiri = ambilBlendshape(kategori, NAMA_LOOK_DOWN[0]);
  const nilaiKanan = ambilBlendshape(kategori, NAMA_LOOK_DOWN[1]);
  const kedipKiri = ambilBlendshape(kategori, NAMA_BLINK[0]);
  const kedipKanan = ambilBlendshape(kategori, NAMA_BLINK[1]);

  // Bila nama blendshape yang dibutuhkan tidak ada di model, modul tidak boleh
  // menebak. Penanda ini membuat getResults() melaporkan dirinya tidak tersedia.
  if (nilaiKiri === null || nilaiKanan === null || kedipKiri === null || kedipKanan === null) {
    if (blendshapeTersedia) {
      blendshapeTersedia = false;
      console.error(
        'Face Landmarker: blendshape eyeLookDownLeft/Right atau eyeBlinkLeft/Right tidak ditemukan pada model ini. ' +
        'Arah pandang tidak akan dilaporkan. Nama yang tersedia:',
        (kategori || []).map(k => k.categoryName)
      );
    }
    laporkanArah('belum aktif');
    return;
  }

  const detik = detikSesiSekarang();
  const rataLookDown = (nilaiKiri + nilaiKanan) / 2;

  // Saring kedipan: mata tertutup berarti arah pandang tidak bisa diukur
  const berkedip = kedipKiri > konfig.FACE_BLINK_THRESHOLD || kedipKanan > konfig.FACE_BLINK_THRESHOLD;
  if (berkedip) {
    frameBerkedip++;
    cetakDebug(kategori, nilaiKiri, nilaiKanan, rataLookDown, kedipKiri, kedipKanan, 'KEDIP (dikeluarkan)');
    return;
  }

  const mentah = rataLookDown > konfig.LOOK_DOWN_THRESHOLD ? 'menunduk' : 'depan';
  terapkanPenghalusan(mentah, detik);

  cetakDebug(kategori, nilaiKiri, nilaiKanan, rataLookDown, kedipKiri, kedipKanan,
    `mentah=${mentah} stabil=${statusStabil} kandidat=${kandidat}x${kandidatJumlah}`);
}

/**
 * Penghalusan temporal status arah pandang.
 *
 * CARA KERJA:
 * Modul memegang satu STATUS STABIL (depan atau menunduk) yang hanya boleh
 * berganti bila CONFIG.FACE_SMOOTHING_FRAMES frame berturut-turut sepakat.
 *
 * - Frame mentah SAMA dengan status stabil: frame dihitung untuk status stabil.
 *   Bila sebelumnya ada deretan kandidat yang belum cukup panjang, deretan itu
 *   dianggap frame meleset dan ikut dihitung sebagai status stabil.
 * - Frame mentah BERBEDA dari status stabil: frame masuk antrean kandidat dan
 *   BELUM dihitung ke mana pun.
 * - Begitu antrean kandidat mencapai jumlah frame yang disyaratkan, status
 *   stabil berganti, dan SELURUH frame antrean dihitung untuk status baru.
 *   Frame-frame itu memang sudah berada di status baru sejak awal antrean, jadi
 *   tidak ada waktu yang salah dikreditkan akibat penundaan konfirmasi.
 * - Segmen menunduk dibuka dan ditutup pada detik AWAL antrean yang
 *   mengonfirmasi pergantian, bukan saat konfirmasi, supaya durasi event di
 *   timeline tidak bergeser sebesar penundaan penghalusan.
 *
 * Frame berkedip tidak masuk fungsi ini sama sekali, sehingga kedipan di
 * tengah antrean tidak memutus maupun menambah antrean.
 *
 * @param {'depan'|'menunduk'} mentah - Keputusan dari frame ini saja
 * @param {number} detik - Posisi jam sesi saat frame ini dibaca
 */
function terapkanPenghalusan(mentah, detik) {
  if (mentah === statusStabil) {
    lepasKandidatKe(statusStabil);
    tambahFrame(statusStabil, 1);
    return;
  }

  if (mentah !== kandidat) {
    lepasKandidatKe(statusStabil);
    kandidat = mentah;
    kandidatMulaiDetik = detik;
  }
  kandidatJumlah++;

  const syarat = Math.max(1, Math.round(konfig.FACE_SMOOTHING_FRAMES));
  if (kandidatJumlah < syarat) return;

  const statusLama = statusStabil;
  const mulaiBaru = kandidatMulaiDetik;
  statusStabil = kandidat;
  tambahFrame(statusStabil, kandidatJumlah);
  resetKandidat();

  if (statusStabil === 'menunduk') {
    menundukMulaiDetik = mulaiBaru;
  } else if (statusLama === 'menunduk') {
    tutupSegmenMenunduk(mulaiBaru);
  }

  laporkanArah(statusStabil);
}

/**
 * Menyerahkan frame antrean kandidat ke sebuah status, lalu mengosongkan antrean.
 * Bila statusnya null (status stabil belum terbentuk, misalnya di awal sesi),
 * frame antrean dibuang: tanpa status yang disepakati, frame itu tidak bisa
 * dinilai dan karenanya dikeluarkan dari pembagi.
 */
function lepasKandidatKe(statusTujuan) {
  if (kandidatJumlah > 0 && statusTujuan) tambahFrame(statusTujuan, kandidatJumlah);
  resetKandidat();
}

function resetKandidat() {
  kandidat = null;
  kandidatJumlah = 0;
  kandidatMulaiDetik = null;
}

function tambahFrame(statusFrame, jumlah) {
  if (statusFrame === 'menunduk') frameMenunduk += jumlah;
  else if (statusFrame === 'depan') frameMenatapDepan += jumlah;
}

/**
 * Mengambil nilai satu blendshape berdasarkan namanya.
 * Mengembalikan null bila namanya tidak ada, supaya pemanggil bisa membedakan
 * "bernilai nol" dari "tidak tersedia".
 */
function ambilBlendshape(kategori, nama) {
  if (!Array.isArray(kategori)) return null;
  for (const k of kategori) {
    if (k.categoryName === nama) return k.score;
  }
  return null;
}

/**
 * Menutup segmen menunduk yang sedang berjalan dan mencatatnya bila cukup panjang.
 *
 * CARA KERJA:
 * Hanya segmen yang bertahan minimal CONFIG.MENUNDUK_EVENT_MIN_DETIK yang
 * disimpan. Menunduk sekejap adalah bagian wajar dari berbicara, sedangkan
 * menunduk beberapa detik penuh menandakan pengguna sedang membaca catatan.
 * Penyaringan ini juga yang menjaga daftar event tetap jarang, puluhan per sesi,
 * sesuai aturan "agregat, bukan data per frame" di CLAUDE.md.
 */
function tutupSegmenMenunduk(detikSelesai = detikSesiSekarang()) {
  if (menundukMulaiDetik === null) return;

  const mulai = menundukMulaiDetik;
  const durasi = detikSelesai - mulai;
  menundukMulaiDetik = null;

  if (durasi >= konfig.MENUNDUK_EVENT_MIN_DETIK) {
    menundukSegmen.push({
      mulaiDetik: Math.round(mulai),
      durasiDetik: Math.round(durasi * 10) / 10
    });
  }
}

function laporkanArah(arah) {
  if (typeof callbacksEksternal.onGazeUpdate === 'function') {
    callbacksEksternal.onGazeUpdate(arah);
  }
}

/**
 * Mode debug untuk kalibrasi ambang.
 *
 * CARA KERJA:
 * Sekali di awal, mencetak seluruh nama blendshape yang benar-benar dikirim
 * model, supaya bisa dipastikan nama yang dipakai modul ini memang ada. Setelah
 * itu mencetak nilai eyeLookDown dan eyeBlink kedua mata beserta keputusan
 * penyaringan dan penghalusannya, sehingga CONFIG.LOOK_DOWN_THRESHOLD,
 * CONFIG.FACE_BLINK_THRESHOLD, dan CONFIG.FACE_SMOOTHING_FRAMES bisa ditetapkan
 * dari angka nyata di laptop pengguna, bukan dari tebakan.
 */
function cetakDebug(kategori, kiri, kanan, rata, kedipKiri, kedipKanan, keputusan) {
  if (!konfig.FACE_DEBUG) return;

  if (!sudahCetakDaftarBlendshape) {
    sudahCetakDaftarBlendshape = true;
    console.log('[face] blendshape tersedia:', (kategori || []).map(k => k.categoryName).join(', '));
  }

  console.log(
    `[face] t=${detikSesiSekarang().toFixed(1)}s ` +
    `lookDown kiri=${kiri.toFixed(3)} kanan=${kanan.toFixed(3)} rata=${rata.toFixed(3)} (ambang ${konfig.LOOK_DOWN_THRESHOLD}) ` +
    `blink kiri=${kedipKiri.toFixed(3)} kanan=${kedipKanan.toFixed(3)} (ambang ${konfig.FACE_BLINK_THRESHOLD}) ` +
    `-> ${keputusan}`
  );
}

/**
 * Mengambil agregat kontak pandang untuk Rapor.
 *
 * CARA KERJA:
 * 1. Melaporkan diri tidak tersedia bila model gagal dimuat, nama blendshape
 *    tidak cocok, atau tidak ada satu pun frame yang sempat dianalisis. Dalam
 *    ketiga kondisi itu modul TIDAK mengembalikan angka apa pun, dan report.js
 *    akan mengeluarkan bobot arah pandang dari rumus skor.
 * 2. Persentase kontak pandang dihitung hanya dari frame yang benar-benar
 *    dinilai: menatap depan + menunduk. Tiga jenis frame dikeluarkan dari
 *    pembagi: tanpa wajah, berkedip, dan antrean kandidat yang dibuang karena
 *    status stabil belum terbentuk.
 * 3. wajahTakTerlihatPersen HANYA berisi frame tanpa wajah. Frame berkedip
 *    dilaporkan terpisah lewat frameBerkedip dan tidak ditampilkan di UI.
 * 4. Segmen menunduk panjang disertakan sebagai event bertimestamp untuk
 *    timeline di Tahap 4B.
 *
 * @returns {Object} { tersedia: false } atau agregat lengkap arah pandang
 */
export function getResults() {
  const frameValid = frameMenatapDepan + frameMenunduk;

  if (!tersedia || !blendshapeTersedia || totalFrameDianalisis === 0 || frameValid <= 0) {
    return { tersedia: false };
  }

  const pandangPersen = frameMenatapDepan / frameValid;
  const wajahTakTerlihatPersen = frameWajahTakTerlihat / totalFrameDianalisis;

  return {
    tersedia: true,
    pandangPersen: Math.min(Math.max(pandangPersen, 0), 1),
    wajahTakTerlihatPersen: Math.min(Math.max(wajahTakTerlihatPersen, 0), 1),
    totalFrame: totalFrameDianalisis,
    frameMenunduk: frameMenunduk,
    frameBerkedip: frameBerkedip,
    menundukSegmen: menundukSegmen.slice()
  };
}
