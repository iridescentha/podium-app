/**
 * ============================================================================
 * MODUL PERHITUNGAN SKOR & RAPOR (REPORT) - PODIUM
 * ============================================================================
 * File: js/report.js
 * Deskripsi:
 * Mengkalkulasi skor akhir (0-100) sesuai rumus pasti pada Bagian 6.2,
 * menyusun kalimat evaluasi suportif, dan menyiapkan saran konkret.
 *
 * ATURAN AMBANG BATAS:
 * Modul ini tidak menyimpan satu pun angka ambang miliknya sendiri. Seluruh
 * ambang diambil dari objek CONFIG di js/app.js yang dioper sebagai argumen.
 * AMBANG_BAWAAN di bawah hanya jaring pengaman bila CONFIG tidak dioper, dan
 * nilainya sengaja dibuat identik dengan CONFIG. Tujuannya sesuai Bagian 9
 * brief: mengkalibrasi aplikasi ini cukup dengan menyunting satu objek, tanpa
 * perlu membuka logika penilaian sama sekali.
 * ============================================================================
 */

/**
 * Jaring pengaman ambang batas. Selalu tertimpa oleh CONFIG dari app.js.
 */
const AMBANG_BAWAAN = {
  WPM_SLOW: 100,
  WPM_FAST: 150,
  WPM_MIN_SCORE: 60,
  WPM_MAX_SCORE: 200,
  WPM_SARAN_PELAN: 95,
  WPM_SARAN_CEPAT: 155,
  WPM_RINGKASAN_CEPAT: 160,
  FILLER_IDEAL_PER_MENIT: 2,
  FILLER_BURUK_PER_MENIT: 10,
  FILLER_SARAN_TOTAL: 8,
  FILLER_RINGKASAN_TOTAL: 6,
  JEDA_PENALTI_PER_JEDA: 0.25,
  JEDA_SARAN_JUMLAH: 3,
  PANDANG_SARAN_MIN: 0.6,
  SUBSKOR_KUAT: 0.8
};

/**
 * Menggabungkan CONFIG yang dioper dengan jaring pengaman.
 */
function ambang(config) {
  return { ...AMBANG_BAWAAN, ...(config || {}) };
}

/**
 * Daftar aturan saran konkret. Urutannya menentukan prioritas: aturan paling
 * atas yang cocok akan tampil lebih dulu, dan maksimal tiga saran dipakai.
 *
 * Setiap kondisi menerima data sesi DAN ambang batas, sehingga menyunting
 * CONFIG langsung mengubah kapan saran ini muncul tanpa menyentuh berkas ini.
 */
export const ATURAN_SARAN = [
  {
    kondisi: (data, a) => data.filler.total > a.FILLER_SARAN_TOTAL,
    saran: "Gunakan teknik jeda sadar: daripada mengisi keheningan dengan 'kayak' atau 'gitu', tarik napas lembut dan biarkan hening sejenak sebelum kalimat berikutnya."
  },
  {
    // Penjaga `pandangTersedia` wajib ada: saat modul arah pandang mati,
    // pandangPersen bernilai null dan `null < 0.6` bernilai true di JavaScript,
    // sehingga saran ini akan muncul untuk metrik yang tidak pernah diukur.
    kondisi: (data, a) => data.pandangTersedia === true && data.pandangPersen < a.PANDANG_SARAN_MIN,
    saran: "Gunakan teknik segitiga pandang: jaga tatapan ke arah kamera/audiens secara bergantian agar pendengar merasa diajak berinteraksi langsung."
  },
  {
    kondisi: (data, a) => data.wpmRata > a.WPM_SARAN_CEPAT,
    saran: "Tempo bicaramu cukup tinggi. Biasakan memberi jeda satu detik di setiap titik akhir kalimat untuk memberi audiens waktu mencerna argumenmu."
  },
  {
    kondisi: (data, a) => data.wpmRata < a.WPM_SARAN_PELAN && data.wpmRata > 0,
    saran: "Tempo bicaramu tergolong pelan. Coba naikkan sedikit ketukan dan tekankan kata kuncinya agar pesan presentasi terasa lebih bertenaga."
  },
  {
    // Sama seperti arah pandang: saran jeda hanya boleh muncul bila jeda diukur.
    kondisi: (data, a) => data.jedaTersedia === true && data.jeda.jumlah > a.JEDA_SARAN_JUMLAH,
    saran: "Ada beberapa jeda panjang tanpa suara. Susun poin-poin presentasimu dalam kartu pengingat mental agar alur materi mengalir lancar."
  }
];

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
 * Menghitung sub-skor kecepatan bicara (0.0 sampai 1.0).
 *
 * CARA KERJA:
 * Nilai penuh diberikan selama kecepatan berada di dalam rentang nyaman
 * (WPM_SLOW sampai WPM_FAST). Di luar itu skor turun lurus ke nol menuju kedua
 * batas ekstrem (WPM_MIN_SCORE dan WPM_MAX_SCORE). Bentuk seperti dataran tinggi
 * dengan dua lereng ini dipilih supaya perbedaan kecil di dalam rentang nyaman
 * tidak mengubah skor, sementara penyimpangan jauh tetap terasa akibatnya.
 */
