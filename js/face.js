/**
 * ============================================================================
 * MODUL ANALISIS WAJAH & ARAH PANDANG (FACE) - PODIUM
 * ============================================================================
 * File: js/face.js
 *
 * STATUS SAAT INI: MODUL SENGAJA DILUMPUHKAN, menunggu implementasi Tahap 2.
 *
 * KENAPA DILUMPUHKAN, BUKAN DIBIARKAN JALAN:
 * Versi sebelumnya menjalankan setInterval yang mencatat SETIAP frame sebagai
 * "menatap depan" tanpa pernah benar-benar menyentuh kamera. Akibatnya kontak
 * pandang selalu terbaca 100% dan skor total ikut terdongkrak oleh angka yang
 * tidak pernah diukur. Rapor jujur yang kehilangan satu metrik jauh lebih
 * berguna daripada rapor lengkap yang isinya karangan.
 *
 * SELAMA `tersedia === false`:
 * - start() tidak menghitung frame apa pun dan tidak memakai CPU sama sekali.
 * - getResults() mengembalikan { tersedia: false }, yang dibaca report.js untuk
 *   mengeluarkan bobot arah pandang dari rumus skor (bobotnya dibagi ulang ke
 *   metrik lain) dan menandai kartunya "belum aktif" di Layar Rapor.
 *
 * TAHAP 2 mengisi blok bertanda TODO di bawah dengan MediaPipe Tasks Vision
 * (FaceLandmarker + blendshapes), lalu mengubah `tersedia` menjadi true.
 * Seluruh struktur modul, nama variabel metrik, dan kontrak fungsinya sengaja
 * dipertahankan supaya Tahap 2 hanya perlu mengisi, bukan menulis ulang.
 *
 * Antarmuka standar modul analisis:
 * - loadModel(): memuat wasm & model secara lazy (Tahap 2).
 * - isReady(): apakah model siap dipakai.
 * - start(callbacks, videoElement): memulai loop inferensi arah pandang.
 * - stop(): menghentikan loop inferensi.
 * - getResults(): agregat kontak pandang & persentase wajah tak terlihat.
 * ============================================================================
 */

// Saklar kejujuran modul. Selama false, modul tidak boleh menghasilkan angka
// apa pun. Tahap 2 mengubahnya menjadi true setelah model benar-benar memuat.
let tersedia = false;

let landmarker = null;
let intervalId = null;

// Status siklus hidup modul: 'berjalan' | 'dijeda' | 'berhenti'.
// Kontrak lengkapnya didokumentasikan di kepala js/speech.js.
let status = 'berhenti';

// Metrik sesi (dihitung ulang setiap start)
let totalFrameDianalisis = 0;
let frameMenatapDepan = 0;
let frameMenunduk = 0;
let frameWajahTakTerlihat = 0;

let callbacksEksternal = {
  onGazeUpdate: null // Arah pandang terkini: 'depan' | 'bawah' | 'tidak terlihat' | 'belum aktif'
};

/**
 * Memeriksa apakah model Face Landmarker sudah siap dipakai.
 *
 * CARA KERJA:
 * Mengembalikan true hanya jika saklar `tersedia` sudah dinyalakan Tahap 2 DAN
 * objek landmarker benar-benar terbentuk. Dua syarat ini sengaja digabung agar
 * mustahil ada jalur kode yang menganggap modul siap padahal modelnya kosong.
 */
export function isReady() {
  return Boolean(tersedia && landmarker);
}

/**
 * Memuat model MediaPipe Tasks Vision Face Landmarker.
 *
 * CARA KERJA (rencana Tahap 2):
 * 1. Impor dinamis @mediapipe/tasks-vision dari CDN saat sesi akan dimulai.
 * 2. Memuat berkas wasm, lalu membuat FaceLandmarker dengan
 *    outputFaceBlendshapes: true agar nilai eyeLookDown tersedia.
 * 3. Menyalakan saklar `tersedia` hanya bila kedua langkah di atas berhasil.
 *
 * Saat ini fungsi ini jujur mengembalikan false tanpa memuat apa pun, sehingga
 * tidak ada permintaan jaringan yang sia-sia sebelum Tahap 2 dikerjakan.
 */
export async function loadModel() {
  // TODO Tahap 2: impor dinamis FaceLandmarker + FilesetResolver, lalu set tersedia = true.
  console.info('Modul arah pandang belum aktif (implementasi MediaPipe masuk di Tahap 2).');
  return false;
}

