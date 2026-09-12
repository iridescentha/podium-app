/**
 * ============================================================================
 * MODUL PERHITUNGAN SKOR & RAPOR (REPORT) - PODIUM
 * ============================================================================
 * File: js/report.js
 * Deskripsi:
 * Mengkalkulasi skor akhir (0-100) sesuai rumus pasti pada Bagian 6.2,
 * menyusun kalimat evaluasi suportif, menyiapkan saran konkret,
 * dan merender visualisasi grafik Chart.js.
 * ============================================================================
 */

/**
 * Daftar aturan saran konkret (mudah dikalibrasi sesuai kebutuhan).
 */
export const ATURAN_SARAN = [
  {
    kondisi: (data) => data.filler.total > 8,
    saran: "Gunakan teknik jeda sadar: daripada mengisi keheningan dengan 'eee' atau 'jadi', tarik napas lembut dan biarkan hening sejenak sebelum kalimat berikutnya."
  },
  {
    // Penjaga `pandangTersedia` wajib ada: saat modul arah pandang mati,
    // pandangPersen bernilai null dan `null < 0.6` bernilai true di JavaScript,
    // sehingga saran ini akan muncul untuk metrik yang tidak pernah diukur.
    kondisi: (data) => data.pandangTersedia === true && data.pandangPersen < 0.6,
    saran: "Gunakan teknik segitiga pandang: jaga tatapan ke arah kamera/audiens secara bergantian agar pendengar merasa diajak berinteraksi langsung."
  },
  {
    kondisi: (data) => data.wpmRata > 155,
    saran: "Tempo bicaramu cukup tinggi. Biasakan memberi jeda satu detik di setiap titik akhir kalimat untuk memberi audiens waktu mencerna argumenmu."
  },
  {
    kondisi: (data) => data.wpmRata < 95 && data.wpmRata > 0,
    saran: "Tingkatkan artikulasi dan ketukan berbicara agar pesan presentasi terasa lebih bertenaga dan antusias."
  },
  {
    kondisi: (data) => data.jeda.jumlah > 3,
    saran: "Ada beberapa jeda panjang tanpa suara. Susun poin-poin presentasimu dalam kartu pengingat mental agar alur materi mengalir lancar."
  }
];

/**
 * Menghitung sub-skor WPM (0.0 sampai 1.0).
 * - Nilai 1.0 jika 100–150 WPM (ideal).
 * - Turun linear ke 0 jika <= 60 atau >= 200 WPM.
 */
export function hitungSkorWpm(wpm) {
  if (wpm <= 60 || wpm >= 200) return 0.0;
  if (wpm >= 100 && wpm <= 150) return 1.0;
  if (wpm < 100) {
    // Linear dari 60 (skor 0) ke 100 (skor 1)
    return (wpm - 60) / 40;
  }
  // Linear dari 150 (skor 1) ke 200 (skor 0)
  return (200 - wpm) / 50;
}

/**
 * Menghitung sub-skor kata pengisi (0.0 sampai 1.0).
 * - Nilai 1.0 jika <= 2 filler per menit.
 * - Nilai 0.0 jika >= 10 filler per menit.
 * - Linear di antaranya.
 */
export function hitungSkorFiller(totalFiller, durasiDetik) {
  const durasiMenit = Math.max(durasiDetik / 60, 0.5);
  const rasioPerMenit = totalFiller / durasiMenit;

  if (rasioPerMenit <= 2) return 1.0;
  if (rasioPerMenit >= 10) return 0.0;

  // Linear dari 2 (skor 1) ke 10 (skor 0)
  return (10 - rasioPerMenit) / 8;
}

/**
 * Menghitung sub-skor jeda hening (0.0 sampai 1.0).
 * - 1.0 jika 0 jeda hening panjang.
 * - Berkurang 0.25 untuk setiap jeda hening > 3 detik.
 * - Nilai minimal 0.0.
 */
export function hitungSkorJeda(jumlahJeda) {
  return Math.max(1.0 - (jumlahJeda * 0.25), 0.0);
}

/**
 * Tabel bobot skor sesuai Bagian 6.2 GEMINI.md. Keduanya berjumlah tepat 100
 * saat seluruh metrik di dalamnya benar-benar terukur.
 */
export const BOBOT_SKOR = {
  tanpaPostur: { wpm: 35, filler: 27, pandang: 27, jeda: 11 },
  denganPostur: { wpm: 30, filler: 25, pandang: 25, jeda: 10, postur: 10 }
};

/**
 * Membatasi sebuah nilai ke rentang 0.0–1.0 agar tidak ada sub-skor liar.
 */
function klem01(nilai) {
  const angka = Number(nilai);
  if (!Number.isFinite(angka)) return 0;
  return Math.min(Math.max(angka, 0), 1);
}

