/**
 * ============================================================================
 * MODUL DETEKSI BROWSER - PODIUM
 * ============================================================================
 * File: js/browser.js
 *
 * Mengenali browser yang sedang dipakai untuk dua keperluan yang sama-sama
 * menyangkut kejujuran, bukan tampilan:
 *
 * 1. MENYEBUT PENERIMA AUDIO DENGAN BENAR. Web Speech API tidak memproses suara
 *    di perangkat; browser meneruskannya ke layanan pengenal suara milik
 *    pembuatnya. Di Chrome itu layanan Google, di Safari layanan Apple. Kotak
 *    privasi adalah tempat produk ini membuat klaim terkuatnya, jadi menyebut
 *    penerima yang salah di sana adalah pernyataan palsu, bukan salah ketik.
 *
 * 2. MENGAKU APA YANG SUDAH DIUJI. Chrome desktop adalah satu-satunya browser
 *    yang divalidasi. Browser lain tidak diblokir, tetapi diberi tahu terus
 *    terang bahwa perilakunya belum diuji.
 *
 * ----------------------------------------------------------------------------
 * CARA KERJA DETEKSI
 * ----------------------------------------------------------------------------
 * navigator.userAgentData dipakai lebih dulu bila ada (browser berbasis
 * Chromium), karena daftar merek di sana lebih bisa dipercaya daripada string
 * User-Agent yang sengaja dibuat mirip satu sama lain. Bila tidak ada (Safari,
 * Firefox), string User-Agent dibaca dengan urutan yang disengaja: penanda
 * browser turunan (Edge, Opera, Firefox) diperiksa SEBELUM "Chrome" dan
 * "Safari", karena hampir semua browser menyisipkan kedua kata itu ke
 * User-Agent-nya.
 *
 * Browser yang tidak bisa dipastikan (Edge, Opera, Brave, Arc, dan lainnya)
 * digolongkan 'lain'. Untuk golongan ini teks privasi sengaja TIDAK menyebut
 * nama penyedia: menebak penyedianya akan mengulang kesalahan yang sama dengan
 * menyebut Chrome untuk pengguna Safari. Edge, misalnya, meneruskan suara ke
 * layanan Microsoft, bukan Google, meski sama-sama berbasis Chromium.
 * ============================================================================
 */

/**
 * Menentukan jenis browser.
 *
 * @returns {'chrome'|'safari'|'lain'}
 */
export function deteksiBrowser() {
  const nav = (typeof navigator !== 'undefined') ? navigator : {};

  // Brave sengaja menyamar sebagai Chrome dan tidak memakai layanan suara Google
  if (nav.brave) return 'lain';

  const merek = nav.userAgentData && Array.isArray(nav.userAgentData.brands)
    ? nav.userAgentData.brands.map(b => b.brand)
    : null;

  if (merek) {
    if (merek.includes('Google Chrome')) return 'chrome';
    return 'lain';
  }

  const ua = String(nav.userAgent || '');

  if (/Edg\/|OPR\/|Opera|Firefox\/|FxiOS|SamsungBrowser/.test(ua)) return 'lain';
  if (/Chrome\/|CriOS/.test(ua)) return 'chrome';
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return 'safari';

  return 'lain';
}

/**
 * Apakah browser ini menyediakan Web Speech API sama sekali.
 * Firefox tidak; di sana kecepatan bicara dan kata pengisi tidak bisa diukur.
 */
export function adaPengenalSuara() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.webkitSpeechRecognition || window.SpeechRecognition);
}

/**
 * Menyusun kalimat privasi tentang transkripsi suara sesuai browser.
 *
 * CARA KERJA:
 * Chrome dan Safari disebut penyedianya dengan nama. Browser lain mendapat
 * kalimat netral yang tetap jujur bahwa suara diproses layanan pengenal suara
 * milik browser, tanpa menebak siapa pemiliknya. Browser tanpa pengenal suara
 * sama sekali diberi tahu bahwa tidak ada audio yang ditranskripsikan.
 *
 * @returns {string}
 */
export function kalimatPrivasiSuara(jenis = deteksiBrowser(), adaSuara = adaPengenalSuara()) {
  if (!adaSuara) {
    return 'Browser ini tidak menyediakan pengenal suara, jadi tidak ada audio yang ditranskripsikan.';
  }
  if (jenis === 'chrome') {
    return 'Transkripsi suara menggunakan layanan speech bawaan Chrome.';
  }
  if (jenis === 'safari') {
    return 'Transkripsi suara menggunakan layanan speech Apple.';
  }
  return 'Transkripsi suara menggunakan layanan pengenal suara bawaan browser ini, yang dikelola oleh penyedia browser tersebut.';
}
