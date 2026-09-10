import { createHmac } from 'node:crypto';
import postgres from '../node_modules/postgres/src/index.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const slug = 'havalimani-fuar-kongre-transfer';
const body = `İstanbul, yıl boyunca çok sayıda uluslararası fuar ve kongreye ev sahipliği yapıyor. Havalimanından doğrudan fuar veya kongre merkezine planlı bir transfer, özellikle kısıtlı zamanı olan kurumsal ziyaretçiler için zaman kaybını en aza indiriyor. Bu yazıda bu sürecin nasıl işlediğini anlatıyoruz.

## İstanbul'daki başlıca fuar ve kongre merkezleri

- **Tüyap Fuar ve Kongre Merkezi** — Büyükçekmece'de, şehrin batısında yer alır; büyük ölçekli sektörel fuarların çoğuna ev sahipliği yapar.
- **CNR Expo** — Yeşilköy'de, şehir merkezine ve eski Atatürk Havalimanı bölgesine yakın konumdadır.
- **İstanbul Lütfi Kırdar Kongre ve Sergi Sarayı (ICEC)** — Harbiye'de, Taksim'e yürüme mesafesinde; uluslararası kongrelerin sık tercih ettiği merkezlerden biridir.
- **Haliç Kongre Merkezi** — Haliç kıyısında, tarihi yarımadaya yakın bir konumda.

Bu dört merkez birbirinden farklı bölgelerde olduğu için hangi havalimanından (İstanbul Havalimanı veya Sabiha Gökçen) hangi merkeze gidileceği, toplam transfer süresini belirgin şekilde etkiler.

[[IMAGE:inline-2]]

## Havalimanına göre süre farkı

Genel eğilim şöyledir: İstanbul Havalimanı, şehrin kuzeybatısında olduğu için Tüyap ve CNR Expo'ya (her ikisi de Avrupa yakasında) görece daha yakındır. Sabiha Gökçen ise Anadolu yakasında olduğu için Avrupa yakasındaki merkezlere gidişte bir köprü veya tünel geçişi gerektirir; bu da toplam süreye trafiğe bağlı olarak ek zaman katar. Lütfi Kırdar ve Haliç Kongre Merkezi şehir merkezine yakın olduğundan her iki havalimanından da benzer bir mantıkla ulaşım planlanır.

Kesin süre, fuar tarihindeki trafik yoğunluğuna bağlı olarak değişeceğinden, önemli bir toplantı veya açılış saatine yetişilmesi gerekiyorsa güzergâhın gün öncesinden netleştirilmesi önerilir.

## Kurumsal grup transferi nasıl planlanır?

Fuar ziyaretlerinde genellikle tek kişi değil, birden fazla çalışandan oluşan bir grup seyahat eder. Bu durumda üç seçenek öne çıkar:

1. **Tek araçla grup transferi** — aynı uçuştan inen grup tek araçla fuar alanına götürülür.
2. **Çoklu araç koordinasyonu** — farklı uçuşlardan inen çalışanlar için birden fazla araç aynı varış noktasına yönlendirilir.
3. **Gün boyu tahsis** — fuar süresince araç ve şoför gruba tahsis edilir; öğle arası otel-fuar arası gidiş-geliş veya akşam yemeği transferi de aynı tahsis kapsamında planlanabilir.

[[IMAGE:inline-1]]

## Fuar dönemlerinde erken planlamanın önemi

Büyük fuar haftalarında hem havalimanı hem şehir içi trafik normalden yoğun olur; aynı dönemde çok sayıda katılımcı benzer güzergâhlarda hareket eder. Bu dönemlerde:

- Araç rezervasyonu mümkün olduğunca erken yapılmalı
- Uçuş numarası ve iniş saati net olarak bildirilmeli
- Fuar alanına giriş saatine göre değil, o saate yetişmek için gereken toplam süreye göre transfer saati planlanmalı

## Otel-fuar arası günlük transfer

Çok günlü fuarlarda katılımcılar genellikle her sabah otelden fuara, akşam fuardan otele transfer ihtiyacı duyar. Bu, tek seferlik havalimanı transferinden ayrı olarak, fuar süresi boyunca günlük tekrarlanan bir hizmet şeklinde planlanabilir — aynı şoför ve araçla süreklilik sağlanması, katılımcıların her gün yeniden bilgi vermesini gereksiz kılar.

## Rezervasyon için gereken bilgiler

- Uçuş numarası ve iniş saati (varsa birden fazla uçuş için ayrı ayrı)
- Fuar/kongre merkezi adı ve varsa salon numarası
- Katılımcı sayısı ve bagaj/numune malzemesi hacmi
- Çok günlü ihtiyaç varsa otel-fuar arası günlük transfer planı

Genel kurumsal transfer hizmetimiz için [kurumsal VIP transfer](/kurumsal-vip-transfer) sayfamıza, havalimanı transferinin genel işleyişi için [İstanbul Havalimanı transfer rehberi](/blog/istanbul-havalimani-transfer-rehberi) yazımıza bakabilirsiniz. Grup ve çok günlü planlama için [rezervasyon ve fiyat formunu](/iletisim) kullanabilirsiniz.`;

