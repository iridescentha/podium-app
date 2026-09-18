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

| Bagian | Isi | Total waktu |
|---|---|---|
| A | Fitur yang belum jadi — bukan uji | ~5 menit |
| B | Uji yang bisa memaksa perubahan kode | ~70 menit |
| C | Uji tampilan | ~25 menit |
| | **Seluruh pemeriksaan** | **~100 menit** |

---

# A. FITUR YANG BELUM JADI

Bukan pemeriksaan. Selama butir ini belum dikerjakan, ada metrik yang **tidak
menghasilkan angka apa pun** di setiap sesi.

## A1. Kalibrasi volume — metrik mati sampai ini dijalankan · ~3 menit

**Status:** `CONFIG.audio.ambangVolumePelan` masih `null`. Akibatnya kartu volume
di rapor **selalu** berbunyi "belum aktif", di semua sesi, selamanya. Ini bukan
uji yang tertunda; ini metrik yang dijanjikan tetapi belum hidup.

**Jalankan:** setel `CONFIG.audio.debug: true`. Dua sesi, masing-masing 1 menit,
bacakan paragraf yang sama:

> "Selamat siang. Hari ini saya ingin membahas bagaimana teknologi bisa membantu
> orang berlatih presentasi secara mandiri. Banyak orang merasa gugup saat
> berbicara di depan umum, dan salah satu cara mengatasinya adalah dengan
> berlatih berulang kali. Aplikasi ini mengukur kecepatan bicara, jeda, dan arah
> pandang, lalu memberikan rapor setelah latihan selesai."

- Sesi 1: volume bicara normal.
- Sesi 2: hampir berbisik.

Catat `volumeRataRms` dari baris `[audio] hasil:` pada kedua sesi.

**Lulus bila:** kedua angka terpisah cukup jauh untuk menaruh satu batas di
antaranya. Isikan batas itu ke `CONFIG.audio.ambangVolumePelan`, lalu jalankan
satu sesi lagi dan pastikan kartu volume menampilkan "pelan" atau "ideal".

**Kalau gagal** (kedua angka berdekatan): berarti kontrol penguatan mikrofon
meratakan volume, dan label volume tidak bisa dipercaya. Jangan dipaksakan —
biarkan `null` dan biarkan kartunya "belum aktif". Itu tetap jujur.

**Commit:** `f6918e4`

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

## B1. Rapor saat metrik hilang — aturan kejujuran · ~8 menit

Ini inti klaim produk. Kalau butir ini gagal, rapor berbohong.

**Jalankan:** mulai sesi mode Lengkap, lalu **cabut izin mikrofon dari ikon
gembok di address bar** begitu sesi berjalan. Diam 40 detik menghadap kamera,
tekan Selesai.

**Lulus bila:**
- Kartu WPM dan kata pengisi berbunyi **"belum aktif"**, bukan `0`.
- Skor total menampilkan **"—"** berwarna redup, dengan keterangan metrik mana
  yang tidak terukur.
- **Tidak ada satu pun kalimat pujian** tentang metrik yang tidak diukur.
- Riwayat menampilkan "—" untuk sesi itu; grafik tren melewatinya, tidak
  menggambarnya sebagai nol.
- Beranda menampilkan skor terakhir dari sesi yang memang punya skor.

**Kalau gagal:** hentikan pekerjaan lain dan perbaiki. Ini pelanggaran aturan
kejujuran metrik di `CLAUDE.md`, bukan cacat tampilan.

**Commit:** `144a9e2`

## B2. Ambang arah pandang dan kap wajah hilang · ~10 menit

Tiga konstanta di bawah ditetapkan dari **satu** sesi uji di Safari. Angkanya
masuk akal, tetapi belum pernah diuji ulang di Chrome.

**Jalankan:** `FACE_DEBUG: true`, filter console `[face]`. Kalibrasi postur, lalu:

