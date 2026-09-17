# TODO — Uji yang Ditunda

Daftar periksa, bukan dokumentasi. Tambahkan entri baru tiap kali ada uji yang
ditunda. Format tiap entri: **apa yang dijalankan**, **lulus itu seperti apa**,
dan **commit** asalnya.

---

## 1. Verifikasi event timeline — commit `2121123`

**Jalankan:** setel `TIMELINE_DEBUG: true` di `CONFIG` (`js/app.js`), jalankan sesi
2 menit dengan naskah di bawah, lalu buka console.

Naskah (perhatikan timer di layar):

| Timer | Ucapkan / lakukan |
|---|---|
| 0:00 | "Selamat pagi, hari ini saya akan membahas tiga hal penting." |
| 0:15 | "Yang pertama itu kayak agak teknis, jadi kayak perlu saya jelaskan pelan-pelan." |
| 0:25 | "Bagian ini menjelaskan cara kerja sistemnya secara umum." |
| 0:40 | **Diam total 5 detik.** Jangan bergumam. |
| 0:45 | "Maaf, saya lanjutkan ke bagian berikutnya." |
| 1:00 | **Menunduk ke meja 6 detik** sambil terus bicara: "Ini datanya saya baca dulu ya, ada beberapa angka di catatan saya." |
| 1:10 | Kembali menatap kamera: "Angkanya menunjukkan peningkatan yang cukup besar." |
| 1:30 | "Kesimpulannya begitu, gitu ya, kira-kira seperti itu." |
| 1:40 | **Bicara cepat** sampai 2:00: "Jadi ada tiga poin utama yang sudah saya sampaikan tadi dan semuanya saling berhubungan satu sama lain sehingga kesimpulannya jelas." |
| 2:00 | Tekan Selesai. |

**Lulus bila:**
- Tabel `kata pengisi`: 3 entri — dua "kayak" sekitar 0:15, satu "gitu" sekitar 1:30.
- Tabel `jeda panjang`: 1 entri, mulai sekitar 0:40, durasi ~5 detik.
- Tabel `segmen menunduk`: 1 entri, mulai sekitar 1:00, durasi ~6 detik.
- Tabel `kecepatan`: 4 potongan, potongan terakhir jelas lebih tinggi.
- Tabel `potongan transkrip`: `detikSelesai` tiap potongan = `detikMulai` potongan berikutnya, tanpa lubang.

**Yang paling dibutuhkan:** selisih antara waktu ucap sebenarnya dan `detikMulai`
potongan transkrip. Angka itu menentukan seberapa longgar label "sekitar" harus
ditulis, dan apakah perlu offset koreksi.

## 2. Kotak simpan transkrip — commit `2121123`

**Jalankan:** di Layar Rapor sesudah sesi apa pun.

**Lulus bila:**
- Kotak default MATI; `JSON.parse(localStorage.getItem('podium_sessions'))[0]` tidak punya `potonganTranskrip`.
- Dicentang → muncul konfirmasi berisi ukuran riwayat; field `potonganTranskrip` muncul di localStorage.
- Dilepas → field hilang, sementara `skor`, `filler.events`, `jeda`, `menundukSegmen` tetap ada.
- Pindah layar lalu kembali → pilihan bertahan. Sesi baru → kotak kembali mati.

## 3. Kalibrasi & mode tanpa kamera — commit `010603b`

**Jalankan:** langkah A–C dari catatan commit (kalibrasi berhasil, kalibrasi gagal,
mode suara saja).

**Lulus bila:**
- Kalibrasi tidak pernah mulai sendiri; hitung mundur muncul sebelum mengukur.
- Kamera ke langit-langit → gagal dengan "Wajah tidak terdeteksi…", status kembali "belum".
- Mode suara saja → Chrome hanya minta mikrofon, lampu kamera mati, baris postur hilang.
- Rapor dan Riwayat memperlihatkan label mode.

**Perhatikan:** `CONFIG.audio.ambangBicaraMaks: 0.08` belum divalidasi. Bila ruangan
tenang pun ditolak sebagai "terlalu berisik", angka ini yang harus dinaikkan.

## 4. Kalibrasi suara & volume — commit `f6918e4` (Tahap 3)

**Jalankan:** setel `CONFIG.audio.debug: true`. Sesi A bicara normal 1 menit, sesi B
bicara pelan 1 menit. Catat `volumeRataRms` dari baris `[audio] hasil:`.

**Lulus bila:** kedua angka terpisah cukup jauh untuk menetapkan satu batas.

