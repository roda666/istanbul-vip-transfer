/**
 * One-time, idempotent manual data entry for owner-supplied KGM PDF tariffs.
 *
 * This script performs no network requests and creates no automatic sync path.
 * All supplied amounts are stored as manual values with their PDF provenance.
 */
import postgres from '../node_modules/postgres/cjs/src/index.js';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const CLASSES = ['class_1', 'class_2', 'class_3', 'class_4', 'class_5', 'class_6'];
const EFFECTIVE_2026_07_01 = '2026-07-01';
const EFFECTIVE_2026_01_01 = '2026-01-01';

const POINT = {
  OSMANGAZI: 'Osmangazi Köprüsü',
  YSS: 'Yavuz Sultan Selim Köprüsü (YSS)',
  KMO: 'Kuzey Marmara Otoyolu (O-7, YSS Köprüsü hariç ilave kesim)',
  IZMIR: 'İstanbul–İzmir Otoyolu (Gebze-Orhangazi-İzmir, ilave kesim)',
  BODRUM: 'İstanbul–Bodrum Otoyolu Güzergahı (doğrulanmamış ilave ücret)',
  BURSA: 'İstanbul–Bursa Otoyolu Güzergahı (doğrulanmamış ilave ücret)',
  ANTALYA: 'İstanbul–Antalya Otoyolu Güzergahı (doğrulanmamış ilave ücret)',
};

const SOURCE = {
  OSMANGAZI: 'https://www.kgm.gov.tr/SiteCollectionDocuments/KGMdocuments/Otoyollar/OtoyolKopruUcret/2026Gecis_Ucret/2-Osmangazi.pdf',
  YSS: 'https://www.kgm.gov.tr/SiteCollectionDocuments/KGMdocuments/Otoyollar/OtoyolKopruUcret/2026Gecis_Ucret/3-YSSKoprusu.pdf',
  KMO: 'https://www.kgm.gov.tr/SiteCollectionDocuments/KGMdocuments/Otoyollar/OtoyolKopruUcret/2026Gecis_Ucret/15-KMOAnadoluKurtkoy-Akyazi.pdf',
  IZMIR: 'https://www.kgm.gov.tr/SiteCollectionDocuments/KGMdocuments/Otoyollar/OtoyolKopruUcret/2026Gecis_Ucret/12-Gebze-Orhangazi-Izmir.pdf',
  AYDIN: 'https://www.kgm.gov.tr/SiteCollectionDocuments/KGMdocuments/Otoyollar/OtoyolKopruUcret/2026Gecis_Ucret/7-Izmir-Aydin.pdf',
};

const toKurus = (values) => Object.fromEntries(CLASSES.map((vehicleClass, index) => [vehicleClass, Math.round(values[index] * 100)]));

const TARIFFS = [
  {
    pointName: POINT.OSMANGAZI,
    sourceName: 'KGM PDF — Osmangazi Köprüsü, Gebze → Bursa Batı (köprü ve Bursa çıkışı dahil tam tutar)',
    sourceUrl: SOURCE.OSMANGAZI,
    validFrom: EFFECTIVE_2026_07_01,
    entryGateName: null,
    exitGateName: null,
    amounts: toKurus([1170, 1870, 2225, 2950, 3720, 820]),
  },
  {
    pointName: POINT.YSS,
    sourceName: 'KGM PDF — Yavuz Sultan Selim Köprüsü geçiş tarifesi',
    sourceUrl: SOURCE.YSS,
    validFrom: EFFECTIVE_2026_07_01,
    entryGateName: null,
    exitGateName: null,
    amounts: toKurus([110, 145, 270, 690, 860, 75]),
  },
  {
    pointName: POINT.KMO,
    sourceName: 'KGM PDF — KMO Anadolu, Kurnaköy 2 → Adapazarı-1',
    sourceUrl: SOURCE.KMO,
    validFrom: EFFECTIVE_2026_07_01,
    entryGateName: 'KURNAKÖY 2',
    exitGateName: 'ADAPAZARI-1',
    amounts: toKurus([480, 725, 845, 1110, 1420, 310]),
  },
  {
    pointName: POINT.KMO,
    sourceName: 'KGM PDF — KMO Anadolu, Kurnaköy 2 → Adapazarı-2',
    sourceUrl: SOURCE.KMO,
    validFrom: EFFECTIVE_2026_07_01,
    entryGateName: 'KURNAKÖY 2',
    exitGateName: 'ADAPAZARI-2',
    amounts: toKurus([490, 785, 935, 1240, 1550, 345]),
  },
  {
    pointName: POINT.IZMIR,
    sourceName: 'KGM PDF — Gebze → İzmir, Osmangazi Köprüsü dahil toplam',
    sourceUrl: SOURCE.IZMIR,
    validFrom: EFFECTIVE_2026_07_01,
    entryGateName: 'GEBZE',
    exitGateName: 'İZMİR',
    amounts: toKurus([1355, 2170, 2580, 3410, 4275, 975]),
  },
  {
    pointName: POINT.BODRUM,
    sourceName: 'KGM PDF toplamı — Gebze → İzmir (Osmangazi dahil) + Işıkkent → Aydın Batı',
    sourceUrl: `${SOURCE.IZMIR} | ${SOURCE.AYDIN}`,
    validFrom: EFFECTIVE_2026_07_01,
    entryGateName: 'GEBZE',
    exitGateName: 'AYDIN BATI',
    amounts: toKurus([1428, 2252, 2695, 3558, 4443, 1008]),
  },
];

