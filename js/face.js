/**
 * ============================================================================
 * MODUL ANALISIS WAJAH & ARAH PANDANG (FACE) - PODIUM
 * ============================================================================
 * File: js/face.js
 *
 * Memakai MediaPipe Tasks Vision (FaceLandmarker dengan blendshapes) untuk
 * mengukur berapa besar porsi waktu pengguna menatap ke depan, dan seberapa
 * sering wajahnya keluar dari jangkauan kamera.
 *
 * ----------------------------------------------------------------------------
 * CARA KERJA SINGKAT
 * ----------------------------------------------------------------------------
 * FaceLandmarker mengembalikan tiga hal yang dipakai modul ini: titik-titik
 * wajah, sekumpulan "blendshape" (nilai 0..1 untuk tiap ekspresi), dan sebuah
 * matriks transformasi 4x4 yang menyatakan posisi serta ROTASI kepala di ruang
 * tiga dimensi.
 *
 * Arah pandang diputuskan dari SUDUT KEPALA ATAS-BAWAH (pitch) yang diambil dari
 * matriks itu. Pitch dibandingkan dengan POSISI NETRAL pengguna yang diukur di
 * Layar Persiapan, bukan dengan angka mutlak: kamera laptop berada di bawah
 * garis mata, sehingga menatap kamera pun sudah menghasilkan pitch negatif
 * (sekitar -10 derajat pada laptop penguji). Bila pitch turun lebih dari
 * CONFIG.FACE_PITCH_MENUNDUK_DERAJAT di bawah netral, frame itu dihitung menunduk.
 *
 * Blendshape masih dibaca, tetapi sejak 22 September 2026 hanya untuk
 * ditampilkan di mode debug; tidak ada satu angka pun yang bergantung padanya.
 *
 * ----------------------------------------------------------------------------
 * ATURAN PEMBAGI (Bagian 6.1 GEMINI.md + CLAUDE.md)
 * ----------------------------------------------------------------------------
 * Frame yang wajahnya TIDAK terdeteksi dikeluarkan dari pembagi persentase
 * kontak pandang, bukan dihitung sebagai menunduk. Menutup kamera atau keluar
 * dari bingkai bukan berarti menunduk, dan menghitungnya begitu akan menghukum
 * pengguna untuk sesuatu yang tidak pernah diukur. Kejadian itu dilaporkan
 * terpisah lewat wajahTakTerlihatPersen.
 *
 * ----------------------------------------------------------------------------
 * TEMUAN UJI 16 SEPTEMBER 2026: eyeLookDown ADALAH FITUR YANG SALAH
 * ----------------------------------------------------------------------------
 * Sampai commit 831eb52 modul ini memutuskan menunduk dari rata-rata blendshape
 * eyeLookDownLeft/Right, mengikuti spesifikasi awal di GEMINI.md. Uji lapangan
 * membuktikan fitur itu salah pilih, bukan salah ambang.
 *
 * eyeLookDown mengukur posisi BOLA MATA RELATIF TERHADAP KEPALA, bukan arah
 * kepala. Akibatnya dua kesalahan berlawanan muncul:
 * 1. Saat kepala menunduk membaca kertas, bola mata justru bergulir ke atas
 *    relatif terhadap kepala agar tetap melihat kertas, sehingga eyeLookDown
 *    MENGECIL. Pada uji 16 September 2026, sepuluh detik membaca kertas
 *    menghasilkan eyeLookDown 0.01-0.37 yang tidak pernah melewati ambang 0.5;
 *    membaca catatan akan selalu tercatat "menatap depan".
 * 2. Saat kepala mendongak sementara mata tetap menatap layar, bola mata
 *    berputar ke bawah relatif terhadap kepala, eyeLookDown MEMBESAR, dan
 *    mendongak tercatat sebagai menunduk.
 *
 * Angka uji yang sama (rata-rata per detik, satu pengguna, kamera laptop):
 *   kepala tegak menatap kamera : pitch  -8.2 s/d -11.1 derajat
 *   kepala tegak, mata ke bawah : pitch  -6.9 s/d  -8.9 derajat
 *   kepala menunduk ke kertas   : pitch -24.0 s/d -28.3 derajat
 *   kepala tegak, mata ke atas  : pitch  -7.0 s/d  -9.3 derajat
 *
 * Pitch kepala memisahkan gerakan kepala dari gerakan mata dengan bersih:
 * gerakan mata saja menggesernya kurang dari 3 derajat, sementara menunduk
 * menggesernya sekitar 16 derajat. Perkiraan pitch dari posisi hidung terhadap
 * garis mata juga diuji dan DITOLAK: nilainya ikut berubah saat hanya mata yang
 * bergerak, dan celah antar-posenya cuma 0.004.
 *
 * Karena pitch bertanda, mendongak menggerakkan nilainya ke arah yang
 * BERLAWANAN dengan ambang menunduk, sehingga kesalahan nomor 2 mustahil
 * terjadi lagi. eyeLookDown tidak bisa begitu: ia nilai 0..1 tanpa tanda.
 *
 * KONSEKUENSI YANG DIAKUI JUJUR: melirik catatan dengan mata saja, tanpa
 * menggerakkan kepala, TIDAK terhitung menunduk. Yang diukur adalah arah kepala.
 * Keterbatasan ini disebutkan di kartu rapor, bukan disembunyikan.
 *
 * ----------------------------------------------------------------------------
 * TEMUAN UJI 16 SEPTEMBER 2026: WAJAH HILANG SAAT MENUNDUK DALAM
 * ----------------------------------------------------------------------------
 * MediaPipe kehilangan wajah pada sudut menunduk yang ekstrem. Pada uji yang
 * sama, menunduk membaca kertas (-28 derajat) masih terdeteksi penuh, tetapi
 * menunduk lebih dalam membuat wajah hilang, dan pitch terakhir sebelum tiap
 * kehilangan selalu sudah dalam: -21, -28, dan -26 derajat.
 *
 * Karena itu frame tanpa wajah TIDAK diperlakukan sama rata:
 * - Hilang saat status stabil sedang 'menunduk' dihitung sebagai MENUNDUK,
 *   paling lama CONFIG.FACE_HILANG_MENUNDUK_MAKS_DETIK. Penyebab realistis
 *   satu-satunya adalah kepala menunduk lebih dalam.
 * - Hilang saat status sedang 'depan' tetap dilaporkan "wajah tidak terlihat":
 *   itu kasus menutup kamera atau keluar dari bingkai.
 * - Batas waktu tadi ada supaya orang yang melirik catatan lalu PERGI dari meja
 *   tidak tercatat menunduk berkepanjangan.
 * Tanpa aturan ini, kebiasaan terburuk (menunduk dalam membaca catatan) justru
 * membuat persentase kontak pandang terlihat lebih bagus, karena frame tanpa
 * wajah dikeluarkan dari pembagi.
 *
 * ----------------------------------------------------------------------------
 * TEMUAN UJI 15 SEPTEMBER 2026: KEDIPAN TERBACA SEBAGAI MENUNDUK
 * ----------------------------------------------------------------------------
 * Uji manual Tahap 2 menunjukkan pola yang konsisten: menatap ke depan dengan
 * mata terbuka tidak pernah terdaftar menunduk, tetapi begitu mata ditutup
 * sejenak lalu dibuka, frame itu langsung terdaftar menunduk. Pencahayaan
 * bukan faktornya.
 *
 * Penyebabnya: blendshape eyeLookDownLeft/Right IKUT NAIK saat kelopak mata
 * menutup. Dari sudut pandang model, kelopak yang turun menutupi bola mata
 * terlihat mirip dengan bola mata yang bergulir ke bawah. Karena itu kedipan
 * harus disaring sebelum arah pandang diputuskan.
 *
 * ----------------------------------------------------------------------------
 * TEMUAN UJI 22 SEPTEMBER 2026: SARINGAN KEDIPAN DICABUT
 * ----------------------------------------------------------------------------
 * Saringan kedipan dipertahankan sementara sesudah modul pindah ke pitch, dengan
 * catatan agar dibuang bila uji menunjukkannya tidak perlu. Ujinya sudah ada, dan
 * jawabannya dua kali "tidak perlu":
 *
 * 1. SARINGANNYA MERUSAK. Pada sesi uji, membaca kertas selama sekitar sepuluh
 *    detik menghasilkan rentetan frame bertanda KEDIP selama hampir tujuh detik
 *    berturut-turut, dengan nilai eyeBlink 0,42-0,65. Tidak ada manusia yang
 *    berkedip tujuh detik: itu kelopak mata yang memang turun karena pandangan
 *    diarahkan ke bawah. Akibatnya sekitar dua pertiga waktu menunduk yang
 *    sungguhan DIBUANG dari pembagi, dan kontak pandang terlihat lebih baik
 *    daripada kenyataannya. Persis jenis kesalahan yang dilarang CLAUDE.md.
 * 2. SARINGANNYA TIDAK DIBUTUHKAN LAGI. Ia ada karena eyeLookDown ikut naik saat
 *    kelopak menutup. Modul ini tidak memakai eyeLookDown lagi. Sudut kepala
 *    diambil dari matriks transformasi, dan log uji menunjukkan pitch sama sekali
 *    tidak terganggu kedipan:
 *      t=23,6 (biasa) pitch -25,0 | t=23,7 KEDIP -24,1 | t=24,0 KEDIP -24,0
 *      t=27,6 (biasa) pitch -22,8
 *    Tidak ada lompatan. Frame berkedip tetap memberi sudut kepala yang benar.
 *
 * Karena itu seluruh frame berwajah kini dinilai dari pitch-nya, tanpa kecuali.
 * Nilai eyeBlink masih dibaca dan dicetak di mode debug sebagai bahan rujukan,
 * tetapi tidak lagi memengaruhi satu angka pun.
 *
 * Dua perbaikan diterapkan waktu itu: menyaring frame berkedip, dan penghalusan
 * temporal. Yang kedua bertahan. Yang pertama SUDAH DICABUT — lihat di bawah.
 *
 * PENGHALUSAN TEMPORAL. Status depan/menunduk hanya berganti setelah
 * CONFIG.FACE_SMOOTHING_FRAMES frame berturut-turut konsisten. Ini menangani
 * frame meleset karena gerak cepat atau blur.
 *
 * Risiko yang harus diawasi saat kalibrasi: saat benar-benar menunduk membaca
 * catatan, kelopak mata ikut turun sehingga eyeBlink juga naik. Ambang kedip
 * yang terlalu rendah akan menyaring menunduk sungguhan sebagai kedipan.
 *
 * ----------------------------------------------------------------------------
 * CATATAN SEJARAH (jangan dihapus)
 * ----------------------------------------------------------------------------
 * Sampai commit 6fe98e0 (12 September 2026) modul ini mengarang data: sebuah
 * setInterval mencatat SETIAP frame sebagai "menatap depan" tanpa pernah
 * menyentuh kamera, sehingga kontak pandang selalu 100% dan skor total
 * terdongkrak angka yang tidak pernah diukur. Modul lalu dilumpuhkan sampai
 * implementasi asli ini siap. Pola kegagalan itu yang melahirkan aturan
 * "modul tidak boleh mengembalikan angka karangan" di CLAUDE.md.
 *
 * Antarmuka standar sesuai kontrak di CLAUDE.md:
 * loadModel() / isReady() / start() / pause() / resume() / stop() / getResults()
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// SUMBER MODEL
// Versi dipatok agar pembaruan CDN tidak diam-diam mengubah perilaku. Ketiganya
// sudah diverifikasi ada pada 14 September 2026.
// ----------------------------------------------------------------------------
const VERSI_TASKS_VISION = '0.10.14';
const URL_BUNDLE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSI_TASKS_VISION}/vision_bundle.mjs`;
const URL_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSI_TASKS_VISION}/wasm`;
const URL_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// Nama blendshape yang dibutuhkan, kini hanya untuk menyaring kedipan. Nama ini
// berasal dari berkas model, bukan dari pustaka JS, jadi tidak bisa diverifikasi
// sebelum model benar-benar dimuat. Bila tidak ditemukan, modul menolak
// melaporkan angka alih-alih menebak (lihat blendshapeTersedia di bawah).
const NAMA_BLINK = ['eyeBlinkLeft', 'eyeBlinkRight'];

// ----------------------------------------------------------------------------
// STATE MODUL
// ----------------------------------------------------------------------------
let landmarker = null;
let tersedia = false;              // Model benar-benar dimuat dan siap
let blendshapeTersedia = true;     // Nama blendshape yang dibutuhkan ditemukan
let sedangMemuat = null;           // Promise pemuatan, mencegah pemuatan ganda
let intervalId = null;

// Status siklus hidup: 'berjalan' | 'dijeda' | 'berhenti'
let status = 'berhenti';

// Penghitung frame sesi
let totalFrameDianalisis = 0;
let frameMenatapDepan = 0;
let frameMenunduk = 0;
let frameWajahTakTerlihat = 0;
let frameHilangDihitungMenunduk = 0; // Frame tanpa wajah yang diatribusikan ke menunduk

// Posisi kepala netral pengguna (derajat), diukur di Layar Persiapan.
// null berarti belum dikalibrasi; selama null, arah pandang TIDAK dilaporkan.
let pitchNetral = null;

// Pelacak kehilangan wajah (lihat tanganiWajahHilang)
let hilangMulaiDetik = null;
let statusSaatHilang = null;

// Penghalusan temporal (lihat terapkanPenghalusan)
let statusStabil = null;           // null | 'depan' | 'menunduk'
let kandidat = null;               // Status mentah yang sedang "mengantre" untuk menggantikan statusStabil
let kandidatJumlah = 0;            // Jumlah frame berturut-turut milik kandidat, belum masuk penghitung
let kandidatMulaiDetik = null;     // Kapan deretan kandidat dimulai

// Segmen menunduk panjang sebagai event bertimestamp (untuk timeline Tahap 4B)
let menundukSegmen = [];           // [{ mulaiDetik, durasiDetik }]
let menundukMulaiDetik = null;     // Penanda segmen menunduk yang sedang berjalan

// Segmen "wajah tidak terlihat" sebagai event bertimestamp. Sampai Tahap 4B,
// kejadian ini hanya dilaporkan sebagai persentase; baris kontak pandang di
// timeline butuh tahu KAPAN-nya, bukan cuma berapa banyak. Yang dicatat di sini
// hanya bagian yang benar-benar dihitung "tidak terlihat": waktu yang sudah
// diatribusikan ke menunduk (di dalam kap) tidak masuk sini, supaya satu momen
// tidak pernah muncul di dua baris sekaligus.
let hilangSegmen = [];             // [{ mulaiDetik, durasiDetik }]
let hilangTakTerlihatMulai = null;

// Elemen video sumber frame, dan penjaga agar frame yang sama tidak diproses dua kali
let videoSumber = null;
let waktuVideoTerakhir = -1;
let timestampTerakhir = 0;

// Konfigurasi aktif
const KONFIG_BAWAAN = {
  FACE_PITCH_MENUNDUK_DERAJAT: 8,
  FACE_KALIBRASI_MS: 2000,
  FACE_KALIBRASI_MIN_RASIO: 0.6,
  FACE_HILANG_MENUNDUK_MAKS_DETIK: 5,
  FACE_SMOOTHING_FRAMES: 3,
  FACE_POLL_INTERVAL_MS: 150,
  MENUNDUK_EVENT_MIN_DETIK: 3,
  FACE_DEBUG: false
};
let konfig = { ...KONFIG_BAWAAN };
let sudahCetakDaftarBlendshape = false;

let callbacksEksternal = {
  onGazeUpdate: null // 'depan' | 'menunduk' | 'tidak terlihat' | 'belum aktif'
};

// ----------------------------------------------------------------------------
// JAM SESI: berjalan hanya saat status 'berjalan', sehingga cap waktu segmen
// menunduk berarti "detik ke sekian sejak sesi dimulai, tanpa menghitung jeda".
// Pola yang sama dipakai di js/speech.js.
// ----------------------------------------------------------------------------
let waktuMulaiSegmenJam = null;
let detikSegmenSelesai = 0;

function detikSesiSekarang() {
  const berjalan = (waktuMulaiSegmenJam !== null)
    ? (Date.now() - waktuMulaiSegmenJam) / 1000
    : 0;
  return detikSegmenSelesai + berjalan;
}

function tutupSegmenJam() {
  if (waktuMulaiSegmenJam === null) return;
  detikSegmenSelesai += (Date.now() - waktuMulaiSegmenJam) / 1000;
  waktuMulaiSegmenJam = null;
}

/**
 * Memeriksa apakah model siap dipakai.
 *
 * CARA KERJA:
 * Dua syarat digabung: saklar `tersedia` menyala DAN objek landmarker benar-benar
 * terbentuk. Digabung supaya mustahil ada jalur kode yang menganggap modul siap
 * padahal modelnya kosong.
 */
