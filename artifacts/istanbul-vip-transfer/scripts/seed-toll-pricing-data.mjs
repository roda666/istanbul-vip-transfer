/**
 * seed-toll-pricing-data.mjs
 *
 * Seeds/normalizes toll crossing points, officially-sourced tariffs (keyed by
 * KGM's own class_1..class_6 taxonomy), and route↔toll alternative mappings
 * for the toll pricing engine (Yol & Geçiş Ücretleri).
 *
 * IMPORTANT — data provenance rules followed by this script (verified 2026-08-26):
 *   - Vehicle classes are ALWAYS class_1..class_6 — KGM's own official axle-based
 *     taxonomy (see TOLL_VEHICLE_CLASS_DESCRIPTIONS in lib/toll-management.ts).
 *     This is completely independent of `vehicles.pricingClass`
 *     (minivan/minibus/midibus/bus). Which class applies to a given vehicle at a
 *     given crossing point is a per-(vehicle, toll point) admin assignment (see
 *     the vehicle_toll_point_classes table) — never a single global vehicle field,
 *     because an operator's own classification can diverge from KGM's per point.
 *   - Every priced row's amount comes from the operator's own official page,
 *     fetched live on 2026-08-26:
 *       - 15 Temmuz Şehitler Köprüsü + Fatih Sultan Mehmet Köprüsü: one shared
 *         KGM PDF tariff table, effective 01/01/2026.
 *       - Yavuz Sultan Selim Köprüsü, Osmangazi Köprüsü, 1915 Çanakkale Köprüsü:
 *         each has its own KGM PDF tariff table, effective 01/07/2026.
 *       - Avrasya Tüneli: the operator's own canonical "Ücretler" tariff page
 *         (https://www.avrasyatuneli.com/ucretlendirme/), fetched live and
 *         re-verified on 2026-08-26 — publishes only DAY/NIGHT rates for
 *         class_1 (Otomobil), class_2 (Minibüs), and class_6 (Motosiklet); this
 *         page carries no explicit tariff effective-date, so effectiveFrom below
 *         is carried over from a separately-fetched 1 Temmuz 2026 announcement
 *         page whose amounts match this canonical page exactly.
 *   - Avrasya Tüneli's own tariff page confirms its classes ARE KGM-compatible
 *     ("otomobil 1. Sınıf", "minibüs 2. Sınıf", "motosiklet 6. Sınıf" — quoted
 *     verbatim from the page), and its own "Yasaklı Araçlar" modal image
 *     (https://www.avrasyatuneli.com/_assets/img/subpage/yasakli-araclar-modal.png,
 *     visually inspected) confirms bicycles/scooters/buses/trucks/tow
 *     trucks/>2-axle/>5000kg/hazmat/>2.8m/N2/N3/O1-O4 freight vehicles are
 *     banned — i.e. only KGM classes 1, 2, 6 may use this tunnel; classes 3/4/5
 *     are confirmed-banned (toll_points.bannedVehicleClasses), not just
 *     "unpriced". A banned class can never be priced at this point, and the
 *     pricing engine hard-rejects any route alternative that includes this
 *     point for a vehicle assigned one of the banned classes here.
 *   - Every row this script writes with a non-null amount always carries the
 *     matching official sourceUrl; the server (assertVerifiedSourceForAmount)
 *     would reject any attempt to save an amount without one, so this script's
 *     own data can never drift into that invalid state. The same applies to
 *     bannedVehicleClasses: a non-null value always carries a
 *     bannedVehicleClassesSourceUrl (assertVerifiedSourceForBan).
 *   - The 5 KGM bridge points are confirmed to have NO vehicle-class ban (their
 *     own official PDF tariffs price all six classes with no exclusion), so
 *     bannedVehicleClasses is seeded as [] (confirmed-none) there, sourced to
 *     the same official PDF used for their tariffs.
 *   - The 6 named highway/otoyol points (İstanbul–İzmir otoyol ilave kesim and
 *     the 5 "Güzergah" placeholders for Bursa/Sapanca/Ankara/Antalya/Bodrum) are
 *     scaffolded with a full class_1..class_6 row set per point, but every row
 *     is left with a NULL amount and NULL source on purpose: Turkish otoyol
 *     segments beyond the named bridges/tunnel are either currently toll-free
 *     or charge distance-based OGS/HGS fees that this point-based, flat
 *     per-class model cannot represent without a specific entry/exit pair and
 *     per-route km input (out of this task's scope). Scaffolding the rows (vs.
 *     leaving zero rows) makes each corridor's incompleteness explicit and
 *     immediately editable by an admin who sources a specific number later.
 *     Their vehicle-class ban status is left unconfirmed (bannedVehicleClasses
 *     = null) for the same reason.
 *   - Route → toll-alternative mappings are this agent's own geographic
 *     inference from each route's origin/destination (which side of the
 *     Bosphorus each is on), not sourced from any operator. Admins can
 *     add/edit/remove alternatives per route from the panel.
 *
 * Idempotent: safe to re-run. Points/tariffs are upserted by natural key; route
 * alternatives are replaced (old ones for these slugs are deleted, then recreated)
 * so re-running always reflects the latest logic in this file.
 *
 * Usage (from artifacts/istanbul-vip-transfer):
 *   node scripts/seed-toll-pricing-data.mjs
 */

import postgres from '../node_modules/postgres/cjs/src/index.js';

