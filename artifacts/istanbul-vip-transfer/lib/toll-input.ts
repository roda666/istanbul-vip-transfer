import { z } from 'zod';
import { isOfficialTollSourceUrl, TOLL_DIRECTIONS, TOLL_PRICING_MODES, TOLL_TIME_BANDS, TOLL_VEHICLE_CLASSES } from '@/lib/toll-management';

const nullableAmount = z.number().int().min(1).max(100_000_000).nullable().optional();
const nullableText = z.string().trim().max(500).nullable().optional();
const nullableDate = z.string().trim().max(40).nullable().optional();
const nullableHour = z.number().int().min(0).max(23).nullable().optional();
const nullableGateName = z.string().trim().min(1).max(160).nullable().optional();

export const tollPointInputSchema = z.object({
  name: z.string().trim().min(2, 'Geçiş noktası adı en az 2 karakter olmalıdır.').max(160),
  type: z.enum(['BRIDGE', 'TUNNEL', 'HIGHWAY']),
  active: z.boolean().default(true),
  /** Only meaningful for points with real DAY/NIGHT-banded tariffs (e.g. Avrasya Tüneli); leave both null otherwise. */
  dayStartHour: nullableHour,
  nightStartHour: nullableHour,
  /** e.g. Avrasya's heavy-vehicle ban — a genuine "not applicable" business rule, distinct from a missing tariff. */
  notes: nullableText,
  /** Which classification system applies at this point (e.g. "KGM Resmî Sınıf 1-6" or a note on a divergent operator scheme). */
  classificationLabel: nullableText,
  /** null = unconfirmed (ask owner), [] = confirmed nothing is banned, non-empty = confirmed banned list. Requires bannedVehicleClassesSourceUrl whenever non-null. */
  bannedVehicleClasses: z.array(z.enum(TOLL_VEHICLE_CLASSES)).max(6).nullable().optional(),
  bannedVehicleClassesSourceUrl: nullableText,
  /** null = unconfirmed (never checked against an official source). Requires tollDirectionSourceUrl whenever non-null. */
  tollDirection: z.enum(TOLL_DIRECTIONS).nullable().optional(),
  tollDirectionSourceUrl: nullableText,
  tollDirectionNotes: nullableText,
  /** FLAT (default) or GATE_PAIR — see toll-management.ts for what each means. */
  pricingMode: z.enum(TOLL_PRICING_MODES).default('FLAT'),
}).superRefine((value, context) => {
  const hasDay = value.dayStartHour != null;
  const hasNight = value.nightStartHour != null;
  if (hasDay !== hasNight) {
    context.addIssue({ code: 'custom', path: ['nightStartHour'], message: 'Gündüz ve gece başlangıç saatleri birlikte girilmeli veya ikisi de boş bırakılmalıdır.' });
  } else if (hasDay && hasNight && value.dayStartHour === value.nightStartHour) {
    context.addIssue({ code: 'custom', path: ['nightStartHour'], message: 'Gündüz ve gece başlangıç saatleri aynı olamaz.' });
  }
  // Same verification pattern as a tariff amount: a banned-classes claim
  // (including a confirmed-empty list) may only be saved with a matching
  // official source URL — never self-certified.
  if (value.bannedVehicleClasses !== undefined && value.bannedVehicleClasses !== null && !isOfficialTollSourceUrl(value.bannedVehicleClassesSourceUrl)) {
    context.addIssue({ code: 'custom', path: ['bannedVehicleClassesSourceUrl'], message: 'Yasaklı araç sınıfları listesi (boş liste dahil) yalnızca resmî bir kaynak adresiyle birlikte kaydedilebilir.' });
  }
  // Same pattern again for the tolling-direction claim.
  if (value.tollDirection != null && !isOfficialTollSourceUrl(value.tollDirectionSourceUrl)) {
    context.addIssue({ code: 'custom', path: ['tollDirectionSourceUrl'], message: 'Geçiş yönü bilgisi yalnızca resmî bir kaynak adresiyle birlikte kaydedilebilir.' });
  }
});

/** Assigns one vehicle's class at one specific toll point — never a single global class shared across all points. */
export const vehicleTollPointClassInputSchema = z.object({
  tollPointId: z.string().uuid(),
  vehicleClass: z.enum(TOLL_VEHICLE_CLASSES),
});

