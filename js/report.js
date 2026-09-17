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
  SUBSKOR_KUAT: 0.8,
  SKOR_MIN_BOBOT_TERUKUR: 50
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
    // Tiap aturan wajib memeriksa ketersediaan metriknya lebih dulu. Metrik yang
    // tidak terukur bernilai null, dan perbandingan apa pun dengan null di
    // JavaScript menghasilkan jawaban yang menyesatkan.
    kondisi: (data, a) => data.fillerTersedia === true && data.filler.total > a.FILLER_SARAN_TOTAL,
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
    kondisi: (data, a) => data.wpmTersedia === true && data.wpmRata > a.WPM_SARAN_CEPAT,
    saran: "Tempo bicaramu cukup tinggi. Biasakan memberi jeda satu detik di setiap titik akhir kalimat untuk memberi audiens waktu mencerna argumenmu."
  },
  {
    kondisi: (data, a) => data.wpmTersedia === true && data.wpmRata < a.WPM_SARAN_PELAN && data.wpmRata > 0,
    saran: "Tempo bicaramu tergolong pelan. Coba naikkan sedikit ketukan dan tekankan kata kuncinya agar pesan presentasi terasa lebih bertenaga."
  },
  {
    // Sama seperti arah pandang: saran jeda hanya boleh muncul bila jeda diukur.
    kondisi: (data, a) => data.jedaTersedia === true && data.jeda.jumlah > a.JEDA_SARAN_JUMLAH,
    saran: "Ada beberapa jeda panjang tanpa suara. Susun poin-poin presentasimu dalam kartu pengingat mental agar alur materi mengalir lancar."
  }
];

/**
 * Jaring pengaman tabel bobot. Tabel yang sebenarnya dipakai ada di
 * CONFIG.BOBOT_SKOR pada js/app.js, ditulis lengkap di sana supaya pemilik
 * proyek bisa membaca dan mengubahnya tanpa membuka berkas ini. Nilai di sini
 * sengaja dibuat identik.
 */
export const BOBOT_SKOR = {
  lengkap: { wpm: 35, filler: 27, pandang: 27, jeda: 11 },
  lengkapDenganPostur: { wpm: 30, filler: 25, pandang: 25, jeda: 10, postur: 10 },
  suaraSaja: { wpm: 48, filler: 37, jeda: 15 }
};

/**
 * Memilih tabel bobot sesuai mode sesi dan modul yang benar-benar aktif.
 *
 * CARA KERJA:
 * Mode 'suara-saja' memakai tabel tersendiri yang memang tidak punya komponen
 * arah pandang, karena kameranya tidak pernah dinyalakan. Mode lengkap memakai
 * tabel dengan atau tanpa postur. Tabel diambil dari CONFIG bila dioper, dan
 * disalin supaya pemanggil tidak pernah mengubah tabel aslinya saat sebuah
 * komponen dikeluarkan dari hitungan.
 */
function pilihTabelBobot(mode, posturTerukur, config) {
  const tabel = (config && config.BOBOT_SKOR) ? config.BOBOT_SKOR : BOBOT_SKOR;

  if (mode === 'suara-saja') return { ...tabel.suaraSaja };
  return { ...(posturTerukur ? tabel.lengkapDenganPostur : tabel.lengkap) };
}

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
 * 1. Memilih tabel bobot dasar dari CONFIG sesuai mode sesi: lengkap, lengkap
 *    dengan postur, atau suara saja (tanpa kamera, tanpa komponen pandang).
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
  const hasil = hitungSkorRinci(metrik, posturAktif, config);
  return hasil.skor;
}

