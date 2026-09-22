const { El } = await import('./dom-tiruan.mjs');
// Mode putar memakai requestAnimationFrame; uji ini tidak memutar apa pun,
// jadi cukup disediakan supaya pemanggilannya tidak melempar.
globalThis.performance = { now: () => 0 };
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
const timeline = await import('./timeline.mjs');
let gagal = 0; const cek=(n,k,i='')=>{console.log(`${k?'LULUS':'GAGAL'}  ${n} ${i}`); if(!k) gagal++;};
const CONFIG = { WPM_SLOW: 100, WPM_FAST: 150, TIMELINE_JENDELA_DETIK: 8, FILLER_WORDS: ['kayak','gitu','apa ya'], FILLER_PREFIX_MIN: 4 };

const sesi = {
  durasiDetik: 120, mode: 'lengkap', pandangTersedia: true,
  deretWpm: [ { detikMulai: 0, detikSelesai: 30, wpm: 120 }, { detikMulai: 30, detikSelesai: 60, wpm: 95 },
              { detikMulai: 60, detikSelesai: 90, wpm: 130 }, { detikMulai: 90, detikSelesai: 120, wpm: 175 } ],
  // Tiga kata pengisi berdempetan di sekitar detik 70 = rentang terpadat
  filler: { total: 4, events: [ { detik: 10, kata: 'kayak' }, { detik: 69, kata: 'kayak' }, { detik: 71, kata: 'gitu' }, { detik: 72, kata: 'kayak' } ] },
  jedaTersedia: true, jeda: { jumlah: 1, daftar: [ { mulaiDetik: 40, durasiDetik: 5 } ] },
  menundukSegmen: [ { mulaiDetik: 100, durasiDetik: 6 } ],
  hilangSegmen: []
};
const transkrip = [
  { detikMulai: 0, detikSelesai: 12, teks: 'selamat pagi semuanya hari ini kayak mau bahas tiga hal' },
  { detikMulai: 60, detikSelesai: 70, teks: 'bagian kedua ini kayak agak teknis' },
  { detikMulai: 70, detikSelesai: 75, teks: 'jadi gitu ya kayaknya begitu' },
  { detikMulai: 100, detikSelesai: 110, teks: 'apa ya intinya begitu' }
];

const wadah = new El('div'), wadahPanel = new El('div');
const kendali = timeline.render(wadah, sesi, CONFIG, { wadahPanel, transkrip });
const panggung = wadah.denganKelas('timeline__panggung')[0];
const kepala = wadah.denganKelas('timeline__kepala')[0];
const waktu = wadahPanel.denganKelas('timeline__panel-waktu')[0];
const ringkasan = wadahPanel.denganKelas('timeline__panel-ringkasan')[0];
const panelTranskrip = wadahPanel.denganKelas('timeline__panel-transkrip')[0];

cek('1. panel dibuat di wadah terpisah', Boolean(waktu && ringkasan && panelTranskrip));
cek('2. dibuka di rentang terpadat (3 filler sekitar detik 71)', Math.abs(kendali.posisi() - 71) <= 2, `posisi ${kendali.posisi()}`);
cek('3. label waktu memakai "sekitar"', waktu.textContent.startsWith('sekitar '), waktu.textContent);
cek('4. ringkasan menyebut jumlah kata pengisi', ringkasan.textContent.includes('3 kata pengisi'), ringkasan.textContent);
cek('5. ringkasan menyebut kecepatan potongan itu', ringkasan.textContent.includes('130 WPM'));

// Klik di tengah lintasan (x=500 dari lebar 1000) = detik 60
panggung.picu('pointerdown', { clientX: 500, pointerId: 1 });
cek('6. klik memindahkan kepala ke detik 60', Math.abs(kendali.posisi() - 60) < 0.5, `posisi ${kendali.posisi()}`);
cek('7. kepala bergeser ke 50%', parseFloat(kepala.style.left) === 50);
cek('8. aria-valuenow ikut diperbarui', panggung.getAttribute('aria-valuenow') === '60' && panggung.getAttribute('aria-valuetext').includes('01:00'));

// Seret: pointermove hanya berlaku setelah pointerdown
panggung.picu('pointermove', { clientX: 250, pointerId: 1 });
cek('9. seret memindahkan kepala', Math.abs(kendali.posisi() - 30) < 0.5, `posisi ${kendali.posisi()}`);
panggung.picu('pointerup', { pointerId: 1 });
panggung.picu('pointermove', { clientX: 900, pointerId: 1 });
cek('10. gerakan setelah lepas tidak menyeret', Math.abs(kendali.posisi() - 30) < 0.5, `posisi ${kendali.posisi()}`);

// Papan ketik
panggung.picu('keydown', { key: 'ArrowRight' });
cek('11. panah kanan maju 1 detik', Math.abs(kendali.posisi() - 31) < 0.01);
panggung.picu('keydown', { key: 'ArrowLeft', shiftKey: true });
cek('12. shift + panah kiri mundur 5 detik', Math.abs(kendali.posisi() - 26) < 0.01);
panggung.picu('keydown', { key: 'Home' });
cek('13. Home ke awal', kendali.posisi() === 0);
panggung.picu('keydown', { key: 'End' });
cek('14. End ke akhir', kendali.posisi() === 120);
panggung.picu('keydown', { key: 'ArrowRight' });
cek('15. tidak bisa melewati durasi sesi', kendali.posisi() === 120);
panggung.picu('keydown', { key: 'Home' });
panggung.picu('keydown', { key: 'ArrowLeft' });
cek('16. tidak bisa mundur sebelum nol', kendali.posisi() === 0);

