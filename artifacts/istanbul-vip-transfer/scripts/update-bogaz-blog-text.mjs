import { createHmac } from 'node:crypto';
import postgres from '../node_modules/postgres/src/index.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const slug = 'istanbul-bogaz-sultanahmet-taksim-tur-rehberi';
const body = `İstanbul'u kısıtlı bir sürede, toplu ulaşım veya turist otobüsü kalabalığına takılmadan görmek isteyenler için özel şoförlü araçla şehir turu pratik bir seçenektir. Bu yazıda tipik bir Boğaz-Sultanahmet-Taksim turunun nasıl planlandığını anlatıyoruz.

## Şoförlü tur, turist otobüründen nasıl farklı?

İki seçeneğin de kendi yeri var; dürüst bir karşılaştırma şöyle:

- **Turist otobüsü/tekne turu**, sabit bir güzergâh ve sabit bir programla çalışır; birden fazla yolcu grubunun aynı anda olduğu bir ortamdır ve genellikle daha düşük bir maliyetle geniş bir güzergâhı kapsar.
- **Özel şoförlü tur**, programı yolcunun ilgi alanına göre esnetme imkânı verir: bir noktada daha uzun kalınabilir, ilgi çekmeyen bir durak atlanabilir, sıra bekleme süresi yolculuk süresine dahil edilmeden planlanabilir.

Kısa süresi olan iş seyahatlerinde veya hareket kabiliyeti kısıtlı yolcularda özel tur daha pratik olurken, bütçe önceliği olan ve geniş bir güzergâhı tek seferde görmek isteyen bağımsız gezginler için turist otobüsü/tekne turu da makul bir seçenektir.

## Tipik rota nasıl planlanır?

Bir günlük şehir turu genellikle üç ana bölgeyi kapsar:

1. **Tarihi yarımada (Sultanahmet çevresi).** Ayasofya, Sultanahmet Camii, Topkapı Sarayı ve Kapalıçarşı'nın bulunduğu bölge — İstanbul'un en yoğun ziyaret edilen kısmı.
2. **Boğaz hattı.** Kıyı yolu boyunca ilerleyen bir güzergâh; yalıların, köprülerin ve boğaz manzarasının görüldüğü kısım.
3. **Taksim ve modern şehir merkezi.** İstiklal Caddesi ve çevresi — İstanbul'un çağdaş yüzü.

[[IMAGE:inline-1]]

## Süre nasıl belirlenir?

Turun toplam süresi, durak sayısına ve her duraktaki kalış süresine göre değişir. Sabit bir "tur süresi" yerine saatlik tahsis mantığıyla çalışılır: araç ve şoför belirlenen saat aralığında yolcuya tahsis edilir, güzergâh ve duraklar yolcunun tercihine göre şekillenir.

Örnek bir günlük planlamada sabah tarihi yarımadadan başlanıp öğleden sonra Boğaz hattı üzerinden Taksim'e doğru ilerlemek, trafik açısından da mantıklı bir sıralamadır — tarihi yarımadanın dar sokakları sabah saatlerinde, Boğaz hattı ise gün ışığında daha keyifli görülür.

[[IMAGE:inline-2]]

## Yaka geçişi gerekiyor mu?

Sultanahmet, Avrupa yakasının tarihi kısmında; Taksim yine Avrupa yakasında ama daha kuzeyde yer alır. Bu iki nokta arasında yaka geçişi gerekmez. Ancak Anadolu yakasındaki bir noktadan (örneğin Kadıköy) başlanacaksa, güzergâhın başına bir köprü veya tünel geçişi eklenir; bu durum toplam süreye trafiğe bağlı olarak 20-40 dakika ekleyebilir.

## Kimler için uygun?

- **Kısa süreli iş seyahati sırasında yarım gün boş kalan** ziyaretçiler
- **Aynı gün transit geçiş yapıp** İstanbul'u görmek isteyen yolcular
- **Hareket kabiliyeti kısıtlı veya küçük çocuklu aileler** — toplu ulaşımdaki kalabalık ve bekleme yerine özel araç konforu tercih edenler
- **Belirli bir ilgi alanına odaklanmak isteyenler** — örneğin yalnızca tarihi yarımadada daha uzun vakit geçirmek isteyen gruplar

## Rezervasyon için gereken bilgiler

- Tarih ve tercih edilen başlangıç saati
- Görülmek istenen bölgeler (öncelik sırasıyla)
- Yolcu sayısı
- Otelden alış/otele bırakış mı, yoksa farklı bir başlangıç/bitiş noktası mı olacağı

Havalimanından şehir merkezine ilk giriş için [İstanbul Havalimanı transfer rehberi](/blog/istanbul-havalimani-transfer-rehberi) yazımıza, genel şehir içi VIP transfer hizmeti için [VIP transfer](/vip-transfer) sayfamıza bakabilirsiniz. Tur planlaması için [rezervasyon ve fiyat formunu](/iletisim) kullanabilirsiniz.`;

