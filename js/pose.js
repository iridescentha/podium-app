/**
 * ============================================================================
 * MODUL KLASIFIKASI POSTUR - PODIUM (STUB SAMPAI TAHAP 5)
 * ============================================================================
 * File: js/pose.js
 * Deskripsi:
 * Modul stub untuk klasifikasi postur menggunakan model Teachable Machine (Pose)
 * di atas TensorFlow.js. URL model dikirimkan pemilik proyek pada Tahap 5.
 *
 * Modul ini sudah mengikuti KONTRAK SIKLUS HIDUP yang didokumentasikan lengkap
 * di kepala js/speech.js (start / pause / resume / stop / getResults), meskipun
 * isinya masih kosong. Tujuannya supaya Tahap 5 hanya perlu mengisi badan fungsi
 * tanpa menyentuh cara app.js memanggilnya.
 *
 * Selama stub:
 * - getResults() mengembalikan aktif: false, sehingga report.js mengeluarkan
 *   bobot postur dari rumus skor alih-alih memberinya nilai penuh gratis.
 * - Sesi dan rapor berjalan mulus tanpa modul ini.
 * ============================================================================
 */

// Status siklus hidup modul: 'berjalan' | 'dijeda' | 'berhenti'
let status = 'berhenti';

// Penghitung per kelas postur. Sesuai Bagian 3 brief, modul menyimpan pencacah
// di memori dan hanya mengembalikan distribusi persentase, bukan array prediksi
// per frame: lebih hemat, konsisten antar modul, dan jauh lebih sedikit
// mengungkap perilaku tubuh pengguna.
let pencacahKelas = {};
let totalSampelDipakai = 0;

/**
 * Memeriksa kesiapan model postur.
 * Selalu false selama stub karena URL model belum tersedia.
 */
export function isModelReady() {
  return false;
}

/**
 * Memuat model Teachable Machine Pose (diimplementasikan pada Tahap 5).
 *
 * @param {string} modelUrl - URL folder model dari Teachable Machine
 */
export async function loadModel(modelUrl) {
  // TODO Tahap 5: muat tf.js + @teachablemachine/pose dari CDN, lalu siapkan webcam.
  return false;
}

/**
 * Memulai pengamatan postur dari nol.
 *
 * CARA KERJA (rencana Tahap 5):
 * Mengosongkan pencacah kelas, lalu menjalankan inferensi tiap
 * CONFIG.POSE_POLL_INTERVAL_MS. Hanya prediksi dengan confidence di atas
 * CONFIG.POSE_CONFIDENCE_MIN yang dicatat, dan hasilnya dihaluskan lewat suara
 * mayoritas dari beberapa prediksi terakhir sebelum masuk pencacah.
 *
 * @returns {boolean} True jika pengamatan benar-benar berjalan
 */
export function start(callbacks = {}) {
  pencacahKelas = {};
  totalSampelDipakai = 0;

  if (!isModelReady()) {
    status = 'berhenti';
    return false;
  }

  status = 'berjalan';
  return true;
}

/**
 * Menjeda pengamatan postur tanpa membuang pencacah kelas.
 *
 * @returns {boolean} True jika modul memang sedang berjalan
 */
export function pause() {
  if (status !== 'berjalan') return false;
  status = 'dijeda';
  // TODO Tahap 5: hentikan interval inferensi di sini, jangan reset pencacah.
  return true;
}

/**
 * Melanjutkan pengamatan postur dari pencacah yang sama.
 *
 * @returns {boolean} True jika berhasil dilanjutkan
 */
export function resume() {
  if (status !== 'dijeda') return false;
  status = 'berjalan';
  // TODO Tahap 5: hidupkan kembali interval inferensi di sini.
  return true;
}

/**
 * Menghentikan pengamatan postur dan melepas resource.
 * Pencacah dibiarkan utuh agar getResults() tetap bisa dibaca Rapor.
 */
export function stop() {
  status = 'berhenti';
  // TODO Tahap 5: hentikan interval inferensi dan lepas webcam milik model.
}

/**
 * Mengembalikan distribusi postur sebagai persentase.
 *
 * CARA KERJA (rencana Tahap 5):
 * Membagi pencacah tiap kelas dengan total sampel YANG DIPAKAI, bukan total
 * sampel yang diambil. Prediksi berconfidence rendah dibuang lebih dulu, jadi
 * memakainya sebagai pembagi akan menurunkan semua persentase secara semu.
 *
 * @returns {Object} { aktif: false } selama stub
 */
export function getResults() {
  if (!isModelReady()) {
    return { aktif: false, distribusi: {} };
  }

  const distribusi = {};
  if (totalSampelDipakai > 0) {
    for (const [kelas, jumlah] of Object.entries(pencacahKelas)) {
      distribusi[kelas] = jumlah / totalSampelDipakai;
    }
  }

  return { aktif: true, distribusi };
}
