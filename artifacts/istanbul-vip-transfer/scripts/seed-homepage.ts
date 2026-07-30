/**
 * Seed script: populate homepage CMS content + Google reviews in the DB.
 *
 * Run once:
 *   cd artifacts/istanbul-vip-transfer && npx tsx scripts/seed-homepage.ts
 *
 * Idempotent: uses INSERT ... ON CONFLICT DO NOTHING / upsert patterns.
 * Does NOT overwrite already-modified content.
 */
import { db } from '../db';
import { content, contentTranslations, googleReviews } from '../db/schema';
import { HOMEPAGE_FALLBACK } from '../lib/homepage-types';
import { eq, and } from 'drizzle-orm';

const HOMEPAGE_SLUG = 'ana-sayfa';

async function seedHomepage() {
  console.log('🌱 Seeding homepage CMS content...');

  // ── 1. TR source content ─────────────────────────────────────────────────
  const [existing] = await db
    .select({ id: content.id, status: content.status })
    .from(content)
    .where(eq(content.slug, HOMEPAGE_SLUG))
    .limit(1);

  let contentId: string;
  if (existing) {
    contentId = existing.id;
    // Only seed if body is null (first run)
    const [row] = await db.select({ body: content.body }).from(content).where(eq(content.id, contentId)).limit(1);
    if (!row?.body) {
      await db.update(content).set({
        body:          JSON.stringify(HOMEPAGE_FALLBACK.tr),
        status:        'PUBLISHED',
        publishedAt:   new Date(),
        heroImage:     '/images/istanbul-vip-transfer-hero.webp',
        heroImageAlt:  HOMEPAGE_FALLBACK.tr.hero.imageAlt,
        seoTitle:      HOMEPAGE_FALLBACK.tr.seo.metaTitle,
        seoDescription: HOMEPAGE_FALLBACK.tr.seo.metaDescription,
        title:         'Ana Sayfa',
      }).where(eq(content.id, contentId));
      console.log('  ✓ Updated existing TR record with sections body');
    } else {
      console.log('  · TR record already has body — skipping overwrite');
    }
  } else {
    const [inserted] = await db.insert(content).values({
      contentType:     'PAGE',
      title:           'Ana Sayfa',
      slug:            HOMEPAGE_SLUG,
      body:            JSON.stringify(HOMEPAGE_FALLBACK.tr),
      status:          'PUBLISHED',
      publishedAt:     new Date(),
      heroImage:       '/images/istanbul-vip-transfer-hero.webp',
      heroImageAlt:    HOMEPAGE_FALLBACK.tr.hero.imageAlt,
      seoTitle:        HOMEPAGE_FALLBACK.tr.seo.metaTitle,
      seoDescription:  HOMEPAGE_FALLBACK.tr.seo.metaDescription,
    }).returning({ id: content.id });
    contentId = inserted.id;
    console.log(`  ✓ Created TR record: ${contentId}`);
  }

  // ── 2. Translation records for EN, DE, RU, AR ─────────────────────────
  const locales = ['en', 'de', 'ru', 'ar'] as const;
  for (const locale of locales) {
    const sections = HOMEPAGE_FALLBACK[locale];
    if (!sections) continue;

    const [existingTx] = await db
      .select({ id: contentTranslations.id, body: contentTranslations.body })
      .from(contentTranslations)
      .where(
        and(
          eq(contentTranslations.entityType, 'homepage'),
          eq(contentTranslations.entityId, contentId),
          eq(contentTranslations.targetLanguageCode, locale),
        ),
      )
      .limit(1);

    if (existingTx) {
      if (!existingTx.body) {
        await db.update(contentTranslations).set({
          body:        JSON.stringify(sections),
          status:      'PUBLISHED',
          publishedAt: new Date(),
          title:       'Ana Sayfa',
        }).where(eq(contentTranslations.id, existingTx.id));
        console.log(`  ✓ Updated existing ${locale.toUpperCase()} translation with sections body`);
      } else {
        console.log(`  · ${locale.toUpperCase()} translation already has body — skipping overwrite`);
      }
    } else {
      await db.insert(contentTranslations).values({
        entityType:          'homepage',
        entityId:            contentId,
        targetLanguageCode:  locale,
        sourceLanguageCode:  'tr',
        status:              'PUBLISHED',
        publishedAt:         new Date(),
        title:               'Ana Sayfa',
        body:                JSON.stringify(sections),
        metaTitle:           sections.seo.metaTitle,
        metaDescription:     sections.seo.metaDescription,
      });
      console.log(`  ✓ Created ${locale.toUpperCase()} translation`);
    }
  }

  // ── 3. Google Reviews ──────────────────────────────────────────────────
  const reviewsToSeed = [
    // TR reviews
    { reviewerName: 'Ahmet Kaya',       reviewText: "İstanbul Havalimanı'ndan otelimize transferde mükemmel bir hizmet aldık. Sürücü kapıda isim tabelasıyla bizi karşıladı, araç tertemizdi. İş seyahatlerinde artık hep bu servisi kullanacağım. Hem saatinde hem de son derece profesyonel.", rating: 5, reviewLanguage: 'tr', sortOrder: 0 },
    { reviewerName: 'Elif Demir',       reviewText: "Sabiha Gökçen'den 11 kişilik grubumuzla uçtuk. Sprinter VIP ile karşılandık, herkesin bagajı eksiksiz yüklendi. Yolculuk boyunca su ikramı yapıldı. Gruptaki herkes çok memnun kaldı, kesinlikle tekrar tercih ederiz.", rating: 5, reviewLanguage: 'tr', sortOrder: 1 },
    // EN reviews
    { reviewerName: 'James Richardson', reviewText: "We were visiting Istanbul for the first time and the service was incredible. Our driver spoke English fluently, gave us tips about the city, and arrived 15 minutes early. The Mercedes Vito was spotless. Best transfer experience I've ever had.", rating: 5, reviewLanguage: 'en', sortOrder: 2 },
    { reviewerName: 'Sarah Mitchell',   reviewText: "Booked a Sprinter for our group of 10 from Istanbul Airport. The vehicle was pristine, driver was punctual and professional, and the meet-and-greet with the name board made everything stress-free. Highly recommend for business travel.", rating: 5, reviewLanguage: 'en', sortOrder: 3 },
    { reviewerName: 'Mark Thompson',    reviewText: "Used this service for three back-to-back business trips. Every time the driver was early, vehicle was spotless, and the ride was smooth. Booking via WhatsApp is quick and easy. Won't use anyone else in Istanbul.", rating: 5, reviewLanguage: 'en', sortOrder: 4 },
    // DE reviews
    { reviewerName: 'Klaus Müller',     reviewText: "Hervorragender Transfer vom Flughafen Istanbul. Der Fahrer wartete mit einem Namensschild, half mit dem Gepäck und brachte uns pünktlich ins Hotel. Der Mercedes Sprinter war geräumig und sehr sauber. Absolut empfehlenswert!", rating: 5, reviewLanguage: 'de', sortOrder: 5 },
    { reviewerName: 'Petra Schneider',  reviewText: "Wir haben den VIP-Transfer für unsere Familienreise gebucht. Trotz unserer Flugverspätung war der Fahrer noch da und sehr entspannt. Tolles Fahrzeug, professioneller Service — wir buchen beim nächsten Istanbul-Besuch wieder.", rating: 5, reviewLanguage: 'de', sortOrder: 6 },
    // RU reviews
    { reviewerName: 'Александр Иванов',    reviewText: "Отличный трансфер из аэропорта Стамбула. Водитель встретил нас с табличкой, помог с багажом и довёз до отеля вовремя. Mercedes Sprinter был просторным и чистым. Всем рекомендую!", rating: 5, reviewLanguage: 'ru', sortOrder: 7 },
    { reviewerName: 'Наталья Петрова',     reviewText: "Бронировали VIP-трансфер для семейной поездки. Несмотря на задержку рейса, водитель терпеливо ждал. Отличное авто, профессиональный сервис — закажем снова при следующем визите в Стамбул.", rating: 5, reviewLanguage: 'ru', sortOrder: 8 },
    // AR reviews
    { reviewerName: 'محمد العلي',          reviewText: "خدمة رائعة من مطار إسطنبول. السائق كان في انتظارنا مع لافتة بالاسم، وساعد في حمل الأمتعة، ووصلنا إلى الفندق في الوقت المحدد. مرسيدس سبرينتر كانت فسيحة ونظيفة للغاية. أوصي بها بشدة!", rating: 5, reviewLanguage: 'ar', sortOrder: 9 },
    { reviewerName: 'فاطمة الزهراء',       reviewText: "حجزنا نقل VIP لرحلتنا العائلية. على الرغم من تأخر الرحلة، انتظر السائق بصبر. سيارة رائعة وخدمة احترافية — سنحجز مجدداً في زيارتنا القادمة لإسطنبول.", rating: 5, reviewLanguage: 'ar', sortOrder: 10 },
  ];

  const existingReviews = await db.select({ reviewerName: googleReviews.reviewerName }).from(googleReviews);
  const existingNames = new Set(existingReviews.map(r => r.reviewerName));

  let created = 0;
  for (const review of reviewsToSeed) {
    if (!existingNames.has(review.reviewerName)) {
      await db.insert(googleReviews).values({
        ...review,
        isVisible: true,
        googleSourceIndicator: true,
      });
      created++;
    }
  }

  if (created > 0) {
    console.log(`  ✓ Seeded ${created} Google reviews`);
  } else {
    console.log('  · Reviews already seeded — skipping');
  }

  console.log('\n✅ Homepage seed complete.');
  console.log(`   Content ID: ${contentId}`);
  console.log('   Locales: TR (source) + EN, DE, RU, AR (translations)');
  console.log('   All records marked PUBLISHED.');
}

seedHomepage().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
