---
name: Toll direction & gate-pair pricing architecture
description: How round-trip toll direction and calculator-based (gate-pair) crossings are modeled, so pricing never fabricates or silently mis-prices a leg.
---

Two independent axes were added to the toll model, both defaulting to "unconfirmed" rather than guessing:

**Direction (`tollDirection` on the toll point):** `ONE_WAY`, `TWO_WAY_SAME` (charged twice, same tariff),
`TWO_WAY_DIRECTIONAL` (forward and backward legs priced by separate tariff rows), or null/unconfirmed (legacy
default: doubled, same as `TWO_WAY_SAME`). Requires a `tollDirectionSourceUrl` whenever set — same
verified-source-or-reject pattern as a TRY amount. A `directionUnconfirmed` flag threads through to the quote
result as informational/non-blocking.

**Pricing mode (`pricingMode` on the toll point):** `FLAT` (one tariff per vehicle class/time-band, the
default) or `GATE_PAIR` (some highway operators price by the specific entry/exit toll-gate pair, not a flat
per-crossing fee — tariffs are then keyed by `entryGateName`/`exitGateName`, and a route alternative must
supply which gate pair it uses via a `gatePairs` map keyed by toll point ID).

**Why:** official sources disagree or go stale (an older KGM page can list different terms than a newer PDF —
prefer the newer/PDF-sourced figure and cite the older page only for non-amount facts like tolling direction),
and some crossings (e.g. Turkish build-operate-transfer highways) have no flat published table at all, only a
fee calculator.

**How to apply:** a `GATE_PAIR` point or a `TWO_WAY_DIRECTIONAL` leg with no matching tariff/gate-pair
configured must show up as a "missing toll line" in the quote, never a fabricated or wrong price. Never invent
gate names or amounts — leave them null/unconfigured until a real official source is found.

**Known unreachable source:** `mobil.otoyolas.com.tr` (OTOYOL A.Ş.'s real pricing API/calculator for
Osmangazi Köprüsü / İstanbul–İzmir Otoyolu, O-5) could not be reached from the Replit sandbox network
(confirmed via curl, impure fetch, and webFetch — all failed/timed out). This corridor's gate-pair tariffs
remain unconfigured pending a different way to source real TRY amounts.