/**
 * Menghitung skor total akhir (0–100) berdasarkan modul yang benar-benar terukur.
 *
 * CARA KERJA:
 * 1. Memilih tabel bobot dasar: dengan postur atau tanpa postur (Bagian 6.2).
 * 2. MEMBUANG komponen yang modulnya tidak menghasilkan data. Contoh saat ini:
 *    modul arah pandang dilumpuhkan sampai Tahap 2, sehingga kunci `pandang`
 *    dikeluarkan dari tabel bobot alih-alih diisi angka karangan.
 * 3. MENORMALKAN ULANG sisa bobot supaya totalnya kembali 100. Bobot metrik yang
 *    hilang otomatis terbagi ke metrik lain secara proporsional, persis prinsip
 *    yang sudah dipakai untuk kondisi postur nonaktif. Karena kedua tabel dasar
 *    sudah berjumlah 100, normalisasi ini tidak mengubah apa pun ketika seluruh
 *    modul aktif: hasilnya identik dengan rumus lama.
 * 4. Menjumlahkan bobot ternormalisasi dikali sub-skor masing-masing komponen.
 *
 * Alasan desainnya: skor harus selalu berarti "persentase dari yang benar-benar
 * diukur". Metrik yang tidak terukur tidak boleh menambah maupun mengurangi nilai.
 *
 * @param {Object} metrik - Objek sesi lengkap (lihat skema Bagian 6.3)
 * @param {boolean} posturAktif - Preferensi pengguna untuk mengaktifkan modul postur
 * @returns {number} Skor bulat 0–100
 */
export function hitungSkorTotal(metrik, posturAktif = false) {
  // Postur hanya ikut dihitung bila pengguna memintanya DAN modulnya benar-benar
  // melaporkan diri aktif. Checkbox yang dicentang di atas modul stub tidak cukup.
  const posturTerukur = Boolean(posturAktif && metrik.postur && metrik.postur.aktif);
  const bobot = { ...(posturTerukur ? BOBOT_SKOR.denganPostur : BOBOT_SKOR.tanpaPostur) };

  const subSkor = {
    wpm: hitungSkorWpm(metrik.wpmRata),
    filler: hitungSkorFiller(metrik.filler.total, metrik.durasiDetik),
    jeda: hitungSkorJeda(metrik.jeda ? metrik.jeda.jumlah : 0)
  };

  // Arah pandang: hanya masuk hitungan bila modulnya melaporkan data terukur.
  if (metrik.pandangTersedia === true) {
    subSkor.pandang = klem01(metrik.pandangPersen);
  } else {
    delete bobot.pandang;
  }

  if (posturTerukur) {
    subSkor.postur = klem01(metrik.postur.skorAudiens);
  } else {
    delete bobot.postur;
  }

  const totalBobot = Object.values(bobot).reduce((a, b) => a + b, 0);
  if (totalBobot <= 0) return 0;

  let skorAkhir = 0;
  for (const [nama, nilaiBobot] of Object.entries(bobot)) {
    const bobotTernormalisasi = (nilaiBobot / totalBobot) * 100;
    skorAkhir += bobotTernormalisasi * (subSkor[nama] || 0);
  }

  return Math.round(Math.min(Math.max(skorAkhir, 0), 100));
}

/**
 * Menghasilkan kalimat ringkasan otomatis yang suportif.
 * Format: Menyebut kekuatan terbesar dan 1 perbaikan utama.
 */
export function buatKalimatRingkasan(metrik, skorTotal) {
  const sWpm = hitungSkorWpm(metrik.wpmRata);
  const sFiller = hitungSkorFiller(metrik.filler.total, metrik.durasiDetik);
  // Arah pandang hanya boleh disebut dalam kalimat evaluasi bila benar-benar diukur.
  const pandangTersedia = metrik.pandangTersedia === true;
  const sPandang = pandangTersedia ? klem01(metrik.pandangPersen) : 0;

  let kekuatan = "Kecepatan bicaramu sangat teratur";
  if (pandangTersedia && sPandang > 0.8) {
    kekuatan = "Kontak pandangmu ke depan sangat konsisten";
  } else if (sFiller > 0.8) {
    kekuatan = "Pilihan katamu sangat bersih dari kata pengisi";
  } else if (sWpm > 0.8) {
    kekuatan = "Ketukan dan tempo bicaramu sudah ideal";
  }

  let perbaikan = "pertahankan ketenangan ini untuk sesi berikutnya.";
  if (metrik.filler.total > 6) {
    perbaikan = `fokus berikutnya: kurangi kata pengisi (${metrik.filler.total}× terdeteksi).`;
  } else if (pandangTersedia && sPandang < 0.6) {
    perbaikan = "fokus berikutnya: lebih sering menatap lurus ke arah audiens.";
  } else if (metrik.wpmRata > 160) {
    perbaikan = "fokus berikutnya: beri jeda sejenak di tiap jeda kalimat.";
  }

  return `${kekuatan} — ${perbaikan}`;
}

/**
 * Menentukan daftar saran terbaik berdasarkan data sesi.
 */
export function pilihSaran(dataSesi) {
  const saranTerpilih = [];
  for (const item of ATURAN_SARAN) {
    if (item.kondisi(dataSesi)) {
      saranTerpilih.push(item.saran);
    }
    if (saranTerpilih.length >= 3) break;
  }

  // Jika tidak ada kondisi kritis yang terpicu, berikan saran penguatan
  if (saranTerpilih.length === 0) {
    saranTerpilih.push("Struktur bicaramu sudah sangat baik! Pertahankan kontak mata dan artikulasi jelas ini saat tampil di hadapan audiens.");
  }

  return saranTerpilih;
}
