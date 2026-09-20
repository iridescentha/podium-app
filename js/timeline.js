/**
 * ============================================================================
 * MODUL REPLAY TIMELINE - PODIUM
 * ============================================================================
 * File: js/timeline.js
 *
 * Menggambar lintasan waktu satu sesi: satu sumbu waktu mendatar dari 00:00
 * sampai durasi sesi, dengan beberapa baris yang berbagi sumbu itu.
 *
 * ----------------------------------------------------------------------------
 * KENAPA BUKAN GRAFIK
 * ----------------------------------------------------------------------------
 * Rapor sudah memberi angka agregat yang benar tetapi tidak bisa ditindaklanjuti
 * ("11 kata pengisi"). Lintasan ini menjawab pertanyaan yang berbeda: DI MANA
 * masalahnya terjadi. Bentuknya karena itu mengikuti bilah pencari video, bukan
 * diagram: satu sumbu waktu, satu posisi yang bisa dipilih, dan panel yang
 * menerangkan apa yang terjadi di posisi itu.
 *
 * Isinya lengkap sesuai TAHAP-4b.md: lintasan statis, kepala pemutar yang bisa
 * diklik, diseret, dan digeser papan ketik, panel keterangan berisi ringkasan
 * kejadian dan potongan transkrip, navigasi antar masalah, serta mode putar
 * dengan pilihan kecepatan.
 *
 * MODE PUTAR MEMUTAR DATA, BUKAN REKAMAN. Tidak ada audio maupun video yang
 * pernah disimpan; yang berjalan hanyalah kepala pemutar di sumbu waktu beserta
 * angka dan teks yang sudah ada di memori.
 *
 * ----------------------------------------------------------------------------
 * CARA KERJA PENEMPATAN
 * ----------------------------------------------------------------------------
 * Seluruh baris memakai satu fungsi pemetaan yang sama: detik dibagi durasi
 * sesi menjadi persentase, lalu dipakai sebagai `left` dan `width` dalam persen.
 * Karena satuannya persen dan bukan piksel, lintasan ikut melar mengikuti lebar
 * layar tanpa perlu digambar ulang, dan seluruh baris dijamin sejajar.
 *
 * Elemen HTML biasa dipilih ketimbang kanvas untuk baris kontak pandang dan
 * masalah: tiap segmen dan penanda jadi elemen yang bisa diberi label, dibaca
 * pembaca layar, dan nanti ditunjuk kursor tanpa menghitung koordinat sendiri.
 * Hanya baris kecepatan yang memakai SVG, karena garis patah paling ringkas
 * digambar sebagai satu polyline.
 *
 * ----------------------------------------------------------------------------
 * CATATAN KEJUJURAN
 * ----------------------------------------------------------------------------
 * Cap waktu kata pengisi dan potongan transkrip berasal dari Web Speech API,
 * yang memfinalkan kalimat beberapa saat SETELAH diucapkan. Posisi penanda di
 * lintasan ini karena itu perkiraan, dan seluruh label waktu di UI memakai kata
 * "sekitar". Cap waktu jeda, menunduk, dan wajah tidak terlihat diukur sendiri
 * oleh modul audio dan wajah, jadi lebih rapat ke kejadian aslinya.
 * ============================================================================
 */

// Ambang bawaan, hanya dipakai bila CONFIG tidak dioper dari app.js
const KONFIG_BAWAAN = {
  WPM_SLOW: 100,
  WPM_FAST: 150,
  TIMELINE_JENDELA_DETIK: 8,
  FILLER_WORDS: [],
  FILLER_PREFIX_MIN: 4
};

/**
 * Memformat detik menjadi MM:SS.
 */
