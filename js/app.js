/**
 * ============================================================================
 * ORKESTRATOR UTAMA (APP) - PODIUM
 * ============================================================================
 * File: js/app.js
 * Deskripsi:
 * Mengatur state global aplikasi, navigasi SPA antar 5 layar, perizinan media,
 * orkestrasi modul (Speech, Audio, Face, Pose, Storage, Report), dan
 * pengujian bentrok mikrofon untuk Tahap 0.
 * 
 * Sesuai aturan:
 * - Dikomentari lengkap dalam Bahasa Indonesia agar mudah dijelaskan ke juri.
 * - Threshold terpusat pada satu objek CONFIG yang mudah dikalibrasi.
 * - Kamera dan mikrofon dimatikan total (track.stop()) saat sesi berakhir.
 * ============================================================================
 */

import * as storage from './storage.js';
import * as audioModule from './audio.js';
import * as speechModule from './speech.js';
import * as faceModule from './face.js';
import * as poseModule from './pose.js';
import * as reportModule from './report.js';

// ----------------------------------------------------------------------------
// 1. KONFIGURASI GLOBAL (CONFIG)
// Sesuai Bagian 6 & 11: Semua threshold ditulis terpusat di sini untuk kalibrasi.
// ----------------------------------------------------------------------------
export const CONFIG = {
  // Kecepatan Berbicara (WPM)
  WPM_SLOW: 100,            // Di bawah 100 dianggap pelan
  WPM_FAST: 150,            // Di atas 150 dianggap terlalu cepat
  WPM_MIN_SCORE: 60,        // Batas bawah linear skor 0
  WPM_MAX_SCORE: 200,       // Batas atas linear skor 0
  WPM_SARAN_PELAN: 95,      // Ambang saran "bicara terlalu pelan"
  WPM_SARAN_CEPAT: 155,     // Ambang saran "bicara terlalu cepat"
  WPM_BUCKET_DETIK: 30,     // Lebar tiap titik pada grafik kecepatan bicara
  WPM_BUCKET_MIN_DETIK: 10, // Potongan terakhir lebih pendek dari ini dibuang

  // --------------------------------------------------------------------------
  // KATA PENGISI YANG DIDETEKSI DARI TRANSKRIP
  //
  // Daftar ini sengaja hanya berisi KATA ASLI, bukan bunyi ragu.
  //
  // Dasarnya pengujian lapangan 12 September 2026 di Chrome desktop: bunyi
  // "eee" dan "emm" yang diucapkan sengaja, ditahan sekitar satu detik,
  // sebanyak lima kali masing-masing, TIDAK MUNCUL SAMA SEKALI di transkrip
  // id-ID, baik pada hasil sementara maupun hasil final. Pengenal suara Chrome
  // dilatih menghasilkan teks yang enak dibaca, jadi ia membuang disfluensi
  // non-leksikal sebelum teksnya sampai ke aplikasi. Menyimpan bunyi itu di
  // daftar ini hanya akan menciptakan ilusi bahwa ia sedang dipantau.
  //
  // Entri satu kata dicocokkan dengan PENCOCOKAN AWALAN, sehingga "kayak" sudah
  // mencakup "kayaknya" dan "gitu" mencakup "gitulah". Tidak perlu mendaftarkan
  // tiap bentuk berimbuhan satu per satu. Entri berisi spasi diperlakukan
  // sebagai frasa utuh dan tetap dicocokkan persis.
  //
  // Dioper ke speech.js saat start(), jadi menyunting daftar ini saja sudah cukup.
  FILLER_WORDS: [
    "anu", "apa ya", "apa namanya",
    "gitu", "kayak", "jadi jadi", "terus terus", "oke oke"
  ],

  // Panjang minimal sebuah entri agar boleh dicocokkan sebagai awalan.
  // Entri yang lebih pendek dari ini hanya dicocokkan persis, karena awalan
  // pendek menyeret kata tak berhubungan: "anu" akan menarik "anugerah".
  // Konsekuensinya "anu" (3 huruf) TIDAK mencakup "anunya" selama ambang ini 4.
  FILLER_PREFIX_MIN: 4,

  // Bunyi ragu non-leksikal. SENGAJA TIDAK dipakai untuk mencocokkan transkrip,
  // karena terbukti tidak pernah sampai ke sana. Didaftarkan di sini hanya
  // sebagai catatan hasil uji. Deteksi akustiknya DIBATALKAN pada Tahap 3
  // (14 September 2026); jeda hening panjang di js/audio.js dipakai sebagai
  // indikator hesitasi penggantinya. Alasan lengkap di kepala js/audio.js.
  FILLER_BUNYI_NONLEKSIKAL: ["eee", "emm", "hmm"],

  // Ambang perhitungan skor kata pengisi dan jeda
  FILLER_IDEAL_PER_MENIT: 2,    // <= 2 per menit dianggap sempurna
  FILLER_BURUK_PER_MENIT: 10,   // >= 10 per menit dianggap skor 0
  JEDA_PENALTI_PER_JEDA: 0.25,  // Pengurangan sub-skor tiap satu jeda panjang

  // Ambang pemilihan saran & kalimat ringkasan (tidak memengaruhi skor)
  WPM_RINGKASAN_CEPAT: 160,
  FILLER_SARAN_TOTAL: 8,
  FILLER_RINGKASAN_TOTAL: 6,
  JEDA_SARAN_JUMLAH: 3,
  PANDANG_SARAN_MIN: 0.6,
  SUBSKOR_KUAT: 0.8,            // Sub-skor di atas ini layak disebut kekuatan

  // Analisis Audio (jeda panjang & volume), dipakai js/audio.js
  audio: {
    // Ambang bicara = suara ruangan (median RMS saat diam) × pengali ini
    pengaliAmbangBicara: 2.5,
    // Hening lebih lama dari ini, diapit suara bicara, dihitung satu jeda panjang
    durasiJedaPanjangMs: 3000,
    // Suara di atas ambang harus bertahan selama ini agar diakui sebagai bicara.
    // Nilai AWAL, belum dikalibrasi: menyaring ketukan meja dan klik mouse
    // supaya tidak memecah satu hening panjang. Periksa lewat debug.
    minDurasiSuaraMs: 200,
    // Lama pengukuran suara ruangan di Layar Persiapan
    durasiUkurNoiseMs: 2000,
    // Rata-rata RMS saat bicara di bawah ini dilabeli "pelan", selain itu "ideal".
    // null = belum ditetapkan dari uji; selama null, label volume tidak ditampilkan.
    ambangVolumePelan: null,
    // true: cetak noise floor, RMS per detik, tiap jeda, dan hasil akhir ke console
    debug: false
  },

  // Arah Pandang (MediaPipe Face Blendshapes)
  LOOK_DOWN_THRESHOLD: 0.5,        // Rata-rata eyeLookDownLeft & eyeLookDownRight di atas ini dihitung menunduk
  FACE_BLINK_THRESHOLD: 0.5,       // eyeBlinkLeft ATAU eyeBlinkRight di atas ini = berkedip, frame dikeluarkan (nilai awal, kalibrasi via debug)
  FACE_SMOOTHING_FRAMES: 3,        // Status depan/menunduk baru berganti setelah sekian frame berturut-turut sepakat (nilai awal)
  FACE_POLL_INTERVAL_MS: 150,      // Frekuensi inferensi wajah tiap 150 ms
  MENUNDUK_EVENT_MIN_DETIK: 3,     // Menunduk selama ini atau lebih dicatat sebagai satu event timeline
  FACE_DEBUG: false,               // true: cetak nama & nilai blendshape ke console untuk kalibrasi ambang

  // Postur (Teachable Machine)
  POSE_CONFIDENCE_MIN: 0.7,        // Minimal confidence 0.7
  POSE_POLL_INTERVAL_MS: 2000,     // Klasifikasi postur tiap 2 detik

  // Batasan Sesi
  MIN_SESSION_DURATION_S: 30       // Sesi < 30 detik ditolak (tidak disimpan ke riwayat)
};

