# TAHAP 7 — MODUL ANALISIS MATERI (`js/materi.js`)

**Jangan kerjakan sebelum Tahap 6 selesai dan saya konfirmasi.** Tahap ini boleh dibuang kalau waktu habis — aplikasi dengan empat metrik yang mulus mengalahkan aplikasi dengan lima metrik yang satu di antaranya salah terus di depan juri.

---

## 1. Tujuan

Mengukur **seberapa lengkap isi slide benar-benar tersampaikan secara verbal**, dan apakah urutan penyampaiannya mengikuti urutan slide. Bukan menilai kualitas isi slide, bukan menilai benar-salah pernyataan.

Metode: pencocokan kata kunci deterministik, berjalan penuh di perangkat. **Tanpa LLM** — alasannya ada di `CLAUDE.md` dan tidak untuk didiskusikan ulang.

## 2. Parsing `.pptx`

File `.pptx` adalah arsip ZIP berisi XML. Langkahnya:
1. Baca file dengan `FileReader` sebagai ArrayBuffer. **Jangan pernah mengunggahnya ke mana pun.**
2. Buka dengan JSZip (tambahkan ke `index.html` dari CDN saat tahap ini dimulai, bukan sebelumnya).
3. Ambil semua entri yang cocok pola `ppt/slides/slide*.xml`. **Urutkan secara numerik** — `slide2.xml` sebelum `slide10.xml`; sort string default akan salah.
4. Parse tiap slide XML dengan `DOMParser`, kumpulkan seluruh isi elemen teks `<a:t>`, gabungkan dengan spasi.
5. Abaikan `ppt/notesSlides/` (catatan pembicara bukan materi yang harus diucapkan), tapi sediakan `CONFIG.materi.sertakanCatatan = false` supaya bisa saya ubah.
6. Setelah ekstraksi, lepas referensi ke file dan ArrayBuffer.

**Batasan yang harus ditangani dan dikomunikasikan ke pengguna:**
- Hanya `.pptx`. File `.ppt` lama (biner) tidak didukung → "Format .ppt lama belum didukung. Simpan ulang sebagai .pptx di PowerPoint."
- Teks di dalam gambar tidak terbaca (tidak ada OCR). Sebut di UI: "Teks yang berbentuk gambar tidak bisa dibaca."
- Slide tanpa teks (hanya gambar/diagram) → tandai `tanpaTeks: true` dan **keluarkan dari perhitungan cakupan**, jangan dihitung 0%. Laporkan jumlahnya.
- File > 20MB → tolak dengan pesan jelas.
- File rusak / bukan pptx valid → tangkap error, "File tidak bisa dibaca. Pastikan ini file .pptx yang valid." Sesi tetap jalan tanpa modul materi.

## 3. Ekstraksi kata kunci per slide

1. **Normalisasi**: lowercase, hapus tanda baca, pecah per spasi.
2. **Buang stopword Indonesia.** Konstanta `STOPWORDS_ID`, isi awal: `yang, dan, di, ke, dari, untuk, dengan, pada, adalah, ini, itu, akan, atau, juga, dalam, tidak, bisa, dapat, telah, sudah, agar, oleh, sebagai, karena, jika, maka, saat, kita, kami, saya, anda, mereka, ada, bagi, serta, antara, secara, lebih, sangat, hanya, setiap, semua, tersebut, yaitu, namun, tetapi, sehingga`.
3. Buang token < 4 karakter dan angka murni, **kecuali** angka 4 digit (kemungkinan tahun).
4. Hasil: array kata kunci unik per slide. Slide dengan < 3 kata kunci setelah penyaringan → tandai `terlaluSedikitKataKunci: true` dan keluarkan dari perhitungan cakupan. Mengukur cakupan dari 2 kata kunci tidak bermakna.

## 4. Pencocokan dengan ucapan

`materi.js` menerima hasil transkrip **final** dari `speech.js` lewat callback. **Jangan buat instance `webkitSpeechRecognition` kedua** — hanya boleh ada satu di seluruh aplikasi.

Untuk tiap kata kunci yang belum tercentang:
1. Normalisasi kata dari transkrip dengan cara yang sama.
2. **Pencocokan awalan, bukan sama-persis** — morfologi Indonesia menuntut ini: "presentasi" harus tercentang oleh "presentasinya" dan "mempresentasikan". Pakai aturan dan konstanta yang sama dengan yang sudah dipakai untuk kata pengisi di `speech.js`; jangan bikin aturan kedua yang berbeda.
3. Saat tercentang, **catat detik-ke-berapa dalam sesi** kata itu pertama diucapkan (untuk analisis urutan).

Tanpa sinonim, tanpa kamus, tanpa embedding. Pencocokan leksikal saja, dan keterbatasannya diakui di UI.

## 5. Metrik yang dihasilkan