const faqItems = [
  ['Özel şoförlü şehir turu turist otobüsünden ne kadar farklı?', 'Turist otobüsü/tekne turu sabit bir program ve daha geniş bir yolcu grubuyla çalışırken, özel şoförlü tur programı yolcunun ilgi alanına göre esnetme imkânı verir — bir durakta daha uzun kalınabilir veya ilgisiz bir durak atlanabilir.'],
  ["Bir günde Sultanahmet, Boğaz ve Taksim'in hepsi görülebilir mi?", 'Evet, tipik bir tam gün turu genellikle bu üç bölgeyi kapsar. Sabah tarihi yarımadadan başlayıp öğleden sonra Boğaz hattı üzerinden Taksim’e ilerlemek yaygın ve trafik açısından mantıklı bir sıralamadır.'],
  ['Tur süresi nasıl belirleniyor?', 'Sabit bir tur süresi yerine saatlik tahsis mantığıyla çalışılır; araç ve şoför belirlenen saat aralığında yolcuya tahsis edilir, güzergâh ve duraklar yolcunun tercihine göre şekillenir.'],
  ['Kadıköy gibi Anadolu yakasından başlayan bir tur mümkün mü?', 'Evet, ancak bu durumda güzergâhın başına bir köprü veya tünel geçişi eklenir ve bu, trafiğe bağlı olarak toplam süreye 20-40 dakika ekleyebilir.'],
  ['Tur otelden mi başlıyor?', 'Genellikle evet; otelden alış ve otele bırakış şeklinde planlanır. Farklı bir başlangıç veya bitiş noktası isteniyorsa (örneğin havalimanına giderken tur yapmak gibi) bu da rezervasyon sırasında belirtilebilir.'],
  ['Küçük çocuklu aileler için uygun mu?', 'Evet, toplu ulaşımdaki kalabalık ve bekleme yerine özel araç konforu tercih eden aileler için uygun bir seçenektir; çocuk koltuğu talebi rezervasyon sırasında belirtilebilir.'],
  ['Kaç kişilik gruplar için uygun?', 'Standart bir aile veya küçük grup için Mercedes Vito, daha kalabalık gruplar için Mercedes Sprinter kullanılır. Araç seçenekleri [araç filomuz](/araclar) sayfasında listelidir.'],
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
      SELECT id, slug, published_at, updated_at
      FROM content
      WHERE slug = ${slug} AND content_type = 'BLOG_POST'
      FOR UPDATE`;
    if (!before) throw new Error('Blog post not found');

    await tx`
      UPDATE content SET
        title = 'İstanbul Boğazı, Sultanahmet ve Taksim VIP Tur Rehberi',
        seo_title = 'İstanbul VIP Şehir Turu: Boğaz, Sultanahmet, Taksim Rehberi',
        seo_description = 'Şoförlü özel araçla İstanbul Boğazı, Sultanahmet ve Taksim turu nasıl planlanır, tipik rota ve süre ne kadar, turist otobüsünden farkı nedir — rehber burada.',
        excerpt = 'Özel şoförlü araçla İstanbul şehir turu: Boğaz, Sultanahmet, Taksim rotası ve planlama rehberi.',
        category = 'Şehir İçi VIP Transfer',
        tags = ${sql.json(['istanbul boğaz turu', 'sultanahmet taksim turu', 'özel şoförlü şehir turu', 'istanbul vip tur'])},
        author = 'Hevra Turizm Transfer Ekibi',
        read_time_minutes = 7,
        internal_links = ${sql.json([
          { label: 'İstanbul Havalimanı transfer rehberi', href: '/blog/istanbul-havalimani-transfer-rehberi' },
          { label: 'VIP transfer', href: '/vip-transfer' },
          { label: 'Araç filomuz', href: '/araclar' },
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
      SELECT id, slug, published_at, updated_at, title, body
      FROM content WHERE id = ${before.id}`;
    if (after.slug !== before.slug) throw new Error('Slug changed unexpectedly');
    if (after.published_at?.toISOString() !== before.published_at?.toISOString()) {
      throw new Error('published_at changed unexpectedly');
    }
    if (!(after.updated_at > before.updated_at)) throw new Error('updated_at did not advance');
    return {
      id: after.id,
      slug: after.slug,
      publishedAt: after.published_at,
      previousUpdatedAt: before.updated_at,
      updatedAt: after.updated_at,
      placeholders: ['[[IMAGE:inline-1]]', '[[IMAGE:inline-2]]'].filter(value => after.body.includes(value)),
      faqCount: faqItems.length,
    };
  });
  await invalidateCache();
  console.log(JSON.stringify(result, null, 2));
} finally {
  await sql.end();
}