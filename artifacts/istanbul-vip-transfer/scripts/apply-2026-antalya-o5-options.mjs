/**
 * Owner-supplied, visually checked KGM PDF cells for Antalya's possible O-5
 * exits. No network requests and no default route selection.
 */
import postgres from '../node_modules/postgres/cjs/src/index.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const SOURCE_URL = 'https://www.kgm.gov.tr/SiteCollectionDocuments/KGMdocuments/Otoyollar/OtoyolKopruUcret/2026Gecis_Ucret/12-Gebze-Orhangazi-Izmir.pdf';
const VALID_FROM = '2026-07-01';
const ENTRY = 'OSMANGAZİ KÖPRÜSÜ (İSTANBUL YÖNÜ)';
const CLASSES = ['class_1', 'class_2', 'class_3', 'class_4', 'class_5', 'class_6'];
const EXITS = [
  { exit: 'SUSURLUK', label: 'Susurluk', amounts: [370, 600, 725, 935, 1185, 295] },
  { exit: 'BALIKESİR KUZEY', label: 'Balıkesir Kuzey', amounts: [490, 785, 935, 1240, 1550, 345] },
  { exit: 'SAVAŞTEPE', label: 'Savaştepe', amounts: [745, 1185, 1420, 1905, 2360, 530] },
  { exit: 'ORHANGAZİ', label: 'Orhangazi', amounts: [1335, 2165, 2535, 3360, 4210, 940] },
  { exit: 'GEMLİK', label: 'Gemlik', amounts: [1395, 2215, 2635, 3480, 4395, 985] },
  { exit: 'BURSA SERBEST BÖLGE', label: 'Bursa Serbest Bölge', amounts: [1430, 2280, 2705, 3580, 4505, 1015] },
  { exit: 'BURSA KUZEY', label: 'Bursa Kuzey', amounts: [1540, 2500, 2950, 3925, 4930, 1115] },
];
const BRIDGES = [
  { name: 'Yavuz Sultan Selim Köprüsü (YSS)', label: 'YSS Köprüsü' },
  { name: 'Fatih Sultan Mehmet Köprüsü (FSM)', label: 'FSM Köprüsü' },
  { name: 'Avrasya Tüneli', label: 'Avrasya Tüneli' },
];
const REVIEW_NOTE = 'Varsayılan seçilmedi, admin rezervasyon bazında seçmeli. PDF rakamı görsel olarak doğrulandı; Susurluk/Balıkesir Kuzey/Savaştepe hücreleri Bursa Batı satırında, Orhangazi/Gemlik/Bursa hücreleri Osmangazi Köprüsü (İstanbul Yönü) sütununda olduğundan güzergâh anlamı operasyonel teyit bekliyor. Müşteriye gösterilmez.';