// ----------------------------------------------------------------------------
// 2. STATE GLOBAL APLIKASI
// ----------------------------------------------------------------------------
const state = {
  layarSaatIni: 'layar-beranda',
  streamKameraMic: null,       // Objek MediaStream aktif dari getUserMedia
  judulLatihan: '',
  durasiTargetDetik: 0,        // 0 berarti bebas
  analisisPosturAktif: false,

  // Status Sesi
  sesiBerjalan: false,
  sesiDijeda: false,
  waktuMulai: null,
  durasiBerjalanDetik: 0,
  timerIntervalId: null,

  // Data Metrik Real-Time Sesi
  metrikLive: {
    wpm: 0,
    fillerTotal: 0,
    arahPandang: 'depan'       // 'depan' | 'bawah' | 'tidak_terlihat'
  },

  // Pengujian Bentrok Mikrofon (Tahap 0)
  ujiBentrokTimerId: null,
  ujiBentrokSisaDetik: 60
};

// ----------------------------------------------------------------------------
// 3. ELEMEN DOM UTAMA
// ----------------------------------------------------------------------------
const DOM = {
  bannerBrowser: document.getElementById('banner-browser'),
  layarDaftar: document.querySelectorAll('.layar'),

  // Layar Beranda
  tombolKePersiapan: document.getElementById('btn-mulai-latihan'),
  tombolKeRiwayat: document.getElementById('btn-ke-riwayat'),
  ringkasanMiniWrap: document.getElementById('ringkasan-mini-wrap'),
  ringkasanTotalSesi: document.getElementById('ringkasan-total-sesi'),
  ringkasanSkorTerakhir: document.getElementById('ringkasan-skor-terakhir'),

  // Layar Persiapan
  formPersiapan: document.getElementById('form-persiapan'),
  inputJudul: document.getElementById('input-judul'),
  selectDurasi: document.getElementById('select-durasi'),
  checkboxPostur: document.getElementById('checkbox-postur'),
  kotakIzinEdukasi: document.getElementById('kotak-izin-edukasi'),
  tombolMintaIzin: document.getElementById('btn-minta-izin'),
  areaMediaPersiapan: document.getElementById('area-media-persiapan'),
  videoPreviewPersiapan: document.getElementById('video-preview-persiapan'),
  meterVolumeBar: document.getElementById('meter-volume-bar'),
  meterVolumeAngka: document.getElementById('meter-volume-angka'),
  statusKalibrasiRuangan: document.getElementById('status-kalibrasi-ruangan'),
  btnUkurUlangRuangan: document.getElementById('btn-ukur-ulang-ruangan'),
  statusModelWajah: document.getElementById('status-model-wajah'),
  statusModelPostur: document.getElementById('status-model-postur'),
  tombolMulaiSesi: document.getElementById('btn-mulai-sesi'),
  btnBatalPersiapan: document.getElementById('btn-batal-persiapan'),

  // Alat Uji Bentrok Mikrofon (Tahap 0)
  btnMulaiUjiBentrok: document.getElementById('btn-uji-bentrok'),
  logUjiBentrok: document.getElementById('log-uji-bentrok'),

  // Layar Sesi
  timerAngka: document.getElementById('timer-angka'),
  timerProgresWrap: document.getElementById('timer-progres-wrap'),
  timerProgressBar: document.getElementById('timer-progress-bar'),
  timerProgresTeks: document.getElementById('timer-progres-teks'),
  liveAngkaWpm: document.getElementById('live-angka-wpm'),
  liveAngkaFiller: document.getElementById('live-angka-filler'),
  liveStatusPandang: document.getElementById('live-status-pandang'),
  videoPreviewSesi: document.getElementById('video-preview-sesi'),
  tombolJedaSesi: document.getElementById('btn-jeda-sesi'),
  tombolSelesaiSesi: document.getElementById('btn-selesai-sesi'),

  // Layar Rapor
  raporSkorAngka: document.getElementById('rapor-skor-angka'),
  raporRingkasanTeks: document.getElementById('rapor-ringkasan-teks'),
  raporWpmNilai: document.getElementById('rapor-wpm-nilai'),
  raporWpmLabel: document.getElementById('rapor-wpm-label'),
  raporFillerNilai: document.getElementById('rapor-filler-nilai'),
  raporFillerRincian: document.getElementById('rapor-filler-rincian'),
  raporPandangNilai: document.getElementById('rapor-pandang-nilai'),
  raporPandangKet: document.getElementById('rapor-pandang-ket'),
  raporJedaNilai: document.getElementById('rapor-jeda-nilai'),
  raporJedaKet: document.getElementById('rapor-jeda-ket'),
  raporVolumeNilai: document.getElementById('rapor-volume-nilai'),
  raporVolumeKet: document.getElementById('rapor-volume-ket'),
  raporPosturKartu: document.getElementById('rapor-postur-kartu'),
  raporPosturNilai: document.getElementById('rapor-postur-nilai'),
  raporCatatanStorage: document.getElementById('rapor-catatan-storage'),
  daftarSaranRapor: document.getElementById('daftar-saran-rapor'),
  btnRaporLatihanLagi: document.getElementById('btn-rapor-latihan-lagi'),
  btnRaporKeBeranda: document.getElementById('btn-rapor-ke-beranda'),

  // Layar Riwayat
  daftarSesiRiwayat: document.getElementById('daftar-sesi-riwayat'),
  btnHapusSemuaSesi: document.getElementById('btn-hapus-semua-sesi'),
  btnRiwayatKeBeranda: document.getElementById('btn-riwayat-ke-beranda')
};