// Lompat antar masalah: 10, 40, 69, 71, 72, 100
// Dipilih lewat labelnya, bukan urutan, supaya penambahan tombol lain di baris
// navigasi tidak diam-diam mengubah tombol mana yang diuji.
const tombolNav = wadahPanel.denganKelas('timeline__panel-navigasi')[0].children;
const tombolSesudah = tombolNav.find(t => t.textContent === 'Masalah berikutnya');
const tombolSebelum = tombolNav.find(t => t.textContent === 'Masalah sebelumnya');
tombolSesudah.picu('click');
cek('17. masalah berikutnya ke kata pengisi pertama', kendali.posisi() === 10);
tombolSesudah.picu('click');
cek('18. berikutnya ke jeda', kendali.posisi() === 40);
tombolSebelum.picu('click');
cek('19. sebelumnya kembali ke 10', kendali.posisi() === 10);
tombolSebelum.picu('click');
cek('20. sudah di masalah pertama, tidak melompat liar', kendali.posisi() === 10);
kendali.keDetik(119);
tombolSesudah.picu('click');
cek('21. di ujung, tidak ada masalah berikutnya', kendali.posisi() === 119);

// Transkrip: potongan yang memuat posisi ditandai aktif
kendali.keDetik(71);
const potongan = wadahPanel.denganKelas('timeline__transkrip-potongan');
const aktif = wadahPanel.denganKelas('timeline__transkrip-potongan--aktif');
cek('22. potongan tetangga ikut tampil sebagai konteks', potongan.length >= 2, `${potongan.length} potongan`);
cek('23. tepat satu potongan ditandai aktif', aktif.length === 1 && aktif[0].textContent.includes('jadi gitu ya'), aktif[0] && aktif[0].textContent);

// Kata pengisi ditandai, termasuk bentuk berimbuhan dan frasa
const ditandai = wadahPanel.denganKelas('timeline__kata-filler').map(e => e.textContent);
cek('24. "gitu" dan "kayaknya" ditandai', ditandai.includes('gitu') && ditandai.includes('kayaknya'), JSON.stringify(ditandai));
kendali.keDetik(105);
const ditandai2 = wadahPanel.denganKelas('timeline__kata-filler').map(e => e.textContent);
cek('25. frasa "apa ya" ditandai sebagai satu kesatuan', ditandai2.includes('apa ya'), JSON.stringify(ditandai2));
cek('26. kata biasa tidak ikut ditandai', !ditandai2.includes('intinya') && !ditandai2.includes('begitu'));

// Ringkasan menyebut menunduk saat kepala berada di segmennya
cek('27. ringkasan menyebut menunduk', ringkasan.textContent.includes('menunduk 6 detik'), ringkasan.textContent);

// Tanpa transkrip (sesi riwayat yang tidak menyimpannya)
const wadah2 = new El('div'), panel2 = new El('div');
timeline.render(wadah2, sesi, CONFIG, { wadahPanel: panel2 });
cek('28. tanpa transkrip: panel mengatakannya apa adanya', panel2.denganKelas('timeline__transkrip-kosong')[0].textContent.includes('Transkrip tidak disimpan untuk sesi ini'));

// Rentang tanpa ucapan
const wadah3 = new El('div'), panel3 = new El('div');
const k3 = timeline.render(wadah3, sesi, CONFIG, { wadahPanel: panel3, transkrip });
k3.keDetik(50);
cek('29. rentang tanpa ucapan dijelaskan, bukan kosong', panel3.denganKelas('timeline__transkrip-kosong')[0].textContent.includes('Tidak ada ucapan'));

// Sesi tanpa masalah: tombol lompat dimatikan, bukan diam-diam tidak berfungsi
const wadah4 = new El('div'), panel4 = new El('div');
timeline.render(wadah4, { ...sesi, filler: { total: 0, events: [] }, jeda: { jumlah: 0, daftar: [] }, menundukSegmen: [] }, CONFIG, { wadahPanel: panel4, transkrip });
const nav4 = panel4.denganKelas('timeline__panel-navigasi')[0];
const lompat4 = nav4.children.filter(t => t.textContent.startsWith('Masalah'));
cek('30. tanpa masalah, tombol lompat dinonaktifkan', lompat4.length === 2 && lompat4.every(t => t.disabled === true));
cek('30b. tombol Putar tetap aktif walau tidak ada masalah', nav4.children.find(t => t.textContent === 'Putar').disabled === false);

// Teks transkrip tidak pernah ditafsirkan sebagai markup
const wadah5 = new El('div'), panel5 = new El('div');
const k5 = timeline.render(wadah5, sesi, CONFIG, { wadahPanel: panel5, transkrip: [ { detikMulai: 0, detikSelesai: 120, teks: '<img src=x onerror=alert(1)> kayak' } ] });
k5.keDetik(10);
const potongan5 = panel5.denganKelas('timeline__transkrip-potongan')[0];
cek('31. teks transkrip diperlakukan sebagai teks biasa', potongan5.textContent.includes('<img') && potongan5.semua(c => c.tagName === 'img').length === 0);
console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