/**
 * Memulai analisis arah pandang real-time.
 *
 * CARA KERJA:
 * 1. Menyimpan callback dan mengosongkan seluruh penghitung frame sesi.
 * 2. Jika modul belum tersedia, fungsi berhenti di sini: tidak ada interval yang
 *    dijalankan dan tidak ada frame yang dicatat. Indikator di Layar Sesi diberi
 *    tahu sekali bahwa modul ini "belum aktif" supaya pengguna tidak mengira
 *    aplikasinya rusak.
 * 3. Jika sudah tersedia (Tahap 2), barulah loop inferensi tiap
 *    CONFIG.FACE_POLL_INTERVAL_MS dijalankan terhadap elemen video sesi.
 *
 * @param {Object} callbacks - { onGazeUpdate }
 * @param {HTMLVideoElement} videoElement - Sumber frame kamera sesi
 * @returns {boolean} True jika loop inferensi benar-benar berjalan
 */
export function start(callbacks = {}, videoElement = null) {
  callbacksEksternal = { ...callbacksEksternal, ...callbacks };

  totalFrameDianalisis = 0;
  frameMenatapDepan = 0;
  frameMenunduk = 0;
  frameWajahTakTerlihat = 0;

  if (!isReady()) {
    status = 'berhenti';
    if (typeof callbacksEksternal.onGazeUpdate === 'function') {
      callbacksEksternal.onGazeUpdate('belum aktif');
    }
    return false;
  }

  status = 'berjalan';

  // TODO Tahap 2: ganti isi interval ini dengan landmarker.detectForVideo(videoElement, now)
  // lalu klasifikasikan blendshapes eyeLookDownLeft + eyeLookDownRight terhadap
  // CONFIG.LOOK_DOWN_THRESHOLD, dan catat frame tanpa wajah ke frameWajahTakTerlihat.
  // Loop inferensinya wajib berhenti sendiri begitu status bukan 'berjalan'.
  return true;
}

/**
 * Menjeda inferensi arah pandang tanpa membuang penghitung frame.
 *
 * CARA KERJA:
 * Status diubah ke 'dijeda' dan interval inferensi dilepas, sementara seluruh
 * penghitung frame dibiarkan utuh. Frame selama jeda tidak boleh dicatat sama
 * sekali, karena pengguna memang sedang tidak berlatih; mencatatnya akan
 * menurunkan persentase kontak pandang tanpa sebab.
 *
 * @returns {boolean} True jika modul memang sedang berjalan
 */
export function pause() {
  if (status !== 'berjalan') return false;
  status = 'dijeda';
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  return true;
}

/**
 * Melanjutkan inferensi arah pandang dari penghitung frame yang sama.
 *
 * @returns {boolean} True jika berhasil dilanjutkan
 */
export function resume() {
  if (status !== 'dijeda') return false;
  status = 'berjalan';
  // TODO Tahap 2: hidupkan kembali interval inferensi di sini, tanpa reset metrik.
  return true;
}

/**
 * Menghentikan analisis arah pandang dan melepas loop inferensi.
 *
 * Penghitung frame dibiarkan utuh agar getResults() tetap bisa dibaca Rapor.
 */
export function stop() {
  status = 'berhenti';
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/**
 * Mengambil agregat kontak pandang untuk Rapor.
 *
 * CARA KERJA:
 * 1. Bila modul belum tersedia, mengembalikan { tersedia: false } dan TIDAK
 *    mengarang angka apa pun. report.js membaca penanda ini untuk mengeluarkan
 *    bobot arah pandang dari rumus skor.
 * 2. Bila tersedia, frame tanpa wajah dikeluarkan dari pembagi supaya menutup
 *    kamera tidak dihitung sebagai "tidak menatap depan"; kejadian itu dilaporkan
 *    terpisah lewat wajahTakTerlihatPersen.
 *
 * @returns {Object} { tersedia: false } atau agregat lengkap arah pandang
 */
export function getResults() {
  if (!tersedia) {
    return { tersedia: false };
  }

  const frameValid = totalFrameDianalisis - frameWajahTakTerlihat;
  const pandangPersen = frameValid > 0 ? (frameMenatapDepan / frameValid) : 0;
  const wajahTakTerlihatPersen = totalFrameDianalisis > 0
    ? (frameWajahTakTerlihat / totalFrameDianalisis)
    : 0;

  return {
    tersedia: true,
    pandangPersen: Math.min(Math.max(pandangPersen, 0), 1),
    wajahTakTerlihatPersen: Math.min(Math.max(wajahTakTerlihatPersen, 0), 1),
    totalFrame: totalFrameDianalisis,
    frameMenunduk: frameMenunduk
  };
}
