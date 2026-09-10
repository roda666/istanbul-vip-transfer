import { createHmac } from 'node:crypto';
import postgres from '../node_modules/postgres/src/index.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const slug = 'otel-transfer-hizmeti-nasil-calisir';
const body = `"Otel transferi" günlük konuşmada havalimanı transferiyle aynı anlamda kullanılsa da aslında biraz daha geniş bir kavram: otelden havalimanına, otelden otele, hatta bir günde birden fazla otele uğrayan grup transferlerinin hepsini kapsar. Bu yazıda sürecin adımlarını ve grup/çoklu durak durumlarını anlatıyoruz.

## Süreç adım adım nasıl işler?

1. **Rezervasyon.** Kalkış noktası (havalimanı veya adres), otel adı, tarih-saat, yolcu ve bagaj sayısı bildirilir.
2. **Uçuş takibi (havalimanı transferiyse).** Uçuş numarası üzerinden iniş saati takip edilir, rötar durumunda karşılama saati otomatik güncellenir.
3. **Karşılama.** Yolcu terminalden çıktığında veya otel lobisinde isim tabelasıyla karşılanır.
4. **Yolculuk.** Otel adresine doğrudan transfer yapılır.
5. **Bırakış.** Araç otel girişine kadar gelir; bagaj indirme desteği sağlanır.

[[IMAGE:inline-1]]

## Otelden otele transfer

Aynı şehirde tatilin bir kısmını bir otelde, kalan kısmını başka bir otelde geçiren yolcular için otelden otele transfer de aynı mantıkla çalışır. Bu tür transferlerde tek fark, her iki otelin de check-out/check-in saatlerinin göz önünde bulundurulmasıdır — özellikle check-out saati ile yeni otelin check-in saati arasında boşluk varsa, bu süre plan yapılırken belirtilmelidir.

## Çoklu durak ve grup transferi

Bir araçta seyahat eden yolcuların farklı otellerde kalması sık karşılaşılan bir durumdur — örneğin aynı uçuştan inen bir arkadaş grubunun bir kısmı bir otelde, bir kısmı başka bir otelde kalıyor olabilir. Bu durumda:

- Tüm duraklar rezervasyon sırasında sırasıyla bildirilir.
- Güzergâh, otellerin konumuna göre en mantıklı sırayla planlanır (örneğin havalimanına en yakın otelden başlanıp sırayla ilerlenir).
- Her durak için tahmini varış saati, önceki durakların süresine göre yaklaşık olarak paylaşılır.

Kalabalık gruplarda veya çok sayıda durak varsa Mercedes Sprinter sınıfı hem bagaj hem yolcu kapasitesi açısından daha uygundur.

[[IMAGE:inline-2]]

## Gece geç saat veya sabah erken transferler

Otel transferlerinin bir kısmı gece yarısından sonra veya sabahın erken saatlerinde gerçekleşir — özellikle gece uçuşlarında. Bu saatlerde otel resepsiyonunun 7/24 açık olup olmadığı ve gece güvenlik prosedürleri (bazı otellerde gece girişi için önceden bilgilendirme istenir) rezervasyon sırasında otel ile teyit edilmesi önerilen bir detaydır; transfer tarafında herhangi bir ek adım gerekmez.

## Rezervasyon için gereken bilgiler

- Kalkış noktası (havalimanı, adres veya otel)
- Varış noktası — otel adı ve açık adres
- Birden fazla durak varsa hepsinin sırası
- Tarih ve saat (havalimanı transferiyse uçuş numarası)
- Yolcu ve bagaj sayısı

Havalimanından ilk giriş için [İstanbul Havalimanı transfer rehberi](/blog/istanbul-havalimani-transfer-rehberi) ve [Sabiha Gökçen transfer rehberi](/blog/sabiha-gokcen-transfer-rehberi) yazılarımıza, genel hizmet detayları için [otel transfer](/otel-transfer) sayfamıza bakabilirsiniz. Grup ve çoklu durak planlaması için [rezervasyon ve fiyat formunu](/iletisim) kullanabilirsiniz.`;

