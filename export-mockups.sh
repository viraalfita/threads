#!/usr/bin/env bash
# Export ThreadLens portfolio mockups + slide as retina PNGs.
#
# Renders each mockup (and the portfolio slide) with Chrome headless against a
# transparent background, then auto-crops the transparent border with Pillow.
#
# Output: mockups-out/{dashboard,posts,compose,analysis,slide}.png
#
# Requires:
#   - Google Chrome installed
#   - python3 + Pillow   →   pip3 install Pillow
#
# Usage:
#   ./export-mockups.sh

set -euo pipefail

# ---- locate Chrome ----
if [[ -n "${CHROME:-}" ]]; then
  :
elif [[ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]]; then
  CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
elif command -v google-chrome >/dev/null 2>&1; then
  CHROME="$(command -v google-chrome)"
elif command -v chromium >/dev/null 2>&1; then
  CHROME="$(command -v chromium)"
else
  echo "✖ Google Chrome not found. Set CHROME=/path/to/chrome and re-run." >&2
  exit 1
fi

# ---- locate Python + Pillow ----
if ! command -v python3 >/dev/null 2>&1; then
  echo "✖ python3 not found." >&2
  exit 1
fi
if ! python3 -c "from PIL import Image" >/dev/null 2>&1; then
  echo "ℹ Pillow not installed. Run:  pip3 install Pillow" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")" && pwd)"
HTML="$ROOT/mockups.html"
SLIDE="$ROOT/portfolio-slides.html"
OUT="$ROOT/mockups-out"
mkdir -p "$OUT"

if [[ ! -f "$HTML" ]]; then
  echo "✖ mockups.html not found at $HTML" >&2
  exit 1
fi

# ---- mockup items ----
# Format: name:width:height
#   name   - output filename (also matches data-name="…" in mockups.html)
#   width  - viewport width in CSS px (oversized; Pillow auto-crops)
#   height - viewport height in CSS px (oversized; Pillow auto-crops)
#
# At --force-device-scale-factor=2 each CSS px renders 2 device px → retina.
ITEMS=(
  "dashboard:1340:1000"
  "posts:1340:840"
  "compose:1200:1180"
  "analysis:1180:1060"
)

render() {
  local url="$1" out="$2" w="$3" h="$4"
  "$CHROME" \
    --headless=new \
    --disable-gpu \
    --hide-scrollbars \
    --no-sandbox \
    --default-background-color=00000000 \
    --window-size="${w},${h}" \
    --force-device-scale-factor=2 \
    --virtual-time-budget=2000 \
    --screenshot="$out" \
    "$url" >/dev/null 2>&1
}

echo "→ rendering with: $CHROME"
echo "→ output:         $OUT"
echo

for entry in "${ITEMS[@]}"; do
  IFS=":" read -r name width height <<<"$entry"
  echo "  • $name (${width}×${height} CSS · @2x)"
  render "file://$HTML?item=$name" "$OUT/$name.png" "$width" "$height"
done

echo "  • slide (1280×720 CSS · @2x)"
render "file://$SLIDE?solo=1" "$OUT/slide.png" 1280 720

# ---- auto-crop transparent borders ----
echo
echo "→ cropping transparent borders…"
python3 - "$OUT" <<'PY'
import glob, os, sys
from PIL import Image

out_dir = sys.argv[1]
for f in sorted(glob.glob(os.path.join(out_dir, "*.png"))):
    im = Image.open(f).convert("RGBA")
    bbox = im.getbbox()
    if not bbox:
        print(f"  ! {os.path.basename(f)} → empty, skipped")
        continue
    cropped = im.crop(bbox)
    cropped.save(f, optimize=True)
    print(f"  ✓ {os.path.basename(f):20s} → {cropped.size[0]}×{cropped.size[1]} px")
PY

echo
echo "✔ done · open $OUT/"
