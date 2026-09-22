const isi = new Map();
globalThis.localStorage = { getItem: k => isi.has(k) ? isi.get(k) : null, setItem: (k,v) => isi.set(k,v), removeItem: k => isi.delete(k) };
const storage = await import('./storage.mjs');
let gagal = 0; const cek=(n,k,i='')=>{console.log(`${k?'LULUS':'GAGAL'}  ${n} ${i}`); if(!k) gagal++;};

// Sesi versi sekarang: dilewatkan apa adanya
const baru = { id: 's_2', judul: 'Baru', mode: 'lengkap', durasiDetik: 120, skor: 74,
  wpmTersedia: true, wpmRata: 130, fillerTersedia: true,
  filler: { total: 3, rincian: { kayak: 3 }, events: [{ detik: 10, kata: 'kayak' }] },
  jedaTersedia: true, jeda: { jumlah: 1, terlamaDetik: 5, daftar: [{ mulaiDetik: 40, durasiDetik: 5 }] },
  pandangTersedia: true, pandangPersen: 0.8, menundukSegmen: [{ mulaiDetik: 60, durasiDetik: 6 }],
  hilangSegmen: [], deretWpm: [{ detikMulai: 0, detikSelesai: 30, wpm: 130 }], metrikHilang: [],
  postur: { aktif: false, distribusi: {} } };
let r = storage.lengkapiSesiLama(baru);
cek('1. sesi versi sekarang tidak diubah', JSON.stringify(r) === JSON.stringify({ ...baru, ...r }) && r.wpmTersedia === true && r.filler.events.length === 1);

// Sesi LAMA (sebelum 144a9e2): tanpa penanda ketersediaan
const lama = { id: 's_1', judul: 'Lama', durasiDetik: 300, skor: 74, wpmRata: 138,
  wpmSeri: [120, 131, 140], filler: { total: 11, rincian: { kayak: 6 } },
  pandangTersedia: true, pandangPersen: 0.62, jeda: { jumlah: 2, terlamaDetik: 5.1 },
  postur: { aktif: false, distribusi: {} } };
r = storage.lengkapiSesiLama(lama);
cek('2. angka lama yang ADA disimpulkan tersedia', r.wpmTersedia === true && r.fillerTersedia === true && r.jedaTersedia === true);
cek('3. angkanya sendiri tidak diubah', r.wpmRata === 138 && r.filler.total === 11 && r.jeda.jumlah === 2);
cek('4. daftar event yang tidak ada jadi array kosong, bukan undefined', Array.isArray(r.filler.events) && r.filler.events.length === 0 && Array.isArray(r.jeda.daftar) && Array.isArray(r.menundukSegmen) && Array.isArray(r.deretWpm));
cek('5. mode tidak dikarang untuk sesi lama', r.mode === undefined);

// Sesi lama yang metriknya memang nol: tetap nol, bukan "belum aktif"
r = storage.lengkapiSesiLama({ ...lama, wpmRata: 0, filler: { total: 0, rincian: {} } });
cek('6. nol yang memang tercatat tetap nol dan tetap tersedia', r.wpmTersedia === true && r.wpmRata === 0 && r.fillerTersedia === true && r.filler.total === 0);

// Sesi baru yang metriknya TIDAK terukur: penandanya dihormati, tidak ditimpa
r = storage.lengkapiSesiLama({ ...baru, wpmTersedia: false, wpmRata: null, fillerTersedia: false,
  filler: { total: null, rincian: {}, events: [] }, metrikHilang: ['kecepatan bicara', 'kata pengisi'], skor: null });
cek('7. penanda "tidak tersedia" tidak ditimpa jadi tersedia', r.wpmTersedia === false && r.fillerTersedia === false);
cek('8. daftar metrik hilang dipertahankan', r.metrikHilang.length === 2 && r.skor === null);

// Sesi rusak sebagian tidak boleh melempar
let aman = true;
try { storage.lengkapiSesiLama({ id: 's_rusak' }); } catch (e) { aman = false; }
cek('9. sesi tanpa field apa pun tidak melempar', aman);
r = storage.lengkapiSesiLama({ id: 's_rusak' });
cek('10. sesi rusak jadi serba "tidak tersedia", bukan nol', r.wpmTersedia === false && r.fillerTersedia === false && r.jedaTersedia === false && r.pandangTersedia === false);

// Transkrip tersimpan ikut terbawa apa adanya
r = storage.lengkapiSesiLama({ ...baru, potonganTranskrip: [{ detikMulai: 0, detikSelesai: 5, teks: 'halo' }] });
cek('11. transkrip tersimpan ikut terbawa', r.potonganTranskrip.length === 1);
r = storage.lengkapiSesiLama(baru);
cek('12. tanpa transkrip tersimpan, fieldnya tidak dikarang', r.potonganTranskrip === undefined);
console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