export const tollTariffInputSchema = z.object({
  tollPointId: z.string().uuid(),
  vehicleClass: z.enum(TOLL_VEHICLE_CLASSES),
  timeBand: z.enum(TOLL_TIME_BANDS).default('ALL'),
  automaticAmountKurus: nullableAmount,
  manualAmountKurus: nullableAmount,
  sourceName: nullableText,
  sourceUrl: nullableText,
  validFrom: nullableDate,
  validUntil: nullableDate,
  active: z.boolean().default(true),
  /** Only used at a GATE_PAIR point (e.g. Osmangazi Köprüsü / O-5) — the exact entry/exit gate names this row prices. Both must be set together. */
  entryGateName: nullableGateName,
  exitGateName: nullableGateName,
  /** Only used at a FLAT point whose tollDirection is TWO_WAY_DIRECTIONAL — which leg (FORWARD/BACKWARD) this row prices. */
  direction: z.enum(['FORWARD', 'BACKWARD']).nullable().optional(),
  /**
   * Required whenever an amount is set and the source page states no
   * effective date (validFrom is empty) — e.g. a live gate-pair fee
   * calculator such as OTOYOL A.Ş.'s or the YSS Köprüsü/Kuzey Marmara
   * Otoyolu operator's. This is the date the admin/agent personally
   * queried the calculator for this exact figure, and becomes the
   * staleness baseline in its place (see evaluateTollTariffStaleness).
   */
  queriedAt: nullableDate,
}).superRefine((value, context) => {
  const hasEntry = !!value.entryGateName;
  const hasExit = !!value.exitGateName;
  if (hasEntry !== hasExit) {
    context.addIssue({ code: 'custom', path: ['exitGateName'], message: 'Giriş ve çıkış gişesi birlikte girilmeli veya ikisi de boş bırakılmalıdır.' });
  }
  // A fully blank scaffold row (no amount at all yet) is allowed — the admin
  // has not sourced this class/point combination yet. Verification is
  // computed server-side from the source URL's domain, never from an
  // admin-ticked checkbox: any row that DOES carry an amount must have a
  // matching official source, or it is rejected outright.
  const amount = value.manualAmountKurus ?? value.automaticAmountKurus ?? null;
  if (amount != null && !isOfficialTollSourceUrl(value.sourceUrl)) {
    context.addIssue({ code: 'custom', path: ['sourceUrl'], message: 'Bir TRY tutarı yalnız KGM, Avrasya Tüneli veya 1915 Çanakkale Köprüsü gibi resmî bir kaynak adresiyle birlikte kaydedilebilir.' });
  }
  if (amount != null && !value.sourceName?.trim()) {
    context.addIssue({ code: 'custom', path: ['sourceName'], message: 'Bir TRY tutarı için kaynak adı gereklidir.' });
  }
  // Neither the source page's stated effective date NOR our own query date —
  // there is then no honest baseline at all for staleness. Never allow this:
  // a calculator-sourced amount with no validFrom must record when it was
  // actually queried.
  if (amount != null && !value.validFrom && !value.queriedAt) {
    context.addIssue({ code: 'custom', path: ['queriedAt'], message: 'Kaynak sayfada bir yürürlük tarihi belirtilmiyorsa (ör. bir ücret hesaplama aracı), tutarı ne zaman sorguladığınızı girmelisiniz.' });
  }
});

export const tollAlternativeInputSchema = z.object({
  routeId: z.string().uuid(),
  name: z.string().trim().min(2, 'Alternatif adı en az 2 karakter olmalıdır.').max(160),
  active: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  displayOrder: z.number().int().min(0).max(10_000).default(0),
  pointIds: z.array(z.string().uuid()).max(30).default([]),
  /**
   * Only meaningful for a GATE_PAIR toll point included in pointIds (e.g.
   * Osmangazi Köprüsü / O-5) — which exact entry/exit gate pair this route
   * uses there, in its forward direction. Keyed by tollPointId so the
   * existing flat pointIds checkbox list did not need to change shape.
   */
  gatePairs: z.record(z.string().uuid(), z.object({
    entryGateName: z.string().trim().min(1).max(160),
    exitGateName: z.string().trim().min(1).max(160),
  })).default({}),
}).superRefine((value, context) => {
  if (value.isDefault && !value.active) {
    context.addIssue({ code: 'custom', path: ['active'], message: 'Varsayılan alternatif aktif olmalıdır.' });
  }
  if (new Set(value.pointIds).size !== value.pointIds.length) {
    context.addIssue({ code: 'custom', path: ['pointIds'], message: 'Bir geçiş noktası alternatif içinde yalnız bir kez kullanılabilir.' });
  }
  for (const pointId of Object.keys(value.gatePairs)) {
    if (!value.pointIds.includes(pointId)) {
      context.addIssue({ code: 'custom', path: ['gatePairs'], message: 'Gişe çifti yalnızca alternatife eklenmiş bir geçiş noktası için tanımlanabilir.' });
    }
  }
});