export function hitungSkorWpm(wpm, config) {
  const a = ambang(config);
  if (wpm <= a.WPM_MIN_SCORE || wpm >= a.WPM_MAX_SCORE) return 0.0;
  if (wpm >= a.WPM_SLOW && wpm <= a.WPM_FAST) return 1.0;

  if (wpm < a.WPM_SLOW) {
    // Lereng naik: dari WPM_MIN_SCORE (skor 0) ke WPM_SLOW (skor 1)
    return (wpm - a.WPM_MIN_SCORE) / (a.WPM_SLOW - a.WPM_MIN_SCORE);
  }
  // Lereng turun: dari WPM_FAST (skor 1) ke WPM_MAX_SCORE (skor 0)
  return (a.WPM_MAX_SCORE - wpm) / (a.WPM_MAX_SCORE - a.WPM_FAST);
}

/**
 * Menghitung sub-skor kata pengisi (0.0 sampai 1.0).
 *
 * CARA KERJA:
 * Jumlah kata pengisi diubah lebih dulu menjadi rasio per menit, supaya sesi
 * panjang tidak otomatis terlihat lebih buruk daripada sesi pendek. Rasio di
 * bawah ambang ideal mendapat nilai penuh, di atas ambang buruk mendapat nol,
 * dan di antaranya turun lurus.
 */
export function hitungSkorFiller(totalFiller, durasiDetik, config) {
  const a = ambang(config);
  const durasiMenit = Math.max(durasiDetik / 60, 0.5);
  const rasioPerMenit = totalFiller / durasiMenit;

  if (rasioPerMenit <= a.FILLER_IDEAL_PER_MENIT) return 1.0;
  if (rasioPerMenit >= a.FILLER_BURUK_PER_MENIT) return 0.0;

  const rentang = a.FILLER_BURUK_PER_MENIT - a.FILLER_IDEAL_PER_MENIT;
  return (a.FILLER_BURUK_PER_MENIT - rasioPerMenit) / rentang;
}

/**
 * Menghitung sub-skor jeda hening (0.0 sampai 1.0).
 *
 * CARA KERJA:
 * Dimulai dari nilai penuh, lalu dikurangi sebesar JEDA_PENALTI_PER_JEDA untuk
 * setiap jeda panjang yang terdeteksi, dengan batas bawah nol.
 */
export function hitungSkorJeda(jumlahJeda, config) {
  const a = ambang(config);
  return Math.max(1.0 - (jumlahJeda * a.JEDA_PENALTI_PER_JEDA), 0.0);
}

/**
 * Menghitung skor total akhir (0–100) berdasarkan modul yang benar-benar terukur.
 *
 * CARA KERJA:
 * 1. Memilih tabel bobot dasar: dengan postur atau tanpa postur (Bagian 6.2).
 * 2. MEMBUANG komponen yang modulnya tidak menghasilkan data. Contohnya: model
 *    wajah gagal dimuat (kunci `pandang` dibuang) atau suara ruangan gagal
 *    diukur (kunci `jeda` dibuang), alih-alih diisi angka karangan.
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
 * @param {Object} config - Objek CONFIG dari app.js
 * @returns {number} Skor bulat 0–100
 */
