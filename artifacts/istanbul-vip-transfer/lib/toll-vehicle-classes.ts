/**
 * Client-safe KGM toll vehicle-class taxonomy constants.
 *
 * Deliberately has NO 'server-only' import and NO database/server imports:
 * it is consumed directly by client components (e.g. the admin vehicle
 * form) as well as by lib/toll-management.ts (which re-exports it for
 * existing server-side callers). Keep this file free of server-only
 * dependencies — that is the entire reason it exists as a separate module.
 */

/**
 * KGM's official toll-tariff taxonomy. These are the ONLY allowed values —
 * never an invented class name (minivan/minibus/midibus/bus, from the prior
 * session, is a different, unrelated concept: see vehicles.pricingClass).
 * A vehicle's class must always be manually chosen by an admin who has
 * inspected it against the official ARAÇ TİPİ definitions below; the agent
 * and the system must never guess or pre-assign it.
 */
export const TOLL_VEHICLE_CLASSES = ['class_1', 'class_2', 'class_3', 'class_4', 'class_5', 'class_6'] as const;
export type TollVehicleClass = (typeof TOLL_VEHICLE_CLASSES)[number];

export function isTollVehicleClass(value: string): value is TollVehicleClass {
  return (TOLL_VEHICLE_CLASSES as readonly string[]).includes(value);
}

/** Admin-facing label shown next to each class in dropdowns. */
export const TOLL_VEHICLE_CLASS_LABELS: Record<TollVehicleClass, string> = {
  class_1: 'Sınıf 1',
  class_2: 'Sınıf 2',
  class_3: 'Sınıf 3',
  class_4: 'Sınıf 4',
  class_5: 'Sınıf 5',
  class_6: 'Sınıf 6',
};

/**
 * Official KGM ARAÇ TİPİ (vehicle-type) definitions per class, sourced from
 * KGM's 01/01/2026 geçiş ücreti tarifesi (FSM/15 Temmuz PDF). Shown as help
 * text so an admin can self-classify a vehicle correctly — the system never
 * infers this from a vehicle's body type or seating.
 *
 * Confirmed (2026-08-26) to be Turkey's shared national highway/bridge
 * vehicle-class scheme, not a KGM-only quirk: both OTOYOL A.Ş.
 * (isletme.otoyolas.com.tr) and the YSS Köprüsü/Kuzey Marmara Otoyolu
 * operator (ysskoprusuveotoyolu.com.tr) use the same 6-class, axle-based
 * taxonomy on their own fee pages/calculators.
 *
 * A vehicle's class is ALWAYS determined by its ruhsat (registration
 * document) — axle spacing for class_1/class_2, axle count for
 * class_3/class_4/class_5 — never by passenger/seat count. A "minibüs"
 * being cited as a class_1 example elsewhere does not mean every minibus in
 * the fleet is class_1: a long-wheelbase variant can fall in class_2, and a
 * midibüs/otobüs can be class_3+. Every vehicle→class assignment must be
 * chosen by an admin who has checked that specific vehicle's ruhsat — the
 * agent/system must never guess or bulk-assign it (see
 * TOLL_VEHICLE_CLASS_SELECTION_WARNING, shown wherever a class is picked).
 */
export const TOLL_VEHICLE_CLASS_DESCRIPTIONS: Record<TollVehicleClass, string> = {
  class_1: 'Aks aralığı 3,20 m’den küçük araçlar (otomobil, panelvan/kamyonet, minibüs örnek olarak verilir — aks aralığını kontrol edin)',
  class_2: 'Aks aralığı 3,20 m ve üzeri, 2 akslı araçlar (minibüs, midibüs, kamyonet vb. dahil olabilir — aks aralığını kontrol edin)',
  class_3: 'Üç akslı her türlü araç',
  class_4: 'Dört ve beş akslı her türlü araç',
  class_5: 'Altı ve üzeri akslı araçlar',
  class_6: 'Motosikletler',
};

/**
 * Shown in every admin UI wherever a class_1..class_6 value is picked —
 * whether for a tariff row, a vehicle→toll-point assignment, or elsewhere.
 * Never assign a class based on passenger count or a "similar vehicle"
 * example: it must be read off that exact vehicle's own ruhsat.
 */
export const TOLL_VEHICLE_CLASS_SELECTION_WARNING =
  'Sınıf, aracın ruhsatındaki aks aralığına/aks sayısına bakılarak seçilmelidir — yolcu sayısına veya "buna benzer araçlar genelde şu sınıftır" gibi bir tahmine göre değil. Bu taksonomi OTOYOL A.Ş. ve YSS Köprüsü/Kuzey Marmara Otoyolu işletmecisinde ortaktır, ancak her aracın sınıfı yine de kendi ruhsatından teyit edilmelidir.';