export function isReady() {
  return Boolean(tersedia && landmarker);
}

/**
 * Memuat MediaPipe Tasks Vision dan model Face Landmarker secara lazy.
 *
 * CARA KERJA:
 * 1. Mengimpor bundle Tasks Vision dari CDN lewat import dinamis, jadi berkasnya
 *    baru diunduh saat pengguna benar-benar akan berlatih, bukan saat halaman dibuka.
 * 2. FilesetResolver mengunduh berkas WebAssembly yang menjalankan inferensinya.
 *    Seluruh pemrosesan terjadi di perangkat; tidak ada frame yang dikirim ke mana pun.
 * 3. Membuat FaceLandmarker dengan runningMode 'VIDEO' (dioptimalkan untuk aliran
 *    frame berurutan), numFaces 1, dan outputFaceBlendshapes true karena nilai
 *    blendshape itulah yang dipakai menentukan arah pandang.
 * 4. Mencoba delegate GPU lebih dulu, lalu jatuh ke CPU bila perangkat menolak.
 *    Tanpa jalur mundur ini, laptop tanpa akselerasi grafis akan gagal total.
 *
 * Pemanggilan berulang aman: promise pemuatan disimpan dan dipakai ulang.
 *
 * @returns {Promise<boolean>} True bila model siap dipakai
 */