const faqItems = [
  ["İstanbul'daki başlıca fuar ve kongre merkezleri nerede?", "Tüyap Fuar ve Kongre Merkezi Büyükçekmece'de, CNR Expo Yeşilköy'de, Lütfi Kırdar Kongre ve Sergi Sarayı Harbiye'de (Taksim yakını), Haliç Kongre Merkezi ise Haliç kıyısındadır."],
  ["Hangi havalimanından hangi fuar merkezine gitmek daha kısa sürer?", "İstanbul Havalimanı, Avrupa yakasındaki Tüyap ve CNR Expo'ya görece daha yakındır. Sabiha Gökçen'den bu merkezlere gidişte bir köprü veya tünel geçişi gerekir; bu trafiğe bağlı olarak süreyi uzatabilir."],
  ['Farklı uçuşlardan inen kalabalık bir grup için transfer nasıl planlanır?', 'Böyle durumlarda birden fazla araç aynı varış noktasına yönlendirilerek koordine edilir; her uçuş için ayrı uçuş numarası ve iniş saati bildirilmesi yeterlidir.'],
  ['Çok günlü fuar boyunca otel-fuar arası günlük transfer alınabilir mi?', 'Evet, fuar süresi boyunca araç ve şoför gruba tahsis edilerek her sabah otelden fuara, akşam fuardan otele transfer düzenli olarak planlanabilir.'],
  ['Fuar dönemlerinde rezervasyonu ne kadar önceden yapmalıyım?', 'Büyük fuar haftalarında hem havalimanı hem şehir içi trafik yoğunlaştığı için araç bulunabilirliği açısından mümkün olduğunca erken rezervasyon önerilir.'],
  ['Numune veya sergi malzemesi taşınacaksa hangi araç uygun?', 'Standart bagajdan fazla hacim gerektiren numune kutuları veya sergi malzemeleri için geniş bagaj hacmine sahip Mercedes Sprinter sınıfı önerilir; miktar rezervasyon sırasında belirtilmelidir.'],
  ['Fuar açılışına kesin saatte yetişmem gerekiyor, bu garanti edilebilir mi?', 'Önemli bir açılış veya toplantı saatine yetişilmesi gerekiyorsa güzergâh ve çıkış saati gün öncesinden trafiğe göre netleştirilir; uçuş takibi de rötar durumunda planlamayı otomatik günceller.'],
];

async function invalidateCache() {
  const domain = process.env.REPLIT_DEV_DOMAIN?.trim();
  const secret = process.env.AUTH_SECRET;
  if (!domain || !secret) throw new Error('Cache invalidation configuration missing');
  const requestBody = JSON.stringify({ slugs: [slug] });
  const signature = createHmac('sha256', secret)
    .update(`blog-cache-revalidation:v1.${requestBody}`)
    .digest('base64url');
  const response = await fetch(`https://${domain}/admin/api/cron/blog-cache-revalidation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-blog-cache-revalidation-signature': signature,
    },
    body: requestBody,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Cache invalidation failed (${response.status})`);
}

