# GEMINI.md — Dokumentasi & Konteks Inti Proyek Podium

> **Podium**: Pelatih Presentasi Pribadi Berbahasa Indonesia untuk Lomba AI/ML  
> **Tema Lomba**: Penerapan AI dalam Kehidupan Sehari-hari  
> **Kriteria Penilaian**: Ide (60%), Implementasi (40%)  
> **Target Pengguna**: Pembicara, mahasiswa, dan profesional yang berlatih presentasi mandiri di depan laptop dengan umpan balik real-time dan rapor evaluasi objektif.

---

## 1. Filosofi & Batasan Keras (Non-Negotiable)

1. **100% Client-Side (Zero Backend / Zero Server / Zero Database)**:
   - Semua pemrosesan video, audio, dan inferensi ML berjalan langsung di browser pengguna.
   - Penyimpanan riwayat latihan hanya menggunakan `localStorage` peramban (key: `podium_sessions`).
2. **Tanpa Build Tools**:
   - Tidak ada npm, webpack, vite, react, tailwind, typescript.
   - Menggunakan **Vanilla HTML5 + CSS3 (CSS Custom Properties) + JavaScript Modern (ES Modules via `<script type="module">`)**.
3. **Library Terbatas & Hanya dari CDN**:
   - **Web Speech API** (`webkitSpeechRecognition` bawaan Google Chrome, `lang: 'id-ID'`).
   - **MediaPipe Tasks Vision** (`FaceLandmarker` dengan blendshapes via CDN `@mediapipe/tasks-vision`).
   - **Web Audio API** (`AudioContext` + `AnalyserNode` bawaan peramban).
   - **Teachable Machine Pose (TF.js)** (URL model dimasukkan pada Tahap 5; modul `pose.js` berupa stub sampai saat itu).
   - **Chart.js** (CDN untuk grafik rapor & tren skor).
   - *Dilarang menambahkan library lain tanpa persetujuan eksplisit.*
4. **Privasi Mutlak**:
   - Tidak ada satu frame video atau rekaman audio pun yang disimpan ke disk atau dikirim ke server luar.
   - Pengecualian jujur di UI: Web Speech API meneruskan audio ke layanan pengenal suara milik browser. Kotak privasi menyebut penyedianya sesuai browser: Chrome → "layanan speech bawaan Chrome", Safari → "layanan speech Apple", browser lain → kalimat netral tanpa nama penyedia (lihat `js/browser.js`).
   - Kamera dan mikrofon **hanya aktif selama sesi**, memiliki indikator live kuning `--sorot`, dan **mati total (`track.stop()`)** saat sesi berakhir.
5. **Target Peramban**:
   - **Google Chrome desktop terbaru adalah satu-satunya target yang divalidasi.**
   - *Revisi 17 September 2026:* browser lain **tidak lagi diblokir**. Ketentuan lama menonaktifkan tombol mulai di browser tanpa `webkitSpeechRecognition`; ketentuan itu dicabut karena juri yang membuka tautan di browser lain akan menilai aplikasi rusak alih-alih memasang Chrome.
   - Di browser selain Chrome, aplikasi tetap berjalan dengan banner tenang yang bisa ditutup: *"Diuji di Chrome. Di browser lain sebagian fitur mungkin berbeda."* Browser tanpa pengenal suara sama sekali (misalnya Firefox) diberi tahu bahwa kecepatan bicara dan kata pengisi tidak akan dinilai, dan rapornya menandai kedua metrik itu "belum aktif".
   - Ini **bukan dukungan multi-browser**. Perilaku di browser lain belum diuji, dan hasil uji dari browser lain tidak berlaku untuk Chrome.
6. **Bahasa & Nada**:
   - Seluruh antarmuka berbahasa Indonesia dengan nada pelatih suportif, bukan menghakimi.
7. **Standar Komentar Kode**:
   - Setiap fungsi penting **wajib** memiliki komentar bahasa Indonesia yang menjelaskan **CARA KERJANYA secara konseptual**, bukan sekadar mengulang nama fungsi (agar dapat dijelaskan kepada juri tanpa membuka dokumentasi eksternal).

---

## 2. Struktur Berkas Proyek