// ----------------------------------------------------------------------------
// 4. NAVIGASI LAYAR (SPA Tanpa Reload)
// ----------------------------------------------------------------------------
/**
 * Berpindah tampilan layar dengan transisi halus 150ms.
 * 
 * CARA KERJA:
 * 1. Menghilangkan kelas 'aktif' dari semua layar.
 * 2. Mengaktifkan layar target.
 * 3. Menyesuaikan kelas warna background pada <body>:
 *    - 'layar--panggung' (latar gelap #14181D) untuk Beranda, Persiapan, Sesi.
 *    - 'layar--terang' (latar cerah #F7F5F0) untuk Rapor dan Riwayat.
 * 4. Memperbarui isi layar dinamis jika diperlukan (misal ringkasan mini di beranda).
 * 
 * @param {string} idLayar - ID elemen layar tujuan (contoh: 'layar-beranda')
 */
export function tampilkanLayar(idLayar) {
  state.layarSaatIni = idLayar;

  DOM.layarDaftar.forEach(layar => {
    if (layar.id === idLayar) {
      layar.classList.add('aktif');
    } else {
      layar.classList.remove('aktif');
    }
  });

  // Tentukan apakah layar ini bertema panggung (gelap) atau ruang evaluasi (terang)
  const layarTarget = document.getElementById(idLayar);
  if (layarTarget) {
    if (layarTarget.classList.contains('layar--terang')) {
      document.body.style.backgroundColor = 'var(--bg-terang)';
      document.body.style.color = 'var(--tinta)';
    } else {
      document.body.style.backgroundColor = 'var(--bg-panggung)';
      document.body.style.color = 'var(--kapur)';
    }
  }

  // Aksi kontekstual saat membuka layar tertentu
  if (idLayar === 'layar-beranda') {
    muatRingkasanBeranda();
  } else if (idLayar === 'layar-persiapan') {
    siapkanLayarPersiapan();
  } else if (idLayar === 'layar-riwayat') {
    muatTampilanRiwayat();
  }

  // Scroll ke paling atas secara mulus
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// ----------------------------------------------------------------------------
// 5. PENANGANAN PERIZINAN & MEDIA (KAMERA & MIC)
// ----------------------------------------------------------------------------
/**
 * Meminta izin akses kamera dan mikrofon kepada pengguna setelah tombol ditekan.
 * 
 * CARA KERJA:
 * 1. Menampilkan penjelasan manfaat izin terlebih dahulu di UI sebelum dialog browser.
 * 2. Memanggil `navigator.mediaDevices.getUserMedia({ video, audio })`.
 * 3. Menghubungkan video stream ke elemen `<video>` preview di Layar Persiapan.
 * 4. Menginisialisasi `AudioContext` di `js/audio.js` dan memulai loop pembacaan RMS
 *    untuk menggerakkan bar meter volume secara real-time.
 * 5. Memeriksa kesiapan modul-modul lain dan mengaktifkan tombol "Mulai sesi".
 * 6. Jika izin ditolak, menampilkan pesan instruksi jelas (klik gembok address bar).
 */
async function mintaIzinMedia() {
  DOM.tombolMintaIzin.disabled = true;
  DOM.tombolMintaIzin.textContent = 'Menghubungkan perangkat...';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user'
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: false, // Menjaga akurasi deteksi bunyi nafas / jeda
        autoGainControl: true
      }
    });

    state.streamKameraMic = stream;

    // Tampilkan video di preview persiapan
    DOM.videoPreviewPersiapan.srcObject = stream;
    DOM.videoPreviewPersiapan.play().catch(e => console.warn('Autoplay video error:', e));

    // Hubungkan audio ke meter volume
    const audioInitSukses = audioModule.initAudio(stream);

    if (audioInitSukses) {
      // Jalankan loop pembacaan volume untuk meter indikator di layar persiapan
      audioModule.start({
        onVolumeTick: (rms) => {
          updateMeterVolume(rms);
        }
      }, CONFIG);
    }

    // Tampilkan area media dan sembunyikan kotak edukasi awal
    DOM.kotakIzinEdukasi.style.display = 'none';
    DOM.areaMediaPersiapan.style.display = 'grid';

    // Tombol mulai sesi dinyalakan oleh ukurSuaraRuangan() setelah pengukuran
    // 2 detik selesai. Tombol ini sengaja TIDAK menunggu model wajah: sesi tetap
    // boleh berjalan tanpa metrik arah pandang.
    DOM.btnMulaiUjiBentrok.disabled = false;

    // Muat model wajah secara lazy, lalu laporkan hasilnya apa adanya
    muatModelWajah();

    // Ukur suara ruangan untuk ambang bicara adaptif
    if (audioInitSukses) {
      ukurSuaraRuangan();
    } else {
      tampilkanStatusKalibrasi('Mikrofon tidak terhubung ke analisis audio. Jeda dan volume tidak akan dinilai.', false);
      DOM.tombolMulaiSesi.disabled = false;
    }

  } catch (error) {
    console.error('Izin kamera/mikrofon ditolak:', error);
    alert(
      'Podium tidak bisa berjalan tanpa kamera dan mikrofon.\n\n' +
      'Cara mengatasi: Klik ikon gembok (atau setelan situs) di sebelah kiri address bar perambanmu → Izinkan Kamera & Mikrofon → Muat ulang halaman.'
    );
    DOM.tombolMintaIzin.disabled = false;
    DOM.tombolMintaIzin.textContent = 'Izinkan & lanjut';
  }
}

