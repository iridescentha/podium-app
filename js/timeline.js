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
 * Langkah 2 (berkas ini, versi sekarang) menggambar lintasannya saja, tanpa
 * interaksi. Kepala pemutar, panel keterangan, dan mode putar menyusul di
 * langkah 3 dan 4 sesuai urutan di TAHAP-4b.md.
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
  WPM_FAST: 150
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
export function render(wadah, sesi, config = {}, opsi = {}) {
  if (!wadah || !sesi) return false;

  const konfig = { ...KONFIG_BAWAAN, ...config };
  const durasi = Number(sesi.durasiDetik);
  wadah.innerHTML = '';
  if (opsi.wadahLegenda) opsi.wadahLegenda.innerHTML = '';

  if (!(durasi > 0)) return false;

  const adaBarisPandang = sesi.pandangTersedia === true;

  wadah.appendChild(gambarSumbu(durasi));
  if (adaBarisPandang) wadah.appendChild(gambarBarisPandang(sesi, durasi));
  wadah.appendChild(gambarBarisKecepatan(sesi.deretWpm, durasi, konfig));
  wadah.appendChild(gambarBarisMasalah(sesi, durasi));

  // Legenda diletakkan di luar blok lintasan bila pemanggil menyediakan
  // wadahnya: ia keterangan, bukan bagian alat ukurnya.
  const legenda = gambarLegenda(adaBarisPandang);
  (opsi.wadahLegenda || wadah).appendChild(legenda);

  return true;
}
