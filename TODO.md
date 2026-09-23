# TODO — Daftar Periksa Sebelum Dikumpulkan

Bukan catatan riwayat. Ini daftar kerja yang harus dijalankan sebelum proyek
dikumpulkan, **diurutkan berdasarkan akibat kalau gagal**, bukan berdasarkan
kapan dibuatnya.

**Semua dijalankan di Chrome desktop.** Jalankan `python3 -m http.server 8000` di
folder proyek, lalu buka `http://localhost:8000`. Jangan pakai Live Server saat
menguji: ia memuat ulang halaman tiap kali ada berkas berubah di folder yang
dipantau (termasuk tangkapan layar yang jatuh ke Desktop), dan seluruh isi
console ikut hilang. Nyalakan juga **Preserve log** di pengaturan console.

Tiap butir berisi: **jalankan**, **lulus bila**, **kalau gagal**, **commit**, dan
**perkiraan waktu**.

Butir yang sudah selesai DIHAPUS dari berkas ini. Temuan yang masih penting
sudah tersimpan di komentar kepala modul terkait dan di pesan commit-nya.

| Bagian | Isi | Sisa waktu |
|---|---|---|
| B | Uji yang bisa memaksa perubahan kode | ~17 menit |
| C | Uji tampilan | ~12 menit |
| | **Sisa pemeriksaan** | **~29 menit** |

---

# B. UJI YANG BISA MEMAKSA PERUBAHAN KODE

Diurutkan dari yang akibatnya paling besar. Kegagalan di sini berarti ada yang
harus diperbaiki, bukan sekadar dicatat.

## B10. Luring dan CDN gagal · ~4 menit

**Jangan pakai throttling "Offline".** Dicoba 22 September 2026 di Chrome dan
GAGAL menguji apa pun: Offline memutus `localhost` juga, jadi halamannya sendiri
tidak pernah dimuat dan yang muncul cuma layar dino Chrome. Yang perlu ditiru
adalah aplikasi tetap dimuat sementara CDN-nya mati, bukan seluruh jaringan mati.

**Jalankan:** DevTools → `Cmd-Shift-P` → "Show Network request blocking" →
centang "Enable network request blocking" → tambahkan dua pola:

```
*cdn.jsdelivr.net*
*storage.googleapis.com*
```

Yang pertama membawa Chart.js dan bundel + wasm MediaPipe; yang kedua membawa
berkas model `face_landmarker.task`. Pastikan throttling kembali ke "No
throttling", lalu centang **Disable cache** di panel Network supaya pustaka tidak
datang dari cache. Muat ulang → buka Riwayat → jalankan satu sesi.

**Lulus bila:** grafik tren diganti keterangan bahwa pustaka grafik gagal dimuat,
model wajah melaporkan "Gagal dimuat", sesi tetap bisa berjalan, dan arah pandang
ditandai "belum aktif".

**Tentang console merah.** Kriteria lama berbunyi "console tidak boleh merah",
dan itu tidak bisa dipenuhi secara harfiah. Terlihat saat B9 dijalankan
22 September 2026 di Chrome: badge console menunjukkan dua galat merah, dan
keduanya BUKAN dari kode aplikasi.

1. `GET /favicon.ico 404` — `index.html` tidak punya `rel="icon"`, jadi Chrome
   meminta berkas yang tidak ada. Bisa dihilangkan dengan satu tag `<link>`.
2. `INFO: Created TensorFlow Lite XNNPACK delegate for CPU.` — ditulis modul
   wasm MediaPipe ke stderr, dan Chrome menandai apa pun dari stderr sebagai
   galat. Tidak bisa dimatikan tanpa ikut menyembunyikan pesan asli pustaka itu.

Jadi yang dinilai: **tidak boleh ada galat merah selain kedua baris di atas**,
dan tidak boleh ada yang berasal dari berkas di `js/`.

**Kalau gagal:** catat galatnya apa adanya.

**Commit:** `931b9ce`, `dce7537`

## B11. Banner browser dan teks privasi · ~4 menit

**Jalankan:** buka Beranda di Chrome, lalu di Safari, lalu (bila ada) Firefox.

