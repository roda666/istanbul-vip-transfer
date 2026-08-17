---
name: Legal entity & trust footer
description: Company legal info (Hevra Turizm / TÜRSAB A-7377) wired to site_settings DB, footer trust band, and KVKK/Privacy Policy veri sorumlusu sections.
---

## What was done

**DB schema:** Added 5 new columns to `site_settings` — `company_legal_name`, `company_trade_name`, `tursab_no`, `full_address`, `google_play_url`. Run via direct ALTER TABLE (not drizzle migration — only schema.ts updated to match).

**Seeded row 1:**
- company_legal_name = 'Hevra Turizm'
- company_trade_name = 'The History Travel'
- tursab_no = 'A-7377'
- full_address = 'Alemdar Mah. Ticarethane Sok. No:5/3 34110 Fatih/İSTANBUL'

**ContactSettings type** (`lib/site-settings-server.ts`) extended with `companyLegalName`, `companyTradeName`, `tursabNo`, `fullAddress`, `googlePlayUrl`.

**Footer:** New "trust band" section between main grid and legal links:
- Left: TÜRSAB amber badge (shows cs.tursabNo — hidden if empty)
- Center: Visa SVG badge, Mastercard SVG badge, 3D Secure chip, SSL chip, Cash + EFT i18n text chips
- Right: Google Play badge (hidden if cs.googlePlayUrl is empty)
- Contact column: shows cs.fullAddress (full address) when set, falls back to locationCity

**i18n:** 5 new footer keys added to all 9 dicts: `tursabLabel`, `paymentMethods`, `cashPayment`, `bankTransfer`, `googlePlayLabel`.

**Admin settings page** (`/admin/ayarlar`): New amber-highlighted "Yasal & Güven Bilgileri" section with all 5 new fields + hint text.

**KVKK & Privacy Policy:** Section "Veri Sorumlusu" updated in TR `content.body` to show Hevra Turizm + TÜRSAB A-7377 + full address. Re-translated to 8 languages via `scripts/update-legal-veri-sorumlusu.mjs`.

**Why:**
- Turkish tourism agencies must display TÜRSAB license number visibly (legal requirement)
- KVKK requires the registered legal entity name as veri sorumlusu, not a trade name

**How to apply:**
- To change company info: update `site_settings` row 1 via admin panel at /admin/ayarlar
- New fields show/hide conditionally in footer (empty string = hidden)
- Google Play badge only appears when `google_play_url` is set
