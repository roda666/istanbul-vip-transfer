# İstanbul VIP Transfer

Türkiye Seyahat Acenteleri Birliği'ne (TÜRSAB) kayıtlı, Mercedes Vito ve Sprinter araç filosuyla İstanbul havalimanı, şehir içi, şehirlerarası ve özel tur transferi sunan VIP ulaşım hizmetinin web sitesi ve admin paneli.

## Run & Operate

- `pnpm --filter @workspace/istanbul-vip-transfer run dev` — Next.js web uygulamasını başlat (PORT env ile)
- `pnpm --filter @workspace/api-server run dev` — API sunucusunu başlat (port 8080)
- `pnpm --filter @workspace/istanbul-vip-transfer run typecheck` — TypeScript tip kontrolü
- `pnpm --filter @workspace/istanbul-vip-transfer run build` — Production build (prebuild check-page-meta dahil)
- `pnpm --filter @workspace/istanbul-vip-transfer run lint` — ESLint
- `cd artifacts/istanbul-vip-transfer && pnpm exec drizzle-kit generate` — Yeni migration oluştur
- `cd artifacts/istanbul-vip-transfer && pnpm exec drizzle-kit migrate` — Migration uygula

## Stack

- **Framework:** Next.js 15 App Router, React 19, TypeScript 5
- **Stil:** Tailwind CSS v4, CSS custom properties
- **Veritabanı:** PostgreSQL + Drizzle ORM (38 tablo, 25 migration)
- **Auth:** iron-session (httpOnly cookie), 4 rol: SUPER_ADMIN / ADMIN / EDITOR / CHAT_STAFF
- **i18n:** 9 dil (TR, EN, DE, RU, AR, FR, ES, IT, NL); TR prefix'siz, diğerleri `/[lang]/...`; RTL Arapça
- **AI:** OpenAI GPT-4o-mini (çeviri, içerik üretimi, chatbot)
- **E-posta:** Nodemailer + AES-256-GCM şifreli SMTP
- **Görsel:** Next.js Image optimization (AVIF/WebP), GCS + Replit remote patterns
- **Fontlar:** next/font/google (Playfair Display + Inter, self-hosted)

## Önemli Mimari Kararlar

- `/data/*` — public Next.js API rotaları (`/api/*` workspace api-server'a yönleniyor, çakışmayı önlemek için `/data/` prefix'i kullanılıyor)
- Tüm admin API rotaları (`/admin/api/*`) session + rol kontrolü gerektiriyor
- Dil switch'i POST `/api/locale` + `window.location.assign()` ile yapılıyor (cookie race condition'ı önlemek için)
- Drizzle migration workflow: `db:generate` → `db:migrate` (push değil)
- Araç seed'i (`db/seed-vehicles.ts`) `db:migrate` zincirine dahil; `service_categories` seed'i de dahil
- Rate limiter'lar in-memory (Map) — multi-instance deploy'da her instance bağımsız sayar; production'da Redis önerilir

## Klasör Yapısı (artifacts/istanbul-vip-transfer/)

```
app/
  (root TR pages)  — /hizmetler, /araclar, /hakkimizda, /iletisim, /blog, ...
  [lang]/          — /en/..., /de/..., /ar/..., vb.
  admin/           — /admin/** (korumalı panel)
  data/            — Public Next.js API endpoint'leri
  api/             — Next.js API (dikkat: /api → api-server'a yönlendirilir; sadece /data/ kullan)
components/        — Ortak React bileşenleri
lib/               — Yardımcı fonksiyonlar, i18n, DB yardımcıları
  i18n/
    dictionaries/  — 9 dil dosyası (tr.ts, en.ts, de.ts, ru.ts, ar.ts, fr.ts, es.ts, it.ts, nl.ts)
    types.ts       — Dictionary arayüzü (yeni key eklerken buraya da ekle)
db/
  schema.ts        — Tüm tablo tanımları (38 tablo)
  seed-*.ts        — Idempotent seed scriptleri
drizzle/
  migrations/      — SQL migration dosyaları (0000–0024)
```

## Geliştirici Notları

- `lib/i18n/types.ts`'e yeni bir dictionary key eklerken **9 dil dosyasını da** güncelle (TR başta, sonra diğerleri)
- Admin sayfaları `/admin/(protected)/` altında; `layout.tsx` session kontrolü yapıyor
- `lib/source-labels.ts` — form kaynak etiketleri; `_TaleplerClient.tsx` içindeki `SERVICE_LABELS` — servis tipi etiketleri
- Chatbot: hibrit AI + insan devralma; `humanTakenOver` kalıcı bayrak, 2-dk AI fallback timer
- Ana sayfa CMS: `entity_type='homepage'` canonical; TR kaydedince 8 dil otomatik çevriliyor

## User Preferences

- Türkçe kullanıcı arayüzü ve admin paneli
- Tüm yeni özellikler 9 dili desteklemeli
- Admin paneli açık tema (light theme)
- Servis sayfaları DB-driven CMS ile yönetiliyor
