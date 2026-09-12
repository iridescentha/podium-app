/**
 * ============================================================================
 * MODUL KLASIFIKASI POSTUR - PODIUM (STUB TAHAP 0-4)
 * ============================================================================
 * File: js/pose.js
 * Deskripsi:
 * Modul stub untuk klasifikasi postur menggunakan model Teachable Machine (Pose).
 * URL model akan dikirimkan oleh pemilik proyek pada Tahap 5.
 * 
 * Sesuai instruksi Bagian 3:
 * - Mengekspor antarmuka lengkap: start(callbacks), stop(), getResults().
 * - Mengembalikan data kosong dan status aktif: false.
 * - Sesi dan rapor dapat berjalan mulus tanpa modul ini.
 * ============================================================================
 */

let sedangBerjalan = false;

/**
 * Memeriksa kesiapan model postur.
 * Mengembalikan false pada tahap stub karena URL model belum diisi.
 */
export function isModelReady() {
  return false;
}

/**
 * Memuat model Teachable Machine (akan diimplementasikan pada Tahap 5).
 */
export async function loadModel(modelUrl) {
  console.log('Pose module stub: loadModel dipanggil dengan URL:', modelUrl);
  return false;
}

/**
 * Memulai pengamatan postur.
 */
export function start(callbacks = {}) {
  sedangBerjalan = true;
  console.log('Pose module stub: start() aktif.');
}

/**
 * Menghentikan pengamatan postur.
 */
export function stop() {
  sedangBerjalan = false;
  console.log('Pose module stub: stop() dipanggil.');
}

/**
 * Mengembalikan data hasil evaluasi postur.
 * 
 * @returns {Object} Data metrik postur kosong sesuai skema data Bagian 6.3
 */
export function getResults() {
  return {
    aktif: false,
    distribusi: {}
  };
}
