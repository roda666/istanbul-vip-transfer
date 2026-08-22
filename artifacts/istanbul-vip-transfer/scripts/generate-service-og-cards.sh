#!/usr/bin/env bash
# ============================================================
# generate-service-og-cards.sh
#
# Generates per-service OG cards for all 14 service pages.
# Output: public/images/og/ directory
#
# Usage:
#   bash scripts/generate-service-og-cards.sh
#   pnpm --filter @workspace/istanbul-vip-transfer generate:og-service-cards
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
GEN="$SCRIPT_DIR/generate-og-card.sh"

# Background image aliases
BG_HERO="$ROOT/public/images/istanbul-vip-transfer-hero.webp"
BG_CITY="$ROOT/public/images/istanbul-hero.jpg"
BG_VITO="$ROOT/public/images/mercedes-vito.jpg"
BG_SPR="$ROOT/public/images/mercedes-sprinter.jpg"

# Ensure output directory exists
mkdir -p "$ROOT/public/images/og"

echo "=== Generating per-service OG cards ==="

bash "$GEN" \
  --bg "$BG_HERO" \
  --line1 "İSTANBUL HAVALİMANI" \
  --line2 "VIP TRANSFER" \
  --tagline "Lüks Havalimanı Transferi" \
  --out "$ROOT/public/images/og/og-istanbul-havalimani-transfer.jpg"

bash "$GEN" \
  --bg "$BG_HERO" \
  --line1 "SABİHA GÖKÇEN" \
  --line2 "HAVALİMANI" \
  --tagline "SAW · VIP Transfer Hizmeti" \
  --out "$ROOT/public/images/og/og-sabiha-gokcen-havalimani-transfer.jpg"

bash "$GEN" \
  --bg "$BG_VITO" \
  --line1 "VIP TRANSFER" \
  --line2 "İSTANBUL" \
  --tagline "Lüks Özel Ulaşım" \
  --out "$ROOT/public/images/og/og-vip-transfer.jpg"

bash "$GEN" \
  --bg "$BG_SPR" \
  --line1 "ŞEHİRLER ARASI" \
  --line2 "VIP TRANSFER" \
  --tagline "Konforlu Şehirler Arası Ulaşım" \
  --out "$ROOT/public/images/og/og-sehirler-arasi-transfer.jpg"

bash "$GEN" \
  --bg "$BG_VITO" \
  --line1 "ŞOFÖRLÜ ARAÇ" \
  --line2 "KİRALAMA" \
  --tagline "Günlük VIP Şoför Hizmeti" \
  --out "$ROOT/public/images/og/og-soforlu-arac-kiralama.jpg"

bash "$GEN" \
  --bg "$BG_CITY" \
  --line1 "OTEL TRANSFER" \
  --line2 "İSTANBUL" \
  --tagline "Havalimanı · Otel · VIP" \
  --out "$ROOT/public/images/og/og-otel-transfer.jpg"

bash "$GEN" \
  --bg "$BG_VITO" \
  --line1 "SAĞLIK TURİZMİ" \
  --line2 "TRANSFERİ" \
  --tagline "Hastane · Klinik · VIP Ulaşım" \
  --out "$ROOT/public/images/og/og-saglik-turizmi-transfer.jpg"

bash "$GEN" \
  --bg "$BG_SPR" \
  --line1 "KURUMSAL VIP" \
  --line2 "TRANSFER" \
  --tagline "Kurumsal Ulaşım Çözümleri" \
  --out "$ROOT/public/images/og/og-kurumsal-vip-transfer.jpg"

bash "$GEN" \
  --bg "$BG_CITY" \
  --line1 "İSTANBUL–BURSA" \
  --line2 "VIP TRANSFER" \
  --tagline "Kapıdan Kapıya Özel Ulaşım" \
  --out "$ROOT/public/images/og/og-istanbul-bursa-transfer.jpg"

bash "$GEN" \
  --bg "$BG_CITY" \
  --line1 "İSTANBUL–SAPANCA" \
  --line2 "VIP TRANSFER" \
  --tagline "Kapıdan Kapıya Özel Ulaşım" \
  --out "$ROOT/public/images/og/og-istanbul-sapanca-transfer.jpg"

bash "$GEN" \
  --bg "$BG_CITY" \
  --line1 "GÜNÜBİRLİK" \
  --line2 "TURLAR" \
  --tagline "İstanbul Özel Tur Hizmeti" \
  --out "$ROOT/public/images/og/og-istanbul-gunubirlik-turlar.jpg"

bash "$GEN" \
  --bg "$BG_CITY" \
  --line1 "SAPANCA" \
  --line2 "MAŞUKİYE TURU" \
  --tagline "Doğa İçinde VIP Günübirlik Tur" \
  --out "$ROOT/public/images/og/og-sapanca-masukiye-turu.jpg"

bash "$GEN" \
  --bg "$BG_CITY" \
  --line1 "BURSA" \
  --line2 "GÜNÜBİRLİK TUR" \
  --tagline "İstanbul'dan VIP Tur Transferi" \
  --out "$ROOT/public/images/og/og-bursa-gunubirlik-tur.jpg"

bash "$GEN" \
  --bg "$BG_CITY" \
  --line1 "YALOVA" \
  --line2 "GÜNÜBİRLİK TUR" \
  --tagline "İstanbul'dan VIP Tur Transferi" \
  --out "$ROOT/public/images/og/og-yalova-gunubirlik-tur.jpg"

echo ""
echo "=== All service OG cards generated ==="
ls -lh "$ROOT/public/images/og/"