```
podium-app/
├── GEMINI.md         # Dokumentasi master konteks proyek dan panduan agen
├── index.html        # SPA 5 layar (<section>) dengan navigasi tanpa reload
├── style.css         # Desain sistem token (panggung/terang), tipografi, & tata letak
└── js/
    ├── app.js        # Orkestrator utama, objek CONFIG, state global, router layar, timer
    ├── speech.js     # Modul Web Speech API: transkripsi Bahasa Indonesia, WPM, kata pengisi
    ├── audio.js      # Modul Web Audio API: FFT, RMS volume meter, jeda hening, heuristik audio
    ├── face.js       # Modul MediaPipe Face Landmarker: arah pandang & wajah tak terlihat
    ├── pose.js       # Modul stub Teachable Machine Pose (antarmuka kosong hingga Tahap 5)
    ├── report.js     # Kalkulasi skor 0-100, pembuat ringkasan suportif, aturan saran konkret
    └── storage.js    # Modul CRUD aman localStorage untuk 'podium_sessions'
```

Setiap modul mengekspor kontrak fungsi konsisten:
- `start(callbacks)`
- `stop()`
- `getResults()`

---

## 3. Desain Sistem: Metafora Panggung & Ruang Evaluasi

Aplikasi menerapkan konsep pencahayaan teater:
- **Layar Panggung** (Beranda, Persiapan, Sesi): Gelap (`--panggung: #14181D`), tenang, fokus, minim distraksi. **Selalu gelap, tidak terpengaruh pilihan tema.**
- **Layar Ruang Evaluasi** (Rapor, Riwayat): Terang (`--bg-terang: #F7F5F0`) secara bawaan, jernih, informatif.

### Pilihan Tema (revisi 17 September 2026)

Spesifikasi ini semula menetapkan Rapor dan Riwayat **selalu** berlatar terang. Ketentuan itu **dilonggarkan**: kedua layar evaluasi kini mengikuti pilihan tema pengguna.

- Tombol tema memutar tiga keadaan: `otomatis` (mengikuti `prefers-color-scheme`), `terang`, dan `gelap`. Bawaannya `otomatis`.
- Pilihan disimpan di `localStorage` dengan kunci tersendiri, `podium_tema`, terpisah dari `podium_sessions`, supaya menghapus riwayat tidak ikut menghapus preferensi tampilan.
- Tema gelap **hanya menimpa token permukaan terang** (`--bg-terang`, `--kartu-terang`, `--tinta`, `--border-terang`) dengan nilai token panggung yang sudah ada. Tidak ada warna baru, dan aturan aksen tunggal tetap berlaku.
- **Layar Sesi dikecualikan dan tetap gelap dalam kondisi apa pun.** Gelapnya adalah metafora panggung, bukan preferensi: layar itu satu-satunya yang tidak dibaca pengguna, dan menerangkannya hanya menambah cahaya ke wajah serta mengalihkan perhatian. Tombol tema tidak ditampilkan di sana.
- Implementasi: [js/tema.js](js/tema.js), atribut `data-tema` pada elemen `<html>`.

### Token Desain (CSS Custom Properties)

```css
:root {
  /* Lapisan Permukaan Panggung */
  --panggung:       #14181D;   /* Latar utama halaman panggung */
  --panggung-naik:  #1B2128;   /* Permukaan kartu (1 tingkat lebih terang) */
  --garis:          #2A313A;   /* Garis pemisah & border kartu */

  /* Ruang Evaluasi & Warna Dasar */
  --bg-terang:      #F7F5F0;   /* Latar ruang evaluasi */
  --tinta:          #1E242B;   /* Teks utama latar terang */
  --kapur:          #EDEFF2;   /* Teks utama latar gelap (body: opacity 0.75) */
  --sorot:          #E8B44A;   /* SATU-SATUNYA aksen: kuning lampu sorot */
  --redup:          #8A9099;   /* HANYA untuk label kecil, satuan, keterangan */
  --bahaya:         #C4543D;   /* Khusus aksi hapus & galat */

  /* Tipografi */
  --font-judul:     'Sora', sans-serif;
  --font-isi:       'Inter', sans-serif;
}
```