export async function loadModel() {
  if (isReady()) return true;
  if (sedangMemuat) return sedangMemuat;

  sedangMemuat = (async () => {
    try {
      const { FilesetResolver, FaceLandmarker } = await import(URL_BUNDLE);
      const berkasVisi = await FilesetResolver.forVisionTasks(URL_WASM);

      const opsiDasar = (delegate) => ({
        baseOptions: { modelAssetPath: URL_MODEL, delegate },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        // DIAGNOSTIK SEMENTARA (15 September 2026): dinyalakan untuk mengukur
        // rotasi kepala (pitch) sebagai pembanding eyeLookDown. Belum dipakai
        // untuk keputusan apa pun.
        outputFacialTransformationMatrixes: true
      });

      try {
        landmarker = await FaceLandmarker.createFromOptions(berkasVisi, opsiDasar('GPU'));
      } catch (galatGpu) {
        console.warn('Face Landmarker: GPU ditolak perangkat, beralih ke CPU.', galatGpu);
        landmarker = await FaceLandmarker.createFromOptions(berkasVisi, opsiDasar('CPU'));
      }

      tersedia = true;
      return true;
    } catch (err) {
      console.error('Gagal memuat Face Landmarker:', err);
      landmarker = null;
      tersedia = false;
      return false;
    } finally {
      sedangMemuat = null;
    }
  })();

  return sedangMemuat;
}