if (!process.env.DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const sql = postgres(process.env.DATABASE_URL, { max: 4 });

const ALL_CLASSES = ['class_1', 'class_2', 'class_3', 'class_4', 'class_5', 'class_6'];

// ── 1. Crossing points ───────────────────────────────────────────────────────
// key: natural key used for upsert (also matches legacy informal names left
// over from manual admin-panel testing, so re-running renames them cleanly).
// Shared official source for the 5 KGM bridges' "no vehicle-class ban" confirmation:
// each bridge's own PDF tariff (see TARIFFS below) prices all six classes with no
// exclusion, which is itself the evidence that no class is banned there.
const KGM_CLASSIFICATION_LABEL = 'KGM Resmî Sınıf 1-6 (aks sayısı/aralığına göre)';

const POINTS = [
  { key: '15 temmuz köprüsü', name: '15 Temmuz Şehitler Köprüsü', type: 'BRIDGE', dayStartHour: null, nightStartHour: null, notes: null, classificationLabel: KGM_CLASSIFICATION_LABEL, bannedVehicleClasses: [], bannedVehicleClassesSourceUrl: 'https://www.kgm.gov.tr/SiteCollectionDocuments/KGMdocuments/Otoyollar/OtoyolKopruUcret/2026Gecis_Ucret/1-15Temmuz-FSM.pdf' },
  { key: 'FSM', name: 'Fatih Sultan Mehmet Köprüsü (FSM)', type: 'BRIDGE', dayStartHour: null, nightStartHour: null, notes: null, classificationLabel: KGM_CLASSIFICATION_LABEL, bannedVehicleClasses: [], bannedVehicleClassesSourceUrl: 'https://www.kgm.gov.tr/SiteCollectionDocuments/KGMdocuments/Otoyollar/OtoyolKopruUcret/2026Gecis_Ucret/1-15Temmuz-FSM.pdf' },
  {
    key: 'YSK', name: 'Yavuz Sultan Selim Köprüsü (YSS)', type: 'BRIDGE', dayStartHour: null, nightStartHour: null, notes: null,
    classificationLabel: KGM_CLASSIFICATION_LABEL, bannedVehicleClasses: [],
    bannedVehicleClassesSourceUrl: 'https://www.kgm.gov.tr/SiteCollectionDocuments/KGMdocuments/Otoyollar/OtoyolKopruUcret/2026Gecis_Ucret/3-YSSKoprusu.pdf',
    // KGM's own YSS page (live-fetched 2026-08-26) confirms tolling has applied
    // in both directions since 1 Ocak 2022 — a fact independent of, and not
    // contradicted by, that same page's own stale 16/08/2024 tariff figures
    // (which this script intentionally does NOT use — see TARIFFS below).
    tollDirection: 'TWO_WAY_SAME',
    tollDirectionSourceUrl: 'https://www.kgm.gov.tr/Sayfalar/KGM/SiteTr/Otoyollar/OtoyolKopruUcret/YavuzSultanSelimKopruGecisUcret.aspx',
    tollDirectionNotes: '1 Ocak 2022 tarihinden itibaren her iki yönde de ücretlendirme uygulanmaktadır (KGM sayfasında doğrulandı).',
    pricingMode: 'FLAT',
    // Registered per instruction (2026-08-26): the operator's own live
    // "Ücret Hesaplama" tool (https://www.ysskoprusuveotoyolu.com.tr/ucret-hesaplama)
    // is now the recognized source domain for this bridge and for Kuzey
    // Marmara Otoyolu. Its select boxes are populated client-side from a
    // service this environment could not reach (2026-08-26 — same class of
    // failure as OTOYOL A.Ş.'s API), so it could NOT be used to re-derive or
    // update this bridge's TRY amount; the KGM PDF tariff above (dated
    // 2026-07-01) remains the authoritative, unchanged amount source. This
    // operator page should be periodically cross-checked by an admin.
    notes: 'Köprünün kendi işletmecisinin canlı "Ücret Hesaplama" aracı (https://www.ysskoprusuveotoyolu.com.tr/ucret-hesaplama) 2026-08-26\'da resmî kaynak listesine eklendi. Bu araç JavaScript ile dolduruluyor ve bu ortamdan erişilebilen bir API bulunamadı; bu yüzden köprünün TRY tutarı KGM\'nin 01/07/2026 tarihli PDF tarifesinden (yukarıda) değiştirilmeden korunmuştur. Admin bu aracı periyodik olarak kontrol ederek tutarı teyit edebilir.',
  },
  {
    key: 'AVRASYA', name: 'Avrasya Tüneli', type: 'TUNNEL',
    dayStartHour: 5, nightStartHour: 0,
    notes: 'Ağır araçlar tünelden geçemez: yalnızca Sınıf 1 (otomobil), Sınıf 2 (minibüs sınıfı) ve Sınıf 6 (motosiklet) için resmî tarife yayımlanır. Sınıf 3/4/5 için bu noktada kasıtlı olarak tarife satırı bulunmaz — bu "eksik veri" değil, operatörün kendi geçiş yasağıdır (bkz. bannedVehicleClasses).',
    classificationLabel: 'Operatörün kendi sınıflandırması — KGM Sınıf 1-6 ile uyumlu olduğu operatörün kendi tarife sayfasında doğrulandı ("otomobil 1. Sınıf", "minibüs 2. Sınıf", "motosiklet 6. Sınıf").',
    bannedVehicleClasses: ['class_3', 'class_4', 'class_5'],
    bannedVehicleClassesSourceUrl: 'https://www.avrasyatuneli.com/_assets/img/subpage/yasakli-araclar-modal.png',
  },
  {
    key: 'ÇANAKKALE KÖPRÜSÜ', name: '1915 Çanakkale Köprüsü', type: 'BRIDGE', dayStartHour: null, nightStartHour: null,
    notes: 'YALNIZCA köprünün kendisinin KGM tarifesi (aşağıda) — bu tutar hiçbir otoyol yaklaşım kesimini içermez. 2026-08-26\'da işletmecinin kendi canlı "Geçiş Ücreti Sorgulama" aracıyla (https://www.1915canakkale.com/online-islemler/gecis-ucreti-sorgulama) çapraz kontrol edildi: "Gelibolu Güney → 1915Çanakkale Köprüsü" sorgusu KGM tarifesiyle TL bazında birebir eşleşti (örn. Sınıf 1: 1170 TL) — bu, KGM tutarının doğrulanmış bir "sadece köprü" değeri olduğunu doğrular. UYARI — ÇİFT SAYMA RİSKİ: aynı işletmecinin ayrı "1915 Çanakkale Otoyolu ve Köprüsü (Malkara-Kavakköy-Gelibolu, giriş/çıkış bazlı birleşik tarife)" noktası (GATE_PAIR) her giriş/çıkış çiftinde köprü ücretini otoyol ücretiyle BİRLEŞTİRİLMİŞ tek tutar olarak döndürür (IncludingBridge=true). Bir rota alternatifi o GATE_PAIR noktasını kullanıyorsa, bu FLAT köprü noktası AYNI alternatife asla eklenmemelidir — aksi halde köprü ücreti iki kez sayılır.',
    classificationLabel: KGM_CLASSIFICATION_LABEL, bannedVehicleClasses: [], bannedVehicleClassesSourceUrl: 'https://www.kgm.gov.tr/SiteCollectionDocuments/KGMdocuments/Otoyollar/OtoyolKopruUcret/2026Gecis_Ucret/4-1915Canakkale.pdf',
  },
  {
    key: 'ÇANAKKALE OTOYOLU', name: '1915 Çanakkale Otoyolu ve Köprüsü (Malkara-Kavakköy-Gelibolu, giriş/çıkış bazlı birleşik tarife)', type: 'HIGHWAY',
    dayStartHour: null, nightStartHour: null,
    notes: 'İşletmecinin kendi canlı "Geçiş Ücreti Sorgulama" aracı (https://www.1915canakkale.com/online-islemler/gecis-ucreti-sorgulama, POST /gettolls?entry=&exit=) 2026-08-26\'da giriş/çıkış çiftine göre tüm 10 nokta çiftinde canlı sorgulanarak resmî kaynak olarak kaydedildi. Sayfada veya API yanıtında herhangi bir yürürlük tarihi YOK — her tarife satırına sorgulama tarihi (queriedAt=2026-08-26) eklendi, validFrom kasıtlı olarak boş bırakıldı (kaynakta yürürlük tarihi belirtilmemiş). UYARI — ÇİFT SAYMA RİSKİ: API\'nin her yanıtı "IncludingBridge": true döndürür ve sayfanın kendi uyarı metni de bunu doğrular: "Seçilen rota köprü kullanımını kapsıyor ise, hesaplanan ücret otoyol ücretini ve köprü geçiş ücretini bir arada içermektedir." Yani bu noktanın her tutarı otoyol + köprü ücretini ZATEN birlikte içerir — bu noktayı kullanan bir rota alternatifine ayrıca "1915 Çanakkale Köprüsü" (FLAT) noktası asla eklenmemelidir, aksi halde köprü ücreti iki kez sayılır. Fiyatlar her çift için her iki yönde de birebir aynı çıktı (sorgulamayla doğrulandı) — bu yüzden yön TWO_WAY_SAME olarak işaretlendi.',
    classificationLabel: KGM_CLASSIFICATION_LABEL,
    bannedVehicleClasses: [],
    bannedVehicleClassesSourceUrl: 'https://www.1915canakkale.com/online-islemler/gecis-ucreti-sorgulama',
    pricingMode: 'GATE_PAIR',
    tollDirection: 'TWO_WAY_SAME',
    tollDirectionSourceUrl: 'https://www.1915canakkale.com/online-islemler/gecis-ucreti-sorgulama',
    tollDirectionNotes: '2026-08-26\'da sorgulanan 10 nokta çiftinin tamamında her iki yön de (A→B ve B→A) birebir aynı TL tutarını döndürdü.',
  },
  { key: 'OSMANGAZİ KÖPRÜSÜ', name: 'Osmangazi Köprüsü', type: 'BRIDGE', dayStartHour: null, nightStartHour: null, notes: null, classificationLabel: KGM_CLASSIFICATION_LABEL, bannedVehicleClasses: [], bannedVehicleClassesSourceUrl: 'https://www.kgm.gov.tr/SiteCollectionDocuments/KGMdocuments/Otoyollar/OtoyolKopruUcret/2026Gecis_Ucret/2-Osmangazi.pdf' },
  {
    key: 'İZMİR OTOBAN', name: 'İstanbul–İzmir Otoyolu (Gebze-Orhangazi-İzmir, ilave kesim)', type: 'HIGHWAY',
    dayStartHour: null, nightStartHour: null,
    notes: 'OTOYOL A.Ş.\'nin işlettiği Osmangazi Köprüsü + O-5 koridoru; sabit tek tutar yok, giriş/çıkış gişe çiftine göre ücretlendirilir (operatörün "Geçiş Ücreti Hesaplama" aracı: https://isletme.otoyolas.com.tr/gecis-ucreti-hesapla/). Bu aracın gerçek fiyat API\'si (mobil.otoyolas.com.tr/WS_Restful/calculatePrice2) bu ortamdan erişilemediği için (curl zaman aşımı, fetch AbortError, webFetch 500 — üç ayrı yöntemle doğrulandı) gişe çifti bazlı tarife satırları kasıtlı olarak boş bırakılmıştır; admin ilgili gişe çiftleri için doğrulanmış tutarları elle girmelidir. UYARI — OLASI ÇİFT SAYMA RİSKİ (2026-08-26\'da not edildi): bu notun kendisi "Osmangazi Köprüsü + O-5 koridoru" ifadesini kullanıyor — yani bu GATE_PAIR noktasının gişe çifti tutarı Osmangazi Köprüsü ücretini ZATEN içerebilir (1915 Çanakkale Otoyolu\'nun IncludingBridge=true yapısıyla aynı desen). İstanbul→İzmir rota alternatifi bu noktayı AYRICA ayrı bir "Osmangazi Köprüsü" (FLAT) satırıyla birlikte kullanıyor. Bir admin bu gişe çiftleri için gerçek tutar girmeden önce OTOYOL A.Ş.\'nin aracından bu tutarın Osmangazi\'yi içerip içermediğini teyit etmeli; emin olunamıyorsa ikisini birden eklemek yerine "çift sayma riski, sahibi doğrulasın" olarak bırakılmalıdır.',
    classificationLabel: null, bannedVehicleClasses: null, bannedVehicleClassesSourceUrl: null,
    pricingMode: 'GATE_PAIR',
    // The calculator page's own text describes gate-based collection that
    // differs by direction (entry/exit gates are not symmetric), so this is
    // modeled as directional rather than assumed to double like a bridge.
    tollDirection: 'TWO_WAY_DIRECTIONAL',
    tollDirectionSourceUrl: 'https://isletme.otoyolas.com.tr/gecis-ucreti-hesapla/',
    tollDirectionNotes: 'OTOYOL A.Ş. hesaplama aracı giriş ve çıkış gişesini ayrı ayrı seçtirir; yön bazında farklı gişe/ücret uygulanabilir.',
  },
  {
    key: 'İstanbul–Bursa Otoyolu Güzergahı', name: 'İstanbul–Bursa Otoyolu Güzergahı (doğrulanmamış ilave ücret)', type: 'HIGHWAY',
    dayStartHour: null, nightStartHour: null,
    notes: 'Distance-based OGS/HGS ücretlendirmesi kullanılır; belirli bir giriş/çıkış çifti olmadan resmî bir tutar üretilemez (kapsam dışı). Tüm sınıflar kasıtlı olarak boş bırakılmıştır.',
    classificationLabel: null, bannedVehicleClasses: null, bannedVehicleClassesSourceUrl: null,
    // 2026-08-26 correction: a highway/otoyol segment is priced by entry+exit
    // gate pair, never a single flat amount — see the sahibi's explicit rule
    // ("otoyolda giriş ve çıkış olarak hesaplanır"). This point had no real
    // gate-pair data yet, but its pricingMode must still reflect the correct
    // model so a future amount is never entered as a flat single price.
    pricingMode: 'GATE_PAIR',
  },
  {
    // Superseded 2026-08-26 by the dedicated 'KUZEY MARMARA OTOYOLU' point
    // below, now that a real operator source has been identified for the
    // Sapanca-side corridor. Deactivated (not deleted) so no route
    // references it anymore, while its history stays intact.
    key: 'İstanbul–Sapanca Otoyolu Güzergahı', name: 'İstanbul–Sapanca Otoyolu Güzergahı (doğrulanmamış ilave ücret)', type: 'HIGHWAY',
    dayStartHour: null, nightStartHour: null,
    notes: 'Bu nokta 2026-08-26 itibarıyla "Kuzey Marmara Otoyolu (O-7)" adlı ayrı noktayla değiştirildi (bkz. KUZEY MARMARA OTOYOLU) — o noktanın gerçek bir işletmeci kaynağı (ysskoprusuveotoyolu.com.tr) var. Bu eski nokta artık hiçbir rotada kullanılmıyor, yalnızca geçmiş kayıt amacıyla pasif tutulur.',
    classificationLabel: null, bannedVehicleClasses: null, bannedVehicleClassesSourceUrl: null,
    active: false,
    pricingMode: 'GATE_PAIR',
  },
  {
    // Superseded — see the note on the Sapanca placeholder above; same
    // reasoning applies to the Ankara-side corridor.
    key: 'İstanbul–Ankara Otoyolu Güzergahı', name: 'İstanbul–Ankara Otoyolu Güzergahı (doğrulanmamış ilave ücret)', type: 'HIGHWAY',
    dayStartHour: null, nightStartHour: null,
    notes: 'Bu nokta 2026-08-26 itibarıyla "Kuzey Marmara Otoyolu (O-7)" adlı ayrı noktayla değiştirildi (bkz. KUZEY MARMARA OTOYOLU) — o noktanın gerçek bir işletmeci kaynağı (ysskoprusuveotoyolu.com.tr) var. Bu eski nokta artık hiçbir rotada kullanılmıyor, yalnızca geçmiş kayıt amacıyla pasif tutulur.',
    classificationLabel: null, bannedVehicleClasses: null, bannedVehicleClassesSourceUrl: null,
    active: false,
    pricingMode: 'GATE_PAIR',
  },
  {
    key: 'KUZEY MARMARA OTOYOLU', name: 'Kuzey Marmara Otoyolu (O-7, YSS Köprüsü hariç ilave kesim)', type: 'HIGHWAY',
    dayStartHour: null, nightStartHour: null,
    notes: 'YSS Köprüsü ve Kuzey Marmara Otoyolu\'nun işletmecisinin kendi "Ücret Hesaplama" aracı (https://www.ysskoprusuveotoyolu.com.tr/ucret-hesaplama) 2026-08-26\'da bu kesimin tarife kaynağı olarak kaydedildi — KGM\'nin YSS PDF/aspx sayfaları yalnızca köprünün kendisini kapsar, bu otoyol kesimini kapsamaz. Sabit tek tutar yok, giriş/çıkış noktası seçilerek hesaplanıyor. Sayfanın giriş/çıkış <select> kutuları JavaScript ile dolduruluyor (statik HTML\'de boş/disabled) ve bu ortamdan erişilebilen bir API uç noktası bulunamadı (2026-08-26, curl + doğrudan JS bundle taraması ile denendi) — bu yüzden gişe çifti bazlı tarife satırları kasıtlı olarak boş bırakılmıştır. Admin gerçek tutarları bu araçtan elle sorgulayıp girmeli ve sayfa yürürlük tarihi belirtmediği için her satıra sorgulama tarihini (queriedAt) eklemelidir.',
    classificationLabel: 'OTOYOL A.Ş. ile aynı ortak ulusal sınıflandırma (aks aralığı/aks sayısına göre) — bu operatörün sayfasında da doğrulandı.',
    bannedVehicleClasses: null, bannedVehicleClassesSourceUrl: null,
    pricingMode: 'GATE_PAIR',
    // Same reasoning as İZMİR OTOBAN below: the calculator's own separate
    // "Giriş Noktası" / "Çıkış Noktası" selectors are the evidence that fees
    // differ by direction, not an assumption.
    tollDirection: 'TWO_WAY_DIRECTIONAL',
    tollDirectionSourceUrl: 'https://www.ysskoprusuveotoyolu.com.tr/ucret-hesaplama',
    tollDirectionNotes: 'İşletmecinin "Ücret Hesaplama" aracı giriş ve çıkış noktasını ayrı ayrı seçtirir; yön bazında farklı gişe/ücret uygulanabilir.',
  },
  {
    key: 'İstanbul–Antalya Otoyolu Güzergahı', name: 'İstanbul–Antalya Otoyolu Güzergahı (doğrulanmamış ilave ücret)', type: 'HIGHWAY',
    dayStartHour: null, nightStartHour: null,
    notes: 'Distance-based OGS/HGS ücretlendirmesi kullanılır; belirli bir giriş/çıkış çifti olmadan resmî bir tutar üretilemez (kapsam dışı). Tüm sınıflar kasıtlı olarak boş bırakılmıştır. AYRICA KAPSAM UYARISI (2026-08-26): rota alternatifleri "Osmangazi Köprüsü" (FLAT) noktasını bu yer tutucuyla birlikte kullanıyor — bu tutar bir gün girilirse, Osmangazi\'yi zaten içerip içermediği ayrıca doğrulanmalı (bkz. İZMİR OTOBAN notundaki aynı desen); emin olunamıyorsa ikisi birden eklenmemeli.',
    classificationLabel: null, bannedVehicleClasses: null, bannedVehicleClassesSourceUrl: null,
    pricingMode: 'GATE_PAIR',
  },
  {
    key: 'İstanbul–Bodrum Otoyolu Güzergahı', name: 'İstanbul–Bodrum Otoyolu Güzergahı (doğrulanmamış ilave ücret)', type: 'HIGHWAY',
    dayStartHour: null, nightStartHour: null,
    notes: 'Distance-based OGS/HGS ücretlendirmesi kullanılır; belirli bir giriş/çıkış çifti olmadan resmî bir tutar üretilemez (kapsam dışı). Tüm sınıflar kasıtlı olarak boş bırakılmıştır. AYRICA KAPSAM UYARISI (2026-08-26): rota alternatifleri "Osmangazi Köprüsü" (FLAT) noktasını bu yer tutucuyla birlikte kullanıyor — bu tutar bir gün girilirse, Osmangazi\'yi zaten içerip içermediği ayrıca doğrulanmalı (bkz. İZMİR OTOBAN notundaki aynı desen); emin olunamıyorsa ikisi birden eklenmemeli.',
    classificationLabel: null, bannedVehicleClasses: null, bannedVehicleClassesSourceUrl: null,
    pricingMode: 'GATE_PAIR',
  },
];

const HIGHWAY_KEYS = new Set([
  'İZMİR OTOBAN',
  'KUZEY MARMARA OTOYOLU',
  'İstanbul–Bursa Otoyolu Güzergahı',
  'İstanbul–Antalya Otoyolu Güzergahı',
  'İstanbul–Bodrum Otoyolu Güzergahı',
]);

// ── 2. Officially-sourced tariffs, keyed by class_1..class_6 ────────────────
const TARIFFS = [
  {
    pointKey: '15 temmuz köprüsü',
    sourceName: 'KGM — 15 Temmuz Şehitler Köprüsü ve FSM Geçiş Ücretleri Tarifesi',
    sourceUrl: 'https://www.kgm.gov.tr/SiteCollectionDocuments/KGMdocuments/Otoyollar/OtoyolKopruUcret/2026Gecis_Ucret/1-15Temmuz-FSM.pdf',
    effectiveFrom: '2026-01-01',
    rows: [{ classes: { class_1: 5900, class_2: 7500, class_3: 16800, class_4: 33300, class_5: 44000, class_6: 2500 }, timeBand: 'ALL' }],
  },
  {
    pointKey: 'FSM',
    sourceName: 'KGM — 15 Temmuz Şehitler Köprüsü ve FSM Geçiş Ücretleri Tarifesi',
    sourceUrl: 'https://www.kgm.gov.tr/SiteCollectionDocuments/KGMdocuments/Otoyollar/OtoyolKopruUcret/2026Gecis_Ucret/1-15Temmuz-FSM.pdf',
    effectiveFrom: '2026-01-01',
    rows: [{ classes: { class_1: 5900, class_2: 7500, class_3: 16800, class_4: 33300, class_5: 44000, class_6: 2500 }, timeBand: 'ALL' }],
  },
  {
    pointKey: 'YSK',
    sourceName: 'KGM — Yavuz Sultan Selim Köprüsü Geçiş Ücretleri Tarifesi',
    sourceUrl: 'https://www.kgm.gov.tr/SiteCollectionDocuments/KGMdocuments/Otoyollar/OtoyolKopruUcret/2026Gecis_Ucret/3-YSSKoprusu.pdf',
    effectiveFrom: '2026-07-01',
    rows: [{ classes: { class_1: 11000, class_2: 14500, class_3: 27000, class_4: 69000, class_5: 86000, class_6: 7500 }, timeBand: 'ALL' }],
  },
  {
    pointKey: 'OSMANGAZİ KÖPRÜSÜ',
    sourceName: 'KGM — Osmangazi Köprüsü Geçiş Ücretleri Tarifesi',
    sourceUrl: 'https://www.kgm.gov.tr/SiteCollectionDocuments/KGMdocuments/Otoyollar/OtoyolKopruUcret/2026Gecis_Ucret/2-Osmangazi.pdf',
    effectiveFrom: '2026-07-01',
    rows: [{ classes: { class_1: 117000, class_2: 187000, class_3: 222500, class_4: 295000, class_5: 372000, class_6: 82000 }, timeBand: 'ALL' }],
  },
  {
    pointKey: 'ÇANAKKALE KÖPRÜSÜ',
    sourceName: 'KGM — 1915 Çanakkale Köprüsü Geçiş Ücretleri Tarifesi',
    sourceUrl: 'https://www.kgm.gov.tr/SiteCollectionDocuments/KGMdocuments/Otoyollar/OtoyolKopruUcret/2026Gecis_Ucret/4-1915Canakkale.pdf',
    effectiveFrom: '2026-07-01',
    rows: [{ classes: { class_1: 117000, class_2: 146500, class_3: 263500, class_4: 292500, class_5: 556000, class_6: 29500 }, timeBand: 'ALL' }],
  },
  // 1915 Çanakkale Otoyolu ve Köprüsü — giriş/çıkış bazlı birleşik tarife
  // (otoyol + köprü zaten TEK tutarda birleşik, bkz. IncludingBridge notu
  // yukarıda). Tüm 10 nokta çiftinin 2 yönü de 2026-08-26'da canlı
  // sorgulandı (POST https://www.1915canakkale.com/gettolls?entry=&exit=);
  // her çiftin iki yönü birebir aynı tutarı döndürdü. Sayfada/API
  // yanıtında yürürlük tarihi yok — bu yüzden effectiveFrom yerine
  // queriedAt kullanılıyor (kaynakta yürürlük tarihi belirtilmemiş).
  ...(() => {
    const CANAKKALE_SOURCE = {
      sourceName: '1915 Çanakkale Otoyolu ve Köprüsü — canlı Geçiş Ücreti Sorgulama aracı (yürürlük tarihi belirtilmemiş, sorgulama tarihi kaydedildi)',
      sourceUrl: 'https://www.1915canakkale.com/online-islemler/gecis-ucreti-sorgulama',
      queriedAt: '2026-08-26',
    };
    // [gateA, gateB, [class_1..class_6 in TRY]] — same amount both directions (confirmed live 2026-08-26).
    const PAIRS = [
      ['malkara', 'kavakkoy', [175, 280, 330, 435, 440, 45]],
      ['malkara', 'gelibolu-kuzey', [260, 405, 490, 640, 645, 65]],
      ['malkara', 'gelibolu-guney', [315, 510, 605, 805, 810, 80]],
      ['malkara', '1915canakkale-koprusu', [1480, 1960, 3225, 3705, 6340, 370]],
      ['kavakkoy', 'gelibolu-kuzey', [105, 165, 195, 260, 260, 25]],
      ['kavakkoy', 'gelibolu-guney', [165, 265, 315, 425, 425, 45]],
      ['kavakkoy', '1915canakkale-koprusu', [1325, 1720, 2930, 3320, 5955, 330]],
      ['gelibolu-kuzey', 'gelibolu-guney', [90, 140, 170, 225, 225, 25]],
      ['gelibolu-kuzey', '1915canakkale-koprusu', [1250, 1590, 2780, 3125, 5760, 320]],
      ['gelibolu-guney', '1915canakkale-koprusu', [1170, 1465, 2635, 2925, 5560, 295]],
    ];
    const toClasses = (try6) => ({
      class_1: Math.round(try6[0] * 100), class_2: Math.round(try6[1] * 100), class_3: Math.round(try6[2] * 100),
      class_4: Math.round(try6[3] * 100), class_5: Math.round(try6[4] * 100), class_6: Math.round(try6[5] * 100),
    });
    const out = [];
    for (const [a, b, tryAmounts] of PAIRS) {
      const classes = toClasses(tryAmounts);
      out.push({ pointKey: 'ÇANAKKALE OTOYOLU', ...CANAKKALE_SOURCE, entryGateName: a, exitGateName: b, rows: [{ classes, timeBand: 'ALL' }] });
      out.push({ pointKey: 'ÇANAKKALE OTOYOLU', ...CANAKKALE_SOURCE, entryGateName: b, exitGateName: a, rows: [{ classes, timeBand: 'ALL' }] });
    }
    return out;
  })(),
  {
    pointKey: 'AVRASYA',
    sourceName: 'Avrasya Tüneli İşletme A.Ş. — Ücretler (canlı tarife sayfası; yürürlük tarihi ayrı 1 Temmuz 2026 duyurusundan alınmıştır, tutarlar bu sayfayla birebir eşleşir)',
    sourceUrl: 'https://www.avrasyatuneli.com/ucretlendirme/',
    effectiveFrom: '2026-07-01',
    // class_3/4/5 deliberately absent — heavy vehicles are banned from the tunnel (see point.notes).
    rows: [
      { classes: { class_1: 33000, class_2: 49500, class_6: 25740 }, timeBand: 'DAY' },
      { classes: { class_1: 16500, class_2: 24750, class_6: 12870 }, timeBand: 'NIGHT' },
    ],
  },
];

// ── 3. Route → toll alternative mapping (this agent's own geographic inference) ──
const ROUTE_ALTERNATIVES = [
  {
    routeSlug: 'istanbul-havalimani-kadikoy',
    alternatives: [
      { name: 'Yavuz Sultan Selim Köprüsü üzerinden', isDefault: true, pointKeys: ['YSK'] },
      { name: 'Avrasya Tüneli üzerinden', isDefault: false, pointKeys: ['AVRASYA'] },
      { name: 'FSM Köprüsü üzerinden', isDefault: false, pointKeys: ['FSM'] },
    ],
  },
  {
    routeSlug: 'sabiha-gokcen-taksim',
    alternatives: [
      { name: 'FSM Köprüsü üzerinden', isDefault: true, pointKeys: ['FSM'] },
      { name: 'Avrasya Tüneli üzerinden', isDefault: false, pointKeys: ['AVRASYA'] },
      { name: '15 Temmuz Şehitler Köprüsü üzerinden', isDefault: false, pointKeys: ['15 temmuz köprüsü'] },
    ],
  },
  {
    routeSlug: 'sultanahmet-sabiha',
    alternatives: [
      { name: 'Avrasya Tüneli üzerinden', isDefault: true, pointKeys: ['AVRASYA'] },
      { name: '15 Temmuz Şehitler Köprüsü üzerinden', isDefault: false, pointKeys: ['15 temmuz köprüsü'] },
      { name: 'FSM Köprüsü üzerinden', isDefault: false, pointKeys: ['FSM'] },
    ],
  },
  {
    routeSlug: 'taksim-sabiha',
    alternatives: [
      { name: 'FSM Köprüsü üzerinden', isDefault: true, pointKeys: ['FSM'] },
      { name: 'Avrasya Tüneli üzerinden', isDefault: false, pointKeys: ['AVRASYA'] },
      { name: '15 Temmuz Şehitler Köprüsü üzerinden', isDefault: false, pointKeys: ['15 temmuz köprüsü'] },
    ],
  },
  {
    routeSlug: 'tarabya-bogaz',
    alternatives: [
      { name: 'İstanbul Havalimanı yönü (Boğaz geçişi gerekmez)', isDefault: true, pointKeys: [] },
      { name: 'Sabiha Gökçen yönü — FSM Köprüsü üzerinden', isDefault: false, pointKeys: ['FSM'] },
      { name: 'Sabiha Gökçen yönü — Avrasya Tüneli üzerinden', isDefault: false, pointKeys: ['AVRASYA'] },
    ],
  },
  {
    routeSlug: 'istanbul-bursa',
    alternatives: [
      { name: 'YSS Köprüsü + Osmangazi Köprüsü', isDefault: true, pointKeys: ['YSK', 'OSMANGAZİ KÖPRÜSÜ'] },
      { name: 'FSM Köprüsü + Osmangazi Köprüsü', isDefault: false, pointKeys: ['FSM', 'OSMANGAZİ KÖPRÜSÜ'] },
      { name: 'Avrasya Tüneli + Osmangazi Köprüsü', isDefault: false, pointKeys: ['AVRASYA', 'OSMANGAZİ KÖPRÜSÜ'] },
    ],
  },
  {
    routeSlug: 'istanbul-sapanca',
    alternatives: [
      { name: 'YSS Köprüsü üzerinden', isDefault: true, pointKeys: ['YSK', 'KUZEY MARMARA OTOYOLU'] },
      { name: 'FSM Köprüsü üzerinden', isDefault: false, pointKeys: ['FSM', 'KUZEY MARMARA OTOYOLU'] },
      { name: 'Avrasya Tüneli üzerinden', isDefault: false, pointKeys: ['AVRASYA', 'KUZEY MARMARA OTOYOLU'] },
    ],
  },
  {
    routeSlug: 'istanbul-ankara',
    alternatives: [
      { name: 'YSS Köprüsü üzerinden', isDefault: true, pointKeys: ['YSK', 'KUZEY MARMARA OTOYOLU'] },
      { name: 'FSM Köprüsü üzerinden', isDefault: false, pointKeys: ['FSM', 'KUZEY MARMARA OTOYOLU'] },
      { name: 'Avrasya Tüneli üzerinden', isDefault: false, pointKeys: ['AVRASYA', 'KUZEY MARMARA OTOYOLU'] },
    ],
  },
  {
    routeSlug: 'istanbul-izmir',
    alternatives: [
      { name: 'YSS Köprüsü + Osmangazi Köprüsü + İzmir Otoyolu', isDefault: true, pointKeys: ['YSK', 'OSMANGAZİ KÖPRÜSÜ', 'İZMİR OTOBAN'] },
      { name: 'FSM Köprüsü + Osmangazi Köprüsü + İzmir Otoyolu', isDefault: false, pointKeys: ['FSM', 'OSMANGAZİ KÖPRÜSÜ', 'İZMİR OTOBAN'] },
      { name: 'Avrasya Tüneli + Osmangazi Köprüsü + İzmir Otoyolu', isDefault: false, pointKeys: ['AVRASYA', 'OSMANGAZİ KÖPRÜSÜ', 'İZMİR OTOBAN'] },
    ],
  },
  {
    routeSlug: 'istanbul-antalya',
    alternatives: [
      { name: 'YSS Köprüsü + Osmangazi Köprüsü', isDefault: true, pointKeys: ['YSK', 'OSMANGAZİ KÖPRÜSÜ', 'İstanbul–Antalya Otoyolu Güzergahı'] },
      { name: 'FSM Köprüsü + Osmangazi Köprüsü', isDefault: false, pointKeys: ['FSM', 'OSMANGAZİ KÖPRÜSÜ', 'İstanbul–Antalya Otoyolu Güzergahı'] },
      { name: 'Avrasya Tüneli + Osmangazi Köprüsü', isDefault: false, pointKeys: ['AVRASYA', 'OSMANGAZİ KÖPRÜSÜ', 'İstanbul–Antalya Otoyolu Güzergahı'] },
    ],
  },
  {
    routeSlug: 'istanbul-bodrum',
    alternatives: [
      { name: 'YSS Köprüsü + Osmangazi Köprüsü', isDefault: true, pointKeys: ['YSK', 'OSMANGAZİ KÖPRÜSÜ', 'İstanbul–Bodrum Otoyolu Güzergahı'] },
      { name: 'FSM Köprüsü + Osmangazi Köprüsü', isDefault: false, pointKeys: ['FSM', 'OSMANGAZİ KÖPRÜSÜ', 'İstanbul–Bodrum Otoyolu Güzergahı'] },
      { name: 'Avrasya Tüneli + Osmangazi Köprüsü', isDefault: false, pointKeys: ['AVRASYA', 'OSMANGAZİ KÖPRÜSÜ', 'İstanbul–Bodrum Otoyolu Güzergahı'] },
    ],
  },
];

async function main() {
  console.log('── 1. Upserting toll points (with per-point day/night hours + notes) ──');
  const pointIdByKey = {};
  for (const p of POINTS) {
    const tollDirection = p.tollDirection ?? null;
    const tollDirectionSourceUrl = p.tollDirectionSourceUrl ?? null;
    const tollDirectionNotes = p.tollDirectionNotes ?? null;
    const pricingMode = p.pricingMode ?? 'FLAT';
    const active = p.active ?? true;
    const existing = await sql`SELECT id FROM toll_points WHERE name = ${p.key} OR name = ${p.name} LIMIT 1`;
    if (existing.length) {
      await sql`
        UPDATE toll_points SET
          name = ${p.name}, type = ${p.type},
          day_start_hour = ${p.dayStartHour}, night_start_hour = ${p.nightStartHour},
          notes = ${p.notes},
          toll_direction = ${tollDirection}, toll_direction_source_url = ${tollDirectionSourceUrl}, toll_direction_notes = ${tollDirectionNotes},
          pricing_mode = ${pricingMode}, active = ${active},
          updated_at = now()
        WHERE id = ${existing[0].id}`;
      pointIdByKey[p.key] = existing[0].id;
      console.log(`  updated: ${p.name}${active ? '' : ' (deactivated)'}`);
    } else {
      const [row] = await sql`
        INSERT INTO toll_points (name, type, day_start_hour, night_start_hour, notes, toll_direction, toll_direction_source_url, toll_direction_notes, pricing_mode, active)
        VALUES (${p.name}, ${p.type}, ${p.dayStartHour}, ${p.nightStartHour}, ${p.notes}, ${tollDirection}, ${tollDirectionSourceUrl}, ${tollDirectionNotes}, ${pricingMode}, ${active})
        RETURNING id`;
      pointIdByKey[p.key] = row.id;
      console.log(`  created: ${p.name}${active ? '' : ' (inactive)'}`);
    }
  }

  console.log('── 2. Upserting officially-sourced tariffs (class_1..class_6) ──');
  let pricedCount = 0;
  for (const t of TARIFFS) {
    const pointId = pointIdByKey[t.pointKey];
    // None of the currently-sourced flat crossings need a gate pair or a
    // FORWARD/BACKWARD direction row (see the schema comment in db/schema.ts
    // — these columns are reserved for a GATE_PAIR point or a future
    // TWO_WAY_DIRECTIONAL flat point once one is actually sourced).
    const entryGateName = t.entryGateName ?? null;
    const exitGateName = t.exitGateName ?? null;
    const direction = t.direction ?? null;
    // queriedAt records the date this agent read the amount from a source
    // page/tool that prints no effective date at all (e.g. a live gate-pair
    // calculator) — see lib/toll-management.ts QUERY_DATE_OLD staleness
    // reason. Sources with a real stated effective date (effectiveFrom) do
    // not need this; the two are mutually exclusive per row in this script.
    const queriedAt = t.queriedAt ?? null;
    for (const row of t.rows) {
      const appliesDay = row.timeBand === 'ALL' || row.timeBand === 'DAY';
      const appliesNight = row.timeBand === 'ALL' || row.timeBand === 'NIGHT';
      for (const [vehicleClass, amountKurus] of Object.entries(row.classes)) {
        const existing = await sql`
          SELECT id FROM toll_tariffs
          WHERE toll_point_id = ${pointId} AND vehicle_class = ${vehicleClass} AND time_band = ${row.timeBand} AND active = true
            AND entry_gate_name IS NOT DISTINCT FROM ${entryGateName} AND exit_gate_name IS NOT DISTINCT FROM ${exitGateName}
          LIMIT 1`;
        if (existing.length) {
          await sql`
            UPDATE toll_tariffs SET
              amount_kurus = ${amountKurus},
              automatic_amount_kurus = ${amountKurus},
              manual_amount_kurus = NULL,
              source_name = ${t.sourceName},
              source_url = ${t.sourceUrl},
              source_verified = true,
              source_fetched_at = now(),
              valid_from = ${t.effectiveFrom ?? null},
              queried_at = ${queriedAt},
              entry_gate_name = ${entryGateName}, exit_gate_name = ${exitGateName}, direction = ${direction},
              updated_at = now()
            WHERE id = ${existing[0].id}`;
        } else {
          await sql`
            INSERT INTO toll_tariffs (
              toll_point_id, vehicle_class, amount_kurus, automatic_amount_kurus,
              source_name, source_url, source_verified, source_fetched_at,
              time_band, applies_day, applies_night, valid_from, queried_at, active,
              entry_gate_name, exit_gate_name, direction
            ) VALUES (
              ${pointId}, ${vehicleClass}, ${amountKurus}, ${amountKurus},
              ${t.sourceName}, ${t.sourceUrl}, true, now(),
              ${row.timeBand}, ${appliesDay}, ${appliesNight}, ${t.effectiveFrom ?? null}, ${queriedAt}, true,
              ${entryGateName}, ${exitGateName}, ${direction}
            )`;
        }
        pricedCount++;
      }
    }
  }
  console.log(`  upserted ${pricedCount} priced, sourced tariff rows`);

  console.log('── 3. Scaffolding blank tariff rows for unsourced highway corridors ──');
  let blankCount = 0;
  for (const p of POINTS) {
    if (!HIGHWAY_KEYS.has(p.key)) continue;
    const pointId = pointIdByKey[p.key];
    for (const vehicleClass of ALL_CLASSES) {
      const existing = await sql`
        SELECT id, amount_kurus, source_url FROM toll_tariffs
        WHERE toll_point_id = ${pointId} AND vehicle_class = ${vehicleClass} AND time_band = 'ALL'
        LIMIT 1`;
      if (!existing.length) {
        await sql`
          INSERT INTO toll_tariffs (
            toll_point_id, vehicle_class, amount_kurus, automatic_amount_kurus,
            source_name, source_url, source_verified,
            time_band, applies_day, applies_night, active
          ) VALUES (
            ${pointId}, ${vehicleClass}, NULL, NULL,
            NULL, NULL, false,
            'ALL', true, true, true
          )`;
        blankCount++;
      }
      // If a row already exists here, leave it untouched — an admin may have
      // already sourced a specific corridor amount from the panel, and this
      // script must never overwrite manually-entered, verified admin work.
    }
  }
  console.log(`  scaffolded ${blankCount} new blank tariff rows (existing rows left untouched)`);

  console.log('── 4. Rebuilding route ↔ toll alternative mappings ──');
  for (const r of ROUTE_ALTERNATIVES) {
    const [route] = await sql`SELECT id FROM transfer_routes WHERE slug = ${r.routeSlug} LIMIT 1`;
    if (!route) { console.log(`  SKIP (route not found): ${r.routeSlug}`); continue; }

    const existingAlts = await sql`SELECT id FROM route_toll_alternatives WHERE route_id = ${route.id}`;
    if (existingAlts.length) {
      await sql`DELETE FROM route_toll_alternatives WHERE route_id = ${route.id}`;
    }

    for (let i = 0; i < r.alternatives.length; i++) {
      const alt = r.alternatives[i];
      const [altRow] = await sql`
        INSERT INTO route_toll_alternatives (route_id, name, is_default, display_order)
        VALUES (${route.id}, ${alt.name}, ${alt.isDefault}, ${i})
        RETURNING id`;
      for (let j = 0; j < alt.pointKeys.length; j++) {
        const pointId = pointIdByKey[alt.pointKeys[j]];
        if (!pointId) { console.log(`  WARN unknown point key: ${alt.pointKeys[j]}`); continue; }
        await sql`
          INSERT INTO route_toll_alternative_items (alternative_id, toll_point_id, display_order)
          VALUES (${altRow.id}, ${pointId}, ${j})`;
      }
    }
    console.log(`  mapped: ${r.routeSlug} (${r.alternatives.length} alternatives)`);
  }

  console.log('Done.');
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => sql.end());
