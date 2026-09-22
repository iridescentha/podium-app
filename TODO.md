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
| A | Fitur yang belum jadi — bukan uji | ~1 menit |
| B | Uji yang bisa memaksa perubahan kode | ~42 menit |
| C | Uji tampilan | ~29 menit |
| | **Sisa pemeriksaan** | **~72 menit** |

---

# A. FITUR YANG BELUM JADI

Bukan pemeriksaan. Selama butir ini belum dikerjakan, ada metrik yang **tidak
menghasilkan angka apa pun** di setiap sesi.

## A2. Matikan seluruh flag debug sebelum dikumpulkan · ~1 menit

**Status:** `CONFIG.TIMELINE_DEBUG` saat ini `true`.

**Jalankan:** di `js/app.js`, pastikan ketiganya `false`:
`TIMELINE_DEBUG`, `FACE_DEBUG`, dan `CONFIG.audio.debug`.

**Lulus bila:** jalankan satu sesi penuh, console bersih — tidak ada baris
`[timeline]`, `[face]`, `[audio]`, maupun `[diag]`.

**Kalau gagal:** setel manual ke `false`. Jangan dikumpulkan dengan debug menyala.

**Commit:** beberapa; periksa nilainya langsung di `CONFIG`.

---

# B. UJI YANG BISA MEMAKSA PERUBAHAN KODE

Diurutkan dari yang akibatnya paling besar. Kegagalan di sini berarti ada yang
harus diperbaiki, bukan sekadar dicatat.

## B4. Jalur kegagalan kalibrasi · ~6 menit

**Jalankan:**
1. Arahkan kamera ke langit-langit → "Kalibrasi sekarang".
2. Hadapkan ke wajah → ulangi.
3. Putar musik keras dekat mikrofon → "Ukur sekarang" (kamu sendiri diam).
4. Matikan musik → ulangi.

**Lulus bila:**
- Langkah 1 gagal dengan "Wajah tidak terdeteksi — pastikan kamera mengarah ke
  wajahmu, lalu coba lagi.", badge kembali ke keadaan belum, tombol tetap kuning.
- Langkah 3 gagal dengan "Ruangan terlalu berisik…".
- Langkah 2 dan 4 berhasil, dan tidak ada sisa dari percobaan yang gagal.

**Kalau gagal:** bila **ruangan tenang pun** ditolak sebagai terlalu berisik,
naikkan `CONFIG.audio.ambangBicaraMaks` (kini 0.08, belum divalidasi). Bila
kamera ke langit-langit malah **berhasil**, naikkan
`CONFIG.FACE_KALIBRASI_MIN_RASIO` (kini 0.6).

**Commit:** `010603b`

## B6. Riwayat: buka analisis sesi lama · ~5 menit

**Jalankan:** buka Riwayat, klik salah satu sesi. Ulangi untuk sesi yang
transkripnya disimpan dan yang tidak.

**Lulus bila:**
- Rapor lengkap sesi itu terbuka: skor, kartu metrik, lintasan waktu dengan
  kepala pemutar dan seluruh event.
- Sesi dengan transkrip tersimpan menampilkan potongan kalimatnya di panel.
- Sesi tanpa transkrip menampilkan "Transkrip tidak disimpan untuk sesi ini",
  sementara lintasan dan panelnya tetap berfungsi penuh.
- Tombol kembali mengantar ke Riwayat, bukan ke Beranda.
- Kotak "Simpan transkrip" **tidak** muncul saat membuka sesi lama.
- Bisa dibuka dengan papan ketik (Tab lalu Enter).

**Kalau gagal:** sesi lama tidak bisa dibuka sama sekali → periksa apakah
`skor`, `deretWpm`, dan `filler.events` benar-benar ada di `localStorage`.

**Commit:** `bd7b83e`

## B7. Mode putar lintasan · ~5 menit

**Jalankan:** di rapor, tekan Putar. Coba juga 2×, jeda di tengah, dan menyeret
kepala pemutar saat sedang berjalan.

**Lulus bila:**
- Kepala pemutar berjalan mulus, panel dan transkrip mengikuti.
- 2× benar-benar dua kali lebih cepat.
- Menyeret saat berjalan **menghentikan** pemutaran, tidak berebut kendali.
- Sampai di ujung, pemutaran berhenti sendiri.

Periksa juga: tinggalkan Layar Rapor saat pemutaran sedang berjalan, lalu buka
lagi. Tidak boleh ada pemutaran yang masih berjalan di latar.

Periksa juga potongan transkrip TERAKHIR. Di sesi "B8 gitu test" potongan
keempat berakhir di detik 46,6 padahal `durasiDetik` cuma 45: kalimat terakhir
baru dibilas sesudah `stop()`, jadi ujungnya melewati ujung sesi. Yang perlu
dilihat: apakah kepala pemutar bisa mencapai potongan itu, atau ekornya
terpotong diam-diam di ujung lintasan. Kalau hanya ekornya yang terpotong dan
teksnya tetap tampil, biarkan — ini kosmetik, bukan angka yang salah.

**Kalau gagal:** catat apakah masalahnya di kecepatan, di seretan, di gulir
transkrip, atau di pemutaran yang tidak berhenti saat layar ditinggalkan.

**Commit:** `e1bb581`

## B8. Simpan transkrip opt-in dan kuota penyimpanan · ~5 menit

**Jalankan:** di rapor, centang lalu lepas "Simpan transkrip sesi ini ke riwayat".
Periksa dengan:
```js
JSON.parse(localStorage.getItem('podium_sessions'))[0]
```