**Lulus bila:**
- **Chrome:** tanpa banner; kotak privasi menyebut "layanan speech bawaan Chrome".
- **Safari:** banner tenang bisa ditutup; kotak privasi menyebut "layanan speech
  Apple"; **tidak ada kata Chrome di kotak privasi**.
- **Firefox:** banner menyebut kecepatan bicara dan kata pengisi tidak dinilai;
  tombol "Mulai latihan" tetap bisa ditekan; rapor menandai keduanya "belum aktif".
- Banner yang sudah ditutup tidak muncul lagi setelah muat ulang.

**Kalau gagal:** teks privasi yang menyebut penyedia yang salah adalah pernyataan
palsu; perbaiki `js/browser.js` sebelum dikumpulkan.

**Commit:** `2a60e12`, `0faa177`

## B12. Mode suara saja · ~4 menit

**Jalankan:** Persiapan → "Suara saja" → Izinkan → kalibrasi ruangan → sesi 40 detik.

**Lulus bila:** Chrome hanya meminta mikrofon (lampu kamera mati), tidak ada
preview di layar sesi, indikator arah pandang berbunyi "tanpa kamera", rapor
menyebut "Mode suara saja", lintasan tampil tiga baris tanpa kontak pandang, dan
Riwayat menandai modenya.

**Kalau gagal:** bila Chrome tetap meminta kamera, periksa `mintaIzinMedia`.

**Commit:** `010603b`

## B13. Apakah kurva skor terlalu murah hati · ~5 menit

Muncul dari data B5, bukan dari kesan. Sesi "B5 Test" berisi satu jeda 5 detik,
dua kata pengisi, dan kontak pandang 88,2% — tetap mendapat **94**. Grafik tren
di Riwayat memperlihatkan sepuluh sesi terakhir menumpuk di 90–100, dengan hanya
dua sesi di bawah 60, dan dua sesi itu rendah karena metriknya memang **hilang**,
bukan karena penampilannya buruk.

Kalau hampir semua sesi bernilai 90-an, angkanya berhenti memberi informasi:
pengguna tidak bisa melihat dirinya membaik, dan itu justru inti produknya.

**Data baru yang MELEMAHKAN dugaan di atas.** Sesi "B8 test" (41 detik,
berhitung satu sampai empat puluh) punya kontak pandang 100%, nol kata pengisi,
dan nol jeda panjang — tetapi cuma dapat **65**, karena kecepatannya 50 WPM.
Sesi "B8 gitu test" dapat 75. Jadi kurvanya jelas bisa membedakan, dan yang
paling menentukan adalah WPM, bukan tiga metrik lainnya. Penumpukan di 90-an
kemungkinan besar cuma karena hampir semua sesi uji kebetulan berkecepatan
wajar.

Yang perlu diputuskan jadi bergeser: bukan lagi "kurvanya terlalu murah hati",
melainkan **apakah WPM pantas sedominan itu**. Satu sesi dengan kontak pandang
sempurna dan tanpa satu pun kata pengisi turun ke 65 hanya karena bicaranya
pelan. Untuk pelatih presentasi, itu bisa dibenarkan — tapi itu keputusanmu,
bukan keputusanku.

**DATA YANG DIKUTIP DI ATAS SUDAH TIDAK ADA.** Diperiksa 23 September 2026 di
Chrome: `podium_sessions` cuma berisi dua sesi, "B4" (skor 60) dan "B8 test"
(skor 65). Sesi "B5 Test", "B8 gitu test", dan sepuluh sesi yang dulu menumpuk
di 90–100 sudah terhapus, jadi sebaran yang jadi alasan butir ini dibuat tidak
bisa dilihat lagi. Temuannya tetap dicatat di atas sebagai riwayat pengamatan,
bukan sebagai sesuatu yang masih bisa diperiksa di layar.

Butir ini karena itu **tidak bisa dijalankan sebelum ada data baru**: perlu
setidaknya satu sesi yang sengaja dibuat mulus dan satu yang sengaja dibuat
cacat (jeda panjang, kata pengisi banyak, sering menunduk), keduanya dengan
bicara sungguhan. Dua sesi yang tersisa berjarak lima angka dan tak satu pun
sengaja dibuat cacat.

