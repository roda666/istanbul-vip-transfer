#!/usr/bin/env bash
# ============================================================
# generate-service-og-cards.sh
#
# Generates per-service OG cards for every registered service page.
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

# Ensure output directory exists
mkdir -p "$ROOT/public/images/og"

echo "=== Generating per-service OG cards ==="

while IFS='|' read -r slug line1 line2 tagline; do
  [[ -z "$slug" ]] && continue
  bash "$GEN" \
    --bg "$ROOT/public/hero-images/$slug.jpg" \
    --line1 "$line1" \
    --line2 "$line2" \
    --tagline "$tagline" \
    --out "$ROOT/public/images/og/og-$slug.jpg"
done <<'CARDS'
istanbul-havalimani-transfer|İSTANBUL HAVALİMANI|VIP TRANSFER|Lüks Havalimanı Transferi
sabiha-gokcen-havalimani-transfer|SABİHA GÖKÇEN|VIP TRANSFER|SAW · Özel Ulaşım
vip-transfer|VIP TRANSFER|İSTANBUL|Lüks Özel Ulaşım
sehirler-arasi-transfer|ŞEHİRLER ARASI|VIP TRANSFER|Konforlu Uzun Yolculuk
soforlu-arac-kiralama|ŞOFÖRLÜ ARAÇ|KİRALAMA|Günlük VIP Şoför Hizmeti
otel-transfer|OTEL TRANSFER|İSTANBUL|Havalimanı · Otel · VIP
saglik-turizmi-transfer|SAĞLIK TURİZMİ|TRANSFERİ|Klinik · Otel · VIP Ulaşım
kurumsal-vip-transfer|KURUMSAL VIP|TRANSFER|Profesyonel İş Seyahati
istanbul-bursa-transfer|İSTANBUL–BURSA|VIP TRANSFER|Kapıdan Kapıya Özel Ulaşım
istanbul-sapanca-transfer|İSTANBUL–SAPANCA|VIP TRANSFER|Doğaya Konforlu Yolculuk
istanbul-gunubirlik-turlar|İSTANBUL|GÜNÜBİRLİK TUR|Size Özel Şehir Keşfi
sapanca-masukiye-turu|SAPANCA–MAŞUKİYE|ÖZEL TUR|Doğa İçinde Günübirlik Tur
bursa-gunubirlik-tur|BURSA|GÜNÜBİRLİK TUR|İstanbul’dan VIP Tur
yalova-gunubirlik-tur|YALOVA|GÜNÜBİRLİK TUR|Termal ve Doğa Turu
ucus-karsilama-meet-greet|UÇUŞ KARŞILAMA|MEET & GREET|Terminalde Kişisel Karşılama
ankara-vip-transfer|ANKARA|VIP TRANSFER|Esenboğa · Özel Araç
antalya-vip-transfer|ANTALYA|VIP TRANSFER|Havalimanı · Tatil Bölgesi
izmir-vip-transfer|İZMİR|VIP TRANSFER|Havalimanı · Ege Rotaları
gelin-arabasi-kiralama|GELİN ARABASI|KİRALAMA|Özel Gününüz İçin
vip-protokol-secim-araci|VIP PROTOKOL|ARAÇ TAHSİSİ|Seçim ve Etkinlik Ulaşımı
gunluk-villa-kiralama|GÜNLÜK VİLLA|KİRALAMA|Konaklama ve Transfer
CARDS

echo ""
echo "=== All service OG cards generated ==="
ls -lh "$ROOT/public/images/og/"
