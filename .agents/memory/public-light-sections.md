---
name: Public page light section tokens
description: Colors used for the converted dark sections on service/blog pages (post light-theme migration and typography uplift).
---

## Canonical public color tokens (globals.css)

| Token | Value | Usage |
|---|---|---|
| `--pub-page-bg` | `#F7F8FC` | page background |
| `--pub-text` | `#263F55` | primary body text |
| `--pub-muted` | `#50677A` | muted/secondary text, subtitles |
| `--pub-link` | `#1D5FD1` | in-body links |
| `--pub-link-hover` | `#174EA6` | link hover |
| `--pub-blue` | `#2563EB` | form focus rings, CTA button rings |
| `--pub-surface-blue` | `#EEF3F9` | alternate section bg (TrustSignals, Contact, ServiceFAQ) |
| `--pub-gold` | `#C99A32` | gold accent (icons, labels, section overlines) |
| Tailwind `--background` | `220 22% 97%` | HSL match for `#F7F8FC` |

**Why:** This uplift replaced all gray-text `#627D98` → `#50677A`, dark-bg `#243B53` text → `#263F55`, old page bg `#F7F5EF` → `#F7F8FC`, and old alternate bg `#EAF2F8` → `#EEF3F9` across every public component and page.

## Section backgrounds (converted from dark)

| Section type | Old bg | New bg |
|---|---|---|
| "Hizmet Hakkında" (all 4 service pages) | `#0D0D0D` | `#EEF3F9` |
| "Kimler İçin" card-in-section | `#0A0A0A` | `#EDF3F7` |
| Card inside Kimler İçin | `rgba(201,168,76,0.02)` | `#FFFDF8` |
| "Nasıl Çalışır" process steps | `#0D0D0D` | `#F7F5EF` |
| "İlgili Hizmetler" links | `#0D0D0D` | `#EDF3F7` |
| "Diğer Yazılar" blog section | `#0A0A0A` | `#EDF3F7` |
| TrustSignals / Contact bg | `#EAF2F8` | `#EEF3F9` |
| VehicleFleet / BookingForm section bg | `#F7F5EF` | `#F7F8FC` |

## Text colors within dark→light sections

| Old | New | Usage |
|-----|-----|-------|
| `#FFFFFF` | `#102A43` | h2 headings in converted dark sections |
| `#888` | `#50677A` or `#263F55` | body paragraphs and list items |
| `#777` | `#50677A` | card descriptions |
| `#E5E5E5` | `#102A43` | bold/strong text in ArticleBody |
| `#C9A84C` (links) | `#1D5FD1` | in-article links, blog "Devamını Oku" |

## Blog card styling (blog/page.tsx)

| Element | Old | New |
|---|---|---|
| Card background | `rgba(201,168,76,0.04)` | `#FFFFFF` |
| Card border | `rgba(201,168,76,0.12)` | `#D9E2EC` |
| Post title | `#E5E5E5` | `#102A43` |
| Description | `#777` | `#50677A` |
| "Devamını Oku →" | gold `#C9A84C` | blue `#1D5FD1` |

## Footer opacity bump (dark footer, white rgba text)

| Old | New |
|-----|-----|
| `rgba(255,255,255,0.40)` | `rgba(255,255,255,0.60)` |
| `rgba(255,255,255,0.45)` | `rgba(255,255,255,0.65)` |

## ServiceFAQ component

Uses `#EEF3F9` background (was `#EDF3F7`, before that `#0A0A0A`).
Answer text: `#50677A`. Question text: `#304A5E`.

## Pages and components fully migrated

Components: Header, Hero, PageHero, Services, TrustSignals, VehicleFleet, Contact, BookingForm, Footer, ServiceFAQ, Reviews, FAQ, ArticleBody  
Pages: otel-transfer, soforlu-arac-kiralama, saglik-turizmi-transfer, kurumsal-vip-transfer, blog/page, blog/[slug]/page, all route/tour pages (istanbul-bursa, istanbul-sapanca, istanbul-gunubirlik-turlar, sapanca-masukiye, bursa-gunubirlik, yalova-gunubirlik)
