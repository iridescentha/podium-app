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
import * as timelineModule from './timeline.js';
import * as temaModule from './tema.js';
import * as browserModule from './browser.js';

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

  // --------------------------------------------------------------------------
  // BOBOT SKOR TIAP MODE
  //
  // Ditulis lengkap di sini, bukan dihitung otomatis, supaya bisa dibaca dan
  // diubah langsung tanpa membuka logika penilaian. Tiap tabel berjumlah 100.
  //
  // 'suaraSaja' adalah bobot 'lengkap' tanpa arah pandang: 27 poin milik
  // pandang dibagi ke tiga metrik sisanya menurut proporsinya masing-masing
  // (35 : 27 : 11 dari total 73), lalu dibulatkan supaya tetap berjumlah 100.
  //
  // Metrik yang modulnya tidak menghasilkan data tetap dikeluarkan oleh
  // report.js dan bobotnya dinormalkan ulang, jadi tabel ini adalah titik awal,
  // bukan jaminan bahwa semua komponennya pasti ikut dihitung.
  // --------------------------------------------------------------------------
  BOBOT_SKOR: {
    lengkap:            { wpm: 35, filler: 27, pandang: 27, jeda: 11 },
    lengkapDenganPostur: { wpm: 30, filler: 25, pandang: 25, jeda: 10, postur: 10 },
    suaraSaja:          { wpm: 48, filler: 37, jeda: 15 }
  },

  // Lama hitung mundur sebelum tiap kalibrasi mulai merekam, supaya pengguna
  // sempat bersiap (diam untuk suara ruangan, menatap kamera untuk postur).
  KALIBRASI_HITUNG_MUNDUR_DETIK: 3,

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

  // Porsi bobot minimal yang harus benar-benar terukur agar skor total boleh
  // ditampilkan. Di bawah ini rapor menampilkan tanda hubung beserta alasannya:
  // angka yang disusun dari satu-dua metrik sisa terlihat sama meyakinkannya
  // dengan skor penuh, padahal tidak.
  SKOR_MIN_BOBOT_TERUKUR: 50,

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
    // Batas atas ambang bicara hasil pengukuran. Di atas ini suara ruangan
    // dianggap setinggi suara bicara, dan kalibrasi digagalkan alih-alih
    // menyimpan acuan yang pasti salah.
    // NILAI AWAL, BELUM DIVALIDASI: tetapkan dari RMS bicara sungguhan lewat debug.
    ambangBicaraMaks: 0.08,
    // Rata-rata RMS saat bicara di bawah ini dilabeli "pelan", selain itu "ideal".
    // null = belum ditetapkan dari uji; selama null, label volume tidak ditampilkan.
    ambangVolumePelan: null,
    // true: cetak noise floor, RMS per detik, tiap jeda, dan hasil akhir ke console
    debug: false
  },

  // Arah Pandang (sudut kepala dari matriks transformasi MediaPipe)
  // Pitch sekian derajat DI BAWAH posisi netral pengguna dihitung menunduk.
  // Nilai awal dari uji 16 September 2026: netral -8° s/d -12°, membaca kertas
  // -24° s/d -28°, sedangkan gerakan mata saja menggeser kurang dari 3°.
  FACE_PITCH_MENUNDUK_DERAJAT: 8,
  FACE_KALIBRASI_MS: 2000,         // Lama pengukuran posisi kepala netral di Layar Persiapan
  // Bagian minimal jendela kalibrasi yang wajahnya harus terdeteksi. Di bawah
  // ini kalibrasi digagalkan, karena median dari segelintir frame bukan acuan.
  FACE_KALIBRASI_MIN_RASIO: 0.6,
  // Wajah yang hilang saat status sedang menunduk dihitung menunduk paling lama
  // sekian detik. Batas ini memisahkan menunduk dalam dari meninggalkan meja.
  FACE_HILANG_MENUNDUK_MAKS_DETIK: 5,
  FACE_BLINK_THRESHOLD: 0.5,       // eyeBlinkLeft ATAU eyeBlinkRight di atas ini = berkedip, frame dikeluarkan (nilai awal, kalibrasi via debug)
  FACE_SMOOTHING_FRAMES: 3,        // Status depan/menunduk baru berganti setelah sekian frame berturut-turut sepakat (nilai awal)
  FACE_POLL_INTERVAL_MS: 150,      // Frekuensi inferensi wajah tiap 150 ms
  MENUNDUK_EVENT_MIN_DETIK: 3,     // Menunduk selama ini atau lebih dicatat sebagai satu event timeline
  FACE_DEBUG: false,               // true: cetak pitch, selisih netral, dan nilai kedipan ke console untuk kalibrasi

  // Postur (Teachable Machine)
  POSE_CONFIDENCE_MIN: 0.7,        // Minimal confidence 0.7
  POSE_POLL_INTERVAL_MS: 2000,     // Klasifikasi postur tiap 2 detik

  // Batasan Sesi
  MIN_SESSION_DURATION_S: 30,      // Sesi < 30 detik ditolak (tidak disimpan ke riwayat)

  // true: cetak seluruh event bertimestamp sesi ke console saat rapor dibuka,
  // untuk mencocokkan isinya dengan apa yang benar-benar dilakukan (Tahap 4B).
  TIMELINE_DEBUG: true,

  // Lebar jendela yang diringkas panel lintasan, berpusat di kepala pemutar.
  // Delapan detik kira-kira selebar satu-dua kalimat, cukup untuk menjelaskan
  // satu kejadian tanpa ikut menyeret kejadian tetangganya.
  TIMELINE_JENDELA_DETIK: 8
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
  // 'lengkap' (kamera + mikrofon) atau 'suara-saja' (tanpa kamera sama sekali)
  modeSesi: 'lengkap',

  // Potongan transkrip bertimestamp sesi terakhir, HANYA di memori dan hanya
  // selama Layar Rapor terbuka (dipakai timeline Tahap 4B). Ikut tersimpan ke
  // localStorage hanya bila pengguna mencentang kotak di Layar Rapor, dan
  // dikosongkan begitu pengguna meninggalkan rapor.
  transkripSesi: null,

  // Objek sesi terakhir apa adanya, dipakai saat pengguna menyalakan atau
  // mematikan penyimpanan transkrip setelah sesinya tersimpan.
  sesiTerakhir: null,
  sesiTerakhirTersimpan: false,

  // Kendali lintasan waktu yang sedang tampil (kepala pemutar dan panelnya)
  kendaliTimeline: null,

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
  ujiBentrokSisaDetik: 60,

  // Status dua kalibrasi wajib di Layar Persiapan:
  // 'belum' | 'mengukur' | 'selesai' | 'gagal'
  kalibrasi: {
    ruangan: 'belum',
    postur: 'belum'
  }
};

