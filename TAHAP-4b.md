# TAHAP 4B — REPLAY TIMELINE (layar Rapor)

Dikerjakan **setelah Tahap 4 (rapor dasar) selesai dan dikonfirmasi.** Ini fitur yang paling terlihat saat demo ke juri, jadi kerjakan dengan rapi — tapi jangan mulai sebelum rapor dasarnya stabil.

---

## 1. Tujuan

Rapor saat ini memberi angka agregat ("11 kata pengisi") yang benar tapi tidak bisa ditindaklanjuti. Timeline mengubahnya jadi **di mana** masalahnya terjadi: pengguna melihat sepanjang durasi sesi, menemukan titik padat masalah, mengkliknya, lalu membaca apa yang ia ucapkan saat itu.

Ini yang membuat keputusan desain "tidak ada teguran selama sesi" jadi masuk akal — feedback ditahan, tapi bisa ditelusuri kembali setelahnya.

## 2. Batasan privasi — WAJIB, jangan dilanggar

Arsitektur melarang menyimpan transkrip. Aturan untuk fitur ini:

- **Transkrip hidup di memori selama sesi** dan dipakai untuk menampilkan timeline di layar Rapor.
- **Saat pengguna meninggalkan layar Rapor, transkrip dibuang.** Set variabelnya `null`, jangan simpan ke `localStorage`.
- **Riwayat tetap hanya menyimpan angka.** Sesi lama tidak punya timeline — ini disengaja, bukan keterbatasan yang perlu ditutupi.
- Di bawah timeline, tulis satu baris `--redup`: "Transkrip hanya ada di layar ini dan tidak disimpan."

Kalau kamu merasa perlu menyimpan transkrip agar fitur ini "lebih berguna", jangan. Tanyakan dulu.

## 3. Data yang harus dikumpulkan selama sesi

Setiap modul mencatat **event bertimestamp** (detik ke berapa dalam sesi), bukan data per frame. Event bersifat jarang — puluhan per sesi, bukan ribuan:

| Modul | Event |
|---|---|
| `speech.js` | tiap kata pengisi terdeteksi: `{ detik, kata }` |
| `speech.js` | potongan transkrip final: `{ detikMulai, detikSelesai, teks }` |
| `audio.js` | tiap jeda panjang: `{ mulaiDetik, durasiDetik }` |
| `face.js` | tiap segmen menunduk > 3 detik: `{ mulaiDetik, durasiDetik }` |
| `speech.js` | WPM per 30 detik (sudah ada sebagai `wpmSeri`) |

Tambahkan ke `getResults()` masing-masing modul. Jangan buat penyimpanan event terpusat yang terpisah — biarkan tiap modul memiliki eventnya sendiri, konsisten dengan kontrak yang sudah ada.

## 4. Tampilan timeline

Empat baris horizontal dengan sumbu waktu yang sama, dari 00:00 sampai durasi sesi. Lebar penuh kolom konten.

1. **Sumbu waktu** — penanda menit, tipis, warna `--redup`.
2. **Kontak pandang** — bar horizontal penuh; segmen menunduk diberi warna berbeda (gunakan `--redup` untuk menunduk, `--sorot` redup untuk menatap depan). Segmen "wajah tidak terlihat" abu-abu netral dan diberi label di legenda.
3. **Kecepatan** — garis WPM per 30 detik. Tandai titik di mana WPM keluar dari rentang ideal.
4. **Masalah** — titik kecil di posisi waktunya: satu titik per kata pengisi, penanda lebih lebar untuk jeda panjang. Bedakan bentuknya, bukan hanya warnanya.

Jangan tambah baris kelima. Empat sudah cukup padat.

## 5. Interaksi

- Klik atau tap di mana pun pada timeline → panel di bawahnya menampilkan:
  - Rentang waktu (mis. "02:31 — 02:39")
  - Ringkasan apa yang terjadi di rentang itu (mis. "3 kata pengisi dalam 8 detik", "jeda 5 detik", "menunduk 6 detik")
  - **Potongan transkrip** dari rentang itu, dengan kata pengisi ditandai — cukup ditebalkan atau diberi warna `--sorot`, jangan pakai highlight blok.
- Default saat rapor pertama dibuka: panel menampilkan **rentang terpadat** (segmen dengan event terbanyak), supaya pengguna langsung melihat bagian yang paling perlu diperbaiki tanpa harus mencari.
- Sediakan navigasi sederhana: tombol "masalah sebelumnya / berikutnya" untuk melompat antar titik padat. Keyboard-accessible.

## 6. Batasan yang harus jujur di UI

**Bunyi ragu non-leksikal ("eee", "emm") tidak akan muncul di transkrip** — Web Speech API membuangnya, dan itu sudah terbukti di uji Tahap 1. Jangan membuat contoh, mockup, atau data dummy yang menampilkan "eee" di transkrip; itu akan terlihat sebagai klaim palsu kalau juri mencobanya sendiri.

Yang muncul sebagai penanda masalah hanya: filler kata asli, jeda panjang, segmen menunduk, dan WPM di luar rentang.

## 7. Desain — tetap tunduk pada aturan yang ada

- Warna hanya dari token yang sudah ada. Aksen `--sorot` tetap satu-satunya; **angka skor tetap elemen paling mencolok di layar**, timeline tidak boleh mengalahkannya.
- Bedakan jenis event dengan bentuk dan posisi, bukan dengan menambah warna baru.
- Timeline ditempatkan **di bawah kartu metrik**, sebelum bagian saran.
- Responsif sampai 380px: di layar sempit, timeline tetap horizontal dengan scroll, jangan diubah jadi daftar vertikal.
- Hormati `prefers-reduced-motion`; tidak ada animasi selain transisi panel 150 ms.

## 8. Urutan pengerjaan

1. Tambahkan pengumpulan event bertimestamp ke tiap modul. Beri langkah uji: jalankan sesi 2 menit, cetak event ke console, cocokkan dengan yang saya lakukan. **Berhenti untuk konfirmasi.**
2. Render timeline statis (empat baris, tanpa interaksi). Berhenti.
3. Tambahkan klik, panel detail, dan navigasi antar masalah. Berhenti.
4. Poles: rentang terpadat sebagai default, aksesibilitas keyboard, responsif.

Kalau waktu mepet dan hanya langkah 1–2 yang selesai, timeline statis tanpa interaksi **tetap layak dikirim** dan tetap berguna.

9. Timeline di layar Riwayat

Sesi di riwayat bisa diklik untuk membuka timeline-nya. Aturannya:

Yang disimpan ke localStorage: seluruh event bertimestamp — daftar kata pengisi ({detik, kata}), daftar jeda panjang, daftar segmen menunduk, dan wpmSeri. Ini metrik, bukan rekaman, dan ukurannya kecil.

Yang TIDAK disimpan: transkrip, dalam bentuk apa pun.

Konsekuensinya: timeline di Riwayat tampil utuh dengan keempat baris dan seluruh interaksinya. Panel detail menampilkan rentang waktu dan ringkasan kejadian, tapi tanpa potongan transkrip. Di tempat transkrip biasanya muncul, tulis satu baris --redup: "Transkrip tidak disimpan — hanya tersedia langsung setelah sesi selesai."

Jangan menawarkan untuk menyimpan transkrip agar fitur ini lebih lengkap. Ini keputusan yang sudah diambil.

Perhatikan ukuran localStorage: sesi dengan banyak event tetap kecil, tapi pastikan penanganan kuota penuh yang sudah ada di storage.js juga menangani kasus ini — kalau gagal simpan, sesi tetap tampil di rapor dengan catatan tidak masuk riwayat.