**Second confirmed-unreachable source (2026-08-26):** `ysskoprusuveotoyolu.com.tr/ucret-hesaplama` (YSS
Köprüsü + Kuzey Marmara Otoyolu operator's own fee calculator) is the same class of problem: the page loads,
but its entry/exit `<select>` fields are static-HTML `disabled`/empty, populated only by client-side JS/AJAX
whose backend endpoint could not be found by scanning the page's own JS bundles. Same pattern as OTOYOL A.Ş. —
treat any Turkish toll/highway BOT-operator "ücret hesaplama" page as presumptively unreachable until proven
otherwise; don't re-attempt the same discovery approach (curl + JS bundle grep) expecting a different result.

**Query-date staleness (queriedAt column, added 2026-08-26):** none of these live-calculator operators publish
a stated tariff effective date. `tollTariffs.queriedAt` records when an admin/agent personally queried the
calculator for a given figure, and is required (validated in `tollTariffInputSchema`) whenever an amount is
saved with no `validFrom`. `evaluateTollTariffStaleness` uses `queriedAt` age (new `QUERY_DATE_OLD` reason) as
the staleness baseline in that case, in `validFrom`'s place — never both. Apply this same pattern to any future
calculator-only toll/highway source with no stated effective date.

**1915canakkale.com IS reachable, unlike the two above (2026-08-26):** its live "Geçiş Ücreti Sorgulama" tool
works via `POST /getexitpoints?entryPoint=X` and `POST /gettolls?entry=X&exit=Y`, both relative to the site
root (not under `/online-islemler/...` as the page URL suggests). Requires a browser User-Agent + a `Referer`
header pointing at the tool page, and an explicit empty POST body (`--data ""`) — omitting the body causes a
411, and a missing Referer causes a 403 (including on the static JS asset path). Treat "unreachable" findings
for other BOT-operator calculators as source-specific, not a blanket sandbox limitation — retry with these
headers before concluding a given operator's tool can't be reached.

**Combined bridge+highway fee pattern ("IncludingBridge"):** some operators (1915 Çanakkale confirmed
2026-08-26) price a corridor that includes both a highway approach and a bridge crossing as ONE combined
gate-pair amount, and say so explicitly (API returns `IncludingBridge: true`; page text confirms the fee
"includes both the highway and bridge fee together" when the route uses the bridge). A route alternative must
never combine such a GATE_PAIR point with that same operator's standalone FLAT bridge point — the bridge fee
would be double-counted. Apply this same suspicion to any other otoyol+köprü combination whose GATE_PAIR notes
say the corridor "includes" a specific bridge (e.g. İstanbul–İzmir Otoyolu's note mentions Osmangazi
Köprüsü) — flag it for verification before real numbers are ever entered, even if no live double-count exists
yet because the tariff is still null.

**Write-time FLAT/GATE_PAIR enforcement (2026-08-26):** the two pricing systems must never cross — a FLAT
bridge/tunnel is one fixed amount per crossing with no gate pair; a GATE_PAIR highway segment has no single
flat amount, only entry+exit gate-pair rows. `resolveTolls` already guarded this at read time, but tariff
create/update had no write-time check. Added `assertPricingModeMatchesGatePair(pricingMode, entryGateName,
exitGateName)` in `lib/toll-management.ts`, called from both the tariff POST and PATCH routes, rejecting a FLAT
point tariff that carries a gate pair and a GATE_PAIR point tariff that lacks one. The admin UI already gated
these fields correctly by `pricingMode`; this closes the API-level gap defense-in-depth. All 5 unverified
intercity highway placeholder points (İstanbul–Ankara/Antalya/Bodrum/Bursa/Sapanca Otoyolu Güzergahı) were
`pricingMode: 'FLAT'` by leftover default despite being highway segments — corrected to `GATE_PAIR` in both the
DB and the seed script source, even while their tariffs stay unsourced/blank.

**Official direction confirmed for 3 more bridges/tunnel (2026-08-26):** 15 Temmuz Şehitler Köprüsü and Fatih
Sultan Mehmet Köprüsü (FSM) are `TWO_WAY_SAME` per the KGM tariff PDF's explicit note ("01.01.2022 tarihinden
itibaren FSM ve 15 Temmuz Şehitler Köprülerinden iki yönlü ücret alınmaktadır"). Avrasya Tüneli is also
`TWO_WAY_SAME` per its own resmi ücretlendirme page (identical fee table applies to both AVRUPA→ASYA and
ASYA→AVRUPA). Osmangazi Köprüsü and the 1915 Çanakkale Köprüsü (the standalone bridge point, not the combined
highway+bridge GATE_PAIR corridor) have NO official direction statement found on their KGM pages — left
null/unconfirmed rather than assumed, per the owner's explicit "doğrulayamadığın yeri boş bırak" rule.

**Alternatives vs. summed items — audited, no bug found except one bad point reference (2026-08-26):** the
owner was concerned that mutually-exclusive Bosphorus crossings (15 Temmuz / FSM / Avrasya Tüneli / YSS) might
be summed together instead of modeled as separate alternatives (only one used per trip, driver's choice). A
full audit of every route's `route_toll_alternatives` + `route_toll_alternative_items` found the two-level
model (mutually-exclusive alternatives, each summing only its own genuinely-different crossings like a
Bosphorus bridge + Osmangazi + a highway segment) was already correctly used everywhere — the only real bug was
`istanbul-havalimani-kadikoy`'s "15 Temmuz Şehitler Köprüsü üzerinden" alternative pointing at the wrong toll
point (YSS instead of 15 Temmuz), now fixed. The admin quote tool (`_FormulaPricingClient.tsx`) already lets
staff pick a specific alternative per reservation via a dropdown — this already satisfies the "seçim
yapılabilsin" requirement; no new UI was needed.

**DELETE-by-id caution on route_toll_alternative_items (2026-08-26):** a route's alternative can hold several
items with similarly-shaped random UUIDs; deleting the wrong one (e.g. removing the crossing itself instead of
the otoyol segment attached to it) silently breaks that alternative's pricing. Always re-run the join query
right before a DELETE to confirm the id's `point_name` matches intent, not just the id copied from an earlier
listing — and re-verify with the same query immediately after.

**İstanbul–Sapanca Kuzey Marmara Otoyolu (O-7) segment — partially confirmed (2026-08-26):** owner confirmed the
Avrasya Tüneli alternative never uses this otoyol segment at all (item removed). For the YSS and FSM
alternatives, entry station confirmed as S7 "Çamlık" (matches the official 9-station tariff PDF recovered
earlier: S1 İstoç, S2 İkitelli, S3 Başakşehir Merkez, S4 Başakşehir, S5 Fenertepe, S6 Çekmeköy, S7 Çamlık, S8
Sarıgazi, G11 Kömürlük) — written to both items' `entryGateName`. Exit station is still unconfirmed ("varies"
per owner, no concrete station given) — left null; no tariff can resolve for this segment until it's confirmed.

**Vehicle-class taxonomy confirmed shared (2026-08-26):** the 6-class axle-based scheme (class_1: axle
spacing <3.20m; class_2: ≥3.20m 2-axle; class_3/4/5: 3/4-5/6+ axle; class_6: motorcycle) is Turkey's shared
national highway/bridge scheme — confirmed present on both KGM/OTOYOL A.Ş. and the YSS/Kuzey Marmara operator's
own pages, not a KGM-only quirk. Still, never auto-assign or bulk-assign a vehicle's class from an example
listed in the class description (e.g. "minibüs" cited under class_1) — always require verification against
that specific vehicle's own ruhsat (axle spacing/count), since a long-wheelbase variant of the same model can
land in a different class. See `TOLL_VEHICLE_CLASS_SELECTION_WARNING` in `lib/toll-management.ts` for the
exact wording surfaced in admin UI.