**Jalankan:** buka Riwayat, lihat sebaran Tren Skor. Lalu putuskan satu hal
saja: apakah sesi yang jelas-jelas cacat (jeda panjang, kata pengisi banyak,
sering menunduk) sudah jatuh ke angka yang terasa berbeda dari sesi yang mulus.

**Lulus bila:** sesi bagus dan sesi cacat terpisah setidaknya 20 angka.

**Kalau gagal:** ini keputusan pemilik proyek, bukan keputusanku — ambangnya
soal rasa, bukan soal benar/salah. Yang boleh kuubah hanyalah kurva di
`js/report.js`, dan hanya sesudah kamu menyebut angka yang kamu mau. **Jangan
diubah sebelum B4–B12 selesai**, karena mengubah kurva membuat seluruh skor di
Riwayat tidak lagi sebanding dengan hasil uji sebelumnya.

**Commit:** belum ada.

---

# C. UJI TAMPILAN

Tidak mengubah kode kalau lulus. Dikerjakan terakhir.

## C2. Tema gelap dan terang · ~6 menit

**Lulus bila:** Rapor dan Riwayat berganti tema; Beranda, Persiapan, dan Sesi
tetap gelap; tombol tema hilang di Layar Sesi; grafik tren tetap terbaca di tema
gelap (ganti tema lalu pindah layar dan kembali); pilihan bertahan setelah muat
ulang; menghapus seluruh riwayat tidak menghapus pilihan tema.

**Commit:** `0c5c6d2`

## C3. Lebar 380px · ~6 menit

**Lulus bila:** kelima layar tidak terpotong, lintasan waktu bisa digeser
mendatar sementara halaman tidak, tombol tidak saling menimpa, dan banner
browser tidak tertimpa tombol tema.

**Commit:** `c5c8bc6`, `0faa177`

---

# Sudah diuji dan lulus (22 September 2026, Chrome)

Butir-butirnya sudah dihapus dari daftar di atas; dicatat di sini supaya tidak
diuji ulang tanpa alasan.

- **Aksesibilitas papan ketik (C4)** — 23 September 2026, Chrome (Live Server,
  `localhost:8080`). Kelima layar dilalui penuh dengan Tab, fokus selalu
  terlihat, baris sesi di Riwayat bisa dibuka dengan Tab lalu Enter, dan
  lintasan menanggapi panah kiri/kanan (1 detik), Shift+panah (5 detik), Home,
  End, serta PageUp/PageDown (10 detik) tanpa menggulirkan halaman. Tombol
  "Masalah sebelumnya/berikutnya" tercapai papan ketik dan melompat ke masalah.
  Diuji dengan sesi "B5 Test" yang memang punya jeda dan kata pengisi.