### Aturan Visual & Tata Letak Keras
- **Aksen Tunggal**: Hanya `--sorot` (#E8B44A). Dilarang menambah warna aksen kedua.
- **Gradien Tunggal**: Hanya radial-gradient halus di belakang judul "Podium" pada Layar Beranda untuk mensimulasikan sorot lampu atas panggung. Dilarang ada gradien lain di layar manapun.
- **Tanpa Bayangan & Glassmorphism**: Permukaan kartu mengandalkan warna `--panggung-naik` dan border 1px `--garis`.
- **Tipografi**:
  - `Sora` untuk judul dan angka besar.
  - `Inter` untuk teks isi.
  - Angka timer & skor memakai `font-variant-numeric: tabular-nums` (72px / 44px).
  - Skala ketat: 14 / 16 / 20 / 28 / 44 / 72 / 88px.
- **Kontras Aksesibilitas**: Teks body di latar panggung menggunakan `--kapur` dengan `opacity: 0.75` (rasio kontras ~7.4:1, lolos kualifikasi WCAG AA).
- **Ritme Spacing**: 64px antar kelompok konten, 24px di dalam kelompok.
- **Radius**: 10px untuk kartu, 999px untuk tombol utama.
- **Larangan Gaya**: Dilarang teks ALL-CAPS spasi lebar, dilarang highlight satu kata beda warna di judul, dilarang emoji sebagai ikon UI, dilarang tanda panah `→` pada tombol.

---

## 4. Alur 5 Layar (Single Page Application)

| Layar | ID Elemen | Fungsi & Karakteristik Utama |
| :--- | :--- | :--- |
| **1. Beranda** | `#layar-beranda` | Judul "Podium" 88px dengan efek sorot panggung, tagline, 3 poin cara kerja berurutan (1, 2, 3), widget mini riwayat (jika ada data), kotak privasi dengan garis aksen kiri `--sorot`, tombol "Mulai latihan" & "Riwayat". Terpusat vertikal (`min-height: 100vh`). |
| **2. Persiapan** | `#layar-persiapan` | Input judul latihan (wajib), pilihan target durasi (3/5/10 menit/bebas), checkbox postur (default nonaktif), kartu edukasi izin sebelum memicu browser prompt, preview kamera cermin, meter sensitivitas volume Web Audio, daftar status modul, dan alat uji bentrok mikrofon 60 detik. |
| **3. Sesi** | `#layar-sesi` | Desain paling tenang. Timer besar 72px tabular di tengah (dengan progres target jika disetel), preview kamera kecil (±180px) di pojok bawah dengan titik status live `--sorot` dan label "live, tidak direkam", 3 indikator tenang (WPM, filler, arah pandang), tombol Jeda & Selesai. Tanpa transkrip berjalan atau notifikasi suara mengganggu. |
| **4. Rapor** | `#layar-rapor` | Ruang evaluasi (terang atau gelap sesuai pilihan tema). Skor total 0–100 (count-up animasi; menampilkan "—" bila metrik yang terukur terlalu sedikit), kalimat evaluasi suportif otomatis, grid kartu metrik terukur (WPM, filler, arah pandang, jeda, volume, postur), lintasan waktu sesi dengan kepala pemutar dan panel keterangan, daftar 3 saran konkret, tombol "Latihan lagi" & "Ke beranda". |
| **5. Riwayat** | `#layar-riwayat` | Ruang evaluasi (terang atau gelap sesuai pilihan tema). Daftar sesi tersimpan (tanggal, judul, durasi, skor, WPM, filler), grafik tren skor Chart.js, tombol hapus per sesi, tombol "Hapus semua" (dengan konfirmasi). |

---

## 5. Logika Metrik, Rumus Skor, & Kalibrasi `CONFIG`

Seluruh parameter threshold ditulis terpusat pada objek `CONFIG` di [js/app.js](js/app.js) untuk mempermudah kalibrasi lapangan:

```javascript
export const CONFIG = {
  WPM_SLOW: 100,               // < 100: pelan
  WPM_FAST: 150,               // > 150: terlalu cepat (ideal: 100-150)
  WPM_MIN_SCORE: 60,           // Batas bawah skor 0
  WPM_MAX_SCORE: 200,          // Batas atas skor 0
  FILLER_WORDS: [
    "eee", "emm", "hmm", "anu", "apa ya", "apa namanya",
    "gitu", "kayak", "jadi jadi", "terus terus", "oke oke"
  ],
  VOICE_RMS_MIN: 0.03,         // Ambang batas suara vokal aktif
  VOICE_FILL_DURATION_MS: 800, // Heuristik bunyi vokal konstan > 800ms
  SILENCE_RMS_MAX: 0.012,      // Batas hening (RMS)
  SILENCE_DURATION_S: 3,       // Hening > 3 detik = 1 jeda panjang
  VOLUME_PELAN_RMS: 0.02,      // Rata-rata volume pelan
  VOLUME_IDEAL_RMS: 0.05,      // Rata-rata volume ideal
  LOOK_DOWN_THRESHOLD: 0.5,    // Blendshape eyeLookDown > 0.5 dihitung menunduk
  FACE_POLL_INTERVAL_MS: 150,  // Sampling arah pandang per 150ms
  POSE_CONFIDENCE_MIN: 0.7,    // Ambang batas akurasi kelas postur
  POSE_POLL_INTERVAL_MS: 2000, // Inferensi postur per 2 detik
  MIN_SESSION_DURATION_S: 30   // Sesi < 30 detik ditolak (tidak disimpan)
};
```

### Formula Skor Total (0–100)

- **Kondisi Default (Modul Postur Nonaktif)**:
  $$\text{Skor} = 35 \times \text{skorWPM} + 27 \times \text{skorFiller} + 27 \times \text{skorPandang} + 11 \times \text{skorJeda}$$

- **Kondisi Khusus (Modul Postur Aktif)**:
  $$\text{Skor} = 30 \times \text{skorWPM} + 25 \times \text{skorFiller} + 25 \times \text{skorPandang} + 10 \times \text{skorJeda} + 10 \times \text{skorPostur}$$

#### Sub-Skor Komponen:
1. **skorWPM**:
   - $1.0$ jika $100 \le \text{WPM} \le 150$
   - Turun linear ke $0.0$ bila $\le 60$ atau $\ge 200$
2. **skorFiller**:
   - $1.0$ jika $\le 2\text{ filler/menit}$
   - $0.0$ jika $\ge 10\text{ filler/menit}$ (linear di antaranya)
3. **skorPandang**:
   - Persentase kontak mata ke depan: $\frac{\text{Frame Depan}}{\text{Total Frame} - \text{Frame Wajah Tak Terlihat}}$
4. **skorJeda**:
   - $1.0 - (0.25 \times \text{jumlah jeda})$, batas minimal $0.0$
5. **skorPostur**:
   - Persentase waktu pada kelas `menghadap-audiens`.

---

## 6. Skema Data `localStorage` (`podium_sessions`)

Data riwayat disimpan dalam array JSON:
```json
{
  "id": "s_1712345678",
  "tanggal": "2026-09-07T19:30:00",
  "judul": "Latihan Sidang Skripsi Bab 3",
  "durasiDetik": 300,
  "skor": 74,
  "wpmRata": 138,
  "wpmSeri": [120, 131, 140],
  "filler": {
    "total": 11,
    "rincian": { "eee": 6, "jadi jadi": 3, "anu": 2 },
    "dariAudio": 2
  },
  "pandangPersen": 0.62,
  "wajahTakTerlihatPersen": 0.08,
  "jeda": {
    "jumlah": 2,
    "terlamaDetik": 5.1
  },
  "volumeLabel": "ideal",
  "postur": {
    "aktif": false,
    "distribusi": {}
  }
}
```

---

## 7. Status Tahapan Pengerjaan (Roadmap Bagian 10)

Setiap tahap wajib dikerjakan berurutan, diuji secara manual, dan **berhenti menunggu konfirmasi pemilik proyek sebelum lanjut**:

- [x] **Tahap 0 — Kerangka, Navigasi, Desain Sistem, & Uji Bentrok Mic**:
  - Kerangka 5 layar, navigasi SPA tanpa reload.
  - Implementasi token panggung & terang, lapisan permukaan `--panggung-naik`, ritme 64px/24px, dan efek lampu sorot.
  - Alur izin perangkat kamera + mic dengan meter volume Web Audio.
  - Fitur pengujian mikrofon paralel 60 detik (Web Audio meter + Web Speech).
- [ ] **Tahap 1 — Suara (`speech.js`)**:
  - Kalibrasi transkripsi Bahasa Indonesia real-time.
  - Perhitungan WPM bergulir 30 detik.
  - Deteksi kata pengisi (`FILLER_WORDS`) berbasis regex boundary pada teks final.
  - Auto-restart recognition pada event `onend` selama sesi masih aktif.
  - *Langkah Uji*: Bicara 2 menit dengan filler disengaja, cocokkan hitungan.
- [ ] **Tahap 2 — Pandang (`face.js`)**:
  - Integrasi MediaPipe Tasks Vision CDN (`FaceLandmarker` dengan blendshapes).
  - Pemuatan lazy model saat sesi akan dimulai.
  - Deteksi arah menunduk (`eyeLookDownLeft` + `eyeLookDownRight` > 0.5) tiap 150 ms.
  - Pencatatan wajah tidak terlihat secara terpisah.
  - *Langkah Uji*: Menunduk 10 detik → kontak pandang turun; tutup kamera → terhitung "wajah tidak terlihat".
- [ ] **Tahap 3 — Audio (`audio.js`)**:
  - *Revisi 21 September 2026:* **metrik volume DIHENTIKAN.** Dua uji lapangan menunjukkan berbisik (rasio 3,91x suara ruangan) dan duduk dua kali lebih jauh (3,86x) tidak terbedakan; memisahkannya butuh pengukuran jarak yang tidak tersedia. Kartu volume di rapor berbunyi "tidak dinilai" dan `CONFIG.audio.pengaliVolumePelan` dibiarkan `null` selamanya. Deteksi jeda panjang tidak terpengaruh.
  - Deteksi jeda hening > 3 detik (RMS < `SILENCE_RMS_MAX`).
  - Evaluasi volume rata-rata (pelan / ideal).
  - Heuristik vokal tertahan "eee" via audio (RMS konstan > 800ms tanpa penambahan kata interim) + logika anti double-count dengan filler transkrip.
  - *Langkah Uji*: Hening 5 detik → 1 jeda; "eee" panjang → bertambah 1 bunyi pengisi tanpa dobel hitung.
- [ ] **Tahap 4 — Rapor (`report.js` & `storage.js`)**:
  - Kalkulasi rumus skor akhir 0–100.
  - Visualisasi 2 grafik Chart.js (WPM per 30 detik & tren skor 10 sesi terakhir).
  - Evaluasi aturan saran konkret (`ATURAN_SARAN`).
  - Penolakan sesi < 30 detik dengan pesan edukatif.
  - *Langkah Uji*: 2 sesi berbeda → 2 entri riwayat; sesi 20 detik → ditolak.
- [ ] **Tahap 5 — Postur (`pose.js`)**:
  - Pemasangan URL model Teachable Machine Pose (4 kelas: `menghadap-audiens`, `menghadap-layar-membaca`, `postur-tertutup`, `tidak-di-tempat`).
  - Checkbox postur diaktifkan saat model tersedia.
  - Pengambilan prediksi confidence > 0.7 tiap 2 detik.
  - *Langkah Uji*: Menoleh ke layar → distribusi kelas berubah.
- [ ] **Tahap 6 — Poles & Kepatuhan Penuh**:
  - Layar Riwayat lengkap dengan grafik tren akumulatif.
  - Uji seluruh penanganan error Bagian 8 (izin ditolak, browser non-Chrome, offline/CDN gagal, localStorage penuh).
  - Uji responsivitas mobile sampai 380px.
  - Audit kepatuhan larangan Bagian 9.

---

## 8. Catatan Penting untuk Sesi / Agen Berikutnya

1. **Jalankan Server Lokal**:
   - Jalankan `python3 -m http.server 8000` di root workspace untuk menguji via `http://localhost:8000`.
2. **Jangan Mengubah Struktur Modul**:
   - Pertahankan arsitektur modular (`js/speech.js`, `js/audio.js`, dll.). Jangan pernah menggabungkan kode menjadi satu file monolitik raksasa.
3. **Pastikan Web Speech Tetap Kompatibel**:
   - Selalu cek ketersediaan `webkitSpeechRecognition` sebelum memanggilnya.
4. **Perangkat Hardware**:
   - Kamera dan mikrofon harus selalu dimatikan total (`track.stop()`) ketika pengguna meninggalkan sesi atau membatalkan persiapan.
5. **Komentar Penjelas**:
   - Setiap modifikasi atau fungsi baru wajib diberi komentar cara kerja dalam Bahasa Indonesia.
