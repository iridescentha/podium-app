/**
 * ============================================================================
 * MODUL TEMA TAMPILAN - PODIUM
 * ============================================================================
 * File: js/tema.js
 *
 * Mengatur pilihan tema untuk LAYAR EVALUASI saja (Rapor dan Riwayat).
 *
 * ----------------------------------------------------------------------------
 * KENAPA LAYAR SESI TETAP GELAP
 * ----------------------------------------------------------------------------
 * Latar gelap pada Beranda, Persiapan, dan Sesi bukan selera warna, melainkan
 * metafora panggung: ruang yang tenang dan minim distraksi, tempat satu-satunya
 * yang terang adalah timer dan preview kamera. Layar Sesi khususnya adalah satu
 * layar yang TIDAK dibaca pengguna, ia sedang bicara ke kamera. Menerangkannya
 * hanya akan menambah cahaya ke wajah pengguna dan mengalihkan perhatian.
 *
 * Karena itu tombol tema hanya mengubah Rapor dan Riwayat, yaitu dua layar yang
 * memang dibaca lama, dan tidak pernah tampil di Layar Sesi.
 *
 * ----------------------------------------------------------------------------
 * TIGA KEADAAN, BUKAN DUA
 * ----------------------------------------------------------------------------
 * 'otomatis' mengikuti setelan sistem pengguna dan ikut berubah bila setelan
 * itu berubah di tengah pemakaian. 'terang' dan 'gelap' adalah pilihan tetap
 * yang mengalahkan setelan sistem. Keadaan awal selalu 'otomatis', dan pilihan
 * pengguna disimpan di localStorage dengan kunci sendiri, terpisah dari riwayat
 * sesi supaya menghapus riwayat tidak ikut menghapus preferensi tampilan.
 * ============================================================================
 */

const KUNCI_TEMA = 'podium_tema';
const URUTAN = ['otomatis', 'terang', 'gelap'];
const LABEL = { otomatis: 'Tema: otomatis', terang: 'Tema: terang', gelap: 'Tema: gelap' };

let pilihan = 'otomatis';
let tombol = null;
let kueriSistem = null;

/**
 * Membaca pilihan tema yang tersimpan.
 * Nilai yang tidak dikenal (data lama atau disunting tangan) diperlakukan
 * sebagai 'otomatis' alih-alih membuat tampilan berada di keadaan tak terduga.
 */
function bacaTersimpan() {
  try {
    const nilai = localStorage.getItem(KUNCI_TEMA);
    return URUTAN.includes(nilai) ? nilai : 'otomatis';
  } catch (error) {
    return 'otomatis';
  }
}

function simpan(nilai) {
  try {
    localStorage.setItem(KUNCI_TEMA, nilai);
  } catch (error) {
    console.warn('Preferensi tema tidak bisa disimpan:', error);
  }
}

/**
 * Menentukan tema yang benar-benar dipakai saat ini.
 *
 * CARA KERJA:
 * Pilihan 'otomatis' diterjemahkan lewat media query prefers-color-scheme,
 * sehingga aplikasi mengikuti setelan sistem operasi pengguna. Pilihan lain
 * dipakai apa adanya.
 */
function temaEfektif() {
  if (pilihan !== 'otomatis') return pilihan;
  return (kueriSistem && kueriSistem.matches) ? 'gelap' : 'terang';
}

/**
 * Menerapkan tema ke dokumen.
 *
 * CARA KERJA:
 * Atribut data-tema dipasang di elemen <html>, dan style.css yang menentukan
 * arti atribut itu: pada tema gelap, token permukaan layar evaluasi ditimpa
 * dengan nilai token panggung yang sudah ada. Tidak ada warna baru yang
 * diperkenalkan, hanya token yang sama dipakai ulang.
 */
function terapkan() {
  document.documentElement.setAttribute('data-tema', temaEfektif());
  if (tombol) {
    tombol.textContent = LABEL[pilihan];
    tombol.setAttribute('aria-label', `${LABEL[pilihan]}. Klik untuk mengganti tema layar rapor dan riwayat.`);
  }
}

/**
 * Memutar pilihan tema: otomatis → terang → gelap → otomatis.
 *
 * Tiga keadaan dipakai, bukan dua, supaya "mengikuti setelan sistem" tetap bisa
 * dipilih kembali setelah pengguna sempat menguncinya ke salah satu tema.
 */
export function ganti() {
  pilihan = URUTAN[(URUTAN.indexOf(pilihan) + 1) % URUTAN.length];
  simpan(pilihan);
  terapkan();
  return pilihan;
}

/**
 * Menyiapkan tema saat aplikasi dimuat.
 *
 * CARA KERJA:
 * 1. Membaca pilihan tersimpan, lalu menerapkannya seketika.
 * 2. Mendengarkan perubahan setelan sistem. Perubahan itu hanya berpengaruh
 *    selama pilihan masih 'otomatis'; pengguna yang sudah memilih sendiri tidak
 *    akan temanya berubah diam-diam di tengah sesi latihan.
 *
 * @param {HTMLElement} tombolTema - Tombol pengganti tema (boleh null)
 */
export function init(tombolTema = null) {
  tombol = tombolTema;
  pilihan = bacaTersimpan();

  if (typeof window.matchMedia === 'function') {
    kueriSistem = window.matchMedia('(prefers-color-scheme: dark)');
    const saatSistemBerubah = () => { if (pilihan === 'otomatis') terapkan(); };
    if (typeof kueriSistem.addEventListener === 'function') {
      kueriSistem.addEventListener('change', saatSistemBerubah);
    }
  }

  if (tombol) tombol.addEventListener('click', ganti);
  terapkan();
}

/** Pilihan tema saat ini: 'otomatis' | 'terang' | 'gelap'. */
export function pilihanSekarang() {
  return pilihan;
}