- **Kepadatan dan hierarki lima layar (C1)** — 23 September 2026, Chrome.
  Skor 96px memang paling menonjol di rapor, tinggi kartu metrik tidak melompat
  antara kartu berangka dan kartu "belum aktif", dan kepadatan antar bagian
  sepadan dengan lintasan. Syarat keempat ("blok kalibrasi terbaca sebagai
  langkah wajib") dicabut karena bertentangan dengan keputusan desain: kalibrasi
  memang boleh dilewatkan, dan kedua modul sudah mengembalikan
  `{ tersedia: false }` tanpa acuan, jadi tidak ada angka karangan.
  Gantinya ditambahkan peringatan konsekuensi di Layar Persiapan (`cf2131e`),
  karena sebelumnya pengguna baru tahu metriknya mati di Layar Rapor — sesudah
  sesinya tidak bisa diulang. Peringatan menyebut metrik yang akan hilang,
  menyusut saat satu kalibrasi selesai, hilang saat keduanya selesai, dan di
  mode suara saja tidak pernah menyebut arah pandang. Semuanya diuji manual.
- **Sebab kosongnya baris kecepatan disebut dengan benar** — sesudah `cf2131e`,
  sesi tanpa ucapan berbunyi "Tidak ada ucapan yang tertangkap, jadi kecepatan
  bicara tidak diukur", bukan lagi "Sesi terlalu singkat" yang jelas salah untuk
  sesi 40 detik. Sesi yang ada ucapannya tetap menggambar garis seperti semula
  (diperiksa dengan sesi "B4").
- **Audit kepatuhan tampilan (C5)** — 23 September 2026, Chrome. Diuji lewat
  sesi "C5 diam": sesi 40 detik tanpa bicara sama sekali, dengan menunduk
  10-16 detik dan lensa ditutup tangan 22-30 detik. Segmen menunduk tergambar
  sebagai blok abu-abu padat, segmen wajah tidak terlihat sebagai blok pudar
  bergaris tepi putus-putus: bedanya terbaca dari BENTUK, bukan warna. Dipastikan
  di tema gelap dan terang, dan contoh di legenda cocok dengan yang tergambar.
  Pesan izin kamera ditolak (`app.js:548`) sudah tanpa tanda panah; seluruh `→`
  dan `->` yang tersisa di repo ada di komentar kode dan satu string di dalam
  console.log ber-flag `FACE_DEBUG`, jadi tidak ada yang sampai ke UI.
- **Sesi diam menahan skor dengan benar** — temuan sampingan dari sesi yang sama.
  Nol kata membuat `speech.getResults()` mengembalikan `tersedia: false` (bukan
  nol), sehingga bobot wpm 35 + filler 27 hilang dan yang terukur tinggal 38 —
  di bawah `SKOR_MIN_BOBOT_TERUKUR` 50. Rapor menampilkan "Tidak dinilai" beserta
  alasannya, bukan angka. Tinggi kartu metrik juga tidak melompat: kartu
  "belum aktif" sama tingginya dengan kartu berangka (satu syarat C1 terpenuhi;
  syarat C1 lainnya belum diperiksa).
- **Flag debug mati (A2)** — `TIMELINE_DEBUG`, `FACE_DEBUG`, dan
  `CONFIG.audio.debug` ketiganya `false` sejak `9e424e6`. Dibuktikan lewat sesi
  B9: rapor terbuka dan tidak satu pun baris `[timeline]`, `[face]`, `[audio]`,
  atau `[diag]` muncul. Seluruh cetakan itu memang berada di balik salah satu
  flag — yang `[diag]` lewat `catatDiagnostik()` yang keluar lebih dulu bila
  `FACE_DEBUG` mati.
- **Sesi pendek dan penyimpanan penuh (B9)** — 22 September 2026, Chrome.
  (a) Sesi 20 detik ditolak, kembali ke Beranda, tidak ada entri baru.
  (b) Pengisian localStorage bertahap berhenti di **38 blok**, dan barulah jalur
  kuota penuh benar-benar tersentuh — dua percobaan sebelumnya (satu blok 5 juta,
  lalu 26 blok 200 ribu) tidak pernah mencapainya. `setItem` melempar
  `QuotaExceededError`, `simpanSesi()` menangkapnya sebagai `console.warn`
  (kuning, bukan merah) dan mengembalikan `{ sukses: false }`. Rapor tetap
  terender penuh — skor, kartu metrik, lintasan, legenda, saran — dengan DUA
  catatan merah: satu di kotak transkrip ("Sesi ini tidak masuk riwayat, jadi
  transkripnya juga tidak bisa disimpan") dan satu di bawah saran. Karena
  `setItem` melempar, tidak ada apa pun yang tertulis, jadi riwayat dipastikan
  tidak bertambah.
- **Jumlah saran mengikuti masalah yang nyata** — sesi B9 hanya menampilkan SATU
  saran, dan itu benar. `ATURAN_SARAN` di `js/report.js` memakai maksimal tiga,
  bukan tepat tiga, dan sesi itu cuma melanggar satu aturan (40 WPM di bawah
  `WPM_SARAN_PELAN`). Bukan cacat.
- **Rapor saat metrik hilang** — semua metrik tak terukur berbunyi "belum aktif",
  skor ditahan, tidak ada pujian palsu.
- **Arah pandang** — mendongak tidak pernah terbaca menunduk (pitch sampai +37°,
  status tetap depan); menunduk membaca kertas 10 detik terhitung penuh 10 detik
  sesudah saringan kedipan dicabut.
- **Deteksi jeda** — jeda 5 detik tercatat, ketukan meja tidak memecahnya, tidak
  ada jeda palsu saat bicara. Tidak ada konstanta yang perlu digeser.
- **Pengenal suara lintas sesi** — empat sesi berturut-turut tanpa memuat ulang
  menghasilkan WPM 102, 106, 102, 93; sesi tanpa jeda sama sekali tetap terhitung.
- **Kalibrasi volume** — dijalankan dua kali dan GAGAL memisahkan kondisi;
  metriknya dihentikan, kartunya berbunyi "tidak dinilai".
- **Event lintasan waktu (B5)** — sesi "B5 Test", 2m 6s. Jeda tercatat di detik
  41 selama 5,0 detik (naskah: 0:40, 5 detik). Segmen menunduk satu buah di
  detik 60 selama 8,3 detik (naskah: 1:00), dan **tidak ada** segmen di 1:20
  meski kepala sempat menunduk sebentar di situ — di bawah
  `MENUNDUK_EVENT_MIN_DETIK`, jadi benar tidak dijadikan segmen. Wajah hilang: 0.
  Kecepatan: empat potongan 114/104/100/126, yang terakhir tertinggi sesuai
  naskah. Potongan kelima (detik 120–126) sengaja dibuang karena lebih pendek
  dari `WPM_BUCKET_MIN_DETIK`.
- **Sebaran cap waktu kata pengisi** — ini uji nyata pertama untuk perbaikan
  `f1ac12d`. Dua "kayak" yang diucapkan sekitar detik 18 dan 22 tercatat di
  18,6 dan 22,8: meleset di bawah 1 detik, jauh di dalam batas ±5 detik. Sebelum
  perbaikan itu keduanya akan menumpuk di detik finalisasi potongan.
- **Jalur kegagalan kalibrasi (B4)** — dikonfirmasi pemilik proyek,
  22 September 2026, Chrome. Kamera ke langit-langit ditolak dengan pesan wajah
  tidak terdeteksi, musik keras ditolak dengan pesan ruangan terlalu berisik,
  dan kedua percobaan ulang yang benar berhasil tanpa meninggalkan sisa keadaan.
  Dua ambang ikut tervalidasi dan komentarnya di CONFIG sudah diperbarui:
  `audio.ambangBicaraMaks` 0.08 (tadinya bertanda "belum divalidasi") dan
  `FACE_KALIBRASI_MIN_RASIO` 0.6. Keduanya terbukti memisahkan kondisi lolos
  dari kondisi gagal DI PERANGKAT PENGUJI; nilai RMS bergantung mikrofon, jadi
  ini bukan jaminan untuk perangkat lain.
- **Mode putar lintasan (B7)** — dikonfirmasi pemilik proyek, 22 September 2026,
  Chrome. Kepala pemutar berjalan mulus dengan panel dan transkrip mengikuti,
  2x benar-benar dua kali lebih cepat, menyeret saat berjalan menghentikan
  pemutaran alih-alih berebut kendali, pemutaran berhenti sendiri di ujung, dan
  tidak ada pemutaran yang tertinggal berjalan saat Layar Rapor ditinggalkan.
- **Buka sesi lama dari Riwayat (B6)** — dikonfirmasi pemilik proyek,
  22 September 2026, Chrome. Rapor lengkap terbuka untuk sesi lama, sesi yang
  transkripnya tersimpan menampilkan potongan kalimatnya sementara yang tidak
  berbunyi "Transkrip tidak disimpan untuk sesi ini", tombol kembali mengantar
  ke Riwayat, kotak "Simpan transkrip" tidak muncul, dan sesinya bisa dibuka
  dengan Tab lalu Enter.
- **Simpan transkrip opt-in (B8)** — sesi "B8 test", 22 September 2026, Chrome.
  Tiga pembacaan `localStorage` berturut-turut tanpa menyentuh halaman sama
  sekali (console dibuka dengan Opt-Cmd-J): sebelum dicentang TIDAK ada field
  `potonganTranskrip`, sesudah dicentang ada, sesudah dilepas hilang lagi
  sementara `skor`, `filler`, `jeda`, `menundukSegmen`, dan `deretWpm` tetap
  utuh. Syarat keempat ikut terbukti gratis: sesi sebelumnya ditinggalkan dengan
  kotak TERCENTANG, dan sesi baru ini mulai dengan kotak mati. Jadi kotaknya
  tidak mewarisi keadaan sesi sebelumnya.
- **Kata pengisi "gitu" (sisa B5)** — sesi "B8 gitu test", 22 September 2026,
  Chrome. Tiga "gitu" di tiga posisi berbeda (ujung kalimat, tengah kalimat,
  awal kalimat) dan satu "kayak": keempatnya masuk ke `potonganTranskrip` DAN
  terhitung di `filler.events`. Jadi yang hilang di B5 adalah satu kali meleset
  pengenal suara, bukan cacat pencocok. Cap waktunya ikut diperiksa manual
  terhadap rentang potongannya: "kayak" adalah kata ke-3 dari 19 di potongan
  11,2–24,1 detik, jadi 11,2 + (2,5/19)×12,9 = 12,9 — persis yang tercatat.
  Keempat event cocok dalam 0,1 detik.
- **Jeda pendek tidak dipalsukan jadi jeda panjang** — empat tarikan napas
  1–2 detik di sesi yang sama menghasilkan `jeda.jumlah: 0`.
- **Arah pandang terhadap lirikan pendek** — `pandangPersen` 88,2% sementara
  satu-satunya segmen menunduk cuma 8,3 detik dari 126. Selisihnya (~6,6 detik)
  adalah lirikan-lirikan pendek ke bawah saat membaca naskah di layar. Ini
  perilaku yang diinginkan: lirikan pendek ikut menurunkan persentase tetapi
  tidak dijadikan segmen di lintasan waktu.

# Keputusan yang diambil tanpa pengujian

Dicatat supaya tidak terlihat seperti kelalaian:

- **Tahap 5 (postur) dibatalkan.** Modul tetap stub, bobotnya dialihkan, rapor
  berbunyi "belum aktif". Keputusan pemilik proyek, 18 September 2026.
- **Tahap 7 (materi PPT) dibatalkan.**
- **`GEMINI.md` Bagian 9** yang disebut di peta jalan tidak pernah ada di berkas
  itu; audit kepatuhan dijalankan terhadap larangan nyata di Bagian 1 dan 3.
- **Bunyi "emm" terbaca sebagai jeda panjang, "eee" terbaca sebagai bicara**
  (uji Chrome 17 September 2026, satu ruangan satu mikrofon). Tidak dijadikan
  klaim di UI karena baru satu kali diuji.
- **Rapor sesi lama memakai ulang Layar Rapor**, bukan layar baru yang isinya
  mirip. Alasannya satu perender berarti tampilan sesi lama mustahil menyimpang
  dari sesi baru; risikonya, apa pun yang salah di rapor akan salah di keduanya.
- **Sesi lama tanpa penanda ketersediaan metrik** (tersimpan sebelum `144a9e2`)
  disimpulkan dari ada tidaknya angka di data tersimpan. Pilihan aman: bila
  angkanya tidak ada sama sekali, metriknya dianggap TIDAK tersedia.
- **Arsiran "wajah tidak terlihat" diganti garis tepi putus-putus** demi
  mematuhi aturan gradien tunggal, tanpa bisa menilai tampilannya lebih dulu.
  Lihat butir C5.
- **Turunan alfa dari token** (misalnya `rgba(232,180,74,0.28)`) dianggap bukan
  warna baru, karena nilainya persis token yang sudah ada dengan transparansi.
- **Selisih waktu transkrip belum diukur di Chrome.** Label "sekitar" dipakai di
  seluruh UI sebagai pilihan aman.
