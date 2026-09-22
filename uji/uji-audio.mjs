let rmsSekarang = 0;
let jam = 1_000_000;
Date.now = () => jam;
let rafAntrian = null;
globalThis.window = { AudioContext: class { constructor(){this.state='running'} createMediaStreamSource(){return {connect(){},disconnect(){}}} createAnalyser(){return {fftSize:512, getFloatTimeDomainData(b){b.fill(rmsSekarang)}}} close(){} } };
globalThis.requestAnimationFrame = (fn) => { rafAntrian = fn; return 1; };
globalThis.cancelAnimationFrame = () => { rafAntrian = null; };

const audio = await import('./audio.mjs');
const CONFIG = { audio: { pengaliAmbangBicara: 2.5, durasiJedaPanjangMs: 3000, minDurasiSuaraMs: 200, durasiUkurNoiseMs: 300, pengaliVolumePelan: 3, debug: false } };
let gagal = 0;
const cek = (nama, kondisi, info='') => { console.log(`${kondisi ? 'LULUS' : 'GAGAL'}  ${nama} ${info}`); if (!kondisi) gagal++; };

// Jalankan frame 16 ms selama durasi tertentu pada tingkat RMS tertentu
function jalan(detik, rms) {
  rmsSekarang = rms;
  const n = Math.round(detik * 1000 / 16);
  for (let i = 0; i < n; i++) { jam += 16; const f = rafAntrian; rafAntrian = null; if (f) f(); }
}

audio.initAudio({ getAudioTracks: () => [1] });
cek('1. tanpa pengukuran -> tersedia false', audio.getResults(CONFIG).tersedia === false);

// Noise floor dengan satu lonjakan: median harus mengabaikannya
let hitung = 0;
const intervalLonjakan = setInterval(() => { hitung++; rmsSekarang = (hitung === 3) ? 0.5 : 0.01; }, 50);
const hasilUkur = await audio.ukurNoiseFloor(CONFIG);
clearInterval(intervalLonjakan);
cek('2. noise floor median kebal lonjakan', hasilUkur.berhasil && Math.abs(hasilUkur.noiseFloorRms - 0.01) < 1e-9, JSON.stringify(hasilUkur));
cek('3. ambang = 0.01 x 2.5', Math.abs(hasilUkur.ambangBicara - 0.025) < 1e-9);

const DIAM = 0.01, BICARA = 0.08;
audio.start({}, CONFIG);
jalan(4, DIAM);      // t0-4   hening awal, TIDAK dihitung
jalan(5, BICARA);    // t4-9
jalan(5, DIAM);      // t9-14  jeda 5 s -> dihitung
jalan(2, BICARA);    // t14-16
jalan(2, DIAM);      // t16-18 hening 2 s -> tidak dihitung
jalan(1, BICARA);    // t18-19
jalan(3, DIAM); jalan(0.1, BICARA); jalan(3, DIAM);  // t19-25.1 hening 6.1 s dengan ketukan 100 ms -> satu jeda
jalan(2, BICARA);    // t25.1-27.1
jalan(2, DIAM); jalan(0.4, BICARA); jalan(2, DIAM);  // ketukan 400 ms = diakui bicara -> dua hening 2 s, tidak dihitung
jalan(1, BICARA);    // t31.5-32.5
let r = audio.getResults(CONFIG);
cek('4. dua jeda terhitung', r.jeda.jumlah === 2, JSON.stringify(r.jeda.daftar));
cek('5. jeda pertama mulai ~9 s durasi ~5 s', r.jeda.daftar[0] && r.jeda.daftar[0].mulaiDetik === 9 && Math.abs(r.jeda.daftar[0].durasiDetik - 5) <= 0.1);
cek('6. ketukan 100 ms tidak memecah hening', r.jeda.daftar[1] && r.jeda.daftar[1].mulaiDetik === 19 && Math.abs(r.jeda.daftar[1].durasiDetik - 6.1) <= 0.1);
cek('7. terlama = 6.1', Math.abs(r.jeda.terlamaDetik - 6.1) <= 0.1, r.jeda.terlamaDetik);
cek('8. volume hanya dari frame bicara', Math.abs(r.volumeRataRms - BICARA) < 1e-6, r.volumeRataRms);
cek('9. label ideal: bicara 0.08 pada ruangan 0.01 = rasio 8x', Math.abs(r.rasioVolume - 8) < 0.01 && r.volumeLabel === 'ideal', `rasio ${r.rasioVolume}`);

// Jeda tombol: hening 4 s lalu pause -> dibuang; akumulator tetap
jalan(4, DIAM);
audio.pause();
jam += 60_000;                // istirahat 1 menit
jalan(1, DIAM);               // tidak ada frame yang diproses saat dijeda
cek('10. pause tidak mereset hitungan', audio.getResults(CONFIG).jeda.jumlah === 2);
audio.resume();
jalan(5, DIAM);               // hening sesudah resume sebelum bicara -> tidak dihitung
jalan(1, BICARA);
jalan(3.5, DIAM);             // jeda 3.5 s -> dihitung, cap waktu tanpa waktu jeda
jalan(1, BICARA);
r = audio.getResults(CONFIG);
cek('11. hening terbuka saat pause & sesudah resume tidak dihitung, jeda baru terhitung', r.jeda.jumlah === 3, JSON.stringify(r.jeda.daftar));
// posisi jam sesi: 32.5 + 4 (sebelum pause) + 5 + 1 = 42.5 -> jeda mulai ~42.5
cek('12. cap waktu mengabaikan durasi pause', r.jeda.daftar[2] && Math.abs(r.jeda.daftar[2].mulaiDetik - 42.5) <= 1, r.jeda.daftar[2] && r.jeda.daftar[2].mulaiDetik);