/**
 * Menghitung sudut kepala atas-bawah (pitch) dan kiri-kanan (yaw) dari matriks
 * transformasi wajah, dalam derajat.
 *
 * CARA KERJA:
 * MediaPipe mencocokkan model wajah tiga dimensi ke wajah yang terlihat, lalu
 * mengembalikan matriks 4x4 berisi rotasi dan posisinya terhadap kamera. Kolom
 * ketiga matriks rotasi adalah SUMBU DEPAN wajah, yaitu ke mana wajah menghadap.
 * Komponen tegaknya (y) langsung memberi pitch lewat arcsin, dan komponen
 * mendatarnya (x) memberi yaw.
 *
 * Tata letak data matriks (kolom dulu atau baris dulu) tidak diasumsikan,
 * melainkan dideteksi dari letak komponen translasi z. Nilai itu selalu jauh
 * dari nol karena wajah berada puluhan sentimeter dari kamera, sehingga
 * posisinya menunjukkan tata letak yang sebenarnya dipakai pustaka.
 *
 * Nilai pitch di sini MUTLAK terhadap kamera, belum dikurangi posisi netral.
 *
 * @returns {{pitch: number, yaw: number}|null} null bila matriks tidak tersedia
 */
function hitungSudutKepala(hasil) {
  const m = hasil && hasil.facialTransformationMatrixes && hasil.facialTransformationMatrixes[0];
  if (!m || !m.data || m.data.length !== 16) return null;

  const d = m.data;
  const kolomDulu = Math.abs(d[14]) > Math.abs(d[11]);
  const fx = kolomDulu ? d[8] : d[2];
  const fy = kolomDulu ? d[9] : d[6];
  const derajat = (r) => Math.asin(Math.max(-1, Math.min(1, r))) * 180 / Math.PI;

  return { pitch: derajat(fy), yaw: derajat(fx) };
}

/**
 * Mengukur posisi kepala netral pengguna di Layar Persiapan.
 *
 * CARA KERJA:
 * 1. Selama CONFIG.FACE_KALIBRASI_MS (awal 2 detik), pitch dibaca dari preview
 *    kamera sementara pengguna diminta menatap kamera dengan posisi duduk wajar.
 * 2. Netral diambil dari MEDIAN sampel, bukan rata-rata, supaya satu gerakan
 *    kepala sesaat tidak menggeser titik acuan seluruh sesi.
 * 3. Seluruh keputusan menunduk nantinya memakai SELISIH terhadap netral ini.
 *    Kalibrasi ulang diperlukan bila pengguna memindahkan laptop atau berganti
 *    posisi duduk, dan itulah gunanya tombol "Kalibrasi ulang postur".
 * 4. Bila wajah terdeteksi pada kurang dari CONFIG.FACE_KALIBRASI_MIN_RASIO
 *    bagian jendela pengukuran (kamera menghadap langit-langit, pengguna di luar
 *    bingkai, lensa tertutup), pengukuran DIGAGALKAN dengan alasan
 *    'wajah-tidak-terdeteksi' dan netral dibiarkan null. Acuan tidak pernah
 *    disimpan sebagian.
 *
 * Nilai netral lama selalu dibuang lebih dulu, supaya kalibrasi ulang yang gagal
 * tidak diam-diam memakai acuan dari posisi duduk sebelumnya.
 *
 * @param {HTMLVideoElement} videoElement - Preview kamera di Layar Persiapan
 * @param {Object} config - Objek CONFIG dari app.js
 * @returns {Promise<{berhasil: boolean, pitchNetral: number|null, jumlahSampel: number}>}
 */
export function kalibrasiPostur(videoElement, config = {}) {
  const k = { ...KONFIG_BAWAAN, ...config };
  pitchNetral = null;

  return new Promise((selesai) => {
    if (!isReady() || !videoElement) {
      selesai({ berhasil: false, alasan: 'model-belum-siap', pitchNetral: null, jumlahSampel: 0 });
      return;
    }

    const sampel = [];
    const idInterval = setInterval(() => {
      if (videoElement.readyState < 2 || !videoElement.videoWidth) return;

      const timestamp = Math.max(performance.now(), timestampTerakhir + 1);
      timestampTerakhir = timestamp;

      let hasil = null;
      try {
        hasil = landmarker.detectForVideo(videoElement, timestamp);
      } catch (err) {
        return;
      }

      if (!hasil || !hasil.faceLandmarks || hasil.faceLandmarks.length === 0) return;
      const sudut = hitungSudutKepala(hasil);
      if (sudut) sampel.push(sudut.pitch);
    }, 100);

    setTimeout(() => {
      clearInterval(idInterval);

      // Wajah harus terdeteksi di sebagian besar jendela pengukuran. Kamera yang
      // mengarah ke langit-langit tetap menghasilkan beberapa frame berwajah
      // secara kebetulan, dan median dari segelintir sampel itu akan jadi acuan
      // yang salah untuk seluruh sesi. Karena itu yang diperiksa bukan "ada
      // sampel", melainkan "cukup banyak sampel dibanding yang seharusnya".
      const diharapkan = Math.max(1, Math.floor(k.FACE_KALIBRASI_MS / 100));
      if (sampel.length < diharapkan * k.FACE_KALIBRASI_MIN_RASIO) {
        selesai({
          berhasil: false,
          alasan: 'wajah-tidak-terdeteksi',
          pitchNetral: null,
          jumlahSampel: sampel.length,
          jumlahDiharapkan: diharapkan
        });
        return;
      }

      const urut = sampel.slice().sort((a, b) => a - b);
      const tengah = Math.floor(urut.length / 2);
      pitchNetral = (urut.length % 2 === 0)
        ? (urut[tengah - 1] + urut[tengah]) / 2
        : urut[tengah];

      if (k.FACE_DEBUG) {
        console.log(
          `[face] postur netral: ${sampel.length} sampel, ` +
          `min=${urut[0].toFixed(1)}° median=${pitchNetral.toFixed(1)}° maks=${urut[urut.length - 1].toFixed(1)}°`
        );
      }

      selesai({ berhasil: true, alasan: null, pitchNetral, jumlahSampel: sampel.length, jumlahDiharapkan: diharapkan });
    }, k.FACE_KALIBRASI_MS);
  });
}

/**
 * Memulai analisis arah pandang dari nol.
 *
 * CARA KERJA:
 * Mengosongkan seluruh penghitung dan daftar segmen, menyalakan jam sesi, lalu
 * menjalankan loop inferensi berkala. Sesuai kontrak di CLAUDE.md, hanya fungsi
 * ini yang boleh mengosongkan akumulator.
 *
 * @param {Object} callbacks - { onGazeUpdate }
 * @param {HTMLVideoElement} videoElement - Sumber frame kamera sesi
 * @param {Object} config - Objek CONFIG dari app.js
 * @returns {boolean} True bila loop inferensi benar-benar berjalan
 */