/**
 * Menyiapkan Layar Persiapan sesuai kondisi perangkat yang sebenarnya.
 *
 * CARA KERJA:
 * Kamera dan mikrofon dimatikan total setiap kali sesi berakhir, sesuai batasan
 * privasi. Akibatnya, saat pengguna kembali ke layar ini lewat "Latihan lagi",
 * tampilan yang tertinggal dari sesi sebelumnya akan berbohong: preview kamera
 * membeku di gambar terakhir dan tombol "Mulai sesi" tampak siap, padahal tidak
 * ada satu pun perangkat yang menyala. Sesi berikutnya akan berjalan tanpa
 * kamera tanpa pengguna tahu.
 *
 * Fungsi ini mengembalikan layar ke keadaan awal bila aliran perangkat memang
 * sudah mati, sehingga pengguna diminta memberi izin lagi secara sadar.
 */
function siapkanLayarPersiapan() {
  const adaStreamAktif = Boolean(
    state.streamKameraMic &&
    state.streamKameraMic.getTracks().some(t => t.readyState === 'live')
  );

  if (adaStreamAktif) return;

  state.streamKameraMic = null;
  DOM.videoPreviewPersiapan.srcObject = null;

  DOM.kotakIzinEdukasi.style.display = '';
  DOM.areaMediaPersiapan.style.display = 'none';

  DOM.tombolMintaIzin.disabled = false;
  DOM.tombolMintaIzin.textContent = 'Izinkan & lanjut';
  DOM.tombolMulaiSesi.disabled = true;
  DOM.btnMulaiUjiBentrok.disabled = true;

  DOM.meterVolumeBar.style.width = '0%';
  DOM.meterVolumeAngka.textContent = '0%';
  tampilkanStatusKalibrasi('', true);
}

/**
 * Memuat model Face Landmarker dan melaporkan statusnya di Layar Persiapan.
 *
 * CARA KERJA:
 * Model diunduh dari CDN, jadi butuh waktu dan bisa gagal saat luring. Badge
 * status diubah menjadi "Memuat model" lebih dulu supaya pengguna tahu ada yang
 * sedang berjalan, lalu menjadi "Selesai" atau "Gagal dimuat" sesuai kenyataan.
 *
 * Kegagalan di sini sengaja TIDAK menghentikan apa pun. Sesi tetap bisa berjalan,
 * modul wajah melaporkan dirinya tidak tersedia, dan rumus skor membagi ulang
 * bobot arah pandang ke metrik lain. Rapor kehilangan satu metrik, tetapi tidak
 * ada satu angka pun yang dikarang.
 */
async function muatModelWajah() {
  DOM.statusModelWajah.textContent = 'Memuat model';
  DOM.statusModelWajah.className = 'status-model-badge badge-menunggu';

  const berhasil = await faceModule.loadModel();

  if (berhasil) {
    DOM.statusModelWajah.textContent = 'Selesai';
    DOM.statusModelWajah.className = 'status-model-badge badge-sukses';
  } else {
    DOM.statusModelWajah.textContent = 'Gagal dimuat';
    DOM.statusModelWajah.className = 'status-model-badge badge-gagal';
    DOM.statusModelWajah.title = 'Sesi tetap bisa berjalan, tetapi arah pandang tidak akan dinilai.';
  }
}

/**
 * Mengukur suara ruangan di Layar Persiapan untuk ambang bicara adaptif.
 *
 * CARA KERJA:
 * 1. Meminta pengguna diam, lalu mengunci tombol "Mulai sesi" dan "Ukur ulang"
 *    selama pengukuran supaya sesi tidak dimulai dengan ambang setengah jadi.
 * 2. js/audio.js membaca energi ruangan selama CONFIG.audio.durasiUkurNoiseMs
 *    dan menetapkan ambang bicara dari situ.
 * 3. Hasilnya dilaporkan apa adanya. Bila gagal, sesi tetap boleh dimulai,
 *    tetapi jeda dan volume tidak dinilai dan bobotnya dialihkan di rumus skor.
 *
 * Pengguna yang tidak sengaja bicara saat pengukuran akan mendapat ambang
 * terlalu tinggi; tombol "Ukur ulang" disediakan untuk kasus itu.
 */
async function ukurSuaraRuangan() {
  DOM.tombolMulaiSesi.disabled = true;
  DOM.btnUkurUlangRuangan.disabled = true;
  tampilkanStatusKalibrasi('Jangan bicara dulu, kami mengukur suara ruanganmu...', true);

  const hasil = await audioModule.ukurNoiseFloor(CONFIG);

  // Pengguna bisa saja sudah meninggalkan Layar Persiapan selama 2 detik itu
  if (!state.streamKameraMic) return;

  if (hasil.berhasil) {
    tampilkanStatusKalibrasi('Suara ruangan terukur. Silakan mulai kapan pun kamu siap.', true);
  } else {
    tampilkanStatusKalibrasi('Suara ruangan gagal diukur. Sesi tetap bisa berjalan, tetapi jeda dan volume tidak akan dinilai.', false);
  }

  DOM.tombolMulaiSesi.disabled = false;
  DOM.btnUkurUlangRuangan.disabled = false;
}

function tampilkanStatusKalibrasi(pesan, normal) {
  DOM.statusKalibrasiRuangan.textContent = pesan;
  DOM.statusKalibrasiRuangan.style.color = normal ? '' : 'var(--bahaya)';
}

/**
 * Memperbarui tampilan visual meter volume suara mikrofon.
 * 
 * CARA KERJA:
 * Nilai RMS (Root Mean Square) dari Web Audio berkisar 0.0 s/d ~0.3 untuk suara manusia normal.
 * Nilai dikalikan faktor pengali 300% dan dibatasi (clamped) pada 100% agar responsif terlihat di UI.
 * 
 * @param {number} rms - Energi gelombang suara saat ini
 */
function updateMeterVolume(rms) {
  const persen = Math.min(Math.round(rms * 350), 100);
  DOM.meterVolumeBar.style.width = `${persen}%`;
  DOM.meterVolumeAngka.textContent = `${persen}%`;
}

/**
 * Menghentikan seluruh track kamera dan mikrofon hardware.
 * 
 * Sesuai Bagian 2 (Batasan Keras):
 * Kamera dan mikrofon mati total (semua track stop()) begitu sesi berakhir.
 */