try {
  const result = await sql.begin(async tx => {
    const [before] = await tx`
      SELECT id, slug, status, published_at, updated_at, hero_image, og_image
      FROM content
      WHERE slug = ${slug} AND content_type = 'BLOG_POST'
      FOR UPDATE`;
    if (!before) throw new Error('Blog post not found');

    const [incomingLink] = await tx`
      SELECT slug
      FROM content
      WHERE slug = 'istanbul-vip-transfer-fiyatlari-nasil-belirlenir'
        AND body LIKE ${`%/blog/${slug}%`}
      LIMIT 1`;
    if (!incomingLink) throw new Error('Required incoming link from pricing article not found');

    await tx`
      UPDATE content SET
        title = 'Havalimanından Fuar ve Kongre Merkezlerine VIP Transfer',
        seo_title = 'Fuar ve Kongre Transferi: Havalimanından Nasıl Ulaşılır?',
        seo_description = 'İstanbul''daki başlıca fuar ve kongre merkezlerine havalimanından VIP transfer nasıl planlanır, kurumsal grup transferinde nelere dikkat edilmeli — rehber.',
        excerpt = 'İstanbul''daki fuar ve kongre merkezlerine havalimanından kurumsal VIP transfer planlama rehberi.',
        category = 'Kurumsal Transfer',
        tags = ${sql.json(['fuar transfer hizmeti', 'kongre merkezi transfer', 'kurumsal vip transfer', 'istanbul fuar ulaşım'])},
        author = 'Hevra Turizm Transfer Ekibi',
        read_time_minutes = 7,
        internal_links = ${sql.json([
          { label: 'Kurumsal VIP transfer', href: '/kurumsal-vip-transfer' },
          { label: 'İstanbul Havalimanı transfer rehberi', href: '/blog/istanbul-havalimani-transfer-rehberi' },
          { label: 'Rezervasyon ve fiyat formu', href: '/iletisim' },
        ])},
        body = ${body},
        updated_at = now()
      WHERE id = ${before.id}`;

    await tx`DELETE FROM faqs WHERE content_id = ${before.id}`;
    for (const [index, [question, answer]] of faqItems.entries()) {
      await tx`
        INSERT INTO faqs (content_id, question, answer, translations, sort_order)
        VALUES (${before.id}, ${question}, ${answer}, '{}'::jsonb, ${index + 1})`;
    }

    const [after] = await tx`
      SELECT id, slug, status, published_at, updated_at, hero_image, og_image, body
      FROM content WHERE id = ${before.id}`;
    if (after.slug !== before.slug) throw new Error('Slug changed unexpectedly');
    if (after.status !== before.status) throw new Error('Publication status changed unexpectedly');
    if (after.published_at?.toISOString() !== before.published_at?.toISOString()) {
      throw new Error('published_at changed unexpectedly');
    }
    if (after.hero_image !== before.hero_image || after.og_image !== before.og_image) {
      throw new Error('Image fields changed unexpectedly');
    }
    if (!(after.updated_at > before.updated_at)) throw new Error('updated_at did not advance');
    for (const placeholder of ['[[IMAGE:inline-1]]', '[[IMAGE:inline-2]]']) {
      if (after.body.split(placeholder).length - 1 !== 1) {
        throw new Error(`${placeholder} was not preserved exactly once`);
      }
    }

    return {
      id: after.id,
      slug: after.slug,
      status: after.status,
      publishedAt: after.published_at,
      previousUpdatedAt: before.updated_at,
      updatedAt: after.updated_at,
      heroImage: after.hero_image,
      ogImage: after.og_image,
      placeholders: ['[[IMAGE:inline-1]]', '[[IMAGE:inline-2]]'],
      faqCount: faqItems.length,
      incomingLinkFrom: incomingLink.slug,
    };
  });
  await invalidateCache();
  console.log(JSON.stringify(result, null, 2));
} finally {
  await sql.end();
}