export function hitungSkorTotal(metrik, posturAktif = false, config) {
  const a = ambang(config);

  // Postur hanya ikut dihitung bila pengguna memintanya DAN modulnya benar-benar
  // melaporkan diri aktif. Checkbox yang dicentang di atas modul stub tidak cukup.
  const posturTerukur = Boolean(posturAktif && metrik.postur && metrik.postur.aktif);
  const bobot = { ...(posturTerukur ? BOBOT_SKOR.denganPostur : BOBOT_SKOR.tanpaPostur) };

  const subSkor = {
    wpm: hitungSkorWpm(metrik.wpmRata, a),
    filler: hitungSkorFiller(metrik.filler.total, metrik.durasiDetik, a)
  };

  // Jeda panjang: hanya masuk hitungan bila suara ruangan sempat diukur. Tanpa
  // ambang bicara, "0 jeda" berarti tidak diukur, bukan lancar, dan dulu justru
  // memberi sub-skor penuh gratis.
  if (metrik.jedaTersedia === true) {
    subSkor.jeda = hitungSkorJeda(metrik.jeda.jumlah, a);
  } else {
    delete bobot.jeda;
  }

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

  const totalBobot = Object.values(bobot).reduce((x, y) => x + y, 0);
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
 *
 * CARA KERJA:
 * Kalimat selalu dibentuk dari dua bagian: satu kekuatan yang benar-benar
 * terukur, lalu satu fokus perbaikan. Urutan pemeriksaannya menentukan
 * prioritas, dan metrik yang modulnya mati tidak pernah ikut disebut.
 */
export function buatKalimatRingkasan(metrik, skorTotal, config) {
  const a = ambang(config);
  const sWpm = hitungSkorWpm(metrik.wpmRata, a);
  const sFiller = hitungSkorFiller(metrik.filler.total, metrik.durasiDetik, a);

  // Arah pandang hanya boleh disebut dalam kalimat evaluasi bila benar-benar diukur.
  const pandangTersedia = metrik.pandangTersedia === true;
  const sPandang = pandangTersedia ? klem01(metrik.pandangPersen) : 0;

  let kekuatan = "Kecepatan bicaramu sangat teratur";
  if (pandangTersedia && sPandang > a.SUBSKOR_KUAT) {
    kekuatan = "Kontak pandangmu ke depan sangat konsisten";
  } else if (sFiller > a.SUBSKOR_KUAT) {
    kekuatan = "Pilihan katamu sangat bersih dari kata pengisi";
  } else if (sWpm > a.SUBSKOR_KUAT) {
    kekuatan = "Ketukan dan tempo bicaramu sudah ideal";
  }

  let perbaikan = "pertahankan ketenangan ini untuk sesi berikutnya.";
  if (metrik.filler.total > a.FILLER_RINGKASAN_TOTAL) {
    perbaikan = `fokus berikutnya: kurangi kata pengisi (${metrik.filler.total}× terdeteksi).`;
  } else if (pandangTersedia && sPandang < a.PANDANG_SARAN_MIN) {
    perbaikan = "fokus berikutnya: lebih sering menatap lurus ke arah audiens.";
  } else if (metrik.wpmRata > a.WPM_RINGKASAN_CEPAT) {
    perbaikan = "fokus berikutnya: beri jeda sejenak di tiap jeda kalimat.";
  }

  return `${kekuatan} — ${perbaikan}`;
}

/**
 * Menentukan daftar saran terbaik berdasarkan data sesi.
 *
 * CARA KERJA:
 * Menelusuri ATURAN_SARAN dari atas ke bawah, mengumpulkan setiap saran yang
 * kondisinya terpenuhi, dan berhenti setelah tiga saran terkumpul agar rapor
 * tidak berubah menjadi daftar tugas yang melelahkan. Bila tidak ada kondisi
 * yang menyala sama sekali, satu kalimat penguatan diberikan sebagai gantinya.
 */
export function pilihSaran(dataSesi, config) {
  const a = ambang(config);
  const saranTerpilih = [];

  for (const item of ATURAN_SARAN) {
    if (item.kondisi(dataSesi, a)) {
      saranTerpilih.push(item.saran);
    }
    if (saranTerpilih.length >= 3) break;
  }

  if (saranTerpilih.length === 0) {
    saranTerpilih.push("Struktur bicaramu sudah sangat baik! Pertahankan kontak mata dan artikulasi jelas ini saat tampil di hadapan audiens.");
  }

  return saranTerpilih;
}
