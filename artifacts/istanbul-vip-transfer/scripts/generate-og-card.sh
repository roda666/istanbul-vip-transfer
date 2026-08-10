#!/usr/bin/env bash
# ============================================================
# generate-og-card.sh
#
# Regenerates public/images/og-card.jpg from the site's hero
# image using ImageMagick (v7 `magick` command).
#
# Run this whenever:
#   - The hero photography changes
#   - The brand colour scheme changes (PANEL_COLOR / ARC_COLOR)
#   - The brand name or tagline shown on the card changes
#
# Usage:
#   bash scripts/generate-og-card.sh
#   # or via npm script:
#   pnpm --filter @workspace/istanbul-vip-transfer generate:og-card
#
# Requirements:
#   - ImageMagick 7  (magick command on PATH)
#   - Hero image at public/images/istanbul-vip-transfer-hero.webp
#
# Output:
#   public/images/og-card.jpg  (1200 × 630 px, JPEG quality 92)
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

SRC="$ROOT/public/images/istanbul-vip-transfer-hero.webp"
OUT="$ROOT/public/images/og-card.jpg"

# ── Brand tokens ─────────────────────────────────────────────
# Update these when the colour scheme or brand wording changes.
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

# ── Text ─────────────────────────────────────────────────────
# Update these when the brand name or tagline changes.
BRAND_LINE1="İSTANBUL"
BRAND_LINE2="VIP TRANSFER"
TAGLINE="Lüks Havalimanı Transferi"

if [ ! -f "$SRC" ]; then
  echo "ERROR: Hero source image not found at $SRC"
  echo "       Place a suitable hero image there and re-run this script."
  exit 1
fi

echo "Generating og-card.jpg from: $SRC"

# Step 1 – crop/resize hero to card dimensions (anchor right so city+bridge stays visible)
# Step 2 – paint the left navy panel
# Step 3 – draw the gold arc (partial circle peeking out from behind the panel)
# Step 4 – annotate brand text on the left panel
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
