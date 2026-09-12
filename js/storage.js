/**
 * ============================================================================
 * MODUL PENYIMPANAN LOKAL (STORAGE) - PODIUM
 * ============================================================================
 * File: js/storage.js
 * Deskripsi:
 * Mengelola pembacaan dan penyimpanan riwayat sesi latihan ke localStorage
 * peramban menggunakan kunci 'podium_sessions'.
 * 
 * Sesuai batasan privasi Bagian 2 & skema data Bagian 6.3:
 * - Tidak ada data video/audio yang disimpan.
 * - Hanya metrik agregat sesi (skor, WPM, filler, arah pandang, jeda, postur)
 *   yang disimpan dalam format JSON.
 * - Menangani kondisi kuota localStorage penuh/error secara aman tanpa
 *   menghentikan alur pembuatan rapor.
 * ============================================================================
 */

const STORAGE_KEY = 'podium_sessions';

/**
 * Mengambil seluruh daftar sesi yang tersimpan di localStorage.
 * 
 * CARA KERJA:
 * 1. Membaca string JSON mentah dari `localStorage.getItem(STORAGE_KEY)`.
 * 2. Jika kunci belum ada, mengembalikan array kosong [].
 * 3. Melakukan parsing JSON di dalam blok try-catch untuk mengantisipasi data
 *    korup; bila gagal parse, mengembalikan array kosong agar aplikasi tidak crash.
 * 
 * @returns {Array<Object>} Daftar objek sesi yang diurutkan dari terbaru ke terlama.
 */
export function ambilDaftarSesi() {
  try {
    const dataMentah = localStorage.getItem(STORAGE_KEY);
    if (!dataMentah) {
      return [];
    }
    const daftar = JSON.parse(dataMentah);
    if (!Array.isArray(daftar)) {
      return [];
    }
    // Urutkan dari sesi terbaru ke terlama berdasarkan tanggal ISO
    return daftar.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
  } catch (error) {
    console.error('Gagal membaca data podium_sessions dari localStorage:', error);
    return [];
  }
}

/**
 * Menyimpan data sesi latihan baru ke daftar riwayat.
 * 
 * CARA KERJA:
 * 1. Mengambil riwayat yang sudah ada terlebih dahulu melalui `ambilDaftarSesi()`.
 * 2. Menyisipkan objek sesi baru ke elemen paling depan (indeks 0).
 * 3. Mengonversi kembali array objek ke format string JSON.
 * 4. Menyimpan string ke `localStorage.setItem()`.
 * 5. Jika penyimpanan gagal (misalnya karena kuota memori browser penuh atau
 *    fitur mode privat memblokir penyimpanan), fungsi menangkap error dan
 *    mengembalikan status { sukses: false, error }, sehingga tampilan rapor
 *    bisa memberi catatan bahwa sesi ini tidak tersimpan tanpa merusak rapor.
 * 
 * @param {Object} sesiBaru - Objek sesi lengkap sesuai skema Bagian 6.3
 * @returns {{ sukses: boolean, pesan?: string }} Status keberhasilan penyimpanan
 */
export function simpanSesi(sesiBaru) {
  try {
    const daftar = ambilDaftarSesi();
    daftar.unshift(sesiBaru);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(daftar));
    return { sukses: true };
  } catch (error) {
    console.warn('Gagal menyimpan sesi ke localStorage (kemungkinan kuota penuh):', error);
    return {
      sukses: false,
      pesan: 'Sesi ini tidak tersimpan ke riwayat (penyimpanan lokal peramban penuh atau tidak diizinkan).'
    };
  }
}

/**
 * Menghapus satu sesi tertentu berdasarkan ID uniknya.
 * 
 * CARA KERJA:
 * 1. Mengambil seluruh riwayat sesi saat ini.
 * 2. Memfilter array untuk membuang elemen yang memiliki `id` yang cocok.
 * 3. Menyimpan kembali sisa array ke `localStorage`.
 * 
 * @param {string} idSesi - ID unik sesi yang ingin dihapus (contoh: "s_1712345678")
 * @returns {boolean} True jika operasi penghapusan berhasil
 */
export function hapusSesi(idSesi) {
  try {
    const daftar = ambilDaftarSesi();
    const daftarBaru = daftar.filter(sesi => sesi.id !== idSesi);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(daftarBaru));
    return true;
  } catch (error) {
    console.error(`Gagal menghapus sesi ${idSesi}:`, error);
    return false;
  }
}

/**
 * Menghapus seluruh riwayat sesi latihan dari localStorage.
 * 
 * CARA KERJA:
 * Menghapus entri `podium_sessions` secara total dari storage peramban.
 * 
 * @returns {boolean} True jika berhasil dikosongkan
 */
export function hapusSemuaSesi() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Gagal mengosongkan riwayat podium_sessions:', error);
    return false;
  }
}

/**
 * Mengambil ringkasan mini riwayat untuk ditampilkan di Layar Beranda.
 * 
 * CARA KERJA:
 * 1. Mengambil daftar sesi dari storage.
 * 2. Jika ada data, membaca jumlah total sesi dan skor pada sesi terakhir yang dilakukan.
 * 3. Jika belum ada data sama sekali, mengembalikan totalSesi: 0 dan skorTerakhir: null.
 * 
 * @returns {{ adaRiwayat: boolean, totalSesi: number, skorTerakhir: number | null }}
 */
export function ambilRingkasanMini() {
  const daftar = ambilDaftarSesi();
  if (daftar.length === 0) {
    return { adaRiwayat: false, totalSesi: 0, skorTerakhir: null };
  }
  return {
    adaRiwayat: true,
    totalSesi: daftar.length,
    skorTerakhir: Math.round(daftar[0].skor)
  };
}