export function start(callbacks = {}, videoElement = null, config = {}) {
  callbacksEksternal = { ...callbacksEksternal, ...callbacks };
  konfig = { ...KONFIG_BAWAAN, ...config };

  totalFrameDianalisis = 0;
  frameMenatapDepan = 0;
  frameMenunduk = 0;
  frameWajahTakTerlihat = 0;
  frameHilangDihitungMenunduk = 0;
  statusStabil = null;
  hilangMulaiDetik = null;
  statusSaatHilang = null;
  resetKandidat();
  diag.detik = -1;
  menundukSegmen = [];
  menundukMulaiDetik = null;
  hilangSegmen = [];
  hilangTakTerlihatMulai = null;
  waktuVideoTerakhir = -1;
  sudahCetakDaftarBlendshape = false;
  blendshapeTersedia = true;

  detikSegmenSelesai = 0;
  waktuMulaiSegmenJam = null;

  videoSumber = videoElement;

  // Tanpa posisi netral, selisih pitch tidak punya arti apa pun. Modul menolak
  // berjalan alih-alih memakai nol sebagai netral, karena kamera laptop membuat
  // posisi menatap kamera pun bernilai jauh dari nol.
  if (!isReady() || !videoSumber || pitchNetral === null) {
    status = 'berhenti';
    laporkanArah('belum aktif');
    return false;
  }

  status = 'berjalan';
  waktuMulaiSegmenJam = Date.now();
  jalankanLoopInferensi();
  return true;
}

/**
 * Menjeda inferensi tanpa membuang penghitung.
 *
 * CARA KERJA:
 * Jam sesi ditutup dan interval dilepas, sehingga tidak ada frame yang dicatat
 * selama jeda. Segmen menunduk yang sedang berjalan ditutup di sini, karena
 * membiarkannya terbuka akan membuat durasinya ikut menelan waktu jeda.
 * Frame kandidat yang belum dikonfirmasi diserahkan ke status stabil, lalu
 * status stabil dikosongkan: sesudah resume(), status harus dibangun ulang
 * dari frame baru, dan segmen menunduk bisa dibuka lagi dengan benar.
 */
export function pause() {
  if (status !== 'berjalan') return false;
  lepasKandidatKe(statusStabil);
  tutupSegmenMenunduk();
  tutupSegmenHilang();
  statusStabil = null;
  hilangMulaiDetik = null;
  statusSaatHilang = null;
  status = 'dijeda';
  tutupSegmenJam();
  hentikanLoopInferensi();
  return true;
}

/**
 * Melanjutkan inferensi dari penghitung yang sama.
 */
export function resume() {
  if (status !== 'dijeda') return false;
  status = 'berjalan';
  waktuMulaiSegmenJam = Date.now();
  waktuVideoTerakhir = -1; // paksa frame pertama sesudah jeda diproses
  jalankanLoopInferensi();
  return true;
}

/**
 * Menghentikan analisis secara total.
 *
 * Penghitung dan daftar segmen dibiarkan utuh agar getResults() masih bisa
 * dibaca Layar Rapor setelah sesi berakhir.
 *
 * Objek landmarker sengaja TIDAK dilepas di sini. Ia tidak memegang kamera
 * maupun mikrofon, hanya memori WebAssembly, sementara perangkat kerasnya sudah
 * dimatikan terpisah lewat matikanSemuaMedia() di app.js. Mempertahankannya
 * membuat sesi berikutnya mulai seketika tanpa mengunduh model lagi.
 */
export function stop() {
  if (status === 'berjalan') {
    lepasKandidatKe(statusStabil);
    tutupSegmenMenunduk();
    tutupSegmenHilang();
    statusStabil = null;
    hilangMulaiDetik = null;
    statusSaatHilang = null;
  }
  status = 'berhenti';
  tutupSegmenJam();
  hentikanLoopInferensi();
}

/**
 * Menjalankan loop inferensi berkala.
 *
 * CARA KERJA:
 * Interval dipilih ketimbang requestAnimationFrame karena laju sampling di sini
 * memang tidak perlu setinggi laju gambar layar. Sampling tiap
 * CONFIG.FACE_POLL_INTERVAL_MS sudah cukup halus untuk mengukur porsi waktu,
 * sekaligus menyisakan CPU untuk pengenalan suara yang berjalan bersamaan.
 */
function jalankanLoopInferensi() {
  hentikanLoopInferensi();
  intervalId = setInterval(prosesSatuFrame, konfig.FACE_POLL_INTERVAL_MS);
}

function hentikanLoopInferensi() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/**
 * Memproses satu frame kamera dan memperbarui seluruh penghitung.
 *
 * CARA KERJA:
 * 1. Berhenti bila status bukan 'berjalan' atau video belum punya gambar.
 * 2. Melewati frame yang isinya sama dengan frame sebelumnya. Kamera biasanya
 *    mengirim 30 gambar per detik sementara kita menyampel lebih sering dari
 *    itu; tanpa penjagaan ini, satu gambar yang sama akan dihitung berkali-kali
 *    dan membuat persentase condong ke keadaan yang kebetulan sedang berlangsung.
 * 3. Timestamp yang dikirim ke MediaPipe wajib selalu naik. Bila tidak, pustaka
 *    melempar galat dan loop berhenti diam-diam.
 * 4. Bila tidak ada wajah, frame dicatat sebagai "wajah tidak terlihat",
 *    segmen menunduk yang sedang berjalan ditutup, dan status stabil
 *    dikosongkan supaya dibangun ulang saat wajah kembali.
 * 5. Sudut kepala dibandingkan dengan postur netral untuk mendapat status MENTAH
 *    frame ini, lalu diserahkan ke penghalusan temporal yang memutuskan kapan
 *    status benar-benar berganti. Nilai kedipan masih dibaca, tetapi HANYA untuk
 *    ditampilkan di mode debug — lihat temuan 22 September 2026 di kepala berkas.
 */