async function upsertManualTariff(tx, point, tariff) {
  for (const vehicleClass of CLASSES) {
    const amountKurus = tariff.amounts[vehicleClass];
    const existing = await tx`
      SELECT id
      FROM toll_tariffs
      WHERE toll_point_id = ${point.id}
        AND vehicle_class = ${vehicleClass}
        AND time_band = 'ALL'
        AND active = true
        AND entry_gate_name IS NOT DISTINCT FROM ${tariff.entryGateName}
        AND exit_gate_name IS NOT DISTINCT FROM ${tariff.exitGateName}
      LIMIT 1`;

    if (existing.length) {
      await tx`
        UPDATE toll_tariffs SET
          amount_kurus = ${amountKurus},
          automatic_amount_kurus = NULL,
          manual_amount_kurus = ${amountKurus},
          source_name = ${tariff.sourceName},
          source_url = ${tariff.sourceUrl},
          source_verified = true,
          source_fetched_at = NULL,
          manual_updated_at = now(),
          queried_at = NULL,
          valid_from = ${tariff.validFrom},
          valid_until = NULL,
          last_sync_error = NULL,
          entry_gate_name = ${tariff.entryGateName},
          exit_gate_name = ${tariff.exitGateName},
          direction = NULL,
          updated_at = now()
        WHERE id = ${existing[0].id}`;
    } else {
      await tx`
        INSERT INTO toll_tariffs (
          toll_point_id, vehicle_class, amount_kurus, automatic_amount_kurus,
          manual_amount_kurus, source_name, source_url, source_verified,
          source_fetched_at, manual_updated_at, queried_at, time_band,
          applies_day, applies_night, valid_from, valid_until, active,
          entry_gate_name, exit_gate_name, direction
        ) VALUES (
          ${point.id}, ${vehicleClass}, ${amountKurus}, NULL,
          ${amountKurus}, ${tariff.sourceName}, ${tariff.sourceUrl}, true,
          NULL, now(), NULL, 'ALL',
          true, true, ${tariff.validFrom}, NULL, true,
          ${tariff.entryGateName}, ${tariff.exitGateName}, NULL
        )`;
    }
  }
}

async function setRouteGatePair(tx, routeSlug, pointId, entryGateName, exitGateName) {
  await tx`
    UPDATE route_toll_alternative_items item SET
      entry_gate_name = ${entryGateName},
      exit_gate_name = ${exitGateName}
    FROM route_toll_alternatives alternative
    JOIN transfer_routes route ON route.id = alternative.route_id
    WHERE item.alternative_id = alternative.id
      AND item.toll_point_id = ${pointId}
      AND route.slug = ${routeSlug}`;
}

