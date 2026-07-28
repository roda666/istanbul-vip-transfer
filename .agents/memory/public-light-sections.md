---
name: Public page light section tokens
description: Colors used for the converted dark sections on service/blog pages (post light-theme migration).
---

## Section backgrounds (converted from dark)

| Section type | Old bg | New bg |
|---|---|---|
| "Kimler İçin" card-in-section | `#0A0A0A` | `#EDF3F7` |
| Card inside Kimler İçin | `rgba(201,168,76,0.02)` | `#FFFDF8` |
| "Nasıl Çalışır" process steps | `#0D0D0D` | `#F7F5EF` |
| "İlgili Hizmetler" links | `#0D0D0D` | `#EDF3F7` |
| "Diğer Yazılar" blog section | `#0A0A0A` | `#EDF3F7` |

## Text colors within those sections

| Old | New | Usage |
|-----|-----|-------|
| `#FFFFFF` | `#183247` | h2 headings |
| `#888` | `#304A5E` | list items and step text |
| `#CCC` | `#243B53` | blog post card titles |

## Card borders (in section)

| Old | New |
|-----|-----|
| `rgba(201,168,76,0.15)` | `rgba(199,154,50,0.2)` |

## ServiceFAQ component

The FAQ accordion section uses `#EDF3F7` background (was `#0A0A0A`).
Open item: `rgba(199,154,50,0.04)` bg, `rgba(199,154,50,0.4)` border.
Closed item: `#FFFFFF` bg, `#D8E1E8` border.

## Pages fixed

- `app/otel-transfer/page.tsx`
- `app/soforlu-arac-kiralama/page.tsx`
- `app/saglik-turizmi-transfer/page.tsx`
- `app/kurumsal-vip-transfer/page.tsx`
- `app/blog/[slug]/page.tsx`
- `components/ServiceFAQ.tsx`
- `app/layout.tsx` — removed `backgroundColor: '#0A0A0A'` from body inline style

**Why:** These were the only remaining dark sections on public pages after the prior-session rewrite of the 12 shared components.
