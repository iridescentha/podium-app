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
| A | Fitur yang belum jadi — bukan uji | ~1 menit |
| B | Uji yang bisa memaksa perubahan kode | ~70 menit |
| C | Uji tampilan | ~25 menit |
| | **Seluruh pemeriksaan** | **~100 menit** |

---

# A. FITUR YANG BELUM JADI

Bukan pemeriksaan. Selama butir ini belum dikerjakan, ada metrik yang **tidak
menghasilkan angka apa pun** di setiap sesi.

## A1. ~~Kalibrasi volume~~ — SELESAI 21 September 2026, metrik DIHENTIKAN

Tidak ada lagi yang perlu dijalankan di butir ini.

**Percobaan 1 (autoGainControl menyala):** normal 3,79× · berbisik 2,85× · dua
kali lebih jauh 3,00×. Suara ruangan hasil kalibrasi bergeser 58% antar sesi.

**Percobaan 2 (autoGainControl dimatikan):** suara ruangan stabil (0,0033 /
0,0022 / 0,0022), tetapi rasionya makin rapat — normal 4,13× · berbisik 3,91× ·
dua kali lebih jauh 3,86×.

**Kesimpulan:** metrik volume dihentikan. Rasionya menormalkan dirinya sendiri
(rata-rata diambil dari frame di atas ambang, dan ambangnya sendiri turunan
suara ruangan), dan bahkan pada RMS mentah, berbisik (0,0088) tidak terbedakan
dari duduk dua kali lebih jauh (0,0084). Kartu volume kini berbunyi "tidak
dinilai" beserta alasannya, `pengaliVolumePelan` dibiarkan `null` selamanya, dan
README serta GEMINI.md sudah disesuaikan.

**autoGainControl tetap dimatikan** karena membuat suara ruangan jauh lebih
stabil, dan deteksi jeda bergantung pada angka itu.

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

**Hasil 20 September 2026 (Chrome):** LULUS untuk seluruh aturan kejujuran —
WPM, kata pengisi, arah pandang, volume, dan postur semuanya "belum aktif";
skor ditahan beserta alasannya; tidak ada kalimat pujian. Dua cacat tampilan
yang ditemukan sudah diperbaiki: skor yang ditahan dulu tampil sebagai "—"
setinggi 96px yang terbaca seperti palang memuat (kini kata "Tidak dinilai"
berukuran 28px), dan baris kecepatan yang kosong dulu menyisakan ruang menganga
setinggi 40px (kini mengikuti tinggi keterangannya).

**Sisa yang belum diperiksa di butir ini:** tampilan sesi itu di Riwayat (harus
"—") dan angka di Beranda (harus mengambil skor dari sesi yang memang punya
skor). Keduanya belum terlihat pada tangkapan layar.

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

**Hasil 22 September 2026:** LULUS untuk sudut kepala. Netral terukur -10,9°;
mendongak mendorong pitch sampai +37° (selisih +48°) dan status TETAP `depan`;
mata saja menggeser selisih sekitar 5°, di bawah ambang 8°; menunduk membaca
kertas memberi selisih -10° sampai -14° dan terbaca `menunduk`.

**Temuan menyusul, sudah diperbaiki:** saringan kedipan membuang hampir tujuh
detik dari sepuluh detik membaca kertas, karena kelopak mata yang turun saat
memandang ke bawah menghasilkan eyeBlink 0,42-0,65 selama berdetik-detik.
Saringan itu DICABUT; alasan lengkapnya di kepala `js/face.js`.

**Yang masih perlu diperiksa ulang sesudah pencabutan:** ulangi pose menunduk
membaca kertas selama 10 detik, lalu lihat rapor. Waktu menunduk sekarang harus
mendekati 10 detik, bukan sekitar sepertiganya.

**Catatan kecil yang belum ditangani:** saat kepala berada persis di sekitar
ambang (selisih -7° sampai -8°), status sempat berkedip antara menunduk dan
depan selama kurang dari satu detik, sehingga satu segmen bisa terpecah dua.
Bisa diredam dengan histeresis (ambang keluar lebih longgar daripada ambang
masuk) bila memang mengganggu.

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

**Hasil 22 September 2026: LULUS.**
- Jeda 5 detik tercatat tepat (mulai 20,5 durasi 5,0).
- **Ketukan meja tidak memecah jeda.** Ketukannya mencapai RMS 0,2574 — empat
  puluh kali ambang bicara — tetapi hanya berlangsung 12 frame (sekitar 100 ms),
  di bawah `minDurasiSuaraMs` 200 ms, jadi jeda 8,5 detik itu tetap utuh.
- **Tidak ada jeda palsu saat bicara.** Di tengah kalimat `bersuara` berkisar
  60-110 dari 120 frame, dan penghitung hening tidak pernah melewati 1,5 detik.
  Bandingkan dengan sebelum autoGainControl dimatikan, yang sempat turun ke
  16/120. `pengaliAmbangBicara: 2.5` TIDAK perlu diubah.
- Hening di bawah 3 detik memang diabaikan: log memuat hening 1,9 dan 2,9 detik
  yang tidak pernah jadi jeda panjang.

**Catatan:** jeda ketiga tercatat 3,1 detik padahal naskahnya meminta 2 detik.
Itu bukan salah hitung — hening yang sebenarnya memang 3,1 detik, dan aturannya
"lebih dari 3 detik". Batas itu belum pernah diuji dengan jeda 2 detik yang
sungguh-sungguh 2 detik, tetapi bukti tidak langsungnya sudah ada di atas.

**Perhatikan sejak 21 September 2026:** `autoGainControl` sudah dimatikan, jadi
ujian ini sekalian memeriksa apakah deteksi jeda ikut membaik. Pada uji volume
sebelumnya, bicara normal sering turun di bawah ambang (`bersuara=16/120` di
tengah membaca) dan satu jeda panjang 4,8 detik tercatat saat pengguna masih
membaca. Bila itu masih terjadi tanpa penguatan otomatis, turunkan
`pengaliAmbangBicara` dari 2.5 ke sekitar 2.0 dan ulangi.

## B3b. Pengenal suara yang mati diam-diam · ~5 menit

**Temuan 21 September 2026:** satu sesi berjalan 45 detik penuh dengan WPM tetap
nol padahal pengguna berbicara. `recognition.start()` melempar galat, modul
menyerah untuk seluruh sesi, dan tidak ada apa pun di layar yang memberi tahu.
Memuat ulang halaman memperbaikinya. Sudah diperbaiki dengan percobaan ulang dan
pengawas berkala.

**Jalankan:** beberapa sesi berturut-turut TANPA memuat ulang halaman —
selesaikan satu sesi, "Latihan lagi", ulangi, minimal empat kali. Bicaralah
sebentar di tiap sesi.

**Lulus bila:** WPM naik di semua sesi. Tulisan merah "pengenal suara tidak
aktif" tidak muncul. Di console tidak ada baris "tidak bisa dijalankan setelah
beberapa percobaan".

**Kalau gagal** (tulisan merah muncul, atau WPM tetap nol): salin seluruh baris
peringatan dari console. Bila baris "dijalankan ulang" muncul terus-menerus saat
kamu memang sedang bicara, `CONFIG.SPEECH_WATCHDOG_DETIK` (kini 15) terlalu
pendek dan harus dinaikkan.

**Commit:** `a5b23b9`, `8f5c1a9`

**Hasil 22 September 2026:** WPM naik di semua sesi **asalkan ada jeda**. Dua
temuan menyusul, keduanya tentang cara pengenal suara bekerja, bukan tentang
pengenal suara yang mati:

1. **WPM hanya bergerak saat penutur berhenti sejenak.** Pengenal suara Chrome
   memfinalkan kalimat pada jeda alami, dan seluruh hitungan Podium berjalan di
   atas hasil final. Selama bicara tanpa henti, angkanya diam di nol lalu
   melompat sekaligus begitu ada jeda. Tidak ada cara memaksa finalisasi lebih
   awal lewat Web Speech API; ini batas platform, bukan cacat kode.
2. **Kalimat terakhir dulu hilang bila sesi ditutup tanpa jeda.** Sudah
   diperbaiki di `8f5c1a9`: `stop()` menunggu pembilasan hasil final sebelum
   rapor disusun.

**Tambahan yang harus diperiksa sekarang:** bicara 40 detik **tanpa jeda sama
sekali**, lalu langsung tekan Selesai tanpa berhenti dulu. Rapor harus tetap
menghitung kalimat itu dan WPM tidak boleh nol. Sebelum perbaikan, sesi seperti
ini menghasilkan nol kata dan rapor menolak menilai.

**Hasil 22 September 2026: LULUS.** Empat sesi berturut-turut tanpa memuat ulang
menghasilkan WPM 102, 106, 102, dan 93; sesi tanpa jeda sama sekali juga tetap
terhitung.

**Temuan menyusul, sudah diperbaiki:** angka kecepatan di panel lintasan
menunjukkan 337, 265, dan 212 WPM padahal rata-rata sesinya sekitar 102, karena
seluruh kata dalam satu potongan diberi cap waktu detik finalisasinya. Cap waktu
kini disebar sepanjang rentang potongan. **Periksa ulang:** seret kepala pemutar
ke beberapa posisi; angka "kecepatan N WPM" di panel harus masuk akal dibanding
WPM rata-rata, dan garis kecepatan tidak boleh menanjak tajam di ujung pada sesi
yang temponya rata.

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