// Ekor sesi: hening 8 s lalu stop -> dibuang
jalan(8, DIAM);
audio.stop();
r = audio.getResults(CONFIG);
cek('13. hening di akhir sesi tidak dihitung', r.jeda.jumlah === 3);

// start() baru mereset, ambang tetap
audio.start({}, CONFIG);
r = audio.getResults(CONFIG);
cek('14. start() mereset akumulator, ambang dipertahankan', r.tersedia && r.jeda.jumlah === 0 && r.volumeRataRms === null && r.volumeLabel === null);

// Volume pelan & ambang volume belum ditetapkan
jalan(2, 0.03);
// Suara ruangan pada sesi ini 0.01, jadi rasio = rataRms / 0.01
cek('15. rasio 3x (0.03 / 0.01) tepat di ambang -> ideal', (() => { const x = audio.getResults(CONFIG); return Math.abs(x.rasioVolume - 3) < 0.01 && x.volumeLabel === 'ideal'; })(), JSON.stringify(audio.getResults(CONFIG).rasioVolume));
cek('16. pengaliVolumePelan null -> label null, rasio tetap dilaporkan', (() => { const x = audio.getResults({ audio: { ...CONFIG.audio, pengaliVolumePelan: null } }); return x.volumeLabel === null && x.rasioVolume > 0 && x.volumeRataRms > 0; })());
audio.stop();

// Mikrofon bisu -> gagal ukur -> tersedia false
rmsSekarang = 0;
const bisu = await audio.ukurNoiseFloor(CONFIG);
cek('17. mikrofon bisu -> gagal, tersedia false', !bisu.berhasil && audio.getResults(CONFIG).tersedia === false);

// report.js: bobot jeda dialihkan
const report = await import('./report.mjs');
const dasar = { wpmTersedia: true, wpmRata: 120, durasiDetik: 120, fillerTersedia: true, filler: { total: 0 }, pandangTersedia: true, pandangPersen: 1, postur: { aktif: false } };
cek('18. skor 100 saat jeda tak tersedia (bobot dialihkan, bukan gratis)', report.hitungSkorTotal({ ...dasar, jedaTersedia: false, jeda: { jumlah: null } }, false) === 100);
const skorEmpatJeda = report.hitungSkorTotal({ ...dasar, pandangPersen: 0.5, jedaTersedia: true, jeda: { jumlah: 4 } }, false);
const skorTakTersedia = report.hitungSkorTotal({ ...dasar, pandangPersen: 0.5, jedaTersedia: false, jeda: { jumlah: null } }, false);
cek('19. 4 jeda menurunkan skor dibanding bobot dialihkan', skorEmpatJeda < skorTakTersedia, `${skorEmpatJeda} vs ${skorTakTersedia}`);
cek('20. saran jeda tidak muncul bila tak tersedia', report.pilihSaran({ ...dasar, jedaTersedia: false, jeda: { jumlah: null } }).every(s => !s.includes('jeda panjang')));
cek('21. saran jeda muncul bila 4 jeda', report.pilihSaran({ ...dasar, jedaTersedia: true, jeda: { jumlah: 4 } }).some(s => s.includes('jeda panjang')));

console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);


// --- Volume RELATIF: mikrofon berbeda, rasio sama (commit volume relatif) ---
// Mikrofon "pelan": ruangan 0.004, bicara 0.02 -> rasio 5x
// Mikrofon "keras": ruangan 0.02,  bicara 0.10 -> rasio 5x
// Keduanya harus mendapat label yang SAMA, karena suaranya memang sama relatif
// terhadap ruangannya masing-masing.
async function sesiDengan(noise, bicara, konf) {
  rmsSekarang = noise;
  await audio.ukurNoiseFloor(konf);
  audio.start({}, konf);
  jalan(10, bicara);
  audio.stop();
  return audio.getResults(konf);
}
const KONF5 = { audio: { ...CONFIG.audio, pengaliVolumePelan: 4 } };
const mikPelan = await sesiDengan(0.004, 0.02, KONF5);
const mikKeras = await sesiDengan(0.02, 0.10, KONF5);
cek('22. dua mikrofon berbeda menghasilkan rasio yang sama', Math.abs(mikPelan.rasioVolume - mikKeras.rasioVolume) < 0.05, `${mikPelan.rasioVolume.toFixed(2)} vs ${mikKeras.rasioVolume.toFixed(2)}`);
cek('23. label keduanya sama walau RMS mutlaknya berbeda 5 kali lipat', mikPelan.volumeLabel === 'ideal' && mikKeras.volumeLabel === 'ideal', `${mikPelan.volumeRataRms.toFixed(4)} vs ${mikKeras.volumeRataRms.toFixed(4)}`);
// 0.012 dipilih, bukan 0.01: pada 0.01 suaranya PERSIS di ambang bicara
// (0.004 x 2.5) sehingga tidak ada satu frame pun yang terhitung bicara.
const berbisik = await sesiDengan(0.004, 0.012, KONF5);   // rasio 3x, di bawah pengali 4
cek('24. berbisik di ruangan yang sama dilabeli pelan', berbisik.volumeLabel === 'pelan', `rasio ${berbisik.rasioVolume.toFixed(2)}`);
cek('25. RMS mutlak dan suara ruangan ikut dilaporkan untuk kalibrasi', typeof berbisik.volumeRataRms === 'number' && typeof berbisik.noiseFloorRms === 'number');
console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