function prosesSatuFrame() {
  if (status !== 'berjalan' || !landmarker || !videoSumber) return;
  if (videoSumber.readyState < 2 || !videoSumber.videoWidth) return;
  if (videoSumber.currentTime === waktuVideoTerakhir) return;
  waktuVideoTerakhir = videoSumber.currentTime;

  // MediaPipe menolak timestamp yang tidak naik, termasuk yang sama persis
  const sekarang = performance.now();
  const timestamp = Math.max(sekarang, timestampTerakhir + 1);
  timestampTerakhir = timestamp;

  let hasil = null;
  try {
    hasil = landmarker.detectForVideo(videoSumber, timestamp);
  } catch (err) {
    console.warn('Face Landmarker gagal memproses frame:', err);
    return;
  }

  totalFrameDianalisis++;

  const adaWajah = Boolean(hasil && hasil.faceLandmarks && hasil.faceLandmarks.length > 0);
  catatDiagnostik(hasil, adaWajah);

  const detik = detikSesiSekarang();

  if (!adaWajah) {
    tanganiWajahHilang(detik);
    return;
  }

  // Wajah kembali terlihat: segmen "tidak terlihat" ditutup, pelacak dikosongkan
  tutupSegmenHilang(detik);
  hilangMulaiDetik = null;
  statusSaatHilang = null;

  const kategori = (hasil.faceBlendshapes && hasil.faceBlendshapes[0])
    ? hasil.faceBlendshapes[0].categories
    : null;

  const kedipKiri = ambilBlendshape(kategori, NAMA_BLINK[0]);
  const kedipKanan = ambilBlendshape(kategori, NAMA_BLINK[1]);
  const sudut = hitungSudutKepala(hasil);

  // Bila blendshape kedipan atau matriks rotasi tidak ada, modul tidak boleh
  // menebak. Penanda ini membuat getResults() melaporkan dirinya tidak tersedia.
  if (kedipKiri === null || kedipKanan === null || sudut === null) {
    if (blendshapeTersedia) {
      blendshapeTersedia = false;
      console.error(
        'Face Landmarker: blendshape eyeBlinkLeft/Right atau matriks transformasi wajah tidak tersedia. ' +
        'Arah pandang tidak akan dilaporkan. Nama blendshape yang ada:',
        (kategori || []).map(k => k.categoryName)
      );
    }
    laporkanArah('belum aktif');
    return;
  }

  // Selisih terhadap posisi netral. Negatif berarti kepala lebih menunduk
  // daripada saat kalibrasi; mendongak membuatnya positif dan karena itu tidak
  // pernah bisa melewati ambang menunduk.
  const selisih = sudut.pitch - pitchNetral;
  const mentah = selisih < -konfig.FACE_PITCH_MENUNDUK_DERAJAT ? 'menunduk' : 'depan';
  terapkanPenghalusan(mentah, detik);

  cetakDebug(sudut, kedipKiri, kedipKanan, selisih,
    `mentah=${mentah} stabil=${statusStabil} kandidat=${kandidat}x${kandidatJumlah}`);
}

/**
 * Memutuskan arti satu frame yang wajahnya tidak terdeteksi.
 *
 * CARA KERJA:
 * Frame tanpa wajah punya dua arti yang sangat berbeda, dan yang membedakannya
 * adalah status tepat sebelum wajah hilang (lihat temuan uji di kepala berkas).
 *
 * 1. Hilang saat status 'menunduk': kepala menunduk lebih dalam sampai melewati
 *    batas sudut yang masih bisa dikenali MediaPipe. Frame dihitung MENUNDUK dan
 *    segmen menunduk dibiarkan terbuka, tetapi hanya sampai
 *    CONFIG.FACE_HILANG_MENUNDUK_MAKS_DETIK. Batas itu memisahkan "menunduk
 *    dalam" dari "meninggalkan meja setelah melirik catatan".
 * 2. Hilang saat status 'depan', atau sesudah batas waktu di atas terlampaui:
 *    frame dihitung sebagai "wajah tidak terlihat" seperti sebelumnya, dan
 *    dikeluarkan dari pembagi persentase.
 */
function tanganiWajahHilang(detik) {
  if (hilangMulaiDetik === null) {
    hilangMulaiDetik = detik;
    statusSaatHilang = statusStabil;
    lepasKandidatKe(statusStabil);
  }

  const batas = konfig.FACE_HILANG_MENUNDUK_MAKS_DETIK;
  const masihDalamBatas = (detik - hilangMulaiDetik) <= batas;

  if (statusSaatHilang === 'menunduk' && masihDalamBatas) {
    frameMenunduk++;
    frameHilangDihitungMenunduk++;
    laporkanArah('menunduk');
    return;
  }

  // Sesudah batas waktu, segmen menunduk ditutup pada detik batas itu, bukan
  // pada saat wajah akhirnya kembali, supaya durasinya tidak menelan waktu
  // pengguna meninggalkan meja.
  if (statusSaatHilang === 'menunduk') {
    // Bagian menunduk berakhir tepat di batas kap; dari detik itulah waktu
    // mulai dihitung sebagai "tidak terlihat".
    tutupSegmenMenunduk(hilangMulaiDetik + batas);
    if (hilangTakTerlihatMulai === null) hilangTakTerlihatMulai = hilangMulaiDetik + batas;
    statusSaatHilang = null;
    statusStabil = null;
  } else {
    if (statusStabil !== null) {
      tutupSegmenMenunduk();
      statusStabil = null;
    }
    if (hilangTakTerlihatMulai === null) hilangTakTerlihatMulai = hilangMulaiDetik;
  }

  frameWajahTakTerlihat++;
  laporkanArah('tidak terlihat');
}

/**
 * Menutup segmen "wajah tidak terlihat" yang sedang berjalan.
 *
 * CARA KERJA:
 * Sama seperti segmen menunduk, hanya kejadian yang bertahan minimal
 * CONFIG.MENUNDUK_EVENT_MIN_DETIK yang disimpan. Kehilangan sekejap terjadi
 * wajar saat pengguna bergerak cepat dan tidak berarti apa-apa bagi pembaca
 * timeline; menyimpannya hanya akan membuat baris kontak pandang penuh bercak.
 */
function tutupSegmenHilang(detikSelesai = detikSesiSekarang()) {
  if (hilangTakTerlihatMulai === null) return;

  const mulai = hilangTakTerlihatMulai;
  const durasi = detikSelesai - mulai;
  hilangTakTerlihatMulai = null;

  if (durasi >= konfig.MENUNDUK_EVENT_MIN_DETIK) {
    hilangSegmen.push({
      mulaiDetik: Math.round(mulai),
      durasiDetik: Math.round(durasi * 10) / 10
    });
  }
}

/**
 * Penghalusan temporal status arah pandang.
 *
 * CARA KERJA:
 * Modul memegang satu STATUS STABIL (depan atau menunduk) yang hanya boleh
 * berganti bila CONFIG.FACE_SMOOTHING_FRAMES frame berturut-turut sepakat.
 *
 * - Frame mentah SAMA dengan status stabil: frame dihitung untuk status stabil.
 *   Bila sebelumnya ada deretan kandidat yang belum cukup panjang, deretan itu
 *   dianggap frame meleset dan ikut dihitung sebagai status stabil.
 * - Frame mentah BERBEDA dari status stabil: frame masuk antrean kandidat dan
 *   BELUM dihitung ke mana pun.
 * - Begitu antrean kandidat mencapai jumlah frame yang disyaratkan, status
 *   stabil berganti, dan SELURUH frame antrean dihitung untuk status baru.
 *   Frame-frame itu memang sudah berada di status baru sejak awal antrean, jadi
 *   tidak ada waktu yang salah dikreditkan akibat penundaan konfirmasi.
 * - Segmen menunduk dibuka dan ditutup pada detik AWAL antrean yang
 *   mengonfirmasi pergantian, bukan saat konfirmasi, supaya durasi event di
 *   timeline tidak bergeser sebesar penundaan penghalusan.
 *
 *
 * @param {'depan'|'menunduk'} mentah - Keputusan dari frame ini saja
 * @param {number} detik - Posisi jam sesi saat frame ini dibaca
 */
