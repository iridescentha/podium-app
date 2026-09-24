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

Chrome desktop adalah satu-satunya peramban yang diuji. Peramban lain seperti
Safari tidak diblokir: aplikasi tetap berjalan dan menampilkan satu baris
keterangan yang bisa ditutup bahwa perilakunya belum diuji.

Ada satu pengecualian. Peramban yang sama sekali tidak menyediakan pengenal
suara — Firefox, misalnya — tidak bisa memulai latihan, dan tombolnya dimatikan
dengan panel yang menyebut alasannya. Sebabnya bukan selera: tanpa kecepatan
bicara dan kata pengisi, bobot yang tersisa cuma 38 dari ambang minimal 50, jadi
SETIAP sesi di sana pasti berakhir "Tidak dinilai". Meminta orang bicara beberapa
menit untuk hasil yang sudah pasti kosong lebih buruk daripada mengatakannya di
depan. Tombol "Riwayat" tetap hidup, jadi aplikasinya masih bisa dilihat.

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

## Dibuat dengan bantuan AI

Aplikasi ini ditulis dengan bantuan **Claude (Anthropic)**, lewat Claude Code.

Pembagiannya terus terang: AI menulis kodenya, komentar penjelas di dalamnya, dan
berkas ini. Seluruh keputusan desain dan produk diambil pemilik proyek, dan
seluruh pengujian dijalankan manusia di perangkat nyata.

Itu bukan pembedaan kosmetik. Setiap angka hasil uji di berkas ini dan di
komentar kode berasal dari sesi yang benar-benar dijalankan di depan kamera dan
mikrofon — bukan perkiraan AI. Angka-angka itulah yang jadi dasar keputusan
seperti menghentikan metrik volume, membatalkan modul postur, dan menutup
latihan di peramban tanpa pengenal suara.

## AI yang dipakai di dalam aplikasi

Podium **menjalankan model machine learning langsung di dalam peramban**, bukan
memanggil layanan AI dari jauh:

- **MediaPipe Face Landmarker** (Google) — model deteksi wajah beserta
  blendshape, berjalan sepenuhnya di perangkat lewat WebAssembly. Inilah yang
  mengukur sudut kepala tiap 150 ms untuk menilai arah pandang. Tidak ada satu
  frame pun yang meninggalkan laptop pengguna.
- **Web Speech API** — pengenal suara bawaan peramban, dipakai untuk
  transkripsi, kecepatan bicara, dan kata pengisi. Ini satu-satunya bagian yang
  TIDAK berjalan di perangkat: peramban meneruskan audionya ke layanan penyedia
  peramban itu sendiri. Lihat bagian Privasi.

Inferensinya berjalan di sisi pengguna, dan itu justru intinya: pelatih
presentasi mengamati wajah dan suara, dua hal paling pribadi yang dimiliki
seseorang. Menjalankan modelnya di perangkat membuat aplikasinya berguna tanpa
perlu dipercaya memegang rekaman siapa pun.

Yang **sengaja tidak dipakai adalah LLM atau API AI generatif**. Alasannya
teknis, bukan ideologis: API key di aplikasi tanpa server tidak mungkin
dirahasiakan, dan menyembunyikannya menuntut backend — sementara backend
membatalkan klaim inti produk ini. Skor dan sarannya karena itu dihitung dari
rumus aritmetika biasa di `js/report.js`, yang bisa dibaca dan diperiksa
seluruhnya, bukan dari model yang jawabannya tidak bisa ditelusuri.

## Metrik

| Metrik | Status | Cara mengukurnya |
|---|---|---|
| Kecepatan bicara (WPM) | Aktif | Jumlah kata dari transkrip dibagi durasi bicara |
| Kata pengisi | Aktif | Pencocokan kata dari transkrip ("kayak", "gitu", "anu") |
| Arah pandang | Aktif | Sudut kepala dari MediaPipe Face Landmarker, dibandingkan postur netral |
| Jeda panjang | Aktif | Hening lebih dari 3 detik yang diapit suara bicara |
| Volume | **Tidak dinilai** | Dihentikan setelah dua uji lapangan: tingkat suara tidak bisa dipisahkan dari jarak duduk |
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
- **Tingkat volume suara tidak dinilai.** Dua uji lapangan (21 September 2026)
  menunjukkan berbisik dan duduk dua kali lebih jauh menghasilkan tingkat
  mikrofon yang praktis sama — 3,91 dan 3,86 kali suara ruangan. Memisahkan
  keduanya butuh pengukuran jarak yang tidak ada di aplikasi ini, jadi kartunya
  berbunyi "tidak dinilai" alih-alih menampilkan label yang menyesatkan.

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
├── js/
│   ├── app.js      orkestrator, objek CONFIG, navigasi, alur sesi
│   ├── speech.js   Web Speech API: transkrip, WPM, kata pengisi
│   ├── audio.js    Web Audio API: jeda panjang
│   ├── face.js     MediaPipe: sudut kepala, arah pandang
│   ├── timeline.js lintasan waktu sesi: kepala pemutar, panel, mode putar
│   ├── report.js   rumus skor, kalimat ringkasan, saran, grafik Chart.js
│   ├── storage.js  riwayat di localStorage
│   ├── tema.js     pilihan tema gelap/terang
│   ├── browser.js  deteksi peramban untuk teks privasi dan gerbang pengenal suara
│   └── pose.js     stub modul postur (tidak aktif)
└── uji/            berkas uji Node, tanpa dependensi
```

Seluruh ambang yang bisa dikalibrasi terkumpul di objek `CONFIG` pada
[js/app.js](js/app.js).

## Alur pemakaian

1. **Beranda** → Mulai latihan.
2. **Persiapan** — isi judul, pilih durasi target, pilih mode (lengkap atau suara
   saja), beri izin perangkat, lalu jalankan dua kalibrasi: suara ruangan dan
   postur netral. Keduanya ditekan sendiri, masing-masing sekitar dua detik —
   pengukuran otomatis bisa merekam ruangan yang sedang ramai tanpa pengguna
   sadar. Kalibrasi boleh dilewatkan, dan kalau dilewatkan layar ini menyebut
   lebih dulu metrik mana yang tidak akan dinilai.
3. **Sesi** — berbicara. Layar sengaja tenang: hanya timer, tiga indikator, dan
   preview kamera kecil.
4. **Rapor** — skor, kartu metrik, lintasan waktu yang bisa ditelusuri dan
   diputar ulang, serta sampai tiga saran konkret. Sarannya hanya muncul untuk
   masalah yang benar-benar terdeteksi, jadi sesi yang mulus bisa saja tidak
   mendapat saran sama sekali.
5. **Riwayat** — daftar sesi tersimpan dan grafik tren skor. Klik satu sesi untuk
   membuka kembali rapor lengkapnya.

## Menjalankan uji

```bash
bash uji/jalankan.sh          # semua berkas uji
bash uji/jalankan.sh face     # hanya yang namanya memuat "face"
```

Uji berjalan di Node tanpa dependensi apa pun. Modul aplikasi disalin ke folder
sementara sebagai `.mjs` lebih dulu, karena Node memperlakukan `.js` sebagai
CommonJS selama tidak ada `package.json` — dan proyek ini sengaja tanpa npm.
Perangkat keras ditiru: mikrofon, kamera, MediaPipe, pengenal suara, dan DOM
semuanya berupa tiruan, sehingga ujinya tidak butuh izin perangkat.