/**
 * Versi rinci dari hitungSkorTotal: selain skor, mengembalikan metrik mana yang
 * ikut dihitung dan mana yang tidak.
 *
 * CARA KERJA:
 * 1. Tabel bobot dipilih sesuai mode, lalu tiap komponen diperiksa apakah
 *    modulnya BENAR-BENAR menghasilkan data. Yang tidak, bobotnya dibuang.
 * 2. Sisa bobot dinormalkan ulang ke 100, persis mekanisme yang sudah dipakai
 *    untuk modul postur yang belum aktif.
 * 3. Bila sisa bobot yang benar-benar terukur lebih kecil dari
 *    CONFIG.SKOR_MIN_BOBOT_TERUKUR, skornya TIDAK DIHITUNG SAMA SEKALI dan
 *    fungsi mengembalikan null. Angka yang disusun dari satu-dua metrik sisa
 *    akan terlihat sama meyakinkannya dengan skor penuh padahal tidak, dan itu
 *    menyesatkan pembacanya. Rapor lebih baik mengatakan "tidak bisa dinilai".
 *
 * @returns {{skor: number|null, terukur: string[], hilang: string[], bobotTerukur: number}}
 */
export function hitungSkorRinci(metrik, posturAktif = false, config) {
  const a = ambang(config);

  // Postur hanya ikut dihitung bila pengguna memintanya DAN modulnya benar-benar
  // melaporkan diri aktif. Checkbox yang dicentang di atas modul stub tidak cukup.
  const posturTerukur = Boolean(posturAktif && metrik.postur && metrik.postur.aktif);
  const bobot = pilihTabelBobot(metrik.mode, posturTerukur, config);
  const totalBobotPenuh = Object.values(bobot).reduce((x, y) => x + y, 0);
  const subSkor = {};
  const hilang = [];

  // Kecepatan bicara dan kata pengisi sama-sama bersumber dari transkrip. Bila
  // pengenal suara tidak pernah menghasilkan apa pun, keduanya tidak terukur:
  // "0 kata per menit" dan "0 kata pengisi" bukan hasil pengukuran, dan yang
  // kedua bahkan akan memberi nilai sempurna gratis.
  if (metrik.wpmTersedia === true) {
    subSkor.wpm = hitungSkorWpm(metrik.wpmRata, a);
  } else {
    delete bobot.wpm;
    hilang.push('kecepatan bicara');
  }

  if (metrik.fillerTersedia === true) {
    subSkor.filler = hitungSkorFiller(metrik.filler.total, metrik.durasiDetik, a);
  } else {
    delete bobot.filler;
    hilang.push('kata pengisi');
  }

  // Jeda panjang: hanya masuk hitungan bila suara ruangan sempat diukur. Tanpa
  // ambang bicara, "0 jeda" berarti tidak diukur, bukan lancar.
  if (metrik.jedaTersedia === true) {
    subSkor.jeda = hitungSkorJeda(metrik.jeda.jumlah, a);
  } else {
    delete bobot.jeda;
    hilang.push('jeda panjang');
  }

  // Arah pandang: hanya masuk hitungan bila modulnya melaporkan data terukur.
  // Pada mode 'suara-saja' kunci ini memang tidak ada sejak awal.
  if (metrik.pandangTersedia === true) {
    subSkor.pandang = klem01(metrik.pandangPersen);
  } else {
    if (bobot.pandang !== undefined) hilang.push('arah pandang');
    delete bobot.pandang;
  }

  if (posturTerukur) {
    subSkor.postur = klem01(metrik.postur.skorAudiens);
  } else {
    delete bobot.postur;
  }

  const totalBobot = Object.values(bobot).reduce((x, y) => x + y, 0);
  const bobotTerukur = totalBobotPenuh > 0 ? (totalBobot / totalBobotPenuh) * 100 : 0;
  const terukur = Object.keys(bobot);

  if (totalBobot <= 0 || bobotTerukur < a.SKOR_MIN_BOBOT_TERUKUR) {
    return { skor: null, terukur, hilang, bobotTerukur: Math.round(bobotTerukur) };
  }

  let skorAkhir = 0;
  for (const [nama, nilaiBobot] of Object.entries(bobot)) {
    const bobotTernormalisasi = (nilaiBobot / totalBobot) * 100;
    skorAkhir += bobotTernormalisasi * (subSkor[nama] || 0);
  }

  return {
    skor: Math.round(Math.min(Math.max(skorAkhir, 0), 100)),
    terukur,
    hilang,
    bobotTerukur: Math.round(bobotTerukur)
  };
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

  // ATURAN MUTLAK: kalimat ini hanya boleh menyebut metrik yang BENAR-BENAR
  // diukur. Sebelum aturan ini ada, sesi yang pengenal suaranya gagal total
  // memuji "pilihan katamu sangat bersih dari kata pengisi", padahal tidak ada
  // satu kata pun yang pernah terdengar. Pujian untuk sesuatu yang tidak diukur
  // jauh lebih merusak kepercayaan daripada rapor yang mengaku tidak tahu.
  const adaWpm = metrik.wpmTersedia === true;
  const adaFiller = metrik.fillerTersedia === true;
  const adaPandang = metrik.pandangTersedia === true;

  if (!adaWpm && !adaFiller && !adaPandang) {
    return 'Sesi ini tidak menghasilkan metrik yang bisa dinilai. Periksa izin mikrofon dan kamera, lalu coba lagi.';
  }

  const sWpm = adaWpm ? hitungSkorWpm(metrik.wpmRata, a) : 0;
  const sFiller = adaFiller ? hitungSkorFiller(metrik.filler.total, metrik.durasiDetik, a) : 0;
  const sPandang = adaPandang ? klem01(metrik.pandangPersen) : 0;

  let kekuatan = null;
  if (adaPandang && sPandang > a.SUBSKOR_KUAT) {
    kekuatan = 'Kontak pandangmu ke depan sangat konsisten';
  } else if (adaFiller && sFiller > a.SUBSKOR_KUAT) {
    kekuatan = 'Pilihan katamu sangat bersih dari kata pengisi';
  } else if (adaWpm && sWpm > a.SUBSKOR_KUAT) {
    kekuatan = 'Ketukan dan tempo bicaramu sudah ideal';
  } else {
    kekuatan = 'Latihan ini sudah tercatat';
  }

  let perbaikan = 'pertahankan ketenangan ini untuk sesi berikutnya.';
  if (adaFiller && metrik.filler.total > a.FILLER_RINGKASAN_TOTAL) {
    perbaikan = `fokus berikutnya: kurangi kata pengisi (${metrik.filler.total}× terdeteksi).`;
  } else if (adaPandang && sPandang < a.PANDANG_SARAN_MIN) {
    perbaikan = 'fokus berikutnya: lebih sering menatap lurus ke arah audiens.';
  } else if (adaWpm && metrik.wpmRata > a.WPM_RINGKASAN_CEPAT) {
    perbaikan = 'fokus berikutnya: beri jeda sejenak di tiap jeda kalimat.';
  }

  return `${kekuatan} — ${perbaikan}`;
}