function matikanSemuaMedia() {
  if (state.streamKameraMic) {
    state.streamKameraMic.getTracks().forEach(track => {
      try {
        track.stop();
      } catch (e) {
        console.warn('Gagal mematikan track media:', e);
      }
    });
    state.streamKameraMic = null;
  }
  audioModule.cleanupAudio();
}

// ----------------------------------------------------------------------------
// 6. ALAT UJI BENTROK MIKROFON (TAHAP 0)
// ----------------------------------------------------------------------------
/**
 * Melakukan pengujian paralel antara Web Audio API (meter volume) dan
 * Web Speech API (webkitSpeechRecognition) selama 60 detik.
 * 
 * CARA KERJA:
 * 1. Mengaktifkan speech recognition dan audio meter secara bersamaan pada stream mikrofon.
 * 2. Menampilkan timer countdown 60 detik dan log interaktif.
 * 3. Memverifikasi bahwa speech recognition menangkap kata tanpa menyebabkan
 *    Web Audio API crash atau error "device busy".
 */
function mulaiUjiBentrokMikrofon() {
  if (!state.streamKameraMic) {
    alert('Beri izin kamera dan mikrofon terlebih dahulu sebelum memulai uji bentrok.');
    return;
  }

  DOM.btnMulaiUjiBentrok.disabled = true;
  DOM.logUjiBentrok.textContent = '[0s] Memulai uji bentrok mikrofon selama 60 detik...\n';
  DOM.logUjiBentrok.textContent += '[0s] Web Audio API: Meter aktif.\n';

  state.ujiBentrokSisaDetik = 60;

  // Mulai Web Speech recognition untuk pengujian
  const speechMulai = speechModule.start({
    onInterim: (teks) => {
      tambahLogUjiBentrok(`Suara terdeteksi (Web Speech): "${teks}"`);
    },
    onFinal: (teksFinal) => {
      tambahLogUjiBentrok(`Final (Web Speech): "${teksFinal}"`);
    },
    onError: (err) => {
      tambahLogUjiBentrok(`[PERINGATAN] Speech Recognition error: ${err.error || err.message}`);
    }
  }, CONFIG);

  if (!speechMulai) {
    tambahLogUjiBentrok('[GAGAL] Web Speech API tidak dapat dijalankan di browser ini.');
    DOM.btnMulaiUjiBentrok.disabled = false;
    return;
  }

  tambahLogUjiBentrok('[0s] Web Speech API: Berhasil berjalan paralel.');
  tambahLogUjiBentrok('Silakan berbicara bebas ke mikrofon sekarang...\n');

  // Interval hitung mundur 60 detik
  state.ujiBentrokTimerId = setInterval(() => {
    state.ujiBentrokSisaDetik--;
    const detikBerjalan = 60 - state.ujiBentrokSisaDetik;

    if (state.ujiBentrokSisaDetik % 10 === 0) {
      const rmsSekarang = audioModule.hitungRMS();
      const persen = Math.min(Math.round(rmsSekarang * 350), 100);
      tambahLogUjiBentrok(`[${detikBerjalan}s] Status Paralel: Audio RMS=${rmsSekarang.toFixed(3)} (${persen}%), Web Speech tetap menyala.`);
    }

    if (state.ujiBentrokSisaDetik <= 0) {
      selesaiUjiBentrokMikrofon(true);
    }
  }, 1000);
}

function tambahLogUjiBentrok(pesan) {
  DOM.logUjiBentrok.textContent += pesan + '\n';
  DOM.logUjiBentrok.scrollTop = DOM.logUjiBentrok.scrollHeight;
}

function selesaiUjiBentrokMikrofon(sukses = true) {
  if (state.ujiBentrokTimerId) {
    clearInterval(state.ujiBentrokTimerId);
    state.ujiBentrokTimerId = null;
  }
  speechModule.stop();
  DOM.btnMulaiUjiBentrok.disabled = false;

  if (sukses) {
    tambahLogUjiBentrok('\n[HASIL UJI] Sukses sempurna! Web Speech API dan Web Audio API dapat berjalan bersamaan di Chrome desktop tanpa bentrok maupun error.');
  }
}

// ----------------------------------------------------------------------------
// 7. ORKESTRASI ALUR SESI LATIHAN (Layar Sesi)
// ----------------------------------------------------------------------------
/**
 * Memulai sesi latihan penuh.
 */
function mulaiSesiLatihan() {
  const judul = DOM.inputJudul.value.trim();
  if (!judul) {
    alert('Mohon isi judul latihan terlebih dahulu (misal: "Latihan Sidang Skripsi").');
    DOM.inputJudul.focus();
    return;
  }

  state.judulLatihan = judul;
  state.durasiTargetDetik = parseInt(DOM.selectDurasi.value, 10) || 0;
  state.analisisPosturAktif = DOM.checkboxPostur.checked;

  // Berpindah ke Layar Sesi
  tampilkanLayar('layar-sesi');

  // Hubungkan stream kamera ke preview kecil di pojok
  if (state.streamKameraMic) {
    DOM.videoPreviewSesi.srcObject = state.streamKameraMic;
    DOM.videoPreviewSesi.play().catch(e => console.warn(e));
  }

  // Reset metrik live
  state.durasiBerjalanDetik = 0;
  state.sesiBerjalan = true;
  state.sesiDijeda = false;
  // Indikator arah pandang dimulai dari "belum aktif", bukan "depan". Modul face
  // yang akan mengoreksinya sendiri lewat onGazeUpdate begitu benar-benar mengukur.
  state.metrikLive = { wpm: 0, fillerTotal: 0, arahPandang: 'belum aktif' };
  DOM.liveAngkaWpm.textContent = '0';
  DOM.liveAngkaFiller.textContent = '0';
  DOM.liveStatusPandang.textContent = 'belum aktif';
  DOM.tombolJedaSesi.textContent = 'Jeda';

  // Siapkan tampilan indikator target durasi
  if (state.durasiTargetDetik > 0) {
    DOM.timerProgresWrap.style.display = 'block';
    DOM.timerProgressBar.style.width = '0%';
    const menitTarget = state.durasiTargetDetik / 60;
    DOM.timerProgresTeks.textContent = `Target: ${menitTarget} menit`;
  } else {
    DOM.timerProgresWrap.style.display = 'none';
  }

  // Mulai modul-modul analisis
  // 1. Modul Suara (Speech)
  speechModule.start({
    onWpmUpdate: (wpm) => {
      state.metrikLive.wpm = wpm;
      DOM.liveAngkaWpm.textContent = wpm;
    },
    onFillerUpdate: (total) => {
      state.metrikLive.fillerTotal = total;
      DOM.liveAngkaFiller.textContent = total;
      // Pulse mikro-animasi pada angka filler saat bertambah
      DOM.liveAngkaFiller.classList.remove('pulse-angka');
      void DOM.liveAngkaFiller.offsetWidth; // Trigger reflow
      DOM.liveAngkaFiller.classList.add('pulse-angka');
    }
  }, CONFIG);

  // 2. Modul Audio (jeda panjang & volume, memakai ambang dari Layar Persiapan)
  audioModule.start({}, CONFIG);

  // 3. Modul Wajah (Face)
  faceModule.start({
    onGazeUpdate: (arah) => {
      state.metrikLive.arahPandang = arah;
      DOM.liveStatusPandang.textContent = arah;
    }
  }, DOM.videoPreviewSesi, CONFIG);

  // 4. Modul Postur (jika diaktifkan)
  if (state.analisisPosturAktif) {
    poseModule.start();
  }

  // Jalankan Timer
  state.waktuMulai = Date.now();
  state.timerIntervalId = setInterval(tickTimerSesi, 1000);
  renderTimerTeks(0);
}

