# Podium — Aturan Kerja

Aplikasi web pelatih presentasi berbahasa Indonesia. Vanilla HTML/CSS/JS, jalan penuh di browser tanpa backend. Proyek lomba AI/ML, dikerjakan seorang diri, tenggat ketat.

## Dokumen lain
- `GEMINI.md` — spesifikasi produk: layar, metrik, rumus skor, token UI, error handling. Rujuk saat butuh detail.
- `TAHAP-3.md`, `TAHAP-7.md` — spesifikasi tahap tertentu. **Jangan dibaca atau dikerjakan sampai saya menyebut tahapnya secara eksplisit.**

## Cara kerja
- Kerjakan **satu tahap per waktu**. Setelah tiap tahap: commit, beri langkah uji manual yang konkret, lalu **berhenti dan tunggu konfirmasi saya**. Jangan lanjut sendiri ke tahap berikutnya.
- Kalau langkah ujinya tidak ada gunanya (perilaku tidak berubah), katakan begitu — jangan buat uji formalitas.
- **Jangan refactor kode yang sudah jalan.** Kalau menurutmu perlu, jelaskan alasannya dan tunggu izin.
- Jangan tambah dependensi apa pun tanpa izin. Library yang diizinkan: Chart.js, TensorFlow.js + `@teachablemachine/pose`, `@mediapipe/tasks-vision`, JSZip.
- Commit per tahap dengan pesan jelas, format `feat(modul): ringkasan`.
- Setelah tiap perubahan, pastikan **console browser bersih tanpa error**. Kalau ada error yang tidak bisa kamu selesaikan, laporkan apa adanya — jangan tutupi dengan try-catch kosong.

## Batasan keras
- Tanpa backend, server, database, atau API eksternal. Penyimpanan hanya `localStorage`.
- Tanpa build tools: tidak ada npm, webpack, vite, React, Tailwind, TypeScript.
- **Tanpa LLM atau API AI generatif dalam bentuk apa pun.** API key di aplikasi klien-saja tidak mungkin dirahasiakan, dan menyembunyikannya butuh backend yang membatalkan klaim privasi produk. Jangan tawarkan.
- Tidak ada frame video, audio, transkrip, atau teks slide yang disimpan maupun dikirim. Pengecualian yang sudah diakui jujur di UI: Web Speech API mengirim audio ke layanan speech Chrome.
- Target Chrome desktop. Browser lain harus dideteksi dan diberi pesan jelas.

## Kejujuran metrik — tidak bisa dinegosiasi
- **Modul tidak boleh mengembalikan angka karangan.** Kalau sebuah modul belum diimplementasikan, `getResults()` mengembalikan `{ tersedia: false }` dan rapor menandai metriknya "belum aktif" serta mengalihkan bobot skornya. Rapor jujur tanpa satu metrik jauh lebih baik daripada rapor lengkap yang bohong.
- Kalau sebuah metrik hanya menghitung sebagian dari yang dijanjikan namanya, sebutkan keterbatasannya di UI.
- Validasi pakai angka, bukan kesan. Kalau akurasinya di bawah ambang yang saya tetapkan, laporkan dan berhenti — jangan memaksakan fitur yang angkanya tidak dipercaya.

## Kontrak modul analisis
Setiap modul (`speech`, `face`, `audio`, `pose`, `materi`) mengekspor:
- `start(callbacks)` — inisialisasi dan **reset** akumulator
- `pause()` — berhenti sementara **tanpa** reset
- `resume()` — lanjut **tanpa** reset
- `stop()` — hentikan total, lepas semua resource
- `getResults()` — kembalikan **agregat** (angka jadi), bukan data per frame

Tombol Jeda hanya memanggil `pause()`/`resume()`, **tidak pernah** `start()`.

`getResults()` mengembalikan persentase dan hitungan, bukan array per frame. Alasannya: konsistensi antar modul, hemat `localStorage`, dan privasi — satu persentase jauh kurang sensitif daripada rekaman perilaku per detik. Sampel yang tidak bisa dinilai (confidence rendah, wajah tidak terdeteksi) dikeluarkan dari pembagi, bukan dihitung sebagai nol.

## Kode
- **Setiap fungsi penting diberi komentar bahasa Indonesia yang menjelaskan CARA KERJANYA**, bukan sekadar namanya. Saya harus bisa menjelaskan seluruh kode ini ke juri tanpa membuka dokumentasi. Ini bukan permintaan kosmetik — 40% nilai lomba ada di implementasi dan pemahaman saya atasnya.
- Semua ambang dan nilai yang bisa dikalibrasi terkumpul di satu objek `CONFIG` di `app.js`. Kalibrasi tidak boleh perlu menyentuh logika.
- Temuan hasil uji yang mengubah keputusan desain dicatat sebagai komentar di kepala modul, lengkap dengan tanggalnya.
- Jangan tebak nilai ambang. Bangun mode debug, minta saya menjalankan uji, tetapkan ambang dari angka nyata.

## Kalau tidak yakin
Katakan. Jangan mengarang nama API, parameter, perilaku library, atau angka hasil uji. Lebih baik bertanya satu kali daripada saya menemukan asumsi salah di hari terakhir.