| Detik | Pose |
|---|---|
| 0:00 | Kepala tegak, mata ke kamera |
| 0:10 | **Kepala mendongak**, mata tetap ke layar |
| 0:20 | Kepala tegak, **hanya mata** melirik ke bawah |
| 0:30 | Kepala menunduk membaca kertas |
| 0:40 | Kepala tegak lagi |
| 0:50 | Berkedip keras 5–6 kali |
| 1:00 | **Menunduk sangat dalam** sampai wajah hilang |
| 1:10 | **Berdiri dan pergi dari bingkai tanpa mendongak**, diam 20 detik |
| 1:30 | Kembali duduk, tatap kamera |

**Lulus bila:**
- Pose mendongak **tidak pernah** terbaca menunduk (`selisih` positif).
- Pose mata saja menggeser `selisih` kurang dari 3°.
- Pose menunduk melewati −8° dan terbaca `menunduk`.
- Kedipan bertanda `KEDIP (dikeluarkan)`, tidak menambah menunduk.
- Saat pergi dari bingkai: sekitar 5 detik pertama terhitung menunduk, sisanya
  "wajah tidak terlihat". Di lintasan: blok abu padat, lalu arsiran bergaris.

**Kalau gagal:**
- Mendongak terbaca menunduk → tanda `pitch` terbalik; laporkan angkanya.
- Menunduk tidak terdeteksi → turunkan `FACE_PITCH_MENUNDUK_DERAJAT` (kini 8).
- Menunduk sungguhan bertanda KEDIP → naikkan `FACE_BLINK_THRESHOLD` (kini 0.5).
- Waktu pergi dari meja terhitung menunduk terlalu lama → turunkan
  `FACE_HILANG_MENUNDUK_MAKS_DETIK` (kini 5).

**Commit:** `dce7537`, `831eb52`

## B3. Deteksi jeda panjang dan penyaring ketukan · ~6 menit

**Jalankan:** `CONFIG.audio.debug: true`. Bicara terus-menerus 1 menit, dengan:
- satu diam penuh 5 detik di tengah,
- satu diam 6 detik yang **diketuk meja sekali** di tengahnya,
- satu diam 2 detik (tidak boleh terhitung).

**Lulus bila:** tepat **dua** jeda panjang tercatat, masing-masing sekitar 5 dan
6 detik. Ketukan tidak memecah jeda kedua menjadi dua.

**Kalau gagal:**
- Jeda 6 detik terpecah dua → naikkan `CONFIG.audio.minDurasiSuaraMs` (kini 200).
- Jeda 2 detik ikut terhitung → periksa `durasiJedaPanjangMs` (kini 3000).
- Bicara biasa terpotong jadi banyak jeda → ambang bicara terlalu tinggi;
  turunkan `pengaliAmbangBicara` (kini 2.5).

**Commit:** `f6918e4`

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

## B5. Event lintasan waktu dan selisih waktu transkrip · ~6 menit

**Jalankan:** `TIMELINE_DEBUG: true`, lalu sesi 2 menit dengan naskah Sesi A
(bicara terus-menerus; satu-satunya diam adalah 5 detik di 0:40; menunduk 6 detik
di 1:00; mendongak 5 detik di 1:20; dua "kayak" di 0:15; satu "gitu" di 1:30;
bicara cepat di 1:40–2:00).

**Lulus bila:**
- kata pengisi: 3 entri; jeda panjang: 1 entri (~0:40); segmen menunduk: 1 entri
  (~1:00) dan **tidak ada** entri di 1:20; kecepatan: 4 potongan, terakhir tertinggi.
- Potongan transkrip bersambung tanpa lubang.

**Kalau gagal:**
- Kata pengisi kurang → periksa `filler.events`; bila "kayak" memang tidak ada di
  transkrip, itu batas pengenal suara, catat saja.
- Jeda lebih dari satu → lihat B3.
- **Selisih waktu transkrip lebih dari ±5 detik** → label "sekitar" saja tidak
  cukup; pertimbangkan menggeser cap waktu potongan dengan offset tetap.

**Commit:** `2121123`, `a9d764b`

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