async function main() {
  await sql.begin(async (tx) => {
    const targetNames = Object.values(POINT);
    const points = await tx`
      SELECT id, name, pricing_mode, active
      FROM toll_points
      WHERE name = ANY(${targetNames})`;
    const pointByName = new Map(points.map((point) => [point.name, point]));

    for (const name of targetNames) {
      if (!pointByName.has(name)) throw new Error(`Hedef geçiş noktası bulunamadı: ${name}`);
    }

    for (const tariff of TARIFFS) {
      const point = pointByName.get(tariff.pointName);
      const needsGatePair = tariff.entryGateName != null;
      if ((point.pricing_mode === 'GATE_PAIR') !== needsGatePair) {
        throw new Error(`Fiyatlandırma modu/gişe çifti uyuşmazlığı: ${point.name}`);
      }
      await upsertManualTariff(tx, point, tariff);
    }

    const pricedHighwayIds = [POINT.KMO, POINT.IZMIR, POINT.BODRUM].map((name) => pointByName.get(name).id);
    await tx`
      UPDATE toll_tariffs SET
        active = false,
        updated_at = now(),
        last_sync_error = 'Yerini doğrulanmış manuel KGM PDF gişe-çifti tarifesi aldı.'
      WHERE toll_point_id = ANY(${pricedHighwayIds})
        AND active = true
        AND entry_gate_name IS NULL
        AND exit_gate_name IS NULL
        AND amount_kurus IS NULL`;

    await tx`
      UPDATE toll_points SET
        notes = 'KGM 01/07/2026 PDF tarifesi: KURNAKÖY 2 → ADAPAZARI-1 Sapanca için varsayılan doğrulanmış gişe çiftidir; ADAPAZARI-2 ayrıca alternatif tarife olarak kayıtlıdır. Bu ücret YSS Köprüsü ücretine ek ayrı otoyol ücretidir. İstanbul–Ankara ve diğer rotalar aynı noktayı kullanıyorsa gerçek çıkış gişesi ayrıca doğrulanmadan bu çift uygulanmamalıdır.',
        classification_label = 'KGM Resmî Sınıf 1-6 (aks sayısı/aralığına göre)',
        toll_direction_source_url = ${SOURCE.KMO},
        toll_direction_notes = 'PDF tablosu Kurnaköy 2 → Adapazarı yönündeki gişe çiftlerini fiyatlandırır; ters yön tutarı ayrıca doğrulanmadan varsayılmaz.',
        updated_at = now()
      WHERE id = ${pointByName.get(POINT.KMO).id}`;

    await tx`
      UPDATE toll_points SET
        notes = 'KGM 01/07/2026 PDF tarifesindeki Gebze → İzmir toplamı Osmangazi Köprüsü geçişini zaten içerir. Bu nokta kullanılan rota alternatifine ayrıca bağımsız Osmangazi Köprüsü kalemi eklenmemelidir.',
        classification_label = 'KGM Resmî Sınıf 1-6 (aks sayısı/aralığına göre)',
        toll_direction_source_url = ${SOURCE.IZMIR},
        toll_direction_notes = 'Kaydedilen manuel PDF tutarı GEBZE → İZMİR yönü içindir; ters yön ayrıca doğrulanmadan varsayılmaz.',
        updated_at = now()
      WHERE id = ${pointByName.get(POINT.IZMIR).id}`;

    await tx`
      UPDATE toll_points SET
        notes = 'Manuel birleşik tutar: KGM 01/07/2026 Gebze → İzmir tarifesi (Osmangazi Köprüsü dahil) + KGM 01/01/2026 Işıkkent → Aydın Batı tarifesi. Rota alternatifine ayrıca bağımsız Osmangazi Köprüsü kalemi eklenmemelidir.',
        classification_label = 'KGM Resmî Sınıf 1-6 (aks sayısı/aralığına göre)',
        toll_direction_source_url = ${SOURCE.IZMIR},
        toll_direction_notes = 'Kaydedilen birleşik tutar İstanbul/Bodrum gidiş yönü içindir; ters yön ayrıca doğrulanmadan varsayılmaz.',
        updated_at = now()
      WHERE id = ${pointByName.get(POINT.BODRUM).id}`;

    await tx`
      UPDATE toll_points SET
        active = false,
        notes = 'N/A — Osmangazi Köprüsü kalemi Gebze → Bursa Batı için köprü ve Bursa çıkışını birlikte tam kapsar. Bu ilave kesim noktası kullanılmaz ve hiçbir rota alternatifine bağlanmamalıdır.',
        updated_at = now()
      WHERE id = ${pointByName.get(POINT.BURSA).id}`;
    await tx`
      UPDATE toll_tariffs SET
        active = false,
        source_name = 'N/A — Bursa tam ücreti Osmangazi Köprüsü kaleminde',
        source_url = ${SOURCE.OSMANGAZI},
        source_verified = true,
        valid_from = ${EFFECTIVE_2026_07_01},
        last_sync_error = 'Kullanılmayan ilave kesim; sıfır fiyat değildir.',
        updated_at = now()
      WHERE toll_point_id = ${pointByName.get(POINT.BURSA).id}`;

    await setRouteGatePair(tx, 'istanbul-sapanca', pointByName.get(POINT.KMO).id, 'KURNAKÖY 2', 'ADAPAZARI-1');
    await tx`
      UPDATE route_toll_alternatives SET
        needs_review = false,
        review_note = 'KMO kalemi yalnız İstanbul–Sapanca için KURNAKÖY 2 → ADAPAZARI-1 varsayılan doğrulanmış gişe çiftini kullanır; ADAPAZARI-2 tarifesi alternatif olarak saklanır.',
        updated_at = now()
      WHERE route_id = (SELECT id FROM transfer_routes WHERE slug = 'istanbul-sapanca')
        AND id IN (
          SELECT alternative_id FROM route_toll_alternative_items
          WHERE toll_point_id = ${pointByName.get(POINT.KMO).id}
        )`;

    await tx`
      UPDATE route_toll_alternatives SET
        needs_review = true,
        review_note = 'Bu rota için Kuzey Marmara/O-7 çıkış gişesi ayrıca doğrulanmalıdır; Sapanca KURNAKÖY 2 → ADAPAZARI-1 tarifesi burada varsayılmaz.',
        updated_at = now()
      WHERE route_id = (SELECT id FROM transfer_routes WHERE slug = 'istanbul-ankara')
        AND id IN (
          SELECT alternative_id FROM route_toll_alternative_items
          WHERE toll_point_id = ${pointByName.get(POINT.KMO).id}
        )`;

    await setRouteGatePair(tx, 'istanbul-izmir', pointByName.get(POINT.IZMIR).id, 'GEBZE', 'İZMİR');
    await setRouteGatePair(tx, 'istanbul-bodrum', pointByName.get(POINT.BODRUM).id, 'GEBZE', 'AYDIN BATI');

    for (const [routeSlug, pointName, replacement] of [
      ['istanbul-izmir', POINT.IZMIR, 'İzmir Otoyolu (Osmangazi dahil)'],
      ['istanbul-bodrum', POINT.BODRUM, 'Bodrum Otoyolu (Osmangazi dahil)'],
    ]) {
      const routePoint = pointByName.get(pointName);
      await tx`
        DELETE FROM route_toll_alternative_items item
        USING route_toll_alternatives alternative, transfer_routes route, toll_points point
        WHERE item.alternative_id = alternative.id
          AND alternative.route_id = route.id
          AND item.toll_point_id = point.id
          AND route.slug = ${routeSlug}
          AND point.name = ${POINT.OSMANGAZI}`;
      await tx`
        UPDATE route_toll_alternatives SET
          name = CASE
            WHEN name ILIKE 'YSS%' THEN ${`YSS Köprüsü + ${replacement}`}
            WHEN name ILIKE 'FSM%' THEN ${`FSM Köprüsü + ${replacement}`}
            WHEN name ILIKE 'Avrasya%' THEN ${`Avrasya Tüneli + ${replacement}`}
            ELSE name
          END,
          needs_review = false,
          review_note = 'Otoyol kalemi Osmangazi Köprüsü ücretini zaten içerir; bağımsız Osmangazi kalemi çift sayımı önlemek için çıkarılmıştır.',
          updated_at = now()
        WHERE route_id = (SELECT id FROM transfer_routes WHERE slug = ${routeSlug})
          AND id IN (
            SELECT alternative_id FROM route_toll_alternative_items
            WHERE toll_point_id = ${routePoint.id}
          )`;
    }

    await tx`
      UPDATE route_toll_alternatives SET
        needs_review = true,
        review_note = 'Antalya sürücüsünün gerçek otoyol güzergâhı ve giriş/çıkış gişeleri doğrulanmadı. Tarife boş bırakılır; tahminle fiyat üretilmez.',
        updated_at = now()
      WHERE route_id = (SELECT id FROM transfer_routes WHERE slug = 'istanbul-antalya')`;

    const antalyaPriced = await tx`
      SELECT count(*)::int AS count
      FROM toll_tariffs
      WHERE toll_point_id = ${pointByName.get(POINT.ANTALYA).id}
        AND amount_kurus IS NOT NULL`;
    if (antalyaPriced[0].count !== 0) throw new Error('Antalya tarifesi beklenmedik biçimde dolu; transaction iptal edildi.');
  });

  console.log('Manual KGM PDF tariffs and route mappings applied successfully.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());