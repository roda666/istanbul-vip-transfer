import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { contentTranslations, flightMeetGreetSettings, optionalServices } from '@/db/schema';
import { getPublicLangCodes } from '@/lib/i18n/active-locales';
import { FLIGHT_MEET_GREET_KEY, normalizeFlightMeetGreetKey } from '@/lib/flight-meet-greet-contract';
import { isOptionalServiceRuntimeValid } from '@/lib/optional-service-validity';
import { dedupeOptionalServices } from '@/lib/optional-service-selection';
import { isServiceTypeInScope } from '@/lib/service-type-scope';

export const dynamic = 'force-dynamic';

/**
 * Public paid catalog. Deliberately returns no included services and no
 * client-controlled pricing metadata. Translation rows must be published;
 * Turkish is only the source language, not a foreign-locale fallback.
 */
export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale')
    ?? request.nextUrl.searchParams.get('lang')
    ?? 'tr';
  const serviceType = request.nextUrl.searchParams.get('serviceType') ?? '';
  if (!(await getPublicLangCodes()).includes(locale)) {
    return NextResponse.json({ error: 'Unsupported or unpublished locale' }, { status: 422 });
  }
  try {
    const [meetGreet] = await db.select({ enabled: flightMeetGreetSettings.enabled })
      .from(flightMeetGreetSettings).where(eq(flightMeetGreetSettings.id, 1)).limit(1);
    const rows = await db.select({
      id: optionalServices.id,
      key: optionalServices.key,
      name: optionalServices.name,
      shortDescription: optionalServices.shortDescription,
      nameTranslations: optionalServices.nameTranslations,
      shortDescriptionTranslations: optionalServices.shortDescriptionTranslations,
      currency: optionalServices.currency,
      unitAmount: optionalServices.unitAmount,
      chargeType: optionalServices.chargeType,
      maximumQuantity: optionalServices.maximumQuantity,
      serviceTypeScope: optionalServices.serviceTypeScope,
       includedInTransfer: optionalServices.includedInTransfer,
      customerVisible: optionalServices.customerVisible,
      translationStatus: contentTranslations.status,
      translationName: contentTranslations.serviceName,
      translationDescription: contentTranslations.serviceShortDescription,
    }).from(optionalServices)
      .leftJoin(contentTranslations, and(
        eq(contentTranslations.entityType, 'optional_service'),
        sql`${contentTranslations.entityId} = ${optionalServices.id}::text`,
        eq(contentTranslations.targetLanguageCode, locale),
      ))
      .where(and(eq(optionalServices.active, true), isNull(optionalServices.archivedAt), eq(optionalServices.includedInTransfer, false)))
      .orderBy(asc(optionalServices.displayOrder), asc(optionalServices.name));
    const services = dedupeOptionalServices(rows.filter((row) => {
      if (!isOptionalServiceRuntimeValid(row)) return false;
      const scope = (row.serviceTypeScope ?? []) as string[];
       if (!isServiceTypeInScope(scope, serviceType)) return false;
       if (normalizeFlightMeetGreetKey(row.key) === FLIGHT_MEET_GREET_KEY && meetGreet?.enabled !== true) return false;
      if (locale !== 'tr' && row.translationStatus !== 'PUBLISHED') return false;
      if (row.customerVisible !== true) return false;
      return true;
    })).map((row) => ({
      id: row.id,
      key: row.key,
      name: locale === 'tr' ? row.name : row.translationName,
      shortDescription: locale === 'tr' ? row.shortDescription : row.translationDescription,
      currency: row.currency,
      unitAmount: row.unitAmount,
      chargeType: row.chargeType,
      maximumQuantity: row.maximumQuantity,
    }));
    return NextResponse.json({ services, locale, serviceType });
  } catch (error) {
    console.error('Optional services public GET error:', error);
    return NextResponse.json({ error: 'Ek hizmetler alınamadı.' }, { status: 503 });
  }
}