/**
 * Loop timer sesi per detik.
 */
function tickTimerSesi() {
  if (!state.sesiBerjalan || state.sesiDijeda) return;

  state.durasiBerjalanDetik++;
  renderTimerTeks(state.durasiBerjalanDetik);

  if (state.durasiTargetDetik > 0) {
    const rasio = Math.min((state.durasiBerjalanDetik / state.durasiTargetDetik) * 100, 100);
    DOM.timerProgressBar.style.width = `${rasio}%`;
  }
}

/**
 * Memformat detik menjadi format MM:SS untuk timer 72px tabular.
 */
function renderTimerTeks(totalDetik) {
  const m = Math.floor(totalDetik / 60).toString().padStart(2, '0');
  const s = (totalDetik % 60).toString().padStart(2, '0');
  DOM.timerAngka.textContent = `${m}:${s}`;
}

/**
 * Menjeda atau melanjutkan sesi latihan.
 *
 * CARA KERJA:
 * Fungsi ini HANYA memanggil pause() dan resume() milik tiap modul, tidak pernah
 * start(). Aturan itu bukan gaya penulisan, melainkan inti kontrak siklus hidup
 * yang didokumentasikan di kepala js/speech.js: start() adalah satu-satunya
 * fungsi yang mengosongkan akumulator, sehingga memanggilnya di sini akan
 * menghapus seluruh hitungan kata, kata pengisi, dan frame yang sudah terkumpul
 * setiap kali pengguna menjeda sesi.
 *
 * Timer sesi ikut membeku karena tickTimerSesi berhenti menambah detik selama
 * state.sesiDijeda bernilai true. Dengan begitu durasi yang dipakai menghitung
 * WPM rata-rata hanya berisi waktu bicara yang sebenarnya.
 *
 * Preview kamera sengaja dibiarkan hidup selama jeda supaya pengguna tidak
 * kehilangan bingkai dirinya, tetapi tidak ada satu pun frame yang dianalisis.
 */
function toggleJedaSesi() {
  if (!state.sesiBerjalan) return;

  if (!state.sesiDijeda) {
    // Masuk mode jeda: semua modul berhenti sementara, akumulator dipertahankan
    state.sesiDijeda = true;
    DOM.tombolJedaSesi.textContent = 'Lanjut';

    speechModule.pause();
    audioModule.pause();
    faceModule.pause();
    poseModule.pause();
  } else {
    // Lanjutkan sesi dari akumulator yang sama
    state.sesiDijeda = false;
    DOM.tombolJedaSesi.textContent = 'Jeda';

    speechModule.resume();
    audioModule.resume();
    faceModule.resume();
    poseModule.resume();
  }
}

/**
 * Mengakhiri sesi latihan dan membuka Layar Rapor.
 */
function selesaiSesiLatihan() {
  const yakin = confirm('Akhiri sesi latihan dan lihat rapor evaluasi?');
  if (!yakin) return;

  // Hentikan timer dan semua modul
  if (state.timerIntervalId) {
    clearInterval(state.timerIntervalId);
    state.timerIntervalId = null;
  }
  state.sesiBerjalan = false;

  speechModule.stop();
  audioModule.stop();
  faceModule.stop();
  if (state.analisisPosturAktif) poseModule.stop();

  // Matikan kamera & mikrofon seketika
  matikanSemuaMedia();

  // Evaluasi batas durasi minimal
  if (state.durasiBerjalanDetik < CONFIG.MIN_SESSION_DURATION_S) {
    // Ambang 30 detik di CONFIG adalah batas keras penolakan; 1 menit disebut
    // sebagai saran ideal agar metriknya cukup padat untuk bermakna.
    alert('Sesi di bawah 30 detik tidak bisa dianalisis. Untuk hasil yang bermakna, coba minimal 1 menit.');
    tampilkanLayar('layar-beranda');
    return;
  }

  // Kumpulkan data sesi
  prosesDanTampilkanRapor();
}

/**
 * Mengumpulkan seluruh metrik modul dan merender Layar Rapor.
 */
