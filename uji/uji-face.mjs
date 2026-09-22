// Uji modul arah pandang: sudut kepala, kap wajah hilang, dan penghalusan.
let jam = 5e6; Date.now = () => jam;
globalThis.performance = { now: () => jam };

const setIntervalAsli = globalThis.setInterval, clearIntervalAsli = globalThis.clearInterval;
const setTimeoutAsli = globalThis.setTimeout;
let timerId = 0; const timers = new Map();
globalThis.setInterval = (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms, sisa: ms }); return id; };
globalThis.clearInterval = (id) => { timers.delete(id); };
const tidurAsli = (ms) => new Promise(r => setTimeoutAsli(r, ms));
function majukanJam(ms) {
  jam += ms;
  for (const t of [...timers.values()]) { t.sisa -= ms; if (t.sisa <= 0) { t.sisa = t.ms; t.fn(); } }
}

const { F } = await import('./mock-vision.mjs');
const face = await import('./face.mjs');
let gagal = 0;
const cek = (n, k, i='') => { console.log(`${k ? 'LULUS' : 'GAGAL'}  ${n} ${i}`); if (!k) gagal++; };
const depanDari = r => r.totalFrame - Math.round(r.wajahTakTerlihatPersen * r.totalFrame) - r.frameMenunduk;

const video = { readyState: 4, videoWidth: 640, videoHeight: 480, currentTime: 0 };
const CONF = { FACE_PITCH_MENUNDUK_DERAJAT: 8, FACE_KALIBRASI_MS: 500, FACE_KALIBRASI_MIN_RASIO: 0.6,
               FACE_HILANG_MENUNDUK_MAKS_DETIK: 5, FACE_SMOOTHING_FRAMES: 3, MENUNDUK_EVENT_MIN_DETIK: 3 };

function frame(n, o = {}) { Object.assign(F, o); for (let i = 0; i < n; i++) { video.currentTime += 0.15; majukanJam(150); } }
async function kalibrasi(konf = CONF) {
  const janji = face.kalibrasiPostur(video, konf);
  for (let i = 0; i < 40; i++) { video.currentTime += 0.1; majukanJam(100); await tidurAsli(10); }
  return janji;
}

cek('0. model butuh matriks transformasi menyala', await face.loadModel());
cek('1. tanpa kalibrasi postur, start ditolak', face.start({}, video, CONF) === false);

F.pitch = -10; F.wajah = true;
let sampel = 0;
const goyang = setIntervalAsli(() => { sampel++; F.pitch = (sampel === 3) ? -30 : -10; }, 30);
const kal = await kalibrasi();
clearIntervalAsli(goyang);
cek('2. netral = median -10 derajat, gerakan sesaat diabaikan', kal.berhasil && Math.abs(kal.pitchNetral + 10) < 0.01, JSON.stringify(kal));

F.pitch = -10;
const arah = [];
face.start({ onGazeUpdate: a => arah.push(a) }, video, CONF);
frame(20, { pitch: -10 });
cek('3. netral -> depan', face.getResults().frameMenunduk === 0 && face.getResults().pandangPersen === 1);

frame(10, { pitch: -3 });
cek('4. MENDONGAK tidak pernah terbaca menunduk', face.getResults().frameMenunduk === 0 && !arah.includes('menunduk'), JSON.stringify([...new Set(arah)]));

frame(10, { pitch: -13 });
cek('5. selisih 3 derajat belum cukup jadi menunduk', face.getResults().frameMenunduk === 0);

const mulaiMenunduk = 6.0;
frame(30, { pitch: -26 });
frame(10, { pitch: -10 });
let r = face.getResults();
cek('6. menunduk 30 frame terhitung', r.frameMenunduk === 30, r.frameMenunduk);
cek('7. segmen menunduk tercatat di awal antrean', r.menundukSegmen.length === 1 && Math.abs(r.menundukSegmen[0].durasiDetik - 4.5) <= 0.2 && Math.abs(r.menundukSegmen[0].mulaiDetik - mulaiMenunduk) <= 1, JSON.stringify(r.menundukSegmen));

