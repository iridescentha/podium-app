#!/bin/bash
# ============================================================================
# PELARI UJI PODIUM
# ============================================================================
# Modul aplikasi ditulis sebagai ES module ber-ekstensi .js, sedangkan Node
# memperlakukan .js sebagai CommonJS selama tidak ada package.json. Daripada
# menambahkan package.json hanya demi itu — proyek ini sengaja tanpa npm —
# berkas modul disalin ke folder sementara dengan ekstensi .mjs sebelum diuji.
#
# Pakai:  bash uji/jalankan.sh          jalankan semua
#         bash uji/jalankan.sh audio    jalankan yang namanya memuat "audio"
# ============================================================================
set -u
AKAR="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$AKAR/uji/.tmp"
SARING="${1:-}"

rm -rf "$TMP" && mkdir -p "$TMP"

# Modul aplikasi, disalin sebagai .mjs
for f in "$AKAR"/js/*.js; do
  cp "$f" "$TMP/$(basename "${f%.js}").mjs"
done

# face.js memuat MediaPipe dari CDN; ganti dengan tiruan lokal saat diuji
sed "s#^const URL_BUNDLE = .*#const URL_BUNDLE = './mock-vision.mjs';#" \
  "$AKAR/js/face.js" > "$TMP/face.mjs"

cp "$AKAR"/uji/*.mjs "$TMP/" 2>/dev/null

gagalTotal=0
for berkas in "$TMP"/uji-*.mjs; do
  nama="$(basename "$berkas" .mjs)"
  [ -n "$SARING" ] && [[ "$nama" != *"$SARING"* ]] && continue

  keluaran="$(cd "$TMP" && node "$berkas" 2>&1)"
  jumlahGagal="$(echo "$keluaran" | grep -cE '^GAGAL')"

  if [ "$jumlahGagal" -eq 0 ] && echo "$keluaran" | grep -q "SEMUA LULUS"; then
    printf '%-26s LULUS\n' "$nama"
  else
    printf '%-26s %s GAGAL\n' "$nama" "$jumlahGagal"
    echo "$keluaran" | grep -E '^GAGAL|Error' | head -5 | sed 's/^/    /'
    gagalTotal=$((gagalTotal + 1))
  fi
done

echo "---"
if [ "$gagalTotal" -eq 0 ]; then
  echo "Semua berkas uji lulus."
else
  echo "$gagalTotal berkas uji GAGAL."
  exit 1
fi