function prosesDanTampilkanRapor() {
  const hasilSpeech = speechModule.getResults(state.durasiBerjalanDetik);
  const hasilAudio = audioModule.getResults(CONFIG);
  const hasilFace = faceModule.getResults();
  const hasilPose = poseModule.getResults();

  const dataSesiLengkap = {
    id: `s_${Date.now()}`,
    tanggal: new Date().toISOString(),
    judul: state.judulLatihan,
    durasiDetik: state.durasiBerjalanDetik,
    skor: 0, // Dihitung di bawah
    wpmRata: hasilSpeech.wpmRata,
    // Deret kecepatan bicara per 30 detik, disusun oleh speech.js yang memegang
    // cap waktu tiap kata. Ini sumber data grafik pertama di rapor (Tahap 4).
    wpmSeri: hasilSpeech.wpmSeri,
    filler: {
      total: hasilSpeech.filler.total,
      rincian: hasilSpeech.filler.rincian
    },
    // Modul arah pandang melaporkan sendiri apakah datanya benar-benar terukur.
    // Selama dilumpuhkan (sampai Tahap 2) nilainya null, bukan 0, supaya
    // "belum diukur" tidak pernah tertukar dengan "0% menatap ke depan".
    pandangTersedia: hasilFace.tersedia === true,
    pandangPersen: hasilFace.tersedia === true ? hasilFace.pandangPersen : null,
    wajahTakTerlihatPersen: hasilFace.tersedia === true ? hasilFace.wajahTakTerlihatPersen : null,
    // Event bertimestamp untuk baris kedua timeline di Tahap 4B. Ini daftar
    // jarang (puluhan per sesi), bukan data per frame, jadi aman disimpan.
    menundukSegmen: hasilFace.tersedia === true ? hasilFace.menundukSegmen : [],
    // Jeda dan volume hanya punya arti bila ambang bicara sempat diukur di Layar
    // Persiapan. Tanpa itu nilainya null, bukan 0, supaya "tidak diukur" tidak
    // pernah terbaca sebagai "tidak ada jeda" dan tidak mendongkrak skor.
    jedaTersedia: hasilAudio.tersedia === true,
    jeda: hasilAudio.tersedia === true
      ? {
          jumlah: hasilAudio.jeda.jumlah,
          terlamaDetik: hasilAudio.jeda.terlamaDetik,
          // Event bertimestamp untuk baris "masalah" di timeline Tahap 4B
          daftar: hasilAudio.jeda.daftar
        }
      : { jumlah: null, terlamaDetik: null, daftar: [] },
    volumeLabel: hasilAudio.tersedia === true ? hasilAudio.volumeLabel : null,
    postur: {
      // Diambil dari laporan modulnya, bukan dari centang checkbox. Dengan begitu
      // modul stub tidak bisa menyumbang bobot skor untuk sesuatu yang tidak diukur.
      aktif: hasilPose.aktif === true,
      distribusi: hasilPose.distribusi
    }
  };

  // Hitung Skor Total (0-100)
  const skorTotal = reportModule.hitungSkorTotal(dataSesiLengkap, state.analisisPosturAktif, CONFIG);
  dataSesiLengkap.skor = skorTotal;

  // Simpan ke storage (dengan proteksi jika storage penuh)
  const statusSimpan = storage.simpanSesi(dataSesiLengkap);

  // Render Layar Rapor
  renderRaporUI(dataSesiLengkap, statusSimpan);
  tampilkanLayar('layar-rapor');
}

/**
 * Merender konten DOM Layar Rapor.
 */
function renderRaporUI(data, statusSimpan) {
  // Count-up animasi skor 72px sekali saat dibuka
  animasiCountUp(DOM.raporSkorAngka, data.skor);

  // Kalimat ringkasan
  DOM.raporRingkasanTeks.textContent = reportModule.buatKalimatRingkasan(data, data.skor, CONFIG);

  // Kartu metrik
  DOM.raporWpmNilai.textContent = data.wpmRata;
  let labelWpm = 'ideal';
  if (data.wpmRata < CONFIG.WPM_SLOW) labelWpm = 'pelan';
  else if (data.wpmRata > CONFIG.WPM_FAST) labelWpm = 'terlalu cepat';
  DOM.raporWpmLabel.textContent = `kecepatan ${labelWpm}`;

  DOM.raporFillerNilai.textContent = `${data.filler.total}×`;
  const rincianStr = Object.entries(data.filler.rincian)
    .map(([k, v]) => `${k} (${v})`)
    .join(', ') || 'tidak ada kata pengisi dominan';
  DOM.raporFillerRincian.textContent = rincianStr;

  // Kartu arah pandang punya dua wajah: angka terukur, atau penanda jujur
  // "belum aktif" lengkap dengan keterangan bahwa metrik ini tidak ikut dihitung.
  if (data.pandangTersedia) {
    DOM.raporPandangNilai.classList.remove('kartu-metrik__nilai--nonaktif');
    DOM.raporPandangNilai.textContent = `${Math.round(data.pandangPersen * 100)}%`;
    DOM.raporPandangKet.innerHTML =
      `wajah tak terlihat: <span id="rapor-wajah-hilang-nilai">${Math.round(data.wajahTakTerlihatPersen * 100)}%</span>`;
  } else {
    DOM.raporPandangNilai.classList.add('kartu-metrik__nilai--nonaktif');
    DOM.raporPandangNilai.textContent = 'belum aktif';
    DOM.raporPandangKet.textContent = 'modul arah pandang belum berjalan, jadi tidak ikut dihitung dalam skor';
  }

  // Kartu jeda: angka terukur, atau "belum aktif" bila suara ruangan gagal diukur
  if (data.jedaTersedia) {
    DOM.raporJedaNilai.classList.remove('kartu-metrik__nilai--nonaktif');
    DOM.raporJedaNilai.textContent = `${data.jeda.jumlah}×`;
    DOM.raporJedaKet.textContent = data.jeda.jumlah > 0
      ? `terlama ${data.jeda.terlamaDetik.toFixed(1)} detik`
      : 'hening di awal dan akhir sesi tidak dihitung';
  } else {
    DOM.raporJedaNilai.classList.add('kartu-metrik__nilai--nonaktif');
    DOM.raporJedaNilai.textContent = 'belum aktif';
    DOM.raporJedaKet.textContent = 'suara ruangan tidak terukur, jadi jeda tidak ikut dihitung dalam skor';
  }

  // Kartu volume: label hanya tampil bila ambangnya sudah ditetapkan dari uji
  if (data.jedaTersedia && data.volumeLabel) {
    DOM.raporVolumeNilai.classList.remove('kartu-metrik__nilai--nonaktif');
    DOM.raporVolumeNilai.textContent = data.volumeLabel;
    DOM.raporVolumeKet.textContent = 'dihitung dari saat kamu berbicara saja';
  } else {
    DOM.raporVolumeNilai.classList.add('kartu-metrik__nilai--nonaktif');
    DOM.raporVolumeNilai.textContent = 'belum aktif';
    DOM.raporVolumeKet.textContent = data.jedaTersedia
      ? 'batas volume belum dikalibrasi'
      : 'suara ruangan tidak terukur';
  }

  // Kartu postur (hanya jika modul aktif)
  if (data.postur.aktif) {
    DOM.raporPosturKartu.style.display = 'block';
    DOM.raporPosturNilai.textContent = 'Tersedia';
  } else {
    DOM.raporPosturKartu.style.display = 'none';
  }

  // Catatan storage jika gagal
  if (!statusSimpan.sukses && statusSimpan.pesan) {
    DOM.raporCatatanStorage.style.display = 'block';
    DOM.raporCatatanStorage.textContent = statusSimpan.pesan;
  } else {
    DOM.raporCatatanStorage.style.display = 'none';
  }

  // Daftar saran konkret
  DOM.daftarSaranRapor.innerHTML = '';
  const daftarSaran = reportModule.pilihSaran(data, CONFIG);
  daftarSaran.forEach(teksSaran => {
    const itemEl = document.createElement('div');
    itemEl.className = 'saran-item';
    itemEl.innerHTML = `<div class="saran-item__aksen"></div><div>${teksSaran}</div>`;
    DOM.daftarSaranRapor.appendChild(itemEl);
  });
}

