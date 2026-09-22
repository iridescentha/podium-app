const { El } = await import('./dom-tiruan.mjs');
// Jam animasi tiruan: frame dijalankan manual supaya kecepatan bisa diukur pasti
let jamAnimasi = 0;
let antrianFrame = [];
globalThis.performance = { now: () => jamAnimasi };
globalThis.requestAnimationFrame = (fn) => { antrianFrame.push(fn); return antrianFrame.length; };
globalThis.cancelAnimationFrame = () => { antrianFrame = []; };
function majuFrame(ms) { jamAnimasi += ms; const antrian = antrianFrame; antrianFrame = []; antrian.forEach(fn => fn(jamAnimasi)); }

const timeline = await import('./timeline.mjs');
let gagal = 0; const cek=(n,k,i='')=>{console.log(`${k?'LULUS':'GAGAL'}  ${n} ${i}`); if(!k) gagal++;};
const CONFIG = { WPM_SLOW: 100, WPM_FAST: 150, TIMELINE_JENDELA_DETIK: 8, FILLER_WORDS: ['kayak'], FILLER_PREFIX_MIN: 4 };
const sesi = { durasiDetik: 60, mode: 'lengkap', pandangTersedia: true,
  deretWpm: [{ detikMulai: 0, detikSelesai: 30, wpm: 120 }, { detikMulai: 30, detikSelesai: 60, wpm: 130 }],
  filler: { total: 1, events: [{ detik: 10, kata: 'kayak' }] },
  jedaTersedia: true, jeda: { jumlah: 0, daftar: [] }, menundukSegmen: [], hilangSegmen: [] };
const transkrip = [ { detikMulai: 0, detikSelesai: 20, teks: 'bagian pertama kayak begini' },
                    { detikMulai: 20, detikSelesai: 40, teks: 'bagian kedua' },
                    { detikMulai: 40, detikSelesai: 60, teks: 'bagian ketiga' } ];

const wadah = new El('div'), wadahPanel = new El('div');
const k = timeline.render(wadah, sesi, CONFIG, { wadahPanel, transkrip });
const nav = wadahPanel.denganKelas('timeline__panel-navigasi')[0];
const [tombolPutar, tombolKecepatan, tombolSebelum, tombolSesudah] = nav.children;
const panggung = wadah.denganKelas('timeline__panggung')[0];

cek('1. tombol Putar dan pengatur kecepatan ada', tombolPutar.textContent === 'Putar' && tombolKecepatan.textContent === '1×');
k.keDetik(0);
tombolPutar.picu('click');
cek('2. label berubah jadi Jeda saat berjalan', tombolPutar.textContent === 'Jeda' && k.sedangPutar() === true);

majuFrame(1000);
cek('3. 1 detik nyata = 1 detik sesi pada 1×', Math.abs(k.posisi() - 1) < 0.01, `posisi ${k.posisi()}`);
majuFrame(2000);
cek('4. berjalan terus mengikuti waktu nyata', Math.abs(k.posisi() - 3) < 0.01, `posisi ${k.posisi()}`);

tombolPutar.picu('click');
cek('5. ditekan lagi = jeda', k.sedangPutar() === false && tombolPutar.textContent === 'Putar');
majuFrame(2000);
cek('6. saat dijeda posisi tidak bergerak', Math.abs(k.posisi() - 3) < 0.01);

tombolKecepatan.picu('click');
cek('7. kecepatan berganti ke 2×', tombolKecepatan.textContent === '2×');
tombolPutar.picu('click');
majuFrame(1000);
cek('8. pada 2×, 1 detik nyata = 2 detik sesi', Math.abs(k.posisi() - 5) < 0.01, `posisi ${k.posisi()}`);
tombolKecepatan.picu('click');
cek('9. kecepatan kembali ke 1×', tombolKecepatan.textContent === '1×');

// Seret mengambil alih
panggung.picu('pointerdown', { clientX: 500, pointerId: 1 });
cek('10. menyeret menghentikan pemutaran', k.sedangPutar() === false && Math.abs(k.posisi() - 30) < 0.5, `posisi ${k.posisi()}`);
panggung.picu('pointerup', { pointerId: 1 });
majuFrame(1000);
cek('11. setelah diseret, posisi tidak lanjut sendiri', Math.abs(k.posisi() - 30) < 0.5);

// Papan ketik dan lompat masalah juga menghentikan
tombolPutar.picu('click');
panggung.picu('keydown', { key: 'ArrowRight' });
cek('12. panah menghentikan pemutaran', k.sedangPutar() === false);
tombolPutar.picu('click');
tombolSebelum.picu('click');   // satu-satunya masalah ada di detik 10, di belakang posisi sekarang
cek('13. lompat masalah menghentikan pemutaran dan memindahkan posisi', k.sedangPutar() === false && k.posisi() === 10, `posisi ${k.posisi()}`);

// Berhenti sendiri di ujung
k.keDetik(58);
tombolPutar.picu('click');
majuFrame(3000);
cek('14. berhenti sendiri di ujung sesi', k.sedangPutar() === false && k.posisi() === 60, `posisi ${k.posisi()}`);
majuFrame(1000);
cek('15. tidak melewati durasi sesi', k.posisi() === 60);

// Menekan Putar di ujung memulai dari awal
tombolPutar.picu('click');
cek('16. putar di ujung mengulang dari awal', k.posisi() < 1 && k.sedangPutar() === true, `posisi ${k.posisi()}`);

// hentikanPutar() dari luar (dipakai app.js saat meninggalkan rapor)
k.hentikanPutar();
cek('17. hentikanPutar dari luar bekerja', k.sedangPutar() === false);
majuFrame(1000);
cek('18. tidak ada frame tersisa setelah dihentikan', k.sedangPutar() === false);

// Panel hanya disusun ulang saat detiknya berganti
k.keDetik(10);
const potonganAwal = wadahPanel.denganKelas('timeline__transkrip-potongan')[0];
k.keDetik(10.4);
cek('19. panel tidak dibangun ulang dalam satu detik yang sama', wadahPanel.denganKelas('timeline__transkrip-potongan')[0] === potonganAwal);
k.keDetik(25);
cek('20. panel diperbarui saat detik berganti', wadahPanel.denganKelas('timeline__transkrip-potongan--aktif')[0].textContent.includes('bagian kedua'));
console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