```js
{
  tersedia: true,
  namaFile: "Sidang Bab 3.pptx",
  jumlahSlide: 12,
  slideDihitung: 10,
  slideDilewati: 2,
  cakupanKeseluruhan: 0.68,
  perSlide: [
    { nomor: 1, cakupan: 0.85, totalKataKunci: 13, tersampaikan: 11,
      waktuPertamaDetik: 12, dihitung: true },
    { nomor: 3, cakupan: null, dihitung: false, alasan: "tanpa teks" }
  ],
  slideTerlewat: [7],
  urutanSesuai: false,
  slideTidakBerurutan: [5, 4]
}
```

**Analisis urutan:** ambil `waktuPertamaDetik` dari slide yang dihitung dan cakupannya di atas ambang, urutkan berdasarkan waktu, bandingkan dengan urutan nomor slide. **Jangan menghukum ini di skor** — melompat urutan sering disengaja dan sah. Sajikan sebagai informasi netral.

## 6. Skor materi — TERPISAH, jangan dicampur

**Skor presentasi 0–100 yang sudah ada (WPM, filler, pandang, jeda, postur) TIDAK BOLEH berubah.**

Cakupan materi adalah **angka kedua yang berdiri sendiri**: "Cakupan materi: 68%". Alasannya: cara menyampaikan dan kelengkapan isi adalah dua hal berbeda; meleburnya membuat pengguna tidak tahu harus memperbaiki apa. Dua angka, dua saran.

## 7. Perubahan UI

**Layar Persiapan** — blok opsional:
- "Materi presentasi (opsional)", input file `accept=".pptx"`.
- Keterangan: "File dibaca langsung di browsermu, tidak diunggah ke mana pun. Teks berbentuk gambar tidak terbaca."
- Setelah berhasil diparsing: ringkasan tenang — "12 slide terbaca, 2 slide tanpa teks akan dilewati" + tombol kecil "Hapus file".
- Gagal → pesan error sesuai Bagian 2, dan tombol "Lanjut tanpa materi" tetap tersedia.
- **Parsing saat file dipilih, bukan saat sesi dimulai** — pengguna harus tahu masalahnya sebelum mulai bicara.

**Layar Sesi** — JANGAN tampilkan apa pun soal materi. Tidak ada checklist slide berjalan, tidak ada progres cakupan. Batas 3 indikator live tetap. Menampilkan checklist akan membuat pengguna membaca layar, bukan berlatih — ini melanggar prinsip inti produk.

**Layar Rapor** — bagian baru **di bawah** kartu metrik yang sudah ada, hanya muncul jika modul aktif:
- Judul "Cakupan Materi" + persentase, ukuran sama dengan angka metrik lain — **bukan** sebesar angka skor utama.
- Daftar slide dengan bar horizontal tipis per slide. Slide di bawah ambang terlewat diberi `--bahaya`; slide yang dikeluarkan dari perhitungan abu-abu dengan label alasannya.
- Maksimal 2 saran dari konstanta `ATURAN_SARAN_MATERI`. Contoh: cakupan slide < 0.25 → "Slide 7 hampir tidak kamu bahas — cek apakah sengaja dilewati"; cakupan keseluruhan < 0.5 → "Lebih dari separuh poin di slidemu belum terucap; coba kurangi slide atau tambah waktu"; `urutanSesuai === false` → sebutkan slide tidak berurutan sebagai catatan netral.
- **Wajib**, satu baris `--redup` di akhir bagian: "Cakupan dihitung dari kecocokan kata, bukan makna. Parafrase dan sinonim mungkin tidak terdeteksi."

**Layar Riwayat** — kolom tambahan cakupan materi jika sesi itu punya datanya; kosong jika tidak.

## 8. Tambahan skema `localStorage`

```js
"materi": {
  "aktif": true,
  "namaFile": "Sidang Bab 3.pptx",
  "jumlahSlide": 12,
  "slideDihitung": 10,
  "cakupanKeseluruhan": 0.68,
  "cakupanPerSlide": [0.85, 0.22, null, 0.91],
  "slideTerlewat": [7],
  "urutanSesuai": false
}
```
Jangan simpan kata kunci, teks slide, atau transkrip — hanya angka. Modul tidak aktif: `{"aktif": false}`.

## 9. Error tambahan

1. JSZip gagal dimuat dari CDN → blok unggah disembunyikan, "Analisis materi tidak tersedia (library gagal dimuat)". Sesi jalan normal.
2. File valid tapi nol slide berteks → beri tahu, tawarkan lanjut tanpa materi.
3. Sesi selesai tapi transkrip kosong (mic gagal) → jangan laporkan cakupan 0%; laporkan "tidak dapat dihitung karena tidak ada ucapan terdeteksi".
4. Pengguna ganti file → reset seluruh state materi, jangan campur data slide lama.

## 10. Roadmap (jangan dikerjakan, catat sebagai komentar saja)

Keterbatasan leksikal bisa diatasi dengan sentence embeddings on-device via transformers.js — model `Xenova/paraphrase-multilingual-MiniLM-L12-v2` mendukung bahasa Indonesia dan berjalan di browser. Tidak dikerjakan karena ukuran model perlu diukur dulu terhadap pengalaman pengguna. Catat ini di komentar kepala modul supaya saya bisa menyebutnya sebagai roadmap di presentasi.