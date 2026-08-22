#!/usr/bin/env bash
# ============================================================
# generate-og-card.sh
#
# Regenerates OG card images using ImageMagick (v7 `magick` command).
#
# Can run in two modes:
#
#   1) Default mode — regenerates the global og-card.jpg from the
#      site hero image (no arguments needed):
#
#        bash scripts/generate-og-card.sh
#        pnpm --filter @workspace/istanbul-vip-transfer generate:og-card
#
#   2) Custom mode — accepts explicit arguments to generate any card:
#
#        bash scripts/generate-og-card.sh \
#          --bg   public/images/istanbul-hero.jpg \
#          --line1 "İSTANBUL" \
#          --line2 "VIP TRANSFER" \
#          --tagline "Lüks Havalimanı Transferi" \
#          --out  public/images/og-custom.jpg
#
# Requirements:
#   - ImageMagick 7  (magick command on PATH)
#
# Output: JPEG, 1200 × 630 px, quality 92
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

# ── Defaults (used when no --* flags are passed) ─────────────
DEFAULT_SRC="$ROOT/public/images/istanbul-vip-transfer-hero.webp"
DEFAULT_OUT="$ROOT/public/images/og-card.jpg"
DEFAULT_LINE1="İSTANBUL"
DEFAULT_LINE2="VIP TRANSFER"
DEFAULT_TAGLINE="Lüks Havalimanı Transferi"

SRC="$DEFAULT_SRC"
OUT="$DEFAULT_OUT"
BRAND_LINE1="$DEFAULT_LINE1"
BRAND_LINE2="$DEFAULT_LINE2"
TAGLINE="$DEFAULT_TAGLINE"

# ── Parse optional arguments ──────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --bg)      SRC="$2";         shift 2 ;;
    --line1)   BRAND_LINE1="$2"; shift 2 ;;
    --line2)   BRAND_LINE2="$2"; shift 2 ;;
    --tagline) TAGLINE="$2";     shift 2 ;;
    --out)     OUT="$2";         shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

# Resolve relative paths from ROOT
[[ "$SRC" != /* ]] && SRC="$ROOT/$SRC"
[[ "$OUT" != /* ]] && OUT="$ROOT/$OUT"

# ── Brand tokens ─────────────────────────────────────────────
PANEL_COLOR="#0D1B3E"    # Dark navy blue left panel
ARC_COLOR="#C9A84C"      # Gold accent arc
TEXT_COLOR="#FFFFFF"     # Primary text
SUB_COLOR="#C9A84C"      # Tagline colour

# ── Card dimensions ──────────────────────────────────────────
W=1200
H=630
PANEL_W=440   # Width of the solid left panel
ARC_R=330     # Radius of the decorative arc circle
ARC_CX=$((PANEL_W - 10))           # Arc centre x (right edge of panel)
ARC_CY=$((H / 2))                  # Arc centre y (vertical middle)

if [ ! -f "$SRC" ]; then
  echo "ERROR: Source image not found at $SRC"
  exit 1
fi

# Ensure output directory exists
mkdir -p "$(dirname "$OUT")"

echo "Generating $(basename "$OUT") from: $(basename "$SRC")"

# Step 1 – crop/resize source to card dimensions (anchor right so main subject stays visible)
# Step 2 – paint the left navy panel
# Step 3 – draw the gold arc (partial circle peeking out from behind the panel)
# Step 4 – annotate text on the left panel
# Step 5 – write output

magick \
  \( "$SRC" \
       -resize "${W}x${H}^" \
       -gravity East \
       -extent "${W}x${H}" \
  \) \
  \( -size "${PANEL_W}x${H}" "xc:${PANEL_COLOR}" \) \
  -gravity NorthWest -composite \
  -fill none \
  -stroke "${ARC_COLOR}" \
  -strokewidth 2 \
  -draw "circle ${ARC_CX},${ARC_CY} $((ARC_CX + ARC_R)),${ARC_CY}" \
  -font "DejaVu-Sans-Bold" \
  -pointsize 50 \
  -fill "${TEXT_COLOR}" \
  -gravity NorthWest \
  -annotate +40+170 "${BRAND_LINE1}" \
  -annotate +40+235 "${BRAND_LINE2}" \
  -pointsize 20 \
  -fill "${SUB_COLOR}" \
  -annotate +40+305 "${TAGLINE}" \
  -quality 92 \
  "$OUT"

echo "✓  Written: $OUT"
echo "   $(magick identify -format '%wx%h px, %[size]' "$OUT")"
