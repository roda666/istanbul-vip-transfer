# G1–G13 kabul kanıtı — 17 Eylül 2026

## Doğrulama özeti

- Production-mode admin kabul testi: **7/7 geçti** (`/tmp/g1-g13-admin-acceptance-prod.log`)
- Seçili unit/contract paketi: **31/31 geçti** (`/tmp/g1-g13-unit-tests-final.log`)
- Admin aksiyon sırası guard'ı: **geçti** — `up → down → edit → activation → delete` (`/tmp/g1-g13-action-contract-final.log`)
- Production build: **geçti** (`build` workflow, 17 Eylül 2026)
- Tarayıcı boyutları: desktop `1440×1000`, tablet `768×1024`, mobile `390×844`
- “Önce” karşılaştırması: kullanıcının verdiği Görsel 1–13 referansları.

## Madde bazlı kanıt

| Madde | Önce | Uygulama kanıtı | Sonra ekran görüntüsü |
|---|---|---|---|
| G1 — ortak admin aksiyon standardı | Görsel 1 | `app/admin/_components/AdminRecordActions.tsx:39`; `scripts/check-admin-action-contract.mjs:12-46` | `admin-record-actions-araclar-desktop.png` |
| G2 — Araçlar kart düzeni ve aksiyon sırası | Görsel 2 | `app/admin/(protected)/araclar/_AraclarList.tsx:327-381` | `admin-record-actions-araclar-{desktop,tablet}.png` |
| G3 — Araçlar mobil aksiyon/overflow | Görsel 3 | `app/admin/_components/AdminRecordActions.tsx:39-160`; production kabul testindeki üç viewport | `admin-record-actions-araclar-mobile.png` |
| G4 — Güzergah AI ile doldur | Görsel 4 | `app/admin/(protected)/transfer-rotalari/_TransferRotalariList.tsx:847` | `owner-g4-route-ai-{desktop-1440,tablet-768,mobile-390}.png` |
| G5 — Blog yazarı görünürlüğü | Görsel 5 | `app/admin/(protected)/blog/_BlogEditor.tsx:226,767-770` | `owner-g5-blog-author-{desktop-1440,tablet-768,mobile-390}.png` |
| G6 — Sayfalar güvenli Sil | Görsel 6 | `app/admin/_components/ContentList.tsx:125` | `owner-g6-pages-delete-{desktop-1440,tablet-768,mobile-390}.png` |
| G7 — Sayfa düzenleme aksiyonları ve çeviri kuyruğu | Görsel 7 | `app/admin/_components/ContentForm.tsx:454,499-507`; `app/admin/api/content/[id]/route.ts` | `owner-g7-page-edit-{desktop-1440,tablet-768,mobile-390}.png` |
| G8 — Yeni Sayfa AI metin/görsel/upload | Görsel 8 | `app/admin/_components/ContentForm.tsx:348` ve görsel kontrol grubu | `owner-g8-page-create-{desktop-1440,tablet-768,mobile-390}.png` |
| G9 — Hizmetler kart listesi | Görsel 9 | `app/admin/(protected)/hizmetler/_HizmetlerList.tsx:403-482` | `owner-g9-service-cards-{desktop-1440,tablet-768,mobile-390}.png` |
| G10 — Schema.org AI alanları | Görsel 10 | `app/admin/(protected)/hizmetler/_ServicePageEditor.tsx:1161` | `owner-g10-service-schema-ai-{desktop-1440,tablet-768,mobile-390}.png` |
| G11 — SSS satır içi düzenleme ve zorunlu yeniden çeviri | Görsel 11 | `app/admin/(protected)/sss/page.tsx:203-229`; `app/admin/api/faqs/[id]/route.ts:67-75` | `owner-g11-faq-inline-{desktop-1440,tablet-768,mobile-390}.png` |
| G12 — Blog durum makinesi | Görsel 12 | `app/admin/(protected)/blog/_BlogEditor.tsx:613-629` | `owner-g12-blog-state-machine-{desktop-1440,tablet-768,mobile-390}.png` |
| G13 — Blog alt aksiyon grubu | Görsel 13 | `app/admin/(protected)/blog/_BlogEditor.tsx:891-898` | `owner-g13-blog-bottom-actions-{desktop-1440,tablet-768,mobile-390}.png` |

## Çeviri sözleşmesi kararı

- Kategori ve blog Türkçe kaynak düzenlemeleri sekiz dil görevini kuyruğa alır; mevcut manuel çeviri kilitlerini korur.
- SSS Türkçe kaynak düzenlemesi, eski müşteri metninin kalmaması için sekiz dili `force: true` ile yeniden üretir.
- Bu ayrım `tests/unit/translation-autofill-route-contract.test.ts` içinde ayrı sözleşmeler olarak korunur.