function waktuMmSs(detik) {
  const bulat = Math.max(0, Math.round(detik));
  const m = Math.floor(bulat / 60).toString().padStart(2, '0');
  const s = (bulat % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Mengubah posisi detik menjadi persentase lebar lintasan.
 * Dibatasi 0..100 supaya event yang cap waktunya sedikit melewati durasi sesi
 * (selisih pembulatan timer) tetap tergambar di dalam lintasan.
 */
function persen(detik, durasi) {
  if (!(durasi > 0)) return 0;
  return Math.min(100, Math.max(0, (detik / durasi) * 100));
}

/**
 * Menentukan jarak antar penanda sumbu waktu.
 *
 * CARA KERJA:
 * Sesi lima menit dan sesi setengah jam tidak boleh memakai jarak yang sama:
 * yang pertama akan terlalu kosong, yang kedua penuh angka yang saling tindih.
 * Jarak dipilih dari daftar langkah yang lazim dibaca manusia (15 detik, 30
 * detik, 1 menit, dan seterusnya), diambil yang pertama menghasilkan penanda
 * tidak lebih dari delapan buah. Yang dihitung adalah JUMLAH PENANDA, bukan
 * jumlah selangnya: penanda 00:00 ikut digambar, jadi selang n menghasilkan
 * n+1 penanda.
 */
const MAKS_PENANDA_SUMBU = 8;

function langkahSumbu(durasi) {
  const pilihan = [15, 30, 60, 120, 300, 600, 900];
  for (const langkah of pilihan) {
    if (Math.floor(durasi / langkah) + 1 <= MAKS_PENANDA_SUMBU) return langkah;
  }
  return 1800;
}

/**
 * Membuat satu elemen dengan kelas dan isi teks sekaligus.
 */
function elemen(tag, kelas, teks) {
  const el = document.createElement(tag);
  if (kelas) el.className = kelas;
  if (teks !== undefined) el.textContent = teks;
  return el;
}

/**
 * Membuat kerangka satu baris: label kecil di atas, lintasan di bawahnya.
 */
function buatBaris(judul, namaBaris) {
  const baris = elemen('div', 'timeline__baris');
  baris.dataset.baris = namaBaris;
  // Label baris sengaja dibuat kecil dan rapat ke lintasannya. Ini alat ukur
  // yang dibaca sekilas, bukan bagian laporan: yang harus menonjol adalah
  // datanya, bukan namanya.
  if (judul) baris.appendChild(elemen('div', 'timeline__baris-judul', judul));
  const lintasan = elemen('div', 'timeline__lintasan');
  baris.appendChild(lintasan);
  return { baris, lintasan };
}

/**
 * Menggambar sumbu waktu berisi penanda menit.
 */
function gambarSumbu(durasi) {
  // Tanpa label baris: penanda waktunya sudah menerangkan dirinya sendiri.
  const { baris, lintasan } = buatBaris('', 'sumbu');
  lintasan.classList.add('timeline__lintasan--sumbu');

  const langkah = langkahSumbu(durasi);
  for (let detik = 0; detik <= durasi; detik += langkah) {
    const tanda = elemen('div', 'timeline__tanda');
    tanda.style.left = `${persen(detik, durasi)}%`;
    tanda.appendChild(elemen('span', 'timeline__tanda-label', waktuMmSs(detik)));
    lintasan.appendChild(tanda);
  }

  return baris;
}

/**
 * Menggambar baris kontak pandang.
 *
 * CARA KERJA:
 * Dasar lintasan diwarnai sebagai "menatap depan", lalu segmen menunduk dan
 * segmen wajah tidak terlihat ditumpuk di atasnya pada posisi masing-masing.
 * Cara ini dipilih karena modul wajah memang hanya mencatat penyimpangannya
 * (menunduk dan tidak terlihat); sisa waktunya menatap depan, dan menghitung
 * ulang potongan "depan" satu per satu hanya akan mengarang batas yang tidak
 * pernah diukur.
 *
 * Ketiga keadaan dibedakan bukan hanya lewat warna: menunduk berupa blok padat,
 * wajah tidak terlihat berupa arsiran bergaris, dan keduanya diberi label.
 */
function gambarBarisPandang(sesi, durasi) {
  const { baris, lintasan } = buatBaris('Kontak pandang', 'pandang');
  lintasan.classList.add('timeline__lintasan--pandang');

  const tambahSegmen = (daftar, kelas, namaKeadaan) => {
    (daftar || []).forEach(seg => {
      const el = elemen('div', `timeline__segmen ${kelas}`);
      el.style.left = `${persen(seg.mulaiDetik, durasi)}%`;
      el.style.width = `${Math.max(0.6, persen(seg.durasiDetik, durasi))}%`;
      el.title = `${namaKeadaan} sekitar ${waktuMmSs(seg.mulaiDetik)}, ${seg.durasiDetik} detik`;
      lintasan.appendChild(el);
    });
  };

  tambahSegmen(sesi.menundukSegmen, 'timeline__segmen--menunduk', 'Menunduk');
  tambahSegmen(sesi.hilangSegmen, 'timeline__segmen--hilang', 'Wajah tidak terlihat');

  // Lintasan yang bersih sepenuhnya adalah hasil yang bagus, bukan baris yang
  // gagal dimuat. Perbedaannya dijelaskan lewat label baris, bukan dibiarkan
  // ditebak sendiri oleh pembaca.
  const bersih = (sesi.menundukSegmen || []).length === 0 && (sesi.hilangSegmen || []).length === 0;
  if (bersih) {
    baris.querySelector('.timeline__baris-judul').textContent = 'Kontak pandang — menatap depan sepanjang sesi';
  }

  return baris;
}

/**
 * Menggambar baris kecepatan bicara sebagai garis patah.
 *
 * CARA KERJA:
 * Tiap potongan 30 detik menyumbang satu titik, ditempatkan di TENGAH rentang
 * potongannya, bukan di awalnya, karena angkanya mewakili seluruh rentang itu.
 * Sumbu tegaknya dibentangkan dari nol sampai nilai tertinggi antara WPM
 * terbesar sesi ini dan batas atas rentang nyaman, supaya dua garis penanda
 * rentang selalu ikut terlihat meski pengguna berbicara pelan sepanjang sesi.
 *
 * Titik yang keluar dari rentang nyaman digambar lebih besar dan berlubang,
 * sehingga bedanya terbaca dari bentuk, bukan dari warna saja.
 */
function gambarBarisKecepatan(deret, durasi, konfig) {
  const { baris, lintasan } = buatBaris('Kecepatan bicara', 'kecepatan');
  lintasan.classList.add('timeline__lintasan--kecepatan');

  if (!Array.isArray(deret) || deret.length === 0) {
    // Tinggi tetap 40px hanya masuk akal bila ada garis yang digambar. Saat
    // kosong, tingginya mengikuti keterangannya supaya tidak ada ruang menganga
    // yang membuat barisnya terlihat rusak.
    lintasan.classList.add('timeline__lintasan--kosong');
    lintasan.appendChild(elemen('div', 'timeline__kosong', 'Sesi terlalu singkat untuk mengukur perubahan kecepatan.'));
    return baris;
  }

  // Satu potongan berarti tidak ada perubahan yang bisa digambar sebagai garis.
  // Titiknya tetap ditampilkan, dan label barisnya yang menjelaskan kenapa
  // garisnya tidak ada, supaya tidak terbaca sebagai grafik yang gagal.
  if (deret.length === 1) {
    baris.querySelector('.timeline__baris-judul').textContent =
      `Kecepatan bicara — ${deret[0].wpm} WPM, sesi terlalu pendek untuk melihat perubahan`;
  }

  const tinggiSvg = 100;
  const maksWpm = Math.max(konfig.WPM_FAST * 1.2, ...deret.map(d => d.wpm)) || 1;
  const y = (wpm) => tinggiSvg - (Math.min(wpm, maksWpm) / maksWpm) * tinggiSvg;
  const x = (d) => persen((d.detikMulai + d.detikSelesai) / 2, durasi);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'timeline__svg');
  svg.setAttribute('viewBox', `0 0 100 ${tinggiSvg}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');

  // Dua garis mendatar penanda batas rentang nyaman
  [konfig.WPM_SLOW, konfig.WPM_FAST].forEach(batas => {
    const garis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    garis.setAttribute('x1', '0');
    garis.setAttribute('x2', '100');
    garis.setAttribute('y1', String(y(batas)));
    garis.setAttribute('y2', String(y(batas)));
    garis.setAttribute('class', 'timeline__batas-wpm');
    svg.appendChild(garis);
  });

  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  polyline.setAttribute('class', 'timeline__garis-wpm');
  polyline.setAttribute('points', deret.map(d => `${x(d)},${y(d.wpm)}`).join(' '));
  svg.appendChild(polyline);
  lintasan.appendChild(svg);

  // Titik digambar sebagai elemen HTML, bukan lingkaran SVG, supaya ukurannya
  // tidak ikut melar saat viewBox direntangkan mengikuti lebar layar.
  deret.forEach(d => {
    const diLuar = d.wpm < konfig.WPM_SLOW || d.wpm > konfig.WPM_FAST;
    const titik = elemen('div', `timeline__titik-wpm${diLuar ? ' timeline__titik-wpm--luar' : ''}`);
    titik.style.left = `${x(d)}%`;
    titik.style.top = `${(y(d.wpm) / tinggiSvg) * 100}%`;
    titik.title = `${d.wpm} kata per menit, ${waktuMmSs(d.detikMulai)}–${waktuMmSs(d.detikSelesai)}`;
    lintasan.appendChild(titik);
  });

  return baris;
}

/**
 * Menggambar baris masalah: kata pengisi dan jeda panjang.
 *
 * CARA KERJA:
 * Kata pengisi digambar sebagai titik kecil di satu posisi waktu, sedangkan jeda
 * panjang sebagai balok selebar durasinya. Bedanya sengaja terletak pada BENTUK
 * dan lebar: satu kejadian sesaat melawan satu rentang waktu. Keduanya juga
 * duduk di ketinggian berbeda di dalam baris, supaya kata pengisi yang jatuh di
 * dalam sebuah jeda tetap terlihat.
 */
function gambarBarisMasalah(sesi, durasi) {
  const { baris, lintasan } = buatBaris('Masalah', 'masalah');
  lintasan.classList.add('timeline__lintasan--masalah');

  const jeda = (sesi.jedaTersedia && sesi.jeda && sesi.jeda.daftar) ? sesi.jeda.daftar : [];
  jeda.forEach(j => {
    const el = elemen('div', 'timeline__jeda');
    el.style.left = `${persen(j.mulaiDetik, durasi)}%`;
    el.style.width = `${Math.max(0.8, persen(j.durasiDetik, durasi))}%`;
    el.title = `Jeda ${j.durasiDetik} detik, sekitar ${waktuMmSs(j.mulaiDetik)}`;
    lintasan.appendChild(el);
  });

  const filler = (sesi.filler && sesi.filler.events) ? sesi.filler.events : [];
  filler.forEach(f => {
    const el = elemen('div', 'timeline__filler');
    el.style.left = `${persen(f.detik, durasi)}%`;
    el.title = `"${f.kata}" sekitar ${waktuMmSs(f.detik)}`;
    lintasan.appendChild(el);
  });

  if (jeda.length === 0 && filler.length === 0) {
    baris.querySelector('.timeline__baris-judul').textContent =
      'Masalah — tidak ada kata pengisi maupun jeda panjang';
    lintasan.classList.add('timeline__lintasan--kosong');
  }

  return baris;
}

/**
 * Menyusun legenda dari baris yang benar-benar digambar.
 *
 * CARA KERJA:
 * Legenda dibangun dari daftar yang sama dengan baris yang tampil, bukan ditulis
 * tetap di HTML. Dengan begitu mode suara saja tidak pernah menampilkan
 * keterangan kontak pandang untuk baris yang memang tidak ada.
 */
function gambarLegenda(adaBarisPandang) {
  const legenda = elemen('div', 'timeline__legenda');

  const item = (kelasContoh, teks) => {
    const wadah = elemen('span', 'timeline__legenda-item');
    wadah.appendChild(elemen('span', `timeline__legenda-contoh ${kelasContoh}`));
    wadah.appendChild(elemen('span', 'timeline__legenda-teks', teks));
    return wadah;
  };

  if (adaBarisPandang) {
    legenda.appendChild(item('timeline__segmen--menunduk', 'menunduk'));
    legenda.appendChild(item('timeline__segmen--hilang', 'wajah tidak terlihat'));
  }
  legenda.appendChild(item('timeline__filler', 'kata pengisi'));
  legenda.appendChild(item('timeline__jeda', 'jeda panjang'));
  legenda.appendChild(item('timeline__titik-wpm--luar', 'kecepatan di luar rentang'));

  return legenda;
}

/**
 * Menggambar seluruh lintasan waktu sesi ke dalam sebuah wadah.
 *
 * CARA KERJA:
 * 1. Wadah dikosongkan lebih dulu, sehingga membuka rapor sesi kedua tidak
 *    menumpuk lintasan baru di atas lintasan lama.
 * 2. Baris kontak pandang hanya dibuat bila sesinya memang mengukur arah
 *    pandang. Pada mode suara saja, lintasan berisi sumbu waktu, kecepatan, dan
 *    masalah, dan legendanya ikut menyesuaikan sehingga tampak memang dirancang
 *    begitu, bukan seperti baris yang gagal dimuat.
 * 3. Sesi tanpa durasi yang masuk akal tidak digambar sama sekali.
 *
 * @param {HTMLElement} wadah - Elemen tempat lintasan digambar
 * @param {Object} sesi - Objek sesi lengkap (rapor atau riwayat)
 * @param {Object} config - CONFIG dari app.js
 * @returns {boolean} False bila lintasan tidak bisa digambar
 */
/**
 * Mengumpulkan seluruh "masalah" sebagai satu daftar waktu yang terurut.
 *
 * CARA KERJA:
 * Tiga jenis kejadian yang berbeda (kata pengisi, jeda panjang, menunduk)
 * disatukan menjadi satu daftar cap waktu, lalu diurutkan. Daftar inilah yang
 * dipakai tombol "masalah sebelumnya/berikutnya" untuk melompat, sehingga
 * pengguna bisa menelusuri sesi dari satu titik bermasalah ke titik berikutnya
 * tanpa harus mencarinya sendiri di lintasan.
 */
function kumpulkanMasalah(sesi) {
  const daftar = [];

  ((sesi.filler && sesi.filler.events) || []).forEach(f => daftar.push(f.detik));
  if (sesi.jedaTersedia && sesi.jeda && sesi.jeda.daftar) {
    sesi.jeda.daftar.forEach(j => daftar.push(j.mulaiDetik));
  }
  (sesi.menundukSegmen || []).forEach(s => daftar.push(s.mulaiDetik));

  return daftar.sort((a, b) => a - b);
}

/**
 * Mencari rentang waktu terpadat dalam sesi.
 *
 * CARA KERJA:
 * Tiap kejadian dicoba sebagai titik tengah sebuah jendela selebar
 * CONFIG.TIMELINE_JENDELA_DETIK, lalu dihitung berapa kejadian lain yang jatuh
 * di dalamnya. Titik dengan tetangga terbanyak yang dipakai sebagai posisi awal
 * kepala pemutar, supaya rapor langsung membuka bagian yang paling perlu
 * diperbaiki, bukan menyuruh pengguna mencarinya sendiri.
 *
 * Sesi tanpa satu pun kejadian membuka di detik nol.
 */
function cariRentangTerpadat(masalah, jendela) {
  if (masalah.length === 0) return 0;

  let terbaik = masalah[0];
  let terbanyak = 0;

  for (const titik of masalah) {
    const jumlah = masalah.filter(m => Math.abs(m - titik) <= jendela / 2).length;
    if (jumlah > terbanyak) {
      terbanyak = jumlah;
      terbaik = titik;
    }
  }

  return terbaik;
}

/**
 * Menandai kata pengisi di dalam sebuah potongan transkrip.
 *
 * CARA KERJA:
 * Aturan pencocokannya sengaja mengikuti js/speech.js: entri berisi spasi
 * dicocokkan sebagai frasa utuh, entri satu kata dicocokkan sebagai awalan
 * selama panjangnya minimal CONFIG.FILLER_PREFIX_MIN. Penandaan di sini murni
 * untuk tampilan dan tidak pernah mengubah hitungan apa pun; hitungan tetap
 * milik speech.js yang melihat transkrip lebih dulu.
 *
 * Teks disusun sebagai simpul DOM satu per satu, bukan lewat innerHTML, supaya
 * apa pun yang keluar dari pengenal suara tidak pernah ditafsirkan sebagai
 * markup.
 */
function tandaiFiller(teks, konfig) {
  const wadah = document.createDocumentFragment();
  const entri = (konfig.FILLER_WORDS || []).map(f => String(f).toLowerCase());
  const frasa = entri.filter(f => /\s/.test(f)).map(f => f.split(/\s+/));
  const tunggal = entri.filter(f => !/\s/.test(f));
  const token = String(teks).split(/\s+/).filter(Boolean);

  const bersih = (t) => t.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '');

  let i = 0;
  while (i < token.length) {
    // Frasa lebih dulu, supaya "apa ya" tidak terpecah jadi dua kata biasa
    const cocokFrasa = frasa.find(f => f.every((kata, k) => bersih(token[i + k] || '') === kata));

    if (cocokFrasa) {
      const potong = token.slice(i, i + cocokFrasa.length).join(' ');
      wadah.appendChild(elemen('strong', 'timeline__kata-filler', potong));
      wadah.appendChild(document.createTextNode(' '));
      i += cocokFrasa.length;
      continue;
    }

    const kata = bersih(token[i]);
    const cocokTunggal = tunggal.some(f => (f.length >= konfig.FILLER_PREFIX_MIN)
      ? kata.startsWith(f)
      : kata === f);

    if (cocokTunggal) {
      wadah.appendChild(elemen('strong', 'timeline__kata-filler', token[i]));
    } else {
      wadah.appendChild(document.createTextNode(token[i]));
    }
    wadah.appendChild(document.createTextNode(' '));
    i++;
  }

  return wadah;
}

/**
 * Menyusun kalimat ringkasan kejadian pada satu rentang waktu.
 *
 * CARA KERJA:
 * Tiap jenis kejadian diperiksa apakah beririsan dengan rentang yang dipilih,
 * lalu disebut dengan angkanya. Kecepatan selalu ikut disebut karena ia berlaku
 * sepanjang potongan, bukan kejadian sesaat, dan diberi keterangan bila berada
 * di luar rentang nyaman.
 */
function ringkasRentang(sesi, awal, akhir, konfig) {
  const bagian = [];
  const beririsan = (mulai, durasi) => mulai < akhir && (mulai + durasi) > awal;

  const filler = ((sesi.filler && sesi.filler.events) || []).filter(f => f.detik >= awal && f.detik <= akhir);
  if (filler.length > 0) {
    const kata = [...new Set(filler.map(f => `"${f.kata}"`))].join(', ');
    bagian.push(`${filler.length} kata pengisi (${kata})`);
  }

  const jeda = (sesi.jedaTersedia && sesi.jeda && sesi.jeda.daftar ? sesi.jeda.daftar : [])
    .filter(j => beririsan(j.mulaiDetik, j.durasiDetik));
  jeda.forEach(j => bagian.push(`jeda ${j.durasiDetik} detik`));

  (sesi.menundukSegmen || []).filter(s => beririsan(s.mulaiDetik, s.durasiDetik))
    .forEach(s => bagian.push(`menunduk ${s.durasiDetik} detik`));

  (sesi.hilangSegmen || []).filter(s => beririsan(s.mulaiDetik, s.durasiDetik))
    .forEach(s => bagian.push(`wajah tidak terlihat ${s.durasiDetik} detik`));

  const potongan = (sesi.deretWpm || []).find(d => d.detikMulai <= awal && d.detikSelesai > awal)
    || (sesi.deretWpm || [])[0];
  if (potongan) {
    const luar = potongan.wpm < konfig.WPM_SLOW ? ' (di bawah rentang nyaman)'
      : potongan.wpm > konfig.WPM_FAST ? ' (di atas rentang nyaman)'
      : '';
    bagian.push(`kecepatan ${potongan.wpm} WPM${luar}`);
  }

  return bagian.length > 0 ? bagian.join(' · ') : 'Tidak ada kejadian yang tercatat di rentang ini.';
}

/**
 * Mengisi panel keterangan sesuai posisi kepala pemutar.
 *
 * CARA KERJA:
 * 1. Rentang dihitung sebagai jendela selebar CONFIG.TIMELINE_JENDELA_DETIK
 *    yang berpusat di posisi kepala pemutar.
 * 2. Waktunya selalu ditulis dengan kata "sekitar". Cap waktu kata pengisi dan
 *    transkrip berasal dari pengenal suara yang memfinalkan kalimat beberapa
 *    saat setelah diucapkan, jadi menuliskannya seolah presisi akan berbohong.
 * 3. Potongan transkrip yang beririsan dengan rentang ditampilkan; potongan
 *    yang benar-benar memuat posisi kepala pemutar ditebalkan sebagai penanda
 *    "di sinilah kamu sekarang".
 * 4. Bila transkrip tidak tersedia (sesi riwayat yang tidak menyimpannya),
 *    panel mengatakannya apa adanya alih-alih tampil kosong.
 */
function isiPanel(panel, sesi, detik, transkrip, konfig) {
  const jendela = konfig.TIMELINE_JENDELA_DETIK;
  const awal = Math.max(0, detik - jendela / 2);
  const akhir = Math.min(sesi.durasiDetik, awal + jendela);

  panel.waktu.textContent = `sekitar ${waktuMmSs(awal)} — ${waktuMmSs(akhir)}`;
  panel.ringkasan.textContent = ringkasRentang(sesi, awal, akhir, konfig);

  panel.transkrip.innerHTML = '';

  if (transkrip === null || transkrip === undefined) {
    panel.transkrip.appendChild(elemen('p', 'timeline__transkrip-kosong',
      'Transkrip tidak disimpan untuk sesi ini.'));
    return;
  }

  const potongan = transkrip.filter(p => p.detikMulai < akhir && p.detikSelesai > awal);
  if (potongan.length === 0) {
    panel.transkrip.appendChild(elemen('p', 'timeline__transkrip-kosong',
      'Tidak ada ucapan yang tertangkap di rentang ini.'));
    return;
  }

  potongan.forEach(p => {
    const aktif = p.detikMulai <= detik && p.detikSelesai >= detik;
    const baris = elemen('p', `timeline__transkrip-potongan${aktif ? ' timeline__transkrip-potongan--aktif' : ''}`);
    baris.appendChild(tandaiFiller(p.teks, konfig));
    panel.transkrip.appendChild(baris);
  });
}

/**
 * Membangun panel keterangan beserta tombol lompat antar masalah.
 */
function buatPanel() {
  const panel = elemen('div', 'timeline__panel');

  const kepala = elemen('div', 'timeline__panel-kepala');
  const waktu = elemen('div', 'timeline__panel-waktu');
  const navigasi = elemen('div', 'timeline__panel-navigasi');

  const tombolPutar = elemen('button', 'tombol tombol--utama tombol--kecil', 'Putar');
  const tombolKecepatan = elemen('button', 'tombol tombol--sekunder tombol--kecil', '1×');
  const tombolSebelum = elemen('button', 'tombol tombol--sekunder tombol--kecil', 'Masalah sebelumnya');
  const tombolSesudah = elemen('button', 'tombol tombol--sekunder tombol--kecil', 'Masalah berikutnya');
  [tombolPutar, tombolKecepatan, tombolSebelum, tombolSesudah].forEach(t => { t.type = 'button'; });
  tombolKecepatan.setAttribute('aria-label', 'Kecepatan pemutaran, sekarang 1 kali');

  navigasi.appendChild(tombolPutar);
  navigasi.appendChild(tombolKecepatan);
  navigasi.appendChild(tombolSebelum);
  navigasi.appendChild(tombolSesudah);
  kepala.appendChild(waktu);
  kepala.appendChild(navigasi);

  const ringkasan = elemen('div', 'timeline__panel-ringkasan');
  const transkrip = elemen('div', 'timeline__panel-transkrip');

  panel.appendChild(kepala);
  panel.appendChild(ringkasan);
  panel.appendChild(transkrip);

  return { panel, waktu, ringkasan, transkrip, tombolPutar, tombolKecepatan, tombolSebelum, tombolSesudah };
}

/**
 * Menggambar seluruh lintasan waktu sesi ke dalam sebuah wadah.
 *
 * CARA KERJA:
 * 1. Wadah dikosongkan lebih dulu, sehingga membuka rapor sesi kedua tidak
 *    menumpuk lintasan baru di atas lintasan lama.
 * 2. Baris kontak pandang hanya dibuat bila sesinya memang mengukur arah
 *    pandang. Pada mode suara saja, lintasan berisi sumbu waktu, kecepatan, dan
 *    masalah, dan legendanya ikut menyesuaikan sehingga tampak memang dirancang
 *    begitu, bukan seperti baris yang gagal dimuat.
 * 3. Seluruh baris dibungkus satu panggung agar kepala pemutar bisa melintasi
 *    semuanya sekaligus, dan panggung itulah yang menerima klik, seretan, serta
 *    tombol papan ketik.
 * 4. Posisi awal kepala pemutar adalah rentang terpadat sesi ini.
 *
 * @param {HTMLElement} wadah - Elemen tempat lintasan digambar
 * @param {Object} sesi - Objek sesi lengkap (rapor atau riwayat)
 * @param {Object} config - CONFIG dari app.js
 * @param {Object} opsi - { wadahLegenda, wadahPanel, transkrip }
 * @returns {Object|null} Kendali lintasan, atau null bila tidak bisa digambar
 */
export function render(wadah, sesi, config = {}, opsi = {}) {
  if (!wadah || !sesi) return null;

  const konfig = { ...KONFIG_BAWAAN, ...config };
  const durasi = Number(sesi.durasiDetik);
  wadah.innerHTML = '';
  if (opsi.wadahLegenda) opsi.wadahLegenda.innerHTML = '';
  if (opsi.wadahPanel) opsi.wadahPanel.innerHTML = '';

  if (!(durasi > 0)) return null;

  const adaBarisPandang = sesi.pandangTersedia === true;
  const transkrip = (opsi.transkrip === undefined) ? null : opsi.transkrip;

  // Panggung: seluruh baris ditumpuk di sini supaya kepala pemutar melintasinya
  const panggung = elemen('div', 'timeline__panggung');
  panggung.appendChild(gambarSumbu(durasi));
  if (adaBarisPandang) panggung.appendChild(gambarBarisPandang(sesi, durasi));
  panggung.appendChild(gambarBarisKecepatan(sesi.deretWpm, durasi, konfig));
  panggung.appendChild(gambarBarisMasalah(sesi, durasi));

  const kepala = elemen('div', 'timeline__kepala');
  kepala.appendChild(elemen('div', 'timeline__kepala-pegangan'));
  panggung.appendChild(kepala);

  panggung.tabIndex = 0;
  panggung.setAttribute('role', 'slider');
  panggung.setAttribute('aria-label', 'Posisi waktu pada lintasan sesi');
  panggung.setAttribute('aria-valuemin', '0');
  panggung.setAttribute('aria-valuemax', String(Math.round(durasi)));

  wadah.appendChild(panggung);

  const legenda = gambarLegenda(adaBarisPandang);
  (opsi.wadahLegenda || wadah).appendChild(legenda);

  const panel = buatPanel();
  (opsi.wadahPanel || wadah).appendChild(panel.panel);

  const masalah = kumpulkanMasalah(sesi);
  let detikSekarang = 0;

  let detikPanelTerakhir = null;

  /**
   * Memindahkan kepala pemutar ke satu posisi waktu.
   *
   * CARA KERJA:
   * Posisi dijepit ke dalam durasi sesi, lalu seluruh tampilan yang bergantung
   * padanya diperbarui dari satu tempat ini.
   *
   * Kepala pemutar digeser tiap kali dipanggil karena itu murni satu properti
   * CSS, sedangkan PANEL hanya disusun ulang saat detiknya benar-benar berganti.
   * Pembedaan ini yang membuat mode putar tetap ringan: tanpa itu, seluruh isi
   * panel dan potongan transkrip akan dibangun ulang enam puluh kali per detik.
   */
  function keDetik(detik) {
    detikSekarang = Math.min(durasi, Math.max(0, detik));
    kepala.style.left = `${persen(detikSekarang, durasi)}%`;
    panggung.setAttribute('aria-valuenow', String(Math.round(detikSekarang)));
    panggung.setAttribute('aria-valuetext', `sekitar ${waktuMmSs(detikSekarang)}`);

    const detikBulat = Math.floor(detikSekarang);
    if (detikBulat === detikPanelTerakhir) return;
    detikPanelTerakhir = detikBulat;

    isiPanel(panel, sesi, detikSekarang, transkrip, konfig);
    gulirKePotonganAktif();
  }

  /**
   * Menggulirkan panel transkrip supaya potongan yang sedang aktif tetap terlihat.
   *
   * CARA KERJA:
   * Saat mode putar berjalan, potongan aktif berpindah ke bawah dan akan keluar
   * dari area panel. scrollIntoView dengan block 'nearest' menggulirkan HANYA
   * bila potongannya memang sudah tidak terlihat, sehingga panel tidak
   * bergoyang setiap detik saat potongannya masih di tempat.
   */
  function gulirKePotonganAktif() {
    const aktif = panel.transkrip.querySelector('.timeline__transkrip-potongan--aktif');
    if (aktif && typeof aktif.scrollIntoView === 'function') {
      aktif.scrollIntoView({ block: 'nearest' });
    }
  }

  /**
   * Mengubah posisi kursor menjadi posisi waktu.
   * Lebar lintasan diukur saat itu juga, bukan disimpan, supaya perubahan lebar
   * jendela atau penggeseran lintasan tidak pernah membuat perhitungannya meleset.
   */
  function dariPointer(event) {
    const kotak = panggung.getBoundingClientRect();
    if (!kotak.width) return;
    keDetik(((event.clientX - kotak.left) / kotak.width) * durasi);
  }

  // --------------------------------------------------------------------------
  // MODE PUTAR
  //
  // Memutar ulang sesi tanpa suara: kepala pemutar berjalan di sumbu waktu, dan
  // panel beserta transkrip mengikutinya. Yang diputar adalah DATA, bukan
  // rekaman — tidak ada audio maupun video yang pernah disimpan.
  //
  // Posisi dihitung dari selisih waktu nyata antar frame, bukan dari jumlah
  // frame, sehingga kecepatannya tetap benar pada layar 60Hz maupun 120Hz dan
  // tidak melambat saat perangkat sibuk.
  // --------------------------------------------------------------------------
  const KECEPATAN = [1, 2];
  let indeksKecepatan = 0;
  let sedangPutar = false;
  let idFrame = null;
  let waktuFrameTerakhir = 0;

  function langkahPutar(sekarang) {
    if (!sedangPutar) return;

    const selisihDetik = (sekarang - waktuFrameTerakhir) / 1000;
    waktuFrameTerakhir = sekarang;
    keDetik(detikSekarang + selisihDetik * KECEPATAN[indeksKecepatan]);

    // Berhenti sendiri di ujung sesi, bukan diam-diam menempel di 100%
    if (detikSekarang >= durasi) {
      hentikanPutar();
      return;
    }
    idFrame = requestAnimationFrame(langkahPutar);
  }

  function mulaiPutar() {
    if (sedangPutar) return;
    // Menekan Putar di ujung sesi berarti memutar dari awal lagi
    if (detikSekarang >= durasi) keDetik(0);
    sedangPutar = true;
    waktuFrameTerakhir = performance.now();
    panel.tombolPutar.textContent = 'Jeda';
    idFrame = requestAnimationFrame(langkahPutar);
  }

  function hentikanPutar() {
    if (!sedangPutar) return;
    sedangPutar = false;
    panel.tombolPutar.textContent = 'Putar';
    if (idFrame !== null) {
      cancelAnimationFrame(idFrame);
      idFrame = null;
    }
  }

  panel.tombolPutar.addEventListener('click', () => {
    if (sedangPutar) hentikanPutar();
    else mulaiPutar();
  });

  panel.tombolKecepatan.addEventListener('click', () => {
    indeksKecepatan = (indeksKecepatan + 1) % KECEPATAN.length;
    const kecepatan = KECEPATAN[indeksKecepatan];
    panel.tombolKecepatan.textContent = `${kecepatan}×`;
    panel.tombolKecepatan.setAttribute('aria-label', `Kecepatan pemutaran, sekarang ${kecepatan} kali`);
  });

  let sedangSeret = false;

  panggung.addEventListener('pointerdown', (event) => {
    // Menyeret selalu mengambil alih: pemutaran dihentikan lebih dulu supaya
    // kepala pemutar tidak ditarik dua arah sekaligus.
    hentikanPutar();
    sedangSeret = true;
    panggung.setPointerCapture(event.pointerId);
    panggung.focus();
    dariPointer(event);
    event.preventDefault();
  });

  panggung.addEventListener('pointermove', (event) => {
    if (sedangSeret) dariPointer(event);
  });

  const lepasSeret = (event) => {
    if (!sedangSeret) return;
    sedangSeret = false;
    if (panggung.hasPointerCapture && panggung.hasPointerCapture(event.pointerId)) {
      panggung.releasePointerCapture(event.pointerId);
    }
  };
  panggung.addEventListener('pointerup', lepasSeret);
  panggung.addEventListener('pointercancel', lepasSeret);

  // Papan ketik: anak panah menggeser satu detik, dengan Shift lima detik.
  panggung.addEventListener('keydown', (event) => {
    const langkah = event.shiftKey ? 5 : 1;
    // Sama seperti menyeret: menggeser manual mengambil alih dari pemutaran
    if (event.key.startsWith('Arrow') || ['Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
      hentikanPutar();
    }
    const aksi = {
      ArrowRight: () => keDetik(detikSekarang + langkah),
      ArrowLeft: () => keDetik(detikSekarang - langkah),
      ArrowUp: () => keDetik(detikSekarang + langkah),
      ArrowDown: () => keDetik(detikSekarang - langkah),
      Home: () => keDetik(0),
      End: () => keDetik(durasi),
      PageUp: () => keDetik(detikSekarang + 10),
      PageDown: () => keDetik(detikSekarang - 10)
    }[event.key];

    if (aksi) {
      aksi();
      event.preventDefault();
    }
  });

  /**
   * Melompat ke masalah terdekat ke arah tertentu.
   * Ambang 0.2 detik mencegah tombol tersangkut di kejadian yang sedang dipilih
   * akibat pembulatan posisi.
   */
  function lompatMasalah(arah) {
    hentikanPutar();
    const berikut = (arah > 0)
      ? masalah.find(m => m > detikSekarang + 0.2)
      : [...masalah].reverse().find(m => m < detikSekarang - 0.2);

    if (berikut !== undefined) keDetik(berikut);
  }

  panel.tombolSebelum.addEventListener('click', () => lompatMasalah(-1));
  panel.tombolSesudah.addEventListener('click', () => lompatMasalah(1));
  panel.tombolSebelum.disabled = masalah.length === 0;
  panel.tombolSesudah.disabled = masalah.length === 0;

  // Buka di rentang terpadat: bagian yang paling perlu diperbaiki
  keDetik(cariRentangTerpadat(masalah, konfig.TIMELINE_JENDELA_DETIK));

  return {
    keDetik,
    posisi: () => detikSekarang,
    sedangPutar: () => sedangPutar,
    hentikanPutar,
    durasi,
    masalah: masalah.slice()
  };
}