// ============================================================================
// GRAFIK (Chart.js)
// ============================================================================
//
// Dua aturan yang berlaku untuk seluruh grafik di berkas ini:
//
// 1. WARNA DIAMBIL DARI TOKEN CSS, bukan dari bawaan Chart.js. Chart.js akan
//    memakai biru dan abu-abunya sendiri bila dibiarkan, dan itu langsung
//    melanggar aturan aksen tunggal di GEMINI.md. Nilai token dibaca saat
//    menggambar lewat getComputedStyle, sehingga mengubah satu nilai di
//    style.css otomatis mengubah grafiknya juga.
// 2. INSTANS LAMA WAJIB DIHANCURKAN sebelum menggambar ulang di kanvas yang
//    sama. Chart.js menolak memakai kanvas yang masih dipegang instans lain,
//    dan tanpa ini grafik akan mati diam-diam pada sesi kedua.
// ============================================================================

// Menyimpan instans Chart.js per id kanvas, supaya bisa dihancurkan saat digambar ulang
const instansGrafik = {};

/**
 * Membaca satu token desain dari CSS supaya grafik memakai palet yang sama
 * dengan seluruh aplikasi.
 */
function token(nama) {
  return getComputedStyle(document.documentElement).getPropertyValue(nama).trim();
}

/**
 * Menyiapkan kanvas: memastikan Chart.js benar-benar termuat, lalu menghancurkan
 * grafik lama di kanvas yang sama.
 *
 * @returns {boolean} False bila Chart.js tidak tersedia (CDN gagal saat luring)
 */
function siapkanKanvas(kanvas) {
  if (!kanvas) return false;
  if (typeof window.Chart === 'undefined') {
    console.warn('Chart.js tidak termuat; grafik dilewati.');
    return false;
  }
  if (instansGrafik[kanvas.id]) {
    instansGrafik[kanvas.id].destroy();
    delete instansGrafik[kanvas.id];
  }
  return true;
}