// ----------------------------------------------------------------------------
// 3. ELEMEN DOM UTAMA
// ----------------------------------------------------------------------------
const DOM = {
  bannerBrowser: document.getElementById('banner-browser'),
  btnTema: document.getElementById('btn-tema'),
  privasiLayananSuara: document.getElementById('privasi-layanan-suara'),
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
  modeLengkap: document.getElementById('mode-lengkap'),
  modeSuaraSaja: document.getElementById('mode-suara-saja'),
  previewKameraKotak: document.getElementById('preview-kamera-kotak'),
  blokKalibrasi: document.getElementById('blok-kalibrasi'),
  barisKalibrasiPostur: document.getElementById('baris-kalibrasi-postur'),
  statusKalibrasiRuangan: document.getElementById('status-kalibrasi-ruangan'),
  badgeKalibrasiRuangan: document.getElementById('badge-kalibrasi-ruangan'),
  btnUkurUlangRuangan: document.getElementById('btn-ukur-ulang-ruangan'),
  statusKalibrasiPostur: document.getElementById('status-kalibrasi-postur'),
  badgeKalibrasiPostur: document.getElementById('badge-kalibrasi-postur'),
  btnKalibrasiPostur: document.getElementById('btn-kalibrasi-postur'),
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
  previewKameraPojok: document.getElementById('preview-kamera-pojok'),
  tombolJedaSesi: document.getElementById('btn-jeda-sesi'),
  tombolSelesaiSesi: document.getElementById('btn-selesai-sesi'),

  // Layar Rapor
  raporSkorAngka: document.getElementById('rapor-skor-angka'),
  raporModeLabel: document.getElementById('rapor-mode-label'),
  raporRingkasanTeks: document.getElementById('rapor-ringkasan-teks'),
  raporWpmNilai: document.getElementById('rapor-wpm-nilai'),
  raporWpmLabel: document.getElementById('rapor-wpm-label'),
  raporFillerNilai: document.getElementById('rapor-filler-nilai'),
  raporFillerRincian: document.getElementById('rapor-filler-rincian'),
  raporFillerCatatan: document.getElementById('rapor-filler-catatan'),
  raporPandangNilai: document.getElementById('rapor-pandang-nilai'),
  raporPandangKet: document.getElementById('rapor-pandang-ket'),
  raporPandangCatatan: document.getElementById('rapor-pandang-catatan'),
  raporJedaNilai: document.getElementById('rapor-jeda-nilai'),
  raporJedaKet: document.getElementById('rapor-jeda-ket'),
  raporVolumeNilai: document.getElementById('rapor-volume-nilai'),
  raporVolumeKet: document.getElementById('rapor-volume-ket'),
  raporPosturKartu: document.getElementById('rapor-postur-kartu'),
  raporPosturNilai: document.getElementById('rapor-postur-nilai'),
  raporPosturKet: document.getElementById('rapor-postur-ket'),
  timelineRapor: document.getElementById('timeline-rapor'),
  timelineLegendaRapor: document.getElementById('timeline-legenda-rapor'),
  timelinePanelRapor: document.getElementById('timeline-panel-rapor'),
  timelineKosong: document.getElementById('timeline-kosong'),
  raporCatatanStorage: document.getElementById('rapor-catatan-storage'),
  checkboxSimpanTranskrip: document.getElementById('checkbox-simpan-transkrip'),
  statusSimpanTranskrip: document.getElementById('status-simpan-transkrip'),
  daftarSaranRapor: document.getElementById('daftar-saran-rapor'),
  btnRaporLatihanLagi: document.getElementById('btn-rapor-latihan-lagi'),
  btnRaporKeBeranda: document.getElementById('btn-rapor-ke-beranda'),

  // Layar Riwayat
  daftarSesiRiwayat: document.getElementById('daftar-sesi-riwayat'),
  grafikTrenKartu: document.getElementById('grafik-tren-kartu'),
  chartTrenSkor: document.getElementById('chart-tren-skor'),
  grafikTrenCatatan: document.getElementById('grafik-tren-catatan'),
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
  // Transkrip hanya boleh hidup selama Layar Rapor terbuka (TAHAP-4b.md Bagian 2).
  // Begitu pengguna beranjak, potongan transkripnya dibuang dari memori. Ia tidak
  // pernah ditulis ke localStorage, jadi ini titik terakhir keberadaannya.
  if (state.layarSaatIni === 'layar-rapor' && idLayar !== 'layar-rapor') {
    state.transkripSesi = null;
  }

  state.layarSaatIni = idLayar;

  DOM.layarDaftar.forEach(layar => {
    if (layar.id === idLayar) {
      layar.classList.add('aktif');
    } else {
      layar.classList.remove('aktif');
    }
  });

  // Tentukan apakah layar ini bertema panggung (gelap) atau ruang evaluasi.
  // Warna ruang evaluasi sendiri mengikuti pilihan tema pengguna lewat token,
  // sedangkan layar panggung selalu gelap apa pun temanya.
  const layarTarget = document.getElementById(idLayar);
  if (layarTarget) {
    const ruangEvaluasi = layarTarget.classList.contains('layar--terang');
    document.body.classList.toggle('layar--terang-aktif', ruangEvaluasi);
    if (ruangEvaluasi) {
      document.body.style.backgroundColor = 'var(--bg-terang)';
      document.body.style.color = 'var(--tinta)';
    } else {
      document.body.style.backgroundColor = 'var(--bg-panggung)';
      document.body.style.color = 'var(--kapur)';
    }
  }

  // Tombol tema disembunyikan selama Layar Sesi: layar itu sengaja tenang, dan
  // temanya memang tidak bisa diubah.
  document.body.classList.toggle('sesi-berjalan', idLayar === 'layar-sesi');

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

  // Mode dibaca tepat sebelum izin diminta, karena inilah yang menentukan
  // apakah kamera ikut dinyalakan sama sekali.
  state.modeSesi = DOM.modeSuaraSaja.checked ? 'suara-saja' : 'lengkap';
  const pakaiKamera = (state.modeSesi === 'lengkap');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      // Mode suara saja TIDAK meminta izin kamera sama sekali, bukan sekadar
      // menyembunyikan previewnya. Lampu kamera pun tidak pernah menyala.
      video: pakaiKamera
        ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
        : false,
      audio: {
        echoCancellation: true,
        noiseSuppression: false, // Menjaga akurasi deteksi bunyi nafas / jeda
        autoGainControl: true
      }
    });

    state.streamKameraMic = stream;

    // Tampilkan video di preview persiapan (hanya bila kamera dipakai)
    if (pakaiKamera) {
      DOM.videoPreviewPersiapan.srcObject = stream;
      DOM.videoPreviewPersiapan.play().catch(e => console.warn('Autoplay video error:', e));
    }

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

    // Tampilkan area media dan blok kalibrasi, sembunyikan kotak edukasi awal
    DOM.kotakIzinEdukasi.style.display = 'none';
    DOM.areaMediaPersiapan.style.display = 'grid';
    DOM.blokKalibrasi.style.display = 'block';
    DOM.previewKameraKotak.style.display = pakaiKamera ? '' : 'none';
    DOM.barisKalibrasiPostur.style.display = pakaiKamera ? '' : 'none';

    // Mode tidak boleh berubah sesudah izin diberikan: kalibrasi dan izin
    // perangkat sudah terikat ke mode yang dipilih. Tombol Batal mengembalikannya.
    DOM.modeLengkap.disabled = true;
    DOM.modeSuaraSaja.disabled = true;

    DOM.tombolMulaiSesi.disabled = false;
    DOM.btnMulaiUjiBentrok.disabled = false;

    // Kalibrasi TIDAK berjalan sendiri. Pengukuran otomatis bisa merekam kamera
    // yang menghadap langit-langit atau ruangan yang sedang ramai, lalu
    // menyimpan acuan salah tanpa pengguna sadar. Pengguna yang menekannya.
    if (audioInitSukses) {
      setStatusKalibrasi('ruangan', 'belum', 'Menentukan batas antara hening dan suara bicaramu.');
    } else {
      setStatusKalibrasi('ruangan', 'belum', 'Mikrofon tidak terhubung ke analisis audio. Jeda dan volume tidak akan dinilai.', true);
    }

    if (pakaiKamera) {
      // Model wajah diunduh lebih dulu; tombol kalibrasi postur menunggu sampai siap
      setStatusKalibrasi('postur', 'belum', 'Menunggu model arah pandang selesai dimuat...');
      DOM.btnKalibrasiPostur.disabled = true;
      muatModelWajah();
    } else {
      DOM.statusModelWajah.textContent = 'Tidak dipakai';
      DOM.statusModelWajah.className = 'status-model-badge badge-menunggu';
      perbaruiHirarkiMulaiSesi();
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

  // Kalibrasi milik satu perangkat dan satu posisi duduk, jadi ikut disetel ulang
  // begitu izin perangkat harus diminta lagi. Pilihan mode ikut dibuka kembali,
  // karena tanpa izin yang berlaku tidak ada lagi yang terikat padanya.
  DOM.blokKalibrasi.style.display = 'none';
  DOM.modeLengkap.disabled = false;
  DOM.modeSuaraSaja.disabled = false;
  state.modeSesi = DOM.modeSuaraSaja.checked ? 'suara-saja' : 'lengkap';
  setStatusKalibrasi('ruangan', 'belum', 'Menentukan batas antara hening dan suara bicaramu.');
  setStatusKalibrasi('postur', 'belum', 'Menentukan posisi kepalamu saat menatap audiens.');
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
    // Modelnya siap; kalibrasi postur menunggu pengguna menekan tombolnya
    setStatusKalibrasi('postur', 'belum', 'Menentukan posisi kepalamu saat menatap audiens.');
  } else {
    DOM.statusModelWajah.textContent = 'Gagal dimuat';
    DOM.statusModelWajah.className = 'status-model-badge badge-gagal';
    DOM.statusModelWajah.title = 'Sesi tetap bisa berjalan, tetapi arah pandang tidak akan dinilai.';
    setStatusKalibrasi('postur', 'belum', 'Model arah pandang gagal dimuat, jadi postur netral tidak bisa diukur.', true);
    DOM.btnKalibrasiPostur.disabled = true;
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
/**
 * Menunda sekian milidetik, dipakai hitung mundur kalibrasi.
 */
function tunggu(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Hitung mundur sebelum sebuah kalibrasi mulai merekam.
 *
 * CARA KERJA:
 * Pengukuran hanya berlangsung dua detik, jadi pengguna perlu tahu persis kapan
 * detik-detik itu dimulai: diam untuk suara ruangan, menatap kamera untuk postur.
 * Tanpa jeda ini, detik pertama pengukuran hampir selalu berisi bunyi klik mouse
 * atau kepala yang masih bergerak ke posisi.
 *
 * @returns {Promise<boolean>} False bila pengguna meninggalkan layar di tengah jalan
 */
async function hitungMundurKalibrasi(nama, instruksi) {
  for (let sisa = CONFIG.KALIBRASI_HITUNG_MUNDUR_DETIK; sisa > 0; sisa--) {
    setStatusKalibrasi(nama, 'bersiap', `${instruksi} Mulai dalam ${sisa}...`);
    await tunggu(1000);
    if (!state.streamKameraMic) return false;
  }
  return true;
}

/**
 * Mengukur suara ruangan. Dijalankan HANYA saat pengguna menekan tombolnya.
 *
 * CARA KERJA:
 * Sesudah hitung mundur, js/audio.js membaca energi ruangan selama
 * CONFIG.audio.durasiUkurNoiseMs dan menurunkan ambang bicara dari situ.
 *
 * Kegagalan tidak pernah menyimpan acuan setengah jadi: modul audio membuang
 * nilai lamanya di awal pengukuran, dan bila gagal, baris ini kembali ke keadaan
 * "belum dikalibrasi" lengkap dengan alasan yang bisa ditindaklanjuti. Sesi tetap
 * boleh dimulai, tetapi jeda dan volume akan dilaporkan "belum aktif" di rapor.
 */
async function ukurSuaraRuangan() {
  DOM.tombolMulaiSesi.disabled = true;

  const siap = await hitungMundurKalibrasi('ruangan', 'Jangan bicara dulu, kami akan mengukur suara ruanganmu.');
  if (!siap) return;

  setStatusKalibrasi('ruangan', 'mengukur', 'Sedang mengukur, mohon tetap diam...');
  const hasil = await audioModule.ukurNoiseFloor(CONFIG);

  // Pengguna bisa saja sudah meninggalkan Layar Persiapan selama pengukuran
  if (!state.streamKameraMic) return;

  if (hasil.berhasil) {
    setStatusKalibrasi('ruangan', 'selesai', 'Batas suara bicara sudah menyesuaikan ruanganmu.');
  } else {
    const pesan = {
      'ruangan-berisik': 'Ruangan terlalu berisik — suara latar setinggi suara bicara. Cari tempat yang lebih tenang, lalu coba lagi.',
      'mikrofon-bisu': 'Tidak ada suara masuk — pastikan mikrofonmu tidak dimatikan, lalu coba lagi.',
      'mikrofon-tidak-siap': 'Mikrofon belum terhubung ke analisis audio. Muat ulang halaman, lalu coba lagi.'
    }[hasil.alasan] || 'Pengukuran gagal. Coba lagi.';
    setStatusKalibrasi('ruangan', 'belum', pesan, true);
  }

  DOM.tombolMulaiSesi.disabled = false;
}

/**
 * Menyimpan status satu kalibrasi lalu menggambar ulang hierarki Layar Persiapan.
 *
 * CARA KERJA:
 * Seluruh tampilan kalibrasi (keterangan, penanda status, gaya tombol, dan
 * tombol mana yang tampil utama) diturunkan dari dua nilai di state.kalibrasi.
 * Dengan begitu tidak ada satu pun jalur kode yang bisa menyalakan dua tombol
 * utama sekaligus, dan tampilan tidak pernah berbeda dari keadaan sebenarnya.
 *
 * @param {'ruangan'|'postur'} nama
 * @param {'belum'|'mengukur'|'selesai'|'gagal'} status
 * @param {string} keterangan - Kalimat penjelas yang tampil di bawah judul baris
 */
function setStatusKalibrasi(nama, status, keterangan, gagal = false) {
  state.kalibrasi[nama] = status;

  const elemen = (nama === 'ruangan')
    ? { ket: DOM.statusKalibrasiRuangan, badge: DOM.badgeKalibrasiRuangan, tombol: DOM.btnUkurUlangRuangan, labelUlang: 'Ukur ulang', labelMulai: 'Ukur sekarang' }
    : { ket: DOM.statusKalibrasiPostur, badge: DOM.badgeKalibrasiPostur, tombol: DOM.btnKalibrasiPostur, labelUlang: 'Kalibrasi ulang', labelMulai: 'Kalibrasi sekarang' };

  elemen.ket.textContent = keterangan;
  elemen.ket.style.color = gagal ? 'var(--bahaya)' : '';

  // Penanda status memakai KATA, bukan sekadar warna, supaya keadaannya tetap
  // terbaca tanpa bergantung pada persepsi warna.
  //
  // Kalibrasi yang gagal kembali ke 'belum', bukan status tersendiri: acuan
  // tidak pernah tersimpan sebagian, jadi keadaannya memang sama dengan belum
  // pernah diukur. Yang membedakan hanya keterangan merah berisi alasannya.
  const penanda = {
    belum: { teks: gagal ? 'gagal' : 'belum', kelas: gagal ? 'badge-gagal' : 'badge-menunggu' },
    bersiap: { teks: 'bersiap', kelas: 'badge-menunggu' },
    mengukur: { teks: 'mengukur', kelas: 'badge-menunggu' },
    selesai: { teks: 'selesai', kelas: 'badge-sukses' }
  }[status];
  elemen.badge.textContent = penanda.teks;
  elemen.badge.className = `status-model-badge ${penanda.kelas}`;

  // Selama belum selesai, tombolnya adalah aksi utama layar ini. Sesudah
  // selesai ia turun jadi tombol sekunder yang tenang, karena kalibrasi ulang
  // hanya dibutuhkan saat ada yang berubah.
  const selesai = (status === 'selesai');
  elemen.tombol.className = `tombol ${selesai ? 'tombol--sekunder' : 'tombol--utama'} tombol--kecil`;
  elemen.tombol.textContent = selesai ? elemen.labelUlang : elemen.labelMulai;
  elemen.tombol.disabled = (status === 'mengukur' || status === 'bersiap');

  perbaruiHirarkiMulaiSesi();
}

/**
 * Menentukan apakah "Mulai sesi" sudah layak jadi aksi utama layar.
 *
 * CARA KERJA:
 * Selama masih ada kalibrasi yang belum selesai, tombol Mulai sesi ditampilkan
 * sekunder supaya hanya ada SATU aksi utama di layar, yaitu kalibrasi yang
 * tertinggal. Tombolnya tetap bisa ditekan: pengguna boleh melewatkan kalibrasi,
 * dengan konsekuensi metrik terkait dilaporkan "belum aktif" di rapor, bukan
 * diisi angka karangan.
 */
function perbaruiHirarkiMulaiSesi() {
  // Mode suara saja tidak punya kalibrasi postur, jadi yang ditunggu hanya satu.
  const posturDibutuhkan = (state.modeSesi === 'lengkap');
  const semuaSelesai = state.kalibrasi.ruangan === 'selesai'
    && (!posturDibutuhkan || state.kalibrasi.postur === 'selesai');
  DOM.tombolMulaiSesi.className = `tombol ${semuaSelesai ? 'tombol--utama' : 'tombol--sekunder'}`;
}

/**
 * Mengukur posisi kepala netral pengguna di Layar Persiapan.
 *
 * CARA KERJA:
 * Modul wajah menilai menunduk dari SELISIH sudut kepala terhadap posisi netral,
 * bukan dari sudut mutlak, karena kamera laptop berada di bawah garis mata:
 * menatap kamera pun sudah menghasilkan sudut yang jauh dari nol, dan angkanya
 * berbeda untuk tiap orang dan tiap posisi laptop.
 *
 * Tombol "Kalibrasi ulang postur" memakai fungsi yang sama. Kalibrasi ulang
 * diperlukan bila pengguna terlanjur mengukur sambil membungkuk, atau memindahkan
 * laptopnya. Tanpa acuan yang benar, seluruh persentase arah pandang ikut salah.
 *
 * Kegagalan di sini tidak menghentikan sesi: modul wajah melaporkan dirinya
 * tidak tersedia dan bobot arah pandang dialihkan ke metrik lain.
 */
async function kalibrasiPosturKepala() {
  if (!faceModule.isReady()) {
    setStatusKalibrasi('postur', 'belum', 'Model arah pandang belum siap, postur netral belum bisa diukur.', true);
    return;
  }

  DOM.tombolMulaiSesi.disabled = true;

  const siap = await hitungMundurKalibrasi('postur', 'Duduklah seperti saat presentasi dan tatap kamera.');
  if (!siap) return;

  setStatusKalibrasi('postur', 'mengukur', 'Sedang mengukur, tahan posisimu...');
  const hasil = await faceModule.kalibrasiPostur(DOM.videoPreviewPersiapan, CONFIG);

  // Pengguna bisa saja sudah meninggalkan Layar Persiapan selama pengukuran
  if (!state.streamKameraMic) return;

  if (hasil.berhasil) {
    setStatusKalibrasi('postur', 'selesai', `Posisi kepala netralmu terukur ${hasil.pitchNetral.toFixed(1)}°. Kalibrasi ulang bila kamu memindahkan laptop.`);
  } else {
    const pesan = {
      'wajah-tidak-terdeteksi': 'Wajah tidak terdeteksi — pastikan kamera mengarah ke wajahmu, lalu coba lagi.',
      'model-belum-siap': 'Model arah pandang belum siap. Tunggu sebentar, lalu coba lagi.'
    }[hasil.alasan] || 'Pengukuran gagal. Coba lagi.';
    setStatusKalibrasi('postur', 'belum', pesan, true);
  }

  DOM.tombolMulaiSesi.disabled = false;
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
    tambahLogUjiBentrok('\n[HASIL UJI] Sukses sempurna! Web Speech API dan Web Audio API dapat berjalan bersamaan di browser ini tanpa bentrok maupun error.');
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

  // Preview kecil di pojok hanya ada bila kamera memang dipakai
  const pakaiKamera = (state.modeSesi === 'lengkap');
  DOM.previewKameraPojok.style.display = pakaiKamera ? '' : 'none';
  if (pakaiKamera && state.streamKameraMic) {
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

  // 3. Modul Wajah (Face), hanya pada mode lengkap
  if (pakaiKamera) {
    faceModule.start({
      onGazeUpdate: (arah) => {
        state.metrikLive.arahPandang = arah;
        DOM.liveStatusPandang.textContent = arah;
      }
    }, DOM.videoPreviewSesi, CONFIG);
  } else {
    DOM.liveStatusPandang.textContent = 'tanpa kamera';
  }

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
    // Mode ikut disimpan karena skor dari tiga metrik tidak sebanding dengan
    // skor dari empat metrik. Tanpa penanda ini, dua angka di Riwayat akan
    // terbaca seolah-olah bisa dibandingkan langsung.
    mode: state.modeSesi,
    durasiDetik: state.durasiBerjalanDetik,
    skor: 0, // Dihitung di bawah
    // Kecepatan dan kata pengisi sama-sama bersumber dari transkrip: bila
    // pengenal suara tidak pernah menghasilkan apa pun, keduanya null dan
    // ditandai tidak tersedia, bukan diisi nol.
    wpmTersedia: hasilSpeech.tersedia === true,
    fillerTersedia: hasilSpeech.tersedia === true,
    wpmRata: hasilSpeech.wpmRata,
    // Deret kecepatan bicara per 30 detik, disusun oleh speech.js yang memegang
    // cap waktu tiap kata. Ini sumber data grafik pertama di rapor (Tahap 4).
    wpmSeri: hasilSpeech.wpmSeri,
    // Bentuk lengkapnya dengan rentang waktu tiap potongan, dibutuhkan baris
    // kecepatan pada timeline Tahap 4B. Ukurannya beberapa puluh angka per sesi.
    deretWpm: hasilSpeech.deretWpm,
    filler: {
      total: hasilSpeech.filler.total,
      rincian: hasilSpeech.filler.rincian,
      // Event bertimestamp tiap kata pengisi untuk timeline Tahap 4B.
      // Ini metrik (detik ke berapa, kata apa), bukan transkrip.
      events: hasilSpeech.filler.events
    },
    // Modul arah pandang melaporkan sendiri apakah datanya benar-benar terukur.
    // Selama dilumpuhkan (sampai Tahap 2) nilainya null, bukan 0, supaya
    // "belum diukur" tidak pernah tertukar dengan "0% menatap ke depan".
    pandangTersedia: hasilFace.tersedia === true,
    pandangPersen: hasilFace.tersedia === true ? hasilFace.pandangPersen : null,
    wajahTakTerlihatPersen: hasilFace.tersedia === true ? hasilFace.wajahTakTerlihatPersen : null,
    // Event bertimestamp untuk baris kontak pandang di timeline. Keduanya daftar
    // jarang (puluhan per sesi), bukan data per frame, jadi aman disimpan.
    menundukSegmen: hasilFace.tersedia === true ? hasilFace.menundukSegmen : [],
    hilangSegmen: hasilFace.tersedia === true ? hasilFace.hilangSegmen : [],
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

  // Hitung Skor Total (0-100). Bernilai null bila metrik yang benar-benar
  // terukur terlalu sedikit untuk menghasilkan angka yang berarti.
  const rincianSkor = reportModule.hitungSkorRinci(dataSesiLengkap, state.analisisPosturAktif, CONFIG);
  dataSesiLengkap.skor = rincianSkor.skor;
  dataSesiLengkap.metrikHilang = rincianSkor.hilang;

  // TRANSKRIP: disimpan di memori saja, khusus untuk timeline Tahap 4B selama
  // Layar Rapor terbuka. Sengaja TIDAK dimasukkan ke dataSesiLengkap, kecuali
  // pengguna mencentang kotak penyimpanan transkrip di Layar Rapor.
  state.transkripSesi = hasilSpeech.potonganTranskrip;
  state.sesiTerakhir = dataSesiLengkap;

  // Kotak penyimpanan transkrip selalu kembali ke keadaan mati tiap sesi baru.
  // Tidak ada setelan "selalu simpan": menyimpan transkrip harus jadi keputusan
  // sadar untuk satu sesi tertentu.
  DOM.checkboxSimpanTranskrip.checked = false;
  DOM.statusSimpanTranskrip.textContent = '';
  DOM.statusSimpanTranskrip.style.color = '';

  cetakEventTimeline(dataSesiLengkap, hasilSpeech.potonganTranskrip);

  // Simpan ke storage (dengan proteksi jika storage penuh)
  const statusSimpan = storage.simpanSesi(dataSesiLengkap);
  state.sesiTerakhirTersimpan = statusSimpan.sukses === true;

  // Render Layar Rapor
  renderRaporUI(dataSesiLengkap, statusSimpan);
  tampilkanLayar('layar-rapor');
}

/**
 * Merender konten DOM Layar Rapor.
 */
function renderRaporUI(data, statusSimpan) {
  // Skor hanya ditampilkan bila benar-benar dihitung. Sesi yang kehilangan
  // terlalu banyak metrik menampilkan tanda hubung beserta alasannya, bukan
  // angka yang terlihat sama meyakinkannya dengan skor penuh.
  if (data.skor === null) {
    DOM.raporSkorAngka.textContent = '—';
    DOM.raporSkorAngka.classList.add('rapor-skor-angka--kosong');
    DOM.raporModeLabel.textContent = `Skor tidak ditampilkan — ${data.metrikHilang.join(', ')} tidak terukur di sesi ini`;
  } else {
    DOM.raporSkorAngka.classList.remove('rapor-skor-angka--kosong');
    animasiCountUp(DOM.raporSkorAngka, data.skor);
  }

  // Label mode, netral: menerangkan dari berapa metrik skor ini disusun.
  // Saat skornya tidak ada, label ini sudah diisi alasannya di atas.
  if (data.skor !== null) {
    const dasar = (data.metrikHilang && data.metrikHilang.length > 0)
      ? ` (tanpa ${data.metrikHilang.join(', ')})`
      : '';
    DOM.raporModeLabel.textContent = (data.mode === 'suara-saja')
      ? `Mode suara saja — dinilai dari kecepatan, kata pengisi, dan jeda${dasar}`
      : `Mode lengkap — dinilai dari kecepatan, kata pengisi, jeda, dan arah pandang${dasar}`;
  }

  // Kalimat ringkasan
  DOM.raporRingkasanTeks.textContent = reportModule.buatKalimatRingkasan(data, data.skor, CONFIG);

  // Kartu metrik
  // Kartu kecepatan bicara
  if (data.wpmTersedia) {
    DOM.raporWpmNilai.classList.remove('kartu-metrik__nilai--nonaktif');
    DOM.raporWpmNilai.textContent = data.wpmRata;
    let labelWpm = 'ideal';
    if (data.wpmRata < CONFIG.WPM_SLOW) labelWpm = 'pelan';
    else if (data.wpmRata > CONFIG.WPM_FAST) labelWpm = 'terlalu cepat';
    DOM.raporWpmLabel.textContent = `kecepatan ${labelWpm}`;
  } else {
    DOM.raporWpmNilai.classList.add('kartu-metrik__nilai--nonaktif');
    DOM.raporWpmNilai.textContent = 'belum aktif';
    DOM.raporWpmLabel.textContent = 'tidak ada ucapan yang tertangkap, jadi tidak ikut dihitung dalam skor';
  }

  // Kartu kata pengisi
  if (data.fillerTersedia) {
    DOM.raporFillerNilai.classList.remove('kartu-metrik__nilai--nonaktif');
    DOM.raporFillerNilai.textContent = `${data.filler.total}×`;
    DOM.raporFillerRincian.textContent = Object.entries(data.filler.rincian)
      .map(([k, v]) => `${k} (${v})`)
      .join(', ') || 'tidak ada kata pengisi dominan';
    DOM.raporFillerCatatan.style.display = '';
  } else {
    DOM.raporFillerNilai.classList.add('kartu-metrik__nilai--nonaktif');
    DOM.raporFillerNilai.textContent = 'belum aktif';
    DOM.raporFillerRincian.textContent = 'tidak ada ucapan yang tertangkap, jadi tidak ikut dihitung dalam skor';
    DOM.raporFillerCatatan.style.display = 'none';
  }

  // Kartu arah pandang punya dua wajah: angka terukur, atau penanda jujur
  // "belum aktif" lengkap dengan keterangan bahwa metrik ini tidak ikut dihitung.
  if (data.pandangTersedia) {
    DOM.raporPandangNilai.classList.remove('kartu-metrik__nilai--nonaktif');
    DOM.raporPandangNilai.textContent = `${Math.round(data.pandangPersen * 100)}%`;
    DOM.raporPandangKet.innerHTML =
      `wajah tak terlihat: <span id="rapor-wajah-hilang-nilai">${Math.round(data.wajahTakTerlihatPersen * 100)}%</span>`;
    // Keterbatasan hanya relevan bila metriknya memang terukur
    DOM.raporPandangCatatan.style.display = '';
  } else {
    DOM.raporPandangNilai.classList.add('kartu-metrik__nilai--nonaktif');
    DOM.raporPandangNilai.textContent = 'belum aktif';
    DOM.raporPandangKet.textContent = 'postur netral belum terukur atau model gagal dimuat, jadi tidak ikut dihitung dalam skor';
    DOM.raporPandangCatatan.style.display = 'none';
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

  // Kartu postur: selalu tampil dengan keadaan sebenarnya. Selama modulnya
  // masih stub, kartunya menyebut "belum aktif" dan bobotnya dialihkan, bukan
  // disembunyikan seolah metrik ini tidak pernah dijanjikan.
  if (data.postur.aktif) {
    DOM.raporPosturNilai.classList.remove('kartu-metrik__nilai--nonaktif');
    const kelasTeratas = Object.entries(data.postur.distribusi)
      .sort((x, y) => y[1] - x[1])[0];
    DOM.raporPosturNilai.textContent = kelasTeratas
      ? `${Math.round(kelasTeratas[1] * 100)}%`
      : 'belum aktif';
    DOM.raporPosturKet.textContent = kelasTeratas ? `terbanyak: ${kelasTeratas[0]}` : '';
  } else {
    DOM.raporPosturNilai.classList.add('kartu-metrik__nilai--nonaktif');
    DOM.raporPosturNilai.textContent = 'belum aktif';
    DOM.raporPosturKet.textContent = 'modul postur belum berjalan, jadi tidak ikut dihitung dalam skor';
  }

  // Lintasan sesi. Baris kecepatannya memakai deretWpm yang sama, jadi grafik
  // WPM yang dulu berdiri sendiri sudah dihapus, bukan dibiarkan berdampingan.
  // Transkrip dioper dari memori, bukan dari objek sesi: di Layar Rapor ia
  // selalu ada, terlepas dari apakah pengguna memilih menyimpannya ke riwayat.
  state.kendaliTimeline = timelineModule.render(DOM.timelineRapor, data, CONFIG, {
    wadahLegenda: DOM.timelineLegendaRapor,
    wadahPanel: DOM.timelinePanelRapor,
    transkrip: state.transkripSesi
  });
  const adaTimeline = Boolean(state.kendaliTimeline);
  DOM.timelineKosong.style.display = adaTimeline ? 'none' : 'block';
  if (!adaTimeline) {
    DOM.timelineKosong.textContent = 'Sesi ini terlalu singkat untuk menggambar lintasan waktu.';
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
 * Menyalakan atau mematikan penyimpanan transkrip untuk sesi yang baru selesai.
 *
 * CARA KERJA:
 * Sesinya sudah tersimpan lebih dulu tanpa transkrip. Saat kotak dicentang,
 * potongan transkrip yang masih ada di memori disisipkan ke objek sesi itu lalu
 * ditimpa ke localStorage; saat dilepas, field-nya dibuang dan ditimpa lagi.
 * Karena transkrip hidup di memori sampai pengguna meninggalkan Layar Rapor,
 * pilihan ini masih bisa diubah kapan pun selama rapor terbuka.
 *
 * Kuota penuh ditangani apa adanya: bila penyimpanan dengan transkrip ditolak,
 * sesinya dikembalikan ke bentuk tanpa transkrip supaya angkanya tetap ada di
 * riwayat, dan kotaknya dilepas kembali agar tampilan tidak mengklaim sesuatu
 * yang tidak tersimpan.
 */
function terapkanPilihanSimpanTranskrip() {
  const inginSimpan = DOM.checkboxSimpanTranskrip.checked;
  const sesi = state.sesiTerakhir;

  if (!sesi || !state.sesiTerakhirTersimpan) {
    DOM.statusSimpanTranskrip.textContent = 'Sesi ini tidak masuk riwayat, jadi transkripnya juga tidak bisa disimpan.';
    DOM.statusSimpanTranskrip.style.color = 'var(--bahaya)';
    DOM.checkboxSimpanTranskrip.checked = false;
    return;
  }

  if (inginSimpan) {
    sesi.potonganTranskrip = state.transkripSesi || [];
  } else {
    delete sesi.potonganTranskrip;
  }

  const hasil = storage.perbaruiSesi(sesi);

  if (hasil.sukses) {
    DOM.statusSimpanTranskrip.style.color = '';
    DOM.statusSimpanTranskrip.textContent = inginSimpan
      ? `Transkrip tersimpan bersama sesi ini (riwayat kini ${storage.perkiraanUkuranKb()} KB).`
      : 'Transkrip tidak disimpan. Riwayat hanya berisi angka.';
    return;
  }

  // Gagal menyimpan: kembalikan sesi ke bentuk tanpa transkrip
  delete sesi.potonganTranskrip;
  storage.perbaruiSesi(sesi);
  DOM.checkboxSimpanTranskrip.checked = false;
  DOM.statusSimpanTranskrip.style.color = 'var(--bahaya)';
  DOM.statusSimpanTranskrip.textContent = 'Transkrip tidak bisa disimpan: penyimpanan peramban penuh. Angka sesi ini tetap tersimpan.';
}

/**
 * Mencetak seluruh event bertimestamp sesi ke console untuk pemeriksaan manual.
 *
 * CARA KERJA:
 * Timeline Tahap 4B berdiri di atas empat daftar event yang dikumpulkan tiga
 * modul berbeda. Sebelum ada satu piksel pun yang digambar, isinya perlu
 * dicocokkan dengan apa yang benar-benar dilakukan pengguna. Fungsi ini
 * mencetak keempatnya beserta cap waktunya, dinyalakan lewat CONFIG.TIMELINE_DEBUG.
 *
 * Potongan transkrip ikut dicetak karena cap waktunyalah yang paling perlu
 * diperiksa: Web Speech memfinalkan kalimat beberapa saat setelah diucapkan.
 */
function cetakEventTimeline(data, potonganTranskrip) {
  if (!CONFIG.TIMELINE_DEBUG) return;

  const waktu = (d) => `${Math.floor(d / 60).toString().padStart(2, '0')}:${Math.round(d % 60).toString().padStart(2, '0')}`;

  console.log(`[timeline] sesi "${data.judul}" — mode ${data.mode}, durasi ${waktu(data.durasiDetik)}`);

  console.log(`[timeline] kata pengisi (${data.filler.events.length}):`);
  console.table(data.filler.events.map(e => ({ waktu: waktu(e.detik), detik: e.detik, kata: e.kata })));

  const jeda = data.jedaTersedia ? data.jeda.daftar : [];
  console.log(`[timeline] jeda panjang (${jeda.length}):`);
  console.table(jeda.map(j => ({ mulai: waktu(j.mulaiDetik), detik: j.mulaiDetik, durasi: j.durasiDetik })));

  console.log(`[timeline] segmen menunduk (${data.menundukSegmen.length}):`);
  console.table(data.menundukSegmen.map(s => ({ mulai: waktu(s.mulaiDetik), detik: s.mulaiDetik, durasi: s.durasiDetik })));

  console.log(`[timeline] segmen wajah tidak terlihat (${data.hilangSegmen.length}):`);
  console.table(data.hilangSegmen.map(s => ({ mulai: waktu(s.mulaiDetik), detik: s.mulaiDetik, durasi: s.durasiDetik })));

  console.log(`[timeline] kecepatan per potongan (${data.deretWpm.length}):`);
  console.table(data.deretWpm.map(d => ({ mulai: waktu(d.detikMulai), selesai: waktu(d.detikSelesai), wpm: d.wpm })));

  const potongan = potonganTranskrip || [];
  console.log(`[timeline] potongan transkrip (${potongan.length}), cap waktunya PERKIRAAN:`);
  console.table(potongan.map(p => ({ mulai: waktu(p.detikMulai), selesai: waktu(p.detikSelesai), teks: p.teks })));
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
    DOM.ringkasanSkorTerakhir.textContent = (info.skorTerakhir === null) ? '—' : info.skorTerakhir;
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
    DOM.grafikTrenKartu.style.display = 'none';
    return;
  }

  DOM.btnHapusSemuaSesi.style.display = 'inline-flex';

  // Grafik tren skor. Butuh minimal dua sesi: satu titik bukan tren, dan
  // menggambarnya hanya akan menyiratkan perbandingan yang belum ada.
  const bisaTren = daftar.length >= 2
    && reportModule.gambarGrafikTrenSkor(DOM.chartTrenSkor, daftar, 10);
  DOM.grafikTrenKartu.style.display = bisaTren ? 'block' : 'none';

  if (bisaTren) {
    // Skor dua mode tidak benar-benar sebanding; disebut apa adanya bila
    // riwayatnya memang bercampur, bukan disembunyikan.
    const modeYangAda = new Set(daftar.slice(0, 10).map(s => s.mode || 'tidak-tercatat'));
    DOM.grafikTrenCatatan.textContent = modeYangAda.size > 1
      ? 'Riwayat ini memuat lebih dari satu mode latihan. Skor mode suara saja dihitung dari tiga metrik, mode lengkap dari empat, jadi keduanya tidak sepenuhnya sebanding.'
      : '';
  }

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

    // Sesi lama (sebelum mode ada) tidak diberi label mode karena modenya
    // memang tidak diketahui; menebaknya akan jadi keterangan karangan.
    const labelMode = sesi.mode === 'suara-saja' ? ' • Mode suara saja'
      : sesi.mode === 'lengkap' ? ' • Mode lengkap'
      : '';

    const el = document.createElement('div');
    el.className = 'item-sesi';
    el.innerHTML = `
      <div class="item-sesi__info">
        <div class="item-sesi__judul">${sesi.judul}</div>
        <div class="item-sesi__meta">${tanggalFormat} • Durasi ${durasiStr} • WPM ${(typeof sesi.wpmRata === 'number') ? sesi.wpmRata : '—'} • Filler ${(typeof sesi.filler.total === 'number') ? sesi.filler.total + '×' : '—'}${labelMode}</div>
      </div>
      <div class="item-sesi__aksi">
        <div class="item-sesi__skor">${(typeof sesi.skor === 'number') ? sesi.skor : '—'}</div>
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
  DOM.btnKalibrasiPostur.addEventListener('click', kalibrasiPosturKepala);

  // Mode dicatat begitu dipilih supaya hierarki tombol langsung menyesuaikan
  [DOM.modeLengkap, DOM.modeSuaraSaja].forEach(radio => {
    radio.addEventListener('change', () => {
      state.modeSesi = DOM.modeSuaraSaja.checked ? 'suara-saja' : 'lengkap';
      perbaruiHirarkiMulaiSesi();
    });
  });
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
  DOM.checkboxSimpanTranskrip.addEventListener('change', terapkanPilihanSimpanTranskrip);

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
  // Kotak privasi harus menyebut penerima audio yang sebenarnya. Menyebut
  // layanan Chrome kepada pengguna Safari adalah pernyataan palsu di tempat
  // produk ini membuat klaim terkuatnya.
  DOM.privasiLayananSuara.textContent = browserModule.kalimatPrivasiSuara();

  temaModule.init(DOM.btnTema);
  initEventListeners();
  tampilkanLayar('layar-beranda');
});
