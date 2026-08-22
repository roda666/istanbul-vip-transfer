---
name: Google Ads Keyword Planner integration
description: Architecture, API version, OAuth callback URI, data source priority in weekly draft
---

## Key facts

- **API version**: v18 (`https://googleads.googleapis.com/v18/customers/{id}:generateKeywordIdeas`)
- **Secrets**: `GOOGLE_ADS_DEVELOPER_TOKEN` and `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (stripe dashes before storing customerId)
- **OAuth callback URI**: Public isteğin HTTPS host’undan türetilir; Google Cloud Console’da hem production hem de aktif preview host’unun aynı `/admin/api/google-ads/callback` yolu exact-match olarak kayıtlı olmalıdır.
- **DB table**: `google_ads_connections` — single-row pattern (DELETE + INSERT on upsert, same as gsc_connections); migration 0027 applied directly via `psql -f` because drizzle migrate only ran seed scripts, not the DDL.
- **Geo/lang**: Turkey = `geoTargetConstants/2792`, Turkish = `languageConstants/1011`
- **Scope**: `https://www.googleapis.com/auth/adwords` (plus `userinfo.email` for display)

## Data source priority in weekly-draft cron

1. GSC connected + has traffic data → use GSC (real CTR/impressions)
2. GSC not connected, Google Ads connected → `findKeywordOpportunitiesFromAds()` (real search volumes)
3. Neither → AI fallback pool (FALLBACK_TOPICS, isoWeekOfYear rotation)

`dataSourceNote` field on the draft records which source was used.

## lib/google-ads.ts exports

- `isGoogleAdsConnected()` — checks for a refresh_token row
- `getGoogleAdsConnection()` — returns `{ connectedEmail, connectedAt }`
- `generateKeywordIdeas(seeds, limit)` — raw Keyword Planner call
- `findKeywordOpportunitiesFromAds(limit)` — curated seeds → top by monthly volume
- `disconnectGoogleAds()` — DELETE FROM google_ads_connections

**Why:** Google Cloud Console redirect URI exact-match ister. Public proxy host’u kullanmak preview ve production akışlarının her birini kendi kayıtlı URI’siyle çalıştırır; internal backend host’ları kullanılmaz.