/**
 * Mengubah detik menjadi label sumbu waktu MM:SS.
 */
function labelWaktu(detik) {
  const m = Math.floor(detik / 60).toString().padStart(2, '0');
  const s = Math.round(detik % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Menggambar tren skor beberapa sesi terakhir di Layar Riwayat.
 *
 * CARA KERJA:
 * Daftar sesi datang terurut dari yang terbaru, jadi dibalik dulu supaya waktu
 * berjalan ke kanan seperti grafik pada umumnya. Hanya sejumlah sesi terakhir
 * yang ditampilkan agar titiknya tetap terbaca.
 *
 * Mode sesi ikut disebut di tooltip, bukan disembunyikan: skor mode suara saja
 * disusun dari tiga metrik dan skor mode lengkap dari empat, sehingga keduanya
 * tidak benar-benar sebanding meski berada di satu garis.
 *
 * @param {HTMLCanvasElement} kanvas
 * @param {Array<Object>} daftarSesi - Terurut dari terbaru ke terlama
 * @param {number} maksSesi - Berapa sesi terakhir yang digambar
 * @returns {boolean} False bila grafik tidak bisa digambar
 */
export function gambarGrafikTrenSkor(kanvas, daftarSesi, maksSesi = 10) {
  if (!siapkanKanvas(kanvas)) return false;
  if (!Array.isArray(daftarSesi) || daftarSesi.length === 0) return false;


  // Sesi tanpa skor (metriknya terlalu sedikit untuk dinilai) tidak bisa jadi
  // titik pada garis tren: menggambarnya sebagai nol akan terbaca sebagai
  // penurunan tajam yang tidak pernah terjadi.
  const berskor = daftarSesi.filter(s => typeof s.skor === 'number');
  if (berskor.length < 2) return false;

  const urutLama = berskor.slice(0, maksSesi).reverse();
  const warnaAksen = token('--sorot');
  const warnaTeks = token('--redup');
  const warnaGaris = token('--border-terang');

  instansGrafik[kanvas.id] = new window.Chart(kanvas, {
    type: 'line',
    data: {
      labels: urutLama.map(s => new Date(s.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })),
      datasets: [{
        label: 'Skor',
        data: urutLama.map(s => s.skor),
        borderColor: warnaAksen,
        backgroundColor: warnaAksen,
        borderWidth: 2,
        pointRadius: 4,
        tension: 0.25,
        fill: false
      }]
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (item) => urutLama[item[0].dataIndex].judul,
            label: (item) => {
              const sesi = urutLama[item.dataIndex];
              const mode = sesi.mode === 'suara-saja' ? 'mode suara saja'
                : sesi.mode === 'lengkap' ? 'mode lengkap'
                : 'mode tidak tercatat';
              return `skor ${sesi.skor} — ${mode}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: warnaTeks, font: { size: 11 } },
          grid: { color: warnaGaris, drawTicks: false }
        },
        y: {
          min: 0,
          max: 100,
          ticks: { color: warnaTeks, font: { size: 11 }, stepSize: 25 },
          grid: { color: warnaGaris, drawTicks: false }
        }
      }
    }
  });

  return true;
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
    // Tidak ada aturan yang menyala bisa berarti dua hal yang sangat berbeda:
    // semuanya sudah baik, atau tidak ada yang sempat diukur. Keduanya tidak
    // boleh memakai kalimat yang sama.
    const adaYangTerukur = dataSesi.wpmTersedia === true
      || dataSesi.fillerTersedia === true
      || dataSesi.pandangTersedia === true;

    saranTerpilih.push(adaYangTerukur
      ? 'Struktur bicaramu sudah sangat baik! Pertahankan kontak mata dan artikulasi jelas ini saat tampil di hadapan audiens.'
      : 'Belum ada metrik yang bisa dinilai dari sesi ini, jadi belum ada saran yang bisa diberikan. Pastikan mikrofon dan kamera bekerja, lalu ulangi latihannya.');
  }

  return saranTerpilih;
}