function terapkanPenghalusan(mentah, detik) {
  if (mentah === statusStabil) {
    lepasKandidatKe(statusStabil);
    tambahFrame(statusStabil, 1);
    return;
  }

  if (mentah !== kandidat) {
    lepasKandidatKe(statusStabil);
    kandidat = mentah;
    kandidatMulaiDetik = detik;
  }
  kandidatJumlah++;

  const syarat = Math.max(1, Math.round(konfig.FACE_SMOOTHING_FRAMES));
  if (kandidatJumlah < syarat) return;

  const statusLama = statusStabil;
  const mulaiBaru = kandidatMulaiDetik;
  statusStabil = kandidat;
  tambahFrame(statusStabil, kandidatJumlah);
  resetKandidat();

  if (statusStabil === 'menunduk') {
    menundukMulaiDetik = mulaiBaru;
  } else if (statusLama === 'menunduk') {
    tutupSegmenMenunduk(mulaiBaru);
  }

  laporkanArah(statusStabil);
}

/**
 * Menyerahkan frame antrean kandidat ke sebuah status, lalu mengosongkan antrean.
 * Bila statusnya null (status stabil belum terbentuk, misalnya di awal sesi),
 * frame antrean dibuang: tanpa status yang disepakati, frame itu tidak bisa
 * dinilai dan karenanya dikeluarkan dari pembagi.
 */
function lepasKandidatKe(statusTujuan) {
  if (kandidatJumlah > 0 && statusTujuan) tambahFrame(statusTujuan, kandidatJumlah);
  resetKandidat();
}

function resetKandidat() {
  kandidat = null;
  kandidatJumlah = 0;
  kandidatMulaiDetik = null;
}

function tambahFrame(statusFrame, jumlah) {
  if (statusFrame === 'menunduk') frameMenunduk += jumlah;
  else if (statusFrame === 'depan') frameMenatapDepan += jumlah;
}

/**
 * Mengambil nilai satu blendshape berdasarkan namanya.
 * Mengembalikan null bila namanya tidak ada, supaya pemanggil bisa membedakan
 * "bernilai nol" dari "tidak tersedia".
 */
function ambilBlendshape(kategori, nama) {
  if (!Array.isArray(kategori)) return null;
  for (const k of kategori) {
    if (k.categoryName === nama) return k.score;
  }
  return null;
}

/**
 * Menutup segmen menunduk yang sedang berjalan dan mencatatnya bila cukup panjang.
 *
 * CARA KERJA:
 * Hanya segmen yang bertahan minimal CONFIG.MENUNDUK_EVENT_MIN_DETIK yang
 * disimpan. Menunduk sekejap adalah bagian wajar dari berbicara, sedangkan
 * menunduk beberapa detik penuh menandakan pengguna sedang membaca catatan.
 * Penyaringan ini juga yang menjaga daftar event tetap jarang, puluhan per sesi,
 * sesuai aturan "agregat, bukan data per frame" di CLAUDE.md.
 */
function tutupSegmenMenunduk(detikSelesai = detikSesiSekarang()) {
  if (menundukMulaiDetik === null) return;

  const mulai = menundukMulaiDetik;
  const durasi = detikSelesai - mulai;
  menundukMulaiDetik = null;

  if (durasi >= konfig.MENUNDUK_EVENT_MIN_DETIK) {
    menundukSegmen.push({
      mulaiDetik: Math.round(mulai),
      durasiDetik: Math.round(durasi * 10) / 10
    });
  }
}

function laporkanArah(arah) {
  if (typeof callbacksEksternal.onGazeUpdate === 'function') {
    callbacksEksternal.onGazeUpdate(arah);
  }
}

/**
 * Mode debug untuk kalibrasi ambang.
 *
 * CARA KERJA:
 * Sekali di awal, mencetak seluruh nama blendshape yang benar-benar dikirim
 * model, supaya bisa dipastikan nama yang dipakai modul ini memang ada. Setelah
 * itu mencetak pitch kepala, selisihnya terhadap netral, dan keputusan
 * penghalusannya, sehingga CONFIG.FACE_PITCH_MENUNDUK_DERAJAT dan
 * CONFIG.FACE_SMOOTHING_FRAMES bisa ditetapkan dari angka nyata di laptop
 * pengguna, bukan dari tebakan. Nilai kedipan ikut dicetak sebagai rujukan,
 * tetapi sejak 22 September 2026 ia tidak memengaruhi perhitungan apa pun.
 */
function cetakDebug(sudut, kedipKiri, kedipKanan, selisih, keputusan) {
  if (!konfig.FACE_DEBUG) return;

  if (!sudahCetakDaftarBlendshape) {
    sudahCetakDaftarBlendshape = true;
    console.log(`[face] netral=${pitchNetral === null ? 'belum diukur' : pitchNetral.toFixed(1) + '°'}, ambang menunduk=${konfig.FACE_PITCH_MENUNDUK_DERAJAT}° di bawah netral`);
  }

  console.log(
    `[face] t=${detikSesiSekarang().toFixed(1)}s ` +
    `pitch=${sudut.pitch.toFixed(1)}° yaw=${sudut.yaw.toFixed(1)}° ` +
    `selisih=${selisih === null ? '-' : selisih.toFixed(1) + '°'} ` +
    `blink kiri=${kedipKiri.toFixed(3)} kanan=${kedipKanan.toFixed(3)} (hanya rujukan) ` +
    `-> ${keputusan}`
  );
}

