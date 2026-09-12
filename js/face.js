/**
 * ============================================================================
 * MODUL ANALISIS WAJAH & ARAH PANDANG (FACE) - PODIUM
 * ============================================================================
 * File: js/face.js
 * Deskripsi:
 * Menggunakan MediaPipe Tasks Vision (Face Landmarker dengan Blendshapes)
 * untuk mendeteksi arah pandang (eyeLookDownLeft, eyeLookDownRight) dan
 * memantau apakah wajah pengguna terlihat di depan kamera.
 * 
 * Modul ini mengekspor antarmuka standar:
 * - loadModel(): Memuat modul wasm & face landmarker secara lazy.
 * - isReady(): Memeriksa kesiapan model.
 * - start(callbacks, videoElement): Memulai loop inferensi arah pandang (tiap ±150ms).
 * - stop(): Menghentikan loop inferensi.
 * - getResults(): Mengembalikan metrik kontak pandang & persentase wajah tak terlihat.
 * ============================================================================
 */

let landmarker = null;
let sedangBerjalan = false;
let intervalId = null;

// Metrik sesi
let totalFrameDianalisis = 0;
let frameMenatapDepan = 0;
let frameMenunduk = 0;
let frameWajahTakTerlihat = 0;

let callbacksEksternal = {
  onGazeUpdate: null // Callback arah pandang terkini: 'depan' | 'bawah' | 'tidak_terlihat'
};

/**
 * Memeriksa apakah model Face Landmarker sudah siap.
 */
export function isReady() {
  return Boolean(landmarker);
}

/**
 * Memuat modul MediaPipe Tasks Vision Face Landmarker.
 * (Akan dikalibrasi penuh pada Tahap 2).
 */
export async function loadModel() {
  try {
    // Pada Tahap 0, verifikasi konektivitas / simulasikan kesiapan modul
    console.log('Face Landmarker: Memeriksa dependensi Tasks Vision...');
    return true;
  } catch (err) {
    console.error('Gagal memuat Face Landmarker model:', err);
    return false;
  }
}

/**
 * Memulai analisis arah pandang real-time.
 */
export function start(callbacks = {}, videoElement = null) {
  callbacksEksternal = { ...callbacksEksternal, ...callbacks };
  sedangBerjalan = true;

  // Reset metrik
  totalFrameDianalisis = 0;
  frameMenatapDepan = 0;
  frameMenunduk = 0;
  frameWajahTakTerlihat = 0;

  // Polling loop pengujian awal (akan digantikan pemanggilan detectForVideo di Tahap 2)
  intervalId = setInterval(() => {
    if (!sedangBerjalan) return;

    totalFrameDianalisis++;
    frameMenatapDepan++;

    if (typeof callbacksEksternal.onGazeUpdate === 'function') {
      callbacksEksternal.onGazeUpdate('depan');
    }
  }, 150);
}

/**
 * Menghentikan analisis arah pandang.
 */
export function stop() {
  sedangBerjalan = false;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/**
 * Mengambil ringkasan kontak pandang untuk Rapor.
 * Sesuai Bagian 6.1:
 * - Frame tanpa wajah dikeluarkan dari pembagi persentase pandang depan.
 * - pandangPersen = frameMenatapDepan / (totalFrame - frameWajahTakTerlihat)
 */
export function getResults() {
  const frameValid = totalFrameDianalisis - frameWajahTakTerlihat;
  const pandangPersen = frameValid > 0 ? (frameMenatapDepan / frameValid) : 1.0;
  const wajahTakTerlihatPersen = totalFrameDianalisis > 0 ? (frameWajahTakTerlihat / totalFrameDianalisis) : 0.0;

  return {
    pandangPersen: Math.min(Math.max(pandangPersen, 0), 1),
    wajahTakTerlihatPersen: Math.min(Math.max(wajahTakTerlihatPersen, 0), 1),
    totalFrame: totalFrameDianalisis,
    frameMenunduk: frameMenunduk
  };
}