// SARINGAN KEDIPAN DICABUT 22 September 2026 — lihat kepala js/face.js.
// Kedipan tidak mengganggu sudut kepala, jadi frame berkedip dinilai seperti
// frame lain. Sebelumnya frame ini dibuang dari pembagi, dan itu membuat
// menunduk sungguhan terhitung jauh lebih pendek daripada kenyataannya.
const sebelumKedip = face.getResults();
frame(6, { pitch: -10, blink: 0.9 });
r = face.getResults();
cek('8. kedipan saat menatap depan dihitung sebagai depan', depanDari(r) === depanDari(sebelumKedip) + 6 && r.frameMenunduk === sebelumKedip.frameMenunduk);
cek('9. tidak ada lagi penghitung frame berkedip', r.frameBerkedip === undefined);

const sebelumBaca = face.getResults();
frame(20, { pitch: -26, blink: 0.6 });   // membaca kertas: kelopak mata ikut turun
frame(10, { pitch: -10, blink: 0.1 });
cek('10. menunduk dengan kelopak turun TETAP terhitung menunduk', face.getResults().frameMenunduk === sebelumBaca.frameMenunduk + 20, `${face.getResults().frameMenunduk - sebelumBaca.frameMenunduk} frame`);

// Wajah hilang
const sebelumHilang = face.getResults();
frame(10, { wajah: false });
frame(5, { wajah: true, pitch: -10, blink: 0 });
r = face.getResults();
cek('11. wajah tak terlihat masuk penghitungnya sendiri', Math.round(r.wajahTakTerlihatPersen * r.totalFrame) === 10, `${Math.round(r.wajahTakTerlihatPersen * r.totalFrame)}`);
cek('12. pembagi = depan + menunduk', Math.abs(r.pandangPersen - depanDari(r) / (depanDari(r) + r.frameMenunduk)) < 1e-9);

// Kap: menunduk lalu wajah hilang lama (pergi dari meja)
face.start({}, video, CONF);
frame(20, { wajah: true, pitch: -26, blink: 0 });
frame(60, { wajah: false });
r = face.getResults();
cek('13. hilang saat menunduk: sekitar 5 detik pertama jadi menunduk', Math.abs(r.frameHilangDihitungMenunduk - 34) <= 2, `${r.frameHilangDihitungMenunduk} frame`);
cek('14. sisanya jadi wajah tidak terlihat', Math.round(r.wajahTakTerlihatPersen * r.totalFrame) === 60 - r.frameHilangDihitungMenunduk);
const segTerakhir = r.menundukSegmen[r.menundukSegmen.length - 1];
cek('15. segmen ditutup pada batas kap', Math.abs(segTerakhir.durasiDetik - 8) <= 0.4, JSON.stringify(segTerakhir));

// Segmen "wajah tidak terlihat" baru ditutup saat wajahnya kembali, jadi
// pengguna harus kembali ke bingkai dulu sebelum daftarnya bisa diperiksa.
frame(10, { wajah: true, pitch: -10 });
r = face.getResults();
cek('16. segmen wajah hilang tercatat terpisah', r.hilangSegmen.length === 1 && r.hilangSegmen[0].mulaiDetik >= segTerakhir.mulaiDetik + segTerakhir.durasiDetik - 0.5, JSON.stringify(r.hilangSegmen));

// Hilang saat menatap depan bukan menunduk
face.start({}, video, CONF);
frame(20, { wajah: true, pitch: -10 });
frame(40, { wajah: false });
frame(10, { wajah: true, pitch: -10 });
r = face.getResults();
cek('17. hilang dari status depan tidak jadi menunduk', r.frameHilangDihitungMenunduk === 0 && r.hilangSegmen.length === 1);

// pause/resume
face.start({}, video, CONF);
frame(30, { wajah: true, pitch: -26 });
const sblmJeda = face.getResults();
face.pause(); jam += 60000; face.resume();
frame(10, { pitch: -10 });
r = face.getResults();
cek('18. pause/resume tidak mereset dan menutup segmen', depanDari(r) === depanDari(sblmJeda) + 10 && r.menundukSegmen.length === 1);
face.stop();

// Kalibrasi gagal
F.wajah = false;
const kalGagal = await kalibrasi();
cek('19. wajah tidak terdeteksi -> kalibrasi ditolak', !kalGagal.berhasil && kalGagal.alasan === 'wajah-tidak-terdeteksi');
cek('20. sesudah kalibrasi gagal, modul menolak berjalan', face.start({}, video, CONF) === false && face.getResults().tersedia === false);

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