async function main() {
  await sql.begin(async (tx) => {
    const [route] = await tx`SELECT id FROM transfer_routes WHERE slug = 'istanbul-antalya' FOR UPDATE`;
    const [point] = await tx`SELECT id FROM toll_points WHERE name = 'İstanbul–Antalya Otoyolu Güzergahı (doğrulanmamış ilave ücret)' FOR UPDATE`;
    if (!route || !point) throw new Error('Antalya rota veya tarife noktası bulunamadı');

    await tx`
      UPDATE toll_points SET
        active = true,
        pricing_mode = 'GATE_PAIR',
        classification_label = 'KGM Resmî Sınıf 1-6 (aks sayısı/aralığına göre)',
        notes = 'Antalya’ya doğrudan ücretli otoyol yoktur. O-5 çıkışı rezervasyon bazında admin tarafından seçilir. Yedi seçenek PDF’de görsel olarak kontrol edilmiştir ancak hücre yönü anomalisi nedeniyle hiçbiri varsayılan değildir.',
        toll_direction = 'TWO_WAY_DIRECTIONAL',
        toll_direction_source_url = ${SOURCE_URL},
        toll_direction_notes = 'Yalnız İstanbul’dan Antalya yönüne gidiş seçenekleri kayıtlıdır; ters yön ayrıca doğrulanmadan varsayılmaz.',
        updated_at = now()
      WHERE id = ${point.id}`;

    await tx`UPDATE toll_tariffs SET active = false, updated_at = now() WHERE toll_point_id = ${point.id}`;
    for (const option of EXITS) {
      for (let index = 0; index < CLASSES.length; index += 1) {
        const vehicleClass = CLASSES[index];
        const amountKurus = Math.round(option.amounts[index] * 100);
        const [existing] = await tx`
          SELECT id FROM toll_tariffs
          WHERE toll_point_id = ${point.id}
            AND vehicle_class = ${vehicleClass}
            AND time_band = 'ALL'
            AND entry_gate_name = ${ENTRY}
            AND exit_gate_name = ${option.exit}
          LIMIT 1`;
        const sourceName = `KGM PDF — Antalya review seçeneği, Osmangazi/İstanbul yönü → ${option.label}; rakam görsel olarak doğrulandı, rota anlamı admin teyidi bekliyor`;
        if (existing) {
          await tx`
            UPDATE toll_tariffs SET
              amount_kurus = ${amountKurus}, automatic_amount_kurus = NULL,
              manual_amount_kurus = ${amountKurus}, source_name = ${sourceName},
              source_url = ${SOURCE_URL}, source_verified = true,
              source_fetched_at = NULL, manual_updated_at = now(), queried_at = NULL,
              valid_from = ${VALID_FROM}, valid_until = NULL, active = true,
              entry_gate_name = ${ENTRY}, exit_gate_name = ${option.exit},
              direction = NULL, last_sync_error = NULL, updated_at = now()
            WHERE id = ${existing.id}`;
        } else {
          await tx`
            INSERT INTO toll_tariffs (
              toll_point_id, vehicle_class, amount_kurus, automatic_amount_kurus,
              manual_amount_kurus, source_name, source_url, source_verified,
              manual_updated_at, time_band, applies_day, applies_night,
              valid_from, active, entry_gate_name, exit_gate_name
            ) VALUES (
              ${point.id}, ${vehicleClass}, ${amountKurus}, NULL,
              ${amountKurus}, ${sourceName}, ${SOURCE_URL}, true,
              now(), 'ALL', true, true,
              ${VALID_FROM}, true, ${ENTRY}, ${option.exit}
            )`;
        }
      }
    }

    await tx`DELETE FROM route_toll_alternatives WHERE route_id = ${route.id}`;
    for (let bridgeIndex = 0; bridgeIndex < BRIDGES.length; bridgeIndex += 1) {
      const bridge = BRIDGES[bridgeIndex];
      const [bridgePoint] = await tx`SELECT id FROM toll_points WHERE name = ${bridge.name} AND active = true`;
      if (!bridgePoint) throw new Error(`Aktif geçiş noktası bulunamadı: ${bridge.name}`);
      for (let exitIndex = 0; exitIndex < EXITS.length; exitIndex += 1) {
        const option = EXITS[exitIndex];
        const [alternative] = await tx`
          INSERT INTO route_toll_alternatives (
            route_id, name, active, is_default, display_order, needs_review, review_note
          ) VALUES (
            ${route.id}, ${`${bridge.label} + O-5 ${option.label} çıkışı (inceleme bekliyor)`},
            true, false, ${bridgeIndex * EXITS.length + exitIndex}, true, ${REVIEW_NOTE}
          ) RETURNING id`;
        await tx`
          INSERT INTO route_toll_alternative_items (
            alternative_id, toll_point_id, display_order, entry_gate_name, exit_gate_name
          ) VALUES
            (${alternative.id}, ${bridgePoint.id}, 0, NULL, NULL),
            (${alternative.id}, ${point.id}, 1, ${ENTRY}, ${option.exit})`;
      }
    }

    const [check] = await tx`
      SELECT
        (SELECT count(*)::int FROM toll_tariffs WHERE toll_point_id = ${point.id} AND active = true) AS active_tariffs,
        (SELECT count(*)::int FROM route_toll_alternatives WHERE route_id = ${route.id} AND active = true) AS alternatives,
        (SELECT count(*)::int FROM route_toll_alternatives WHERE route_id = ${route.id} AND is_default = true) AS defaults,
        (SELECT count(*)::int FROM route_toll_alternatives WHERE route_id = ${route.id} AND needs_review = true) AS review_alternatives`;
    if (check.active_tariffs !== 42 || check.alternatives !== 21 || check.defaults !== 0 || check.review_alternatives !== 21) {
      throw new Error(`Antalya bütünlük kontrolü başarısız: ${JSON.stringify(check)}`);
    }
  });
  console.log('Antalya O-5 review-only exit options applied successfully.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => sql.end());