const faqItems = [
  ['Otel transferi yalnızca havalimanından mı yapılıyor?', 'Hayır. Otel transferi havalimanından otele, otelden otele ve bir günde birden fazla otele uğrayan grup transferlerini de kapsar; süreç aynı mantıkla işler.'],
  ['Farklı otellerde kalan bir grup tek araçla transfer alabilir mi?', 'Evet. Tüm duraklar rezervasyon sırasında bildirilir, güzergâh otellerin konumuna göre en mantıklı sırayla planlanır ve her durak için yaklaşık varış saati paylaşılır.'],
  ['Otelden otele transferde check-out/check-in saatleri nasıl planlanır?', 'İlk otelin check-out saati ile yeni otelin check-in saati arasında boşluk varsa bu bilgi rezervasyon sırasında belirtilir; transfer saati buna göre ayarlanır.'],
  ['Gece geç saatte otel transferi mümkün mü?', 'Evet, gece yarısından sonra veya sabah erken saatlerdeki transferler normal şekilde yapılır. Otelin gece giriş prosedürü varsa bunun otel ile ayrıca teyit edilmesi önerilir.'],
  ['Uçağım rötar yaparsa otel transferi bekler mi?', 'Evet, havalimanı transferi olan otel transferlerinde uçuş numarası üzerinden iniş saati takip edilir ve rötar durumunda karşılama saati otomatik olarak güncellenir.'],
  ['Kalabalık grup için hangi araç önerilir?', 'Çok sayıda durak veya kalabalık grup olduğunda geniş bagaj ve yolcu kapasitesine sahip Mercedes Sprinter sınıfı tercih edilir.'],
  ['Bagaj indirme desteği var mı?', 'Evet, araç otel girişine kadar gelir ve bagaj indirme desteği standart hizmetin bir parçasıdır.'],
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

    await tx`
      UPDATE content SET
        title = 'Otel Transfer Hizmeti Nasıl Çalışır?',
        seo_title = 'Otel Transfer Hizmeti Nasıl Çalışır? Adım Adım Rehber',
        seo_description = 'Havalimanından otele VIP transfer nasıl planlanır, çoklu durak ve grup transferi nasıl işler, hangi bilgiler gerekir — adım adım anlatıyoruz.',
        excerpt = 'Havalimanından otele VIP transfer sürecinin adım adım işleyişi ve grup/çoklu durak planlaması.',
        category = 'Havalimanı Transferi',
        tags = ${sql.json(['otel transfer hizmeti', 'havalimanından otele transfer', 'vip otel transferi', 'grup otel transferi'])},
        author = 'Hevra Turizm Transfer Ekibi',
        read_time_minutes = 6,
        internal_links = ${sql.json([
          { label: 'İstanbul Havalimanı transfer rehberi', href: '/blog/istanbul-havalimani-transfer-rehberi' },
          { label: 'Sabiha Gökçen transfer rehberi', href: '/blog/sabiha-gokcen-transfer-rehberi' },
          { label: 'Otel transfer', href: '/otel-transfer' },
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
    if (after.slug !== before.slug || after.status !== before.status) {
      throw new Error('Protected slug or publication status changed unexpectedly');
    }
    if (after.published_at?.toISOString() !== before.published_at?.toISOString()) {
      throw new Error('published_at changed unexpectedly');
    }
    if (after.hero_image !== before.hero_image || after.og_image !== before.og_image) {
      throw new Error('Image fields changed before image generation');
    }
    if (!(after.updated_at > before.updated_at)) throw new Error('updated_at did not advance');
    for (const placeholder of ['[[IMAGE:inline-1]]', '[[IMAGE:inline-2]]']) {
      if (after.body.split(placeholder).length - 1 !== 1) {
        throw new Error(`${placeholder} must appear exactly once`);
      }
    }
    return {
      id: after.id,
      slug: after.slug,
      status: after.status,
      publishedAt: after.published_at,
      previousUpdatedAt: before.updated_at,
      updatedAt: after.updated_at,
      faqCount: faqItems.length,
    };
  });
  await invalidateCache();
  console.log(JSON.stringify(result, null, 2));
} finally {
  await sql.end();
}