// ----------------------------------------------------------------------------
// DIAGNOSTIK SEMENTARA (15 September 2026) — BELUM DIPAKAI UNTUK KEPUTUSAN
//
// Uji manual menunjukkan arah terbalik: melihat ke atas terbaca menunduk, dan
// menunduk sungguhan menurunkan eyeLookDown. Hipotesis: eyeLookDown mengukur
// posisi bola mata RELATIF TERHADAP KEPALA, bukan arah kepala. Saat kepala
// menunduk ke kertas, bola mata bisa justru bergulir ke atas relatif terhadap
// kepala. Untuk memastikannya, empat sinyal dicetak berdampingan, dirata-rata
// per detik supaya angkanya bisa disalin:
//   lookDown  rata-rata eyeLookDownLeft/Right   (fitur yang dipakai sekarang)
//   lookUp    rata-rata eyeLookUpLeft/Right
//   pitch     rotasi kepala atas-bawah (derajat) dari matriks transformasi wajah
//   yaw       rotasi kepala kiri-kanan (derajat), untuk melihat gangguan menoleh
//   hidung    jarak tegak ujung hidung di bawah garis mata, dibagi jarak antar
//             sudut mata luar (estimasi pitch dari landmark 2D)
//   hilang    jumlah frame tanpa wajah dalam detik itu
// ----------------------------------------------------------------------------
const diag = { detik: -1, n: 0, hilang: 0, lookDown: 0, lookUp: 0, pitch: 0, yaw: 0, nPose: 0, hidung: 0, tataLetak: null };

function catatDiagnostik(hasil, adaWajah) {
  if (!konfig.FACE_DEBUG) return;

  const detikBulat = Math.floor(detikSesiSekarang());
  if (detikBulat !== diag.detik) {
    cetakDiagnostikPerDetik();
    Object.assign(diag, { detik: detikBulat, n: 0, hilang: 0, lookDown: 0, lookUp: 0, pitch: 0, yaw: 0, nPose: 0, hidung: 0 });
  }

  if (!adaWajah) { diag.hilang++; return; }

  const kategori = (hasil.faceBlendshapes && hasil.faceBlendshapes[0]) ? hasil.faceBlendshapes[0].categories : null;
  const b = (nama) => ambilBlendshape(kategori, nama) ?? 0;
  diag.n++;
  diag.lookDown += (b('eyeLookDownLeft') + b('eyeLookDownRight')) / 2;
  diag.lookUp += (b('eyeLookUpLeft') + b('eyeLookUpRight')) / 2;

  // Estimasi pitch dari landmark 2D. Indeks 1 = ujung hidung, 33 dan 263 =
  // sudut luar mata kiri dan kanan pada mesh 468 titik. Koordinat dinormalisasi
  // 0..1, jadi dikalikan ukuran video agar skala x dan y setara.
  const lm = hasil.faceLandmarks[0];
  if (lm && lm[1] && lm[33] && lm[263]) {
    const w = videoSumber.videoWidth, h = videoSumber.videoHeight;
    const mataY = ((lm[33].y + lm[263].y) / 2) * h;
    const jarakMata = Math.hypot((lm[263].x - lm[33].x) * w, (lm[263].y - lm[33].y) * h);
    if (jarakMata > 0) diag.hidung += (lm[1].y * h - mataY) / jarakMata;
  }

  // Pitch dan yaw dari matriks transformasi 4x4. Tata letak data (kolom atau
  // baris dulu) dideteksi dari posisi komponen translasi z, yang jauh lebih
  // besar dari nol karena wajah berada puluhan sentimeter dari kamera.
  const m = hasil.facialTransformationMatrixes && hasil.facialTransformationMatrixes[0];
  if (m && m.data && m.data.length === 16) {
    const d = m.data;
    const kolomDulu = Math.abs(d[14]) > Math.abs(d[11]);
    if (diag.tataLetak === null) {
      diag.tataLetak = kolomDulu ? 'kolom-dulu' : 'baris-dulu';
      console.log(`[diag] matriks transformasi terdeteksi: tata letak ${diag.tataLetak}, data=`, Array.from(d).map(x => +x.toFixed(3)));
    }
    // Sumbu depan wajah (kolom ke-3 matriks rotasi) dalam koordinat kamera
    const fx = kolomDulu ? d[8] : d[2];
    const fy = kolomDulu ? d[9] : d[6];
    const derajat = (r) => Math.asin(Math.max(-1, Math.min(1, r))) * 180 / Math.PI;
    diag.pitch += derajat(fy);
    diag.yaw += derajat(fx);
    diag.nPose++;
  }
}

function cetakDiagnostikPerDetik() {
  if (diag.detik < 0) return;
  const rata = (x, n, digit = 3) => n > 0 ? (x / n).toFixed(digit) : '-';
  console.log(
    `[diag] t=${diag.detik}s frame=${diag.n} hilang=${diag.hilang} ` +
    `lookDown=${rata(diag.lookDown, diag.n)} lookUp=${rata(diag.lookUp, diag.n)} ` +
    `pitch=${rata(diag.pitch, diag.nPose, 1)}° yaw=${rata(diag.yaw, diag.nPose, 1)}° ` +
    `hidung=${rata(diag.hidung, diag.n)}`
  );
}

/**
 * Mengambil agregat kontak pandang untuk Rapor.
 *
 * CARA KERJA:
 * 1. Melaporkan diri tidak tersedia bila model gagal dimuat, posisi netral belum
 *    dikalibrasi, matriks atau blendshape tidak tersedia, atau tidak ada satu
 *    pun frame yang sempat dinilai. Dalam kondisi itu modul TIDAK mengembalikan
 *    angka apa pun, dan report.js mengeluarkan bobot arah pandang dari skor.
 * 2. Persentase kontak pandang dihitung hanya dari frame yang benar-benar
 *    dinilai: menatap depan + menunduk. Tiga jenis frame dikeluarkan dari
 *    pembagi: tanpa wajah dan antrean kandidat yang dibuang karena status
 *    stabil belum terbentuk.
 * 3. wajahTakTerlihatPersen HANYA berisi frame tanpa wajah.
 * 4. Segmen menunduk panjang disertakan sebagai event bertimestamp untuk
 *    timeline di Tahap 4B.
 *
 * @returns {Object} { tersedia: false } atau agregat lengkap arah pandang
 */
export function getResults() {
  const frameValid = frameMenatapDepan + frameMenunduk;

  if (!tersedia || !blendshapeTersedia || pitchNetral === null || totalFrameDianalisis === 0 || frameValid <= 0) {
    return { tersedia: false };
  }

  const pandangPersen = frameMenatapDepan / frameValid;
  const wajahTakTerlihatPersen = frameWajahTakTerlihat / totalFrameDianalisis;

  return {
    tersedia: true,
    pandangPersen: Math.min(Math.max(pandangPersen, 0), 1),
    wajahTakTerlihatPersen: Math.min(Math.max(wajahTakTerlihatPersen, 0), 1),
    totalFrame: totalFrameDianalisis,
    frameMenunduk: frameMenunduk,
    frameHilangDihitungMenunduk: frameHilangDihitungMenunduk,
    pitchNetral: pitchNetral,
    menundukSegmen: menundukSegmen.slice(),
    hilangSegmen: hilangSegmen.slice()
  };
}
