# TAHAP 3 — JEDA PANJANG & VOLUME (`js/audio.js`)

**Versi ini menggantikan seluruh spesifikasi Tahap 3 sebelumnya.** Deteksi bunyi ragu non-leksikal ("eee", "emm") **dibatalkan** — lihat Bagian 4 untuk alasan dan cara menjelaskannya.

Konsekuensinya: tahap ini jadi jauh lebih ringan. Tidak ada library baru, tidak ada kalibrasi ambang yang rumit, tidak ada risiko gagal.

---

## 1. Yang dikerjakan

Tiga metrik, semuanya dari RMS yang sudah dihitung modul ini:

**Jeda panjang.** RMS di bawah ambang bicara selama lebih dari `CONFIG.audio.durasiJedaPanjangMs` (awal 3000) berturut-turut → 1 jeda panjang. Catat jumlah, durasi terlama, dan **timestamp detik-ke-berapa tiap jeda dimulai** (dibutuhkan timeline di Tahap 4B).

**Volume.** Rata-rata RMS sepanjang sesi → label pelan/ideal. Dua ambang di `CONFIG`.

**Ambang bicara adaptif.** Jangan pakai konstanta absolut — gain mikrofon berbeda jauh antar laptop. Ukur noise floor 2 detik di layar Persiapan ("Jangan bicara dulu, kami mengukur suara ruanganmu"), lalu `ambangBicara = noiseFloorRms × CONFIG.audio.pengaliAmbangBicara` (awal 2.5). Ini kalibrasi minimal yang tetap perlu — tanpa ini, jeda tidak akan terdeteksi di ruangan berisik.

## 2. Bentuk hasil

```js
{
  tersedia: true,
  volumeRataRms: 0.14,
  volumeLabel: "ideal",
  jeda: {
    jumlah: 2,
    terlamaDetik: 5.1,
    daftar: [ { mulaiDetik: 47, durasiDetik: 5.1 }, { mulaiDetik: 132, durasiDetik: 3.4 } ]
  }
}
```

`daftar` adalah **event jarang** (beberapa item per sesi), bukan data per frame. Aturan "kembalikan agregat, bukan data per frame" di `CLAUDE.md` tetap berlaku untuk hal lain — daftar event berjumlah puluhan adalah pengecualian yang sah dan dibutuhkan timeline.

## 3. Konstanta di `CONFIG.audio`

```
pengaliAmbangBicara: 2.5
durasiJedaPanjangMs: 3000
ambangVolumePelan: (tetapkan dari uji)
ambangVolumeIdeal: (tetapkan dari uji)
```

## 4. Deteksi bunyi ragu non-leksikal — DIBATALKAN

Jangan implementasikan. Jangan tawarkan. Jangan tambahkan Meyda, Pitchfinder, atau library audio apa pun.

Alasan, untuk dicatat sebagai komentar di kepala modul:

- Uji Tahap 1 (commit `5417122`) membuktikan Web Speech API tidak pernah mentranskripsikan bunyi ragu — 0 dari 10 percobaan. **Catatan 17 September 2026: uji ini dijalankan di Safari, bukan Chrome.** Uji ulang di Chrome tercatat di TODO.md, tetapi keputusan di bagian ini tidak bergantung pada hasilnya. Ini perilaku sengaja pada ASR komersial, bukan bug.
- Deteksi akustik langsung (kestabilan F0 + kestabilan spektrum, metode Goto dkk. 1999) secara teknis mungkin, tapi butuh kalibrasi per pengguna dan per ruangan, dengan risiko nyata gagal mencapai akurasi yang layak. Biaya waktunya tidak sepadan dengan sisa tenggat.
- Sebagai gantinya, **jeda hening panjang** dipakai sebagai indikator hesitasi. Ini lebih murah, lebih andal, dan tetap bermakna: berhenti lama di tengah presentasi adalah gejala yang sama dengan mengisi jeda pakai "eee".
- Filler berupa **kata asli** tetap terdeteksi lewat transkrip di `speech.js` — "kayak", "gitu", "anu", "apa", "seperti", "maksudnya", "jadi". Pastikan daftar ini lengkap.

Di rapor, kartu kata pengisi harus menyebut apa adanya: filler kata terhitung, bunyi non-leksikal tidak. Jangan hapus baris keterangan yang sudah ada — ubah kalimatnya jadi permanen, bukan sementara.