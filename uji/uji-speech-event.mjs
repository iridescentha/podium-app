let jam = 2e6; Date.now = () => jam;
let instans = null;
class RecognitionTiruan {
  start() { this.aktif = true; } stop() { this.aktif = false; if (this.onend) this.onend(); } abort() {}
  constructor() { instans = this; }
  // Kirim satu potongan final seolah Chrome baru memfinalkannya
  kirimFinal(teks) { this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: teks }], { isFinal: true, length: 1 })] }); }
}
globalThis.window = { webkitSpeechRecognition: RecognitionTiruan };
const speech = await import('./speech.mjs');
let gagal = 0; const cek=(n,k,i='')=>{console.log(`${k?'LULUS':'GAGAL'}  ${n} ${i}`); if(!k) gagal++;};
const CONFIG = { FILLER_WORDS: ['anu','apa ya','gitu','kayak'], FILLER_PREFIX_MIN: 4, WPM_BUCKET_DETIK: 30, WPM_BUCKET_MIN_DETIK: 10 };

speech.start({}, CONFIG);
jam += 10_000; instans.kirimFinal('jadi kayak begini maksudnya');
jam += 8_000;  instans.kirimFinal('terus gitu ya');
jam += 12_000; instans.kirimFinal('sekian dan terima kasih');
let r = speech.getResults(30);

cek('1. dua event kata pengisi tercatat', r.filler.events.length === 2, JSON.stringify(r.filler.events));
// Cap waktu kini DISEBAR di dalam rentang potongannya, bukan ditumpuk di detik
// finalisasi. Potongan 1 ("jadi kayak begini maksudnya") membentang 0-10 detik
// dengan 4 kata, jadi "kayak" (kata ke-2) jatuh di sekitar 3,75 detik.
// Potongan 2 ("terus gitu ya") membentang 10-18 dengan 3 kata, jadi "gitu"
// (kata ke-2) jatuh di sekitar 14 detik.
cek('2. cap waktu event disebar sesuai posisi katanya', r.filler.events[0].kata === 'kayak' && Math.abs(r.filler.events[0].detik - 3.75) < 0.3 && r.filler.events[1].kata === 'gitu' && Math.abs(r.filler.events[1].detik - 14) < 0.5, JSON.stringify(r.filler.events));
cek('3. jumlah event sama dengan total filler', r.filler.events.length === r.filler.total);

cek('4. tiga potongan transkrip tersimpan', r.potonganTranskrip.length === 3, JSON.stringify(r.potonganTranskrip));
cek('5. potongan membawa teks asli', r.potonganTranskrip[0].teks === 'jadi kayak begini maksudnya');
cek('6. rentang waktu bersambung', Math.abs(r.potonganTranskrip[0].detikMulai - 0) < 0.2 && Math.abs(r.potonganTranskrip[0].detikSelesai - 10) < 0.2 && Math.abs(r.potonganTranskrip[1].detikMulai - 10) < 0.2);

// pause() tidak boleh menghapus event, dan jam sesi mengabaikan durasi jeda
speech.pause(); jam += 60_000; speech.resume();
jam += 5_000; instans.kirimFinal('anu sudah selesai');
r = speech.getResults(35);
cek('7. pause/resume tidak menghapus event', r.filler.events.length === 3 && r.potonganTranskrip.length === 4);
// Potongan sesudah resume membentang 30-35 detik dengan 3 kata; "anu" adalah
// kata pertama, jadi jatuh sekitar 30,8 — dan yang penting, durasi jeda satu
// menit tidak ikut terhitung sama sekali.
cek('8. cap waktu event mengabaikan durasi jeda', Math.abs(r.filler.events[2].detik - 30.8) < 0.5, r.filler.events[2].detik);

// start() mengosongkan keduanya
speech.start({}, CONFIG);
r = speech.getResults(10);
cek('9. start() mengosongkan event dan transkrip', r.filler.events.length === 0 && r.potonganTranskrip.length === 0);

// Frasa dua kata menghasilkan satu event per kemunculan
jam += 4_000; instans.kirimFinal('apa ya begitu apa ya');
r = speech.getResults(10);
cek('10. frasa berulang menghasilkan dua event', r.filler.events.filter(e => e.kata === 'apa ya').length === 2, JSON.stringify(r.filler.events));
console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);

// --- Sesi tanpa satu pun hasil final: TIDAK TERSEDIA, bukan nol ---
speech.start({}, CONFIG);
jam += 120_000;                       // dua menit berlalu tanpa transkrip apa pun
let kosong = speech.getResults(120);
cek('11. tanpa transkrip: melaporkan tersedia false', kosong.tersedia === false);
cek('12. WPM null, bukan 0', kosong.wpmRata === null, String(kosong.wpmRata));
cek('13. kata pengisi null, bukan 0', kosong.filler.total === null, String(kosong.filler.total));
cek('14. tidak ada deret WPM palsu', kosong.deretWpm.length === 0 && kosong.wpmSeri.length === 0);

// Begitu ada satu kalimat, metriknya kembali tersedia
jam += 5_000; instans.kirimFinal('halo semuanya selamat pagi');
let ada = speech.getResults(125);
cek('15. satu kalimat cukup untuk membuat metrik tersedia', ada.tersedia === true && typeof ada.wpmRata === 'number' && ada.filler.total === 0);
console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);

// Pengawas memakai setInterval; tanpa stop() proses node tidak pernah keluar.
speech.stop();

// --- Sebaran cap waktu: kasus lapangan 22 September 2026 ---
// Penutur bicara 40 detik tanpa jeda sama sekali, lalu Chrome memfinalkan
// semuanya sekaligus. Sebelum diperbaiki, seluruh katanya menumpuk di detik 40
// sehingga potongan 30-40 terbaca ratusan WPM dan potongan awal nyaris kosong.
speech.start({}, CONFIG);
jam += 40_000;
const kalimatPanjang = Array.from({ length: 60 }, (_, i) => `kata${i}`).join(' ');
instans.kirimFinal(kalimatPanjang);
const rr = speech.getResults(40);
cek('16. kata tersebar, bukan menumpuk di detik finalisasi', (() => {
  const deret = rr.deretWpm;
  return deret.length === 2 && deret.every(d => d.wpm > 40 && d.wpm < 140);
})(), JSON.stringify(rr.deretWpm));
cek('17. rata-rata sesi tetap benar', Math.abs(rr.wpmRata - 90) <= 2, `${rr.wpmRata} WPM`);
speech.stop();
console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
