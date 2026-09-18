---
name: Google Ads Keyword Planner integration
description: Architecture, API version, OAuth callback URI, and measurement versus discovery source rules
---

## Key facts

- **API version**: v24 by default (`https://googleads.googleapis.com/v24/customers/{id}:generateKeywordIdeas`); allow a validated `vNNN` override so API sunsets do not silently break Keyword Planner.
- **Configuration**: keep `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (MCC request header) separate from `GOOGLE_ADS_CUSTOMER_ID` (target advertising account in the API URL); normalize both to digits for requests.
- **OAuth callback URI**: Public isteğin HTTPS host’undan türetilir; Google Cloud Console’da hem production hem de aktif preview host’unun aynı `/admin/api/google-ads/callback` yolu exact-match olarak kayıtlı olmalıdır.
- **DB table**: `google_ads_connections` — single-row pattern (DELETE + INSERT on upsert, same as gsc_connections); migration 0027 applied directly via `psql -f` because drizzle migrate only ran seed scripts, not the DDL.
- **Geo/lang**: Turkey = `geoTargetConstants/2792`, Turkish = `languageConstants/1011`
- **Scope**: `https://www.googleapis.com/auth/adwords` (plus `userinfo.email` for display)

## Data source rules

### Known-keyword measurement and weekly drafts

1. GSC with usable traffic data → use GSC (real CTR/impressions)
2. GSC absent, unavailable, or without usable opportunities → use Google Ads (real search volumes)
3. Neither provider yields usable data → AI fallback pool

`dataSourceNote` field on the draft records which source was used.

### New topic discovery

Run GSC and Google Ads in parallel; never treat either as a fallback in discovery. GSC weak-ranking/high-impression queries are **nearby gains**. Ads volume keywords not already represented by GSC are **new market opportunities**. Persist both groups and their provider state separately.

**Why:** Search Console only reports the site's existing search footprint, so it cannot surface demand in newly served cities. Keyword Planner supplies that external-demand view; its API versions are sunset over time.

**How to apply:** Keep metric endpoints sequential and discovery endpoints parallel. Provider failures must preserve usable results from the other provider and surface only safe, fixed status messages.

## lib/google-ads.ts exports

- `isGoogleAdsConnected()` — checks for a refresh_token row
- `getGoogleAdsConnection()` — returns `{ connectedEmail, connectedAt }`
- `generateKeywordIdeas(seeds, limit)` — raw Keyword Planner call
- `findKeywordOpportunitiesFromAds(limit)` — curated seeds → top by monthly volume
- `disconnectGoogleAds()` — DELETE FROM google_ads_connections

**Why:** Google Cloud Console redirect URI exact-match ister. Public proxy host’u kullanmak preview ve production akışlarının her birini kendi kayıtlı URI’siyle çalıştırır; internal backend host’ları kullanılmaz.

## MCC permission boundary

The OAuth user must be authorized for the MCC supplied in `login-customer-id`, even when the target advertising account is directly accessible to that user.

**Why:** Google returns `authorizationError: USER_PERMISSION_DENIED` when the OAuth user can list the target account but cannot list/access the MCC used as the login context.

**How to apply:** Keep the MCC and target IDs separate. If this error persists, authorize the connected OAuth user on the MCC (or reconnect with an MCC-authorized user); do not collapse the target ID back into the login header.