**Akibat bila belum dikerjakan:** `CONFIG.audio.ambangVolumePelan` masih `null`,
sehingga kartu volume di rapor selalu "belum aktif". **Ini metrik yang dijanjikan
tetapi belum menghasilkan angka.**

Sekalian periksa: `minDurasiSuaraMs: 200` (ketukan meja saat hening tidak boleh
memecah satu jeda panjang jadi dua).

## 5. Ambang arah pandang — commit `dce7537`

**Jalankan:** `FACE_DEBUG: true`, lalu pose netral / menunduk baca kertas / mendongak,
masing-masing 10 detik.

**Lulus bila:**
- `FACE_PITCH_MENUNDUK_DERAJAT: 8` memisahkan netral dari menunduk tanpa salah pada pose mendongak.
- Kap `FACE_HILANG_MENUNDUK_MAKS_DETIK: 5` benar: menunduk dalam lalu **pergi dari meja** → sekitar 5 detik pertama terhitung menunduk, sisanya "tidak terlihat".

Sekalian putuskan: setelah pindah ke pitch, apakah saringan kedipan
(`FACE_BLINK_THRESHOLD`) dan `FACE_SMOOTHING_FRAMES` masih diperlukan.

## 6. Rapor & grafik — commit `931b9ce`

**Jalankan:** langkah A–F dari catatan commit.

**Lulus bila:** grafik tren skor memakai warna token (tidak ada biru bawaan Chart.js),
sesi < 30 detik ditolak dan tidak masuk riwayat, mode luring mengganti grafik dengan
keterangan, dan lebar 380px tidak menimbulkan scroll mendatar.

## 7. Rapor saat metrik hilang — commit `bugfix metrik jujur`

**Jalankan:** paksa sesi tanpa transkrip (matikan izin mikrofon dari ikon gembok
setelah sesi dimulai, atau pilih perangkat mikrofon yang salah), bicara 40 detik,
lalu Selesai. Ulangi juga dengan kalibrasi suara ruangan sengaja digagalkan.

**Lulus bila:**
- Kartu WPM dan kata pengisi berbunyi "belum aktif", bukan 0.
- Skor total menampilkan "—" berwarna redup, bukan angka, dengan alasan di
  bawahnya menyebut metrik mana yang tidak terukur.
- Tidak ada kalimat pujian tentang metrik yang tidak diukur.
- Riwayat menampilkan "—" untuk sesi itu, dan grafik tren melewatinya tanpa
  menggambar titik nol.
- Beranda menampilkan skor terakhir dari sesi yang memang punya skor.

## 8. Pemeriksaan visual setelah perapatan UI — commit `redesign kepadatan`

Semua ini perlu mata, bukan uji otomatis.

**Lulus bila:**
- **Rapor:** skor 96px jelas jadi elemen paling menonjol; kartu metrik padat
  (angka 24px, label 12px) dan tidak lagi setinggi sebelumnya; kalimat ringkasan
  15px tidak menyaingi skor.
- **Kartu metrik** tetap terbaca saat isinya "belum aktif" (15px) dan tidak
  membuat tinggi kartu melompat dibanding kartu bernilai angka.
- **Riwayat:** baris sesi padat, skor 24px, meta 12px masih terbaca.
- **Persiapan:** tombol lebih rendah (11px/24px) tetapi masih nyaman ditekan;
  blok kalibrasi tetap jadi aksi utama yang jelas.
- **Beranda:** judul 88px tetap utuh; jarak antar kelompok 40px tidak membuat
  halamannya terasa sesak.
- **380px:** tidak ada teks yang terpotong atau tombol yang saling menimpa di
  kelima layar.
- Kepadatan lintasan waktu dipakai sebagai acuan: bagian lain tidak boleh
  terasa jauh lebih longgar darinya.

---

## Keputusan yang masih menggantung

- **GEMINI.md Bagian 7 (Tahap 2) masih menulis spesifikasi lama** berbasis
  `eyeLookDown`, padahal implementasinya sudah memakai pitch kepala sejak
  `dce7537`. Perlu dikoreksi setelah disetujui.
- **`autoGainControl: true`** pada `getUserMedia` menaikkan penguatan mikrofon saat
  hening. Pengaruhnya ke deteksi jeda dan label volume belum diukur.
- **Netral postur bisa bergeser di tengah sesi** (pengguna makin membungkuk).
  Tombol kalibrasi ulang hanya menolong sebelum sesi dimulai. Belum diputuskan
  apakah perlu ditangani.
- **Pemeriksaan ruangan berisik belum literal**: yang diperiksa suara ruangan, bukan
  selisihnya terhadap suara bicara pengguna. Versi literal butuh langkah "ucapkan
  satu kalimat" saat kalibrasi.
