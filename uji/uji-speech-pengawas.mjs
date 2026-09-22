// Jam nyata dipakai apa adanya; jeda percobaan dan pengawas memakai timer asli
let gagalBerapaKali = 0, instansDibuat = 0, instans = null;
class RecognitionTiruan {
  constructor() { instansDibuat++; instans = this; }
  start() {
    if (gagalBerapaKali > 0) { gagalBerapaKali--; const e = new Error('InvalidStateError'); e.name = 'InvalidStateError'; throw e; }
    this.aktif = true;
  }
  stop() { this.aktif = false; }
  abort() {}
  kirimFinal(teks) { this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: teks }], { isFinal: true, length: 1 })] }); }
}
globalThis.window = { webkitSpeechRecognition: RecognitionTiruan };
const speech = await import('./speech.mjs');
let gagal = 0; const cek=(n,k,i='')=>{console.log(`${k?'LULUS':'GAGAL'}  ${n} ${i}`); if(!k) gagal++;};
const tidur = ms => new Promise(r => setTimeout(r, ms));
const CONFIG = { FILLER_WORDS: ['kayak'], FILLER_PREFIX_MIN: 4, WPM_BUCKET_DETIK: 30, WPM_BUCKET_MIN_DETIK: 10, SPEECH_WATCHDOG_DETIK: 1 };

// KASUS BUG: start() gagal sekali, seperti saat instans lama belum tuntas ditutup
gagalBerapaKali = 1; instansDibuat = 0;
const keadaan = [];
speech.start({ onStatusChange: k => keadaan.push(k) }, CONFIG);
cek('1. percobaan pertama gagal, sesi belum menyerah', instansDibuat === 1);
await tidur(400);
cek('2. dicoba lagi otomatis dan berhasil', instansDibuat === 2 && instans.aktif === true, `${instansDibuat} instans`);
instans.kirimFinal('halo ini uji coba');
cek('3. transkrip masuk setelah percobaan ulang', speech.getResults(10).tersedia === true);
speech.stop();

// Gagal terus: menyerah setelah beberapa percobaan DAN melaporkannya
gagalBerapaKali = 99; instansDibuat = 0;
const keadaan2 = [];
speech.start({ onStatusChange: k => keadaan2.push(k) }, CONFIG);
await tidur(2500);
cek('4. berhenti mencoba setelah beberapa kali, tidak selamanya', instansDibuat <= 5, `${instansDibuat} percobaan`);
cek('5. kegagalan dilaporkan ke pemanggil', keadaan2.includes('tidak-aktif'), JSON.stringify(keadaan2));
speech.stop();

// PENGAWAS: pengenalan berhenti diam-diam tanpa onend
gagalBerapaKali = 0; instansDibuat = 0;
const keadaan3 = [];
speech.start({ onStatusChange: k => keadaan3.push(k) }, CONFIG);
instans.kirimFinal('kalimat pertama');
cek('6. status aktif dilaporkan saat hasil masuk', keadaan3.includes('aktif'));
const sebelumPengawas = instansDibuat;
await tidur(6500);   // lebih lama dari SPEECH_WATCHDOG_DETIK 1 detik + siklus cek 5 detik
cek('7. pengawas membangun ulang pengenalan yang diam', instansDibuat > sebelumPengawas, `${sebelumPengawas} -> ${instansDibuat}`);
cek('8. keadaan tidak-aktif ikut dilaporkan', keadaan3.includes('tidak-aktif'), JSON.stringify(keadaan3));
cek('9. akumulator TIDAK direset oleh pengawas', speech.getResults(20).totalKata === 2, `${speech.getResults(20).totalKata} kata`);

// Pengawas berhenti saat sesi dijeda dan dihentikan
const saatJeda = instansDibuat;
speech.pause();
await tidur(6500);
cek('10. pengawas diam saat sesi dijeda', instansDibuat === saatJeda, `${saatJeda} -> ${instansDibuat}`);
speech.resume();
const saatStop = instansDibuat;
speech.stop();
await tidur(6500);
cek('11. pengawas diam setelah sesi berhenti', instansDibuat === saatStop + 0 || instansDibuat === saatStop, `${saatStop} -> ${instansDibuat}`);
console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