**Lulus bila:**
- Bawaan **mati**; tanpa dicentang tidak ada field `potonganTranskrip`.
- Dicentang → field muncul, disertai keterangan ukuran riwayat.
- Dilepas → field hilang, sementara `skor`, `filler.events`, `jeda`, dan
  `menundukSegmen` tetap utuh.
- Sesi baru selalu kembali ke keadaan tidak tercentang.

**Penting — jangan menyentuh halaman sesudah Selesai.** Percobaan pertama
(22 September 2026) gagal jadi bukti justru karena ini: kotaknya sempat
tercentang lebih dulu, jadi ketiga pembacaan keluar sama persis dan sampel
"sebelum dicentang" tidak pernah ada. Buka console dengan **⌥⌘J**, yang
menaruh fokus langsung di console tanpa mengklik halaman, lalu baru jalankan
pembacaan pertama.

Kejadian itu sendiri sudah ditelusuri dan BUKAN bug: baris status di bawah
kotaknya berbunyi "Transkrip tersimpan bersama sesi ini", dan teks itu hanya
ditulis di dalam handler-nya (`app.js:1456`), yang cuma terikat ke event
`change`. Selain itu `app.js:1447` adalah satu-satunya baris di seluruh kode
yang menulis `potonganTranskrip` ke objek sesi. Jadi transkripnya masuk lewat
jalur yang benar. Yang belum terbukti hanyalah syarat "bawaan mati".

**Kalau gagal:** transkrip tersimpan tanpa dicentang adalah **pelanggaran
privasi**, perbaiki segera.

**Commit:** `2121123`

## B9. Sesi terlalu pendek dan penyimpanan penuh · ~4 menit

**Jalankan:** (a) sesi 20 detik lalu Selesai. (b) Isi localStorage sampai penuh:
```js
try { localStorage.setItem('sampah', 'x'.repeat(5_000_000)); } catch (e) { console.log('penuh'); }
```
lalu jalankan sesi normal 40 detik.

**Lulus bila:** (a) muncul pesan sesi di bawah 30 detik, kembali ke Beranda,
tidak ada entri baru di Riwayat. (b) Rapor tetap tampil lengkap, dengan catatan
merah bahwa sesi tidak tersimpan ke riwayat.

**Kalau gagal:** aplikasi tidak boleh macet atau kehilangan rapor hanya karena
penyimpanan penuh.

**Bersihkan:** `localStorage.removeItem('sampah')`

**Commit:** `931b9ce`

## B10. Luring dan CDN gagal · ~4 menit

**Jalankan:** DevTools → Network → Offline → muat ulang → buka Riwayat dan
jalankan satu sesi.

**Lulus bila:** grafik tren diganti keterangan bahwa pustaka grafik gagal dimuat,
model wajah melaporkan "Gagal dimuat", sesi tetap bisa berjalan, dan arah pandang
ditandai "belum aktif". **Console tidak boleh merah.**

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

## C1. Kepadatan dan hierarki lima layar · ~8 menit

**Lulus bila:** skor 96px jelas paling menonjol di rapor; kartu metrik padat dan
tingginya tidak melompat saat berbunyi "belum aktif"; blok kalibrasi terbaca
sebagai langkah wajib, bukan pelengkap; lintasan waktu tetap jadi acuan
kepadatan — bagian lain tidak terasa jauh lebih longgar.

**Kalau gagal:** catat layar dan elemennya, jangan diubah sendiri saat menguji.

**Commit:** `c5c8bc6`, `28abd6f`

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

## C4. Aksesibilitas papan ketik · ~5 menit

**Lulus bila:** seluruh layar bisa dilalui dengan Tab, fokus selalu terlihat,
lintasan waktu bisa digeser dengan panah kiri/kanan, Home, dan End, serta tombol
"Masalah sebelumnya/berikutnya" bisa dicapai papan ketik.

**Commit:** `aa09c4f`

---

## C5. Hasil audit kepatuhan — periksa mata sekali · ~4 menit

Audit Tahap 6 dijalankan terhadap larangan nyata di `GEMINI.md` Bagian 1 dan 3.
(Bagian 9 yang disebut peta jalan tidak pernah ada di berkas itu.) Tiga temuan
sudah diperbaiki; yang perlu dipastikan hanya tampilannya.

**Lulus bila:**
- Segmen **"wajah tidak terlihat"** di lintasan waktu masih jelas berbeda dari
  segmen **menunduk**: sekarang isian pudar bergaris tepi putus-putus, bukan
  arsiran diagonal. Arsiran lama memakai gradien kedua, dan `GEMINI.md` Bagian 3
  hanya mengizinkan satu gradien di seluruh aplikasi.
- Kedua bentuk itu masih terbedakan **tanpa bergantung warna** di tema gelap
  maupun terang, dan contoh di legenda cocok dengan yang tergambar di lintasan.
- Pesan izin kamera yang ditolak tidak lagi memakai tanda panah.

**Kalau gagal** (segmen hilang jadi sulit dibedakan): pilihan lain adalah
mengembalikan arsiran dan mengubah aturan gradien di `GEMINI.md` secara sadar.
Jangan diam-diam menambah gradien kedua.

**Commit:** `66b75ba`

---

# Sudah diuji dan lulus (22 September 2026, Chrome)

Butir-butirnya sudah dihapus dari daftar di atas; dicatat di sini supaya tidak
diuji ulang tanpa alasan.

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
