// Pengenal suara tiruan yang meniru perilaku Chrome: hasil final hanya dikirim
// saat penutur berhenti, atau saat stop() dipanggil.
let instans = null;
class RecognitionTiruan {
  constructor() { instans = this; this.tertunda = ''; }
  start() { this.aktif = true; }
  // Pengguna bicara: hanya hasil sementara yang mengalir
  ucap(teks) {
    this.tertunda = (this.tertunda + ' ' + teks).trim();
    this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: this.tertunda }], { isFinal: false, length: 1 })] });
  }
  // stop() membilas yang tertunda sebagai hasil final, lalu menutup — asinkron,
  // persis seperti Chrome.
  stop() {
    this.aktif = false;
    setTimeout(() => {
      if (this.tertunda) {
        this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: this.tertunda }], { isFinal: true, length: 1 })] });
        this.tertunda = '';
      }
      if (this.onend) this.onend();
    }, 80);
  }
  abort() { this.aktif = false; this.tertunda = ''; }
}
globalThis.window = { webkitSpeechRecognition: RecognitionTiruan };
const speech = await import('./speech.mjs');
let gagal = 0; const cek=(n,k,i='')=>{console.log(`${k?'LULUS':'GAGAL'}  ${n} ${i}`); if(!k) gagal++;};
const CONFIG = { FILLER_WORDS: ['kayak'], FILLER_PREFIX_MIN: 4, WPM_BUCKET_DETIK: 30, WPM_BUCKET_MIN_DETIK: 10, SPEECH_WATCHDOG_DETIK: 60 };

// KASUS BUG: bicara tanpa jeda sama sekali, lalu langsung tekan Selesai
speech.start({}, CONFIG);
instans.ucap('saya bicara tanpa berhenti sama sekali sepanjang sesi ini');
cek('1. sebelum berhenti, belum ada hasil final sama sekali', speech.getResults(40).tersedia === false);

const janji = speech.stop();
cek('2. stop() mengembalikan promise', janji instanceof Promise);
cek('3. tepat setelah stop(), hasilnya memang belum sampai', speech.getResults(40).tersedia === false);

await janji;
const r = speech.getResults(40);
cek('4. sesudah ditunggu, kalimat terakhir terhitung', r.tersedia === true && r.totalKata === 9, `${r.totalKata} kata`);
cek('5. WPM ikut terhitung, bukan nol', r.wpmRata > 0, `${r.wpmRata} WPM`);
cek('6. potongan transkrip ikut terbawa', r.potonganTranskrip.length === 1 && r.potonganTranskrip[0].teks.includes('tanpa berhenti'));

// Sesi yang penuturnya sempat berhenti: perilaku lama tidak berubah
speech.start({}, CONFIG);
instans.ucap('kalimat pertama');
instans.stop();                      // seperti jeda alami: Chrome memfinalkan
await new Promise(r2 => setTimeout(r2, 150));
speech.start({}, CONFIG);            // instans baru, seperti auto-restart
instans.ucap('kalimat kedua sesudah jeda');
await speech.stop();
cek('7. sesi dengan jeda tetap utuh', speech.getResults(30).totalKata === 4, `${speech.getResults(30).totalKata} kata`);

// Pengenal suara yang menolak menutup tidak boleh menggantung rapor selamanya
class RecognitionMacet extends RecognitionTiruan {
  stop() { this.aktif = false; /* sengaja tidak pernah memicu onend */ }
}
globalThis.window.webkitSpeechRecognition = RecognitionMacet;
const speech2 = await import('./speech.mjs?v=2');
speech2.start({}, CONFIG);
const mulai = Date.now();
await speech2.stop();
const lama = Date.now() - mulai;
cek('8. tidak menggantung bila onend tak pernah datang', lama < 1500, `${lama} ms`);
cek('9. tetap menunggu cukup lama untuk pembilasan wajar', lama >= 500, `${lama} ms`);
console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