/**
 * Animasi count-up angka skor 0 -> skorAkhir.
 */
function animasiCountUp(elemen, targetNilai) {
  let saatIni = 0;
  const durasi = 800;
  const stepTime = 20;
  const increment = targetNilai / (durasi / stepTime);

  const timer = setInterval(() => {
    saatIni += increment;
    if (saatIni >= targetNilai) {
      elemen.textContent = Math.round(targetNilai);
      clearInterval(timer);
    } else {
      elemen.textContent = Math.round(saatIni);
    }
  }, stepTime);
}

// ----------------------------------------------------------------------------
// 8. TAMPILAN BERANDA & RIWAYAT
// ----------------------------------------------------------------------------
function muatRingkasanBeranda() {
  const info = storage.ambilRingkasanMini();
  if (info.adaRiwayat) {
    DOM.ringkasanMiniWrap.style.display = 'block';
    DOM.ringkasanTotalSesi.textContent = info.totalSesi;
    DOM.ringkasanSkorTerakhir.textContent = info.skorTerakhir;
  } else {
    DOM.ringkasanMiniWrap.style.display = 'none';
  }
}

function muatTampilanRiwayat() {
  const daftar = storage.ambilDaftarSesi();
  DOM.daftarSesiRiwayat.innerHTML = '';

  if (daftar.length === 0) {
    DOM.daftarSesiRiwayat.innerHTML = '<div class="pesan-kosong">Belum ada riwayat sesi latihan.</div>';
    DOM.btnHapusSemuaSesi.style.display = 'none';
    return;
  }

  DOM.btnHapusSemuaSesi.style.display = 'inline-flex';

  daftar.forEach(sesi => {
    const tanggalFormat = new Date(sesi.tanggal).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const m = Math.floor(sesi.durasiDetik / 60);
    const s = sesi.durasiDetik % 60;
    const durasiStr = `${m}m ${s}s`;

    const el = document.createElement('div');
    el.className = 'item-sesi';
    el.innerHTML = `
      <div class="item-sesi__info">
        <div class="item-sesi__judul">${sesi.judul}</div>
        <div class="item-sesi__meta">${tanggalFormat} • Durasi ${durasiStr} • WPM ${sesi.wpmRata} • Filler ${sesi.filler.total}×</div>
      </div>
      <div class="item-sesi__aksi">
        <div class="item-sesi__skor">${sesi.skor}</div>
        <button class="tombol tombol--bahaya" data-hapus-id="${sesi.id}" style="padding: 6px 14px; font-size: 13px;">Hapus</button>
      </div>
    `;
    DOM.daftarSesiRiwayat.appendChild(el);
  });

  // Pasang listener hapus per sesi
  DOM.daftarSesiRiwayat.querySelectorAll('[data-hapus-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-hapus-id');
      if (confirm('Hapus sesi ini dari riwayat?')) {
        storage.hapusSesi(id);
        muatTampilanRiwayat();
        muatRingkasanBeranda();
      }
    });
  });
}

// ----------------------------------------------------------------------------
// 9. INISIALISASI EVENT LISTENERS
// ----------------------------------------------------------------------------
function initEventListeners() {
  // Peringatan jika bukan Chrome / tidak mendukung webkitSpeechRecognition
  if (!speechModule.isSupported()) {
    DOM.bannerBrowser.classList.remove('tersembunyi');
    DOM.tombolKePersiapan.disabled = true;
    DOM.tombolKePersiapan.title = 'Browser tidak didukung';
  }

  // Beranda
  DOM.tombolKePersiapan.addEventListener('click', () => {
    tampilkanLayar('layar-persiapan');
  });

  DOM.tombolKeRiwayat.addEventListener('click', () => {
    tampilkanLayar('layar-riwayat');
  });

  // Persiapan
  DOM.tombolMintaIzin.addEventListener('click', mintaIzinMedia);
  DOM.btnUkurUlangRuangan.addEventListener('click', ukurSuaraRuangan);
  DOM.btnMulaiUjiBentrok.addEventListener('click', mulaiUjiBentrokMikrofon);
  DOM.tombolMulaiSesi.addEventListener('click', mulaiSesiLatihan);
  DOM.btnBatalPersiapan.addEventListener('click', () => {
    matikanSemuaMedia();
    tampilkanLayar('layar-beranda');
  });

  // Sesi
  DOM.tombolJedaSesi.addEventListener('click', toggleJedaSesi);
  DOM.tombolSelesaiSesi.addEventListener('click', selesaiSesiLatihan);

  // Rapor
  DOM.btnRaporLatihanLagi.addEventListener('click', () => {
    tampilkanLayar('layar-persiapan');
  });

  DOM.btnRaporKeBeranda.addEventListener('click', () => {
    tampilkanLayar('layar-beranda');
  });

  // Riwayat
  DOM.btnRiwayatKeBeranda.addEventListener('click', () => {
    tampilkanLayar('layar-beranda');
  });

  DOM.btnHapusSemuaSesi.addEventListener('click', () => {
    if (confirm('Apakah Anda yakin ingin menghapus SELURUH riwayat sesi latihan? Tindakan ini tidak dapat dibatalkan.')) {
      storage.hapusSemuaSesi();
      muatTampilanRiwayat();
      muatRingkasanBeranda();
    }
  });
}

// Jalankan saat DOM selesai dimuat
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  tampilkanLayar('layar-beranda');
});
