# Podium — Pelatih Presentasi Pribadi

## Cara menjalankan

```bash
cd podium-app
python3 -m http.server 8000
```

Lalu buka **http://localhost:8000** di **Google Chrome desktop**.

**Jangan membuka `index.html` dengan klik dua kali.** Berkas yang dibuka lewat
`file://` tidak boleh mengakses kamera dan mikrofon, dan modul JavaScript-nya
juga akan ditolak peramban. Aplikasi ini membutuhkan `localhost` atau HTTPS, dan
perintah di atas menyediakan `localhost`.

Kalau port 8000 sedang dipakai, ganti angkanya: `python3 -m http.server 8080`.

### Tentang peramban

Chrome desktop adalah satu-satunya peramban yang diuji. Peramban lain tidak
diblokir — aplikasi tetap berjalan dan menampilkan satu baris keterangan bahwa
perilakunya belum diuji. Di peramban tanpa pengenal suara (misalnya Firefox),
kecepatan bicara dan kata pengisi tidak akan dinilai, dan rapor menandainya
"belum aktif" alih-alih menampilkan angka nol.

---

## Apa ini

Aplikasi web untuk berlatih presentasi sendirian. Pengguna berbicara di depan
laptop, aplikasi mengamati suara dan arah pandangnya, lalu menampilkan rapor
terukur setelah sesi selesai.

**Tidak ada teguran apa pun selama sesi berlangsung.** Ini keputusan desain
berbasis riset, bukan keterbatasan: umpan balik yang muncul saat orang sedang
bicara justru merusak konsentrasinya. Seluruh evaluasi ditahan sampai sesi
selesai, lalu bisa ditelusuri kembali lewat lintasan waktu di layar rapor.

Seluruh pemrosesan berjalan di peramban. Tidak ada backend, tidak ada basis
data, dan tidak ada berkas yang dikirim ke mana pun. Riwayat latihan disimpan di
`localStorage` peramban.

## Metrik

| Metrik | Status | Cara mengukurnya |
|---|---|---|
| Kecepatan bicara (WPM) | Aktif | Jumlah kata dari transkrip dibagi durasi bicara |
| Kata pengisi | Aktif | Pencocokan kata dari transkrip ("kayak", "gitu", "anu") |
| Arah pandang | Aktif | Sudut kepala dari MediaPipe Face Landmarker, dibandingkan postur netral |
| Jeda panjang | Aktif | Hening lebih dari 3 detik yang diapit suara bicara |
| Volume | **Belum dikalibrasi** | Rata-rata energi suara; batasnya belum ditetapkan |
| Postur tubuh | **Tidak aktif** | Dibatalkan; modulnya stub dan bobotnya dialihkan |

Metrik yang tidak menghasilkan data **tidak pernah diisi angka nol**. Rapor
menandainya "belum aktif" dan membagi ulang bobotnya ke metrik lain. Bila metrik
yang benar-benar terukur terlalu sedikit, skor total tidak ditampilkan sama
sekali, diganti tanda hubung beserta alasannya.

### Yang tidak diukur, dan diakui di antarmuka

- **Bunyi ragu non-leksikal** ("eee", "emm") tidak terhitung sebagai kata
  pengisi. Pengenal suara peramban membuangnya sebelum teksnya sampai ke
  aplikasi — terbukti di Safari 12 September 2026 dan di Chrome 17 September
  2026. Jeda hening panjang dipakai sebagai indikator hesitasi sebagai gantinya.
- **Arah pandang mengukur sudut kepala, bukan gerakan bola mata.** Melirik
  catatan tanpa menggerakkan kepala tidak terdeteksi.
- **Cap waktu kata pengisi dan transkrip bersifat perkiraan**, karena pengenal
  suara memfinalkan kalimat beberapa saat setelah diucapkan. Seluruh label waktu
  di antarmuka memakai kata "sekitar".

## Privasi

- Tidak ada frame video, rekaman audio, atau transkrip yang dikirim ke server
  mana pun oleh aplikasi ini.
- Kamera dan mikrofon hanya menyala selama sesi, dan dimatikan total begitu sesi
  berakhir.
- **Pengecualian yang diakui terus terang:** transkripsi memakai Web Speech API,
  dan peramban meneruskan audio ke layanan pengenal suara miliknya — Chrome ke
  layanan Google, Safari ke layanan Apple. Kotak privasi di layar Beranda
  menyebut penyedia yang sesuai dengan peramban yang sedang dipakai.
- **Transkrip tidak disimpan** kecuali pengguna mencentangnya secara khusus
  untuk satu sesi di layar rapor. Tanpa itu, riwayat hanya berisi angka.

## Struktur berkas

```
podium-app/
├── index.html      lima layar dalam satu halaman
├── style.css       token desain, tema panggung dan ruang evaluasi
├── README.md       berkas ini
├── CLAUDE.md       aturan kerja pengembangan
├── GEMINI.md       spesifikasi produk
├── TODO.md         daftar periksa sebelum dikumpulkan
└── js/
    ├── app.js      orkestrator, objek CONFIG, navigasi, alur sesi
    ├── speech.js   Web Speech API: transkrip, WPM, kata pengisi
    ├── audio.js    Web Audio API: jeda panjang, volume
    ├── face.js     MediaPipe: sudut kepala, arah pandang
    ├── timeline.js lintasan waktu sesi: kepala pemutar, panel, mode putar
    ├── report.js   rumus skor, kalimat ringkasan, saran, grafik Chart.js
    ├── storage.js  riwayat di localStorage
    ├── tema.js     pilihan tema gelap/terang
    ├── browser.js  deteksi peramban untuk teks privasi
    └── pose.js     stub modul postur (tidak aktif)
```

Seluruh ambang yang bisa dikalibrasi terkumpul di objek `CONFIG` pada
[js/app.js](js/app.js).

## Alur pemakaian

1. **Beranda** → Mulai latihan.
2. **Persiapan** — isi judul, pilih durasi target, pilih mode (lengkap atau suara
   saja), beri izin perangkat, lalu jalankan dua kalibrasi: suara ruangan dan
   postur netral. Keduanya wajib ditekan sendiri, masing-masing sekitar dua detik.
3. **Sesi** — berbicara. Layar sengaja tenang: hanya timer, tiga indikator, dan
   preview kamera kecil.
4. **Rapor** — skor, kartu metrik, lintasan waktu yang bisa ditelusuri dan
   diputar ulang, serta tiga saran konkret.
5. **Riwayat** — daftar sesi tersimpan dan grafik tren skor. Klik satu sesi untuk
   membuka kembali rapor lengkapnya.
