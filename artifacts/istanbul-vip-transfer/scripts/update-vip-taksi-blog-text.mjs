import { createHmac } from 'node:crypto';
import postgres from '../node_modules/postgres/src/index.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const slug = 'vip-taksi-ile-standart-taksi-farklari';
const body = `Havalimanına inen bir yolcu için şehre ulaşmanın iki temel yolu var: terminaldeki taksi durağından sıraya girmek veya önceden rezervasyon yaparak VIP transfer/taksi karşılamasını beklemek. İkisi de meşru seçenekler; bu yazıda aralarındaki somut farkları anlatıyoruz.

## Havalimanı taksi durağı deneyimi

Taksi durağında süreç şu şekilde işler: yolcu terminalden çıkar, taksi sırasına girer, sıradaki taksiye biner. Bu modelin avantajı **anlık esneklik**tir — rezervasyon gerekmez, uçak indiği anda taksiye binilebilir.

Dezavantajı ise **öngörülemezlik**tir: yoğun saatlerde (özellikle çoklu uçuşun aynı anda indiği zaman dilimlerinde) sıra beklemesi uzayabilir, hangi sürücüye veya araç durumuna denk geleceğiniz önceden bilinmez.

[[IMAGE:inline-1]]

## Fiyatlandırma mantığı: taksimetre ve sabit fiyat

Bu, iki seçenek arasındaki en somut farktır.

- **Standart taksi**, taksimetre ile çalışır: ücret, gerçekleşen mesafe ve süreye göre anlık hesaplanır. Trafiğe takılırsanız veya rota uzarsa ücret buna göre artar.
- **VIP taksi/transfer**, rezervasyon sırasında sabitlenen bir fiyatla çalışır. Trafik, rota değişikliği veya yolculuğun beklenenden uzun sürmesi toplam ücreti etkilemez — fiyat bir tahmin değil taahhüttür. Bu konuyu ayrıntılı işleyen [İstanbul VIP transfer fiyatları nasıl belirlenir](/blog/istanbul-vip-transfer-fiyatlari-nasil-belirlenir) yazımıza bakabilirsiniz.

[[IMAGE:inline-2]]

## Araç ve karşılama kalitesi

Taksi durağındaki araç, sıradaki hangi taksi geldiyse odur — model ve iç mekân kalitesi değişkenlik gösterebilir. VIP transferde ise araç sınıfı (Mercedes Vito, Sprinter gibi) rezervasyon sırasında bilinir ve isim tabelasıyla karşılama standart hizmetin bir parçasıdır.

## Ne zaman hangisi mantıklı?

Dürüst bir değerlendirme şöyle: **tek başınıza, az bagajla, kısa mesafeli bir yolculuk** yapıyorsanız (örneğin havalimanından yakın bir bölgeye) taksi durağı hızlı ve pratik bir seçenektir — rezervasyon beklemeden anında hareket edebilirsiniz.

Buna karşılık **grup hâlinde, bagajlı, uzun mesafeli veya sabit bütçe planlaması gereken** bir yolculukta (iş seyahati, aile tatili, önemli bir randevuya yetişme) önceden rezervasyonlu VIP transfer hem fiyat belirsizliğini ortadan kaldırır hem de karşılama ve araç kalitesini garanti eder.

## Uçuş rötarı durumunda fark

Taksi durağında rötar bir sorun oluşturmaz çünkü zaten anlık karşılama söz konusudur. VIP transferde ise rötar, rezervasyon sırasında verilen uçuş numarası üzerinden takip edilerek yönetilir — karşılama saati otomatik güncellenir, bu durum ek ücrete yol açmaz.

## Rezervasyon için gereken bilgiler

VIP transfer tercih edildiğinde gereken bilgiler: kalkış/varış adresi, tarih-saat, uçuş numarası (havalimanı transferiyse), yolcu ve bagaj sayısı.

VIP transfer ile taksi arasındaki genel karşılaştırma için [VIP transfer ile taksi arasındaki farklar](/blog/vip-transfer-ile-taksi-arasindaki-farklar) yazımıza, fiyatlandırma mantığı için [VIP transfer fiyatları nasıl belirlenir](/blog/istanbul-vip-transfer-fiyatlari-nasil-belirlenir) yazımıza bakabilirsiniz. Rezervasyon için [teklif formunu](/iletisim) kullanabilirsiniz.`;

const faqs = [
  ['VIP taksi ile standart taksi arasındaki en büyük fark nedir?', 'En somut fark fiyatlandırma mantığıdır: standart taksi taksimetreyle anlık hesaplanır, VIP taksi/transfer ise rezervasyon sırasında sabitlenen bir fiyatla çalışır ve trafik ücreti etkilemez.'],
  ['Havalimanında taksi durağından binmek neden daha uzun sürebilir?', 'Yoğun saatlerde, özellikle birden fazla uçuşun aynı anda indiği zaman dilimlerinde, taksi sırası beklemesi uzayabilir. Önceden rezervasyonlu transferde ise karşılama önceden planlanmıştır.'],
  ['Taksimetre ile giderken rötar veya trafik ücreti nasıl etkiler?', 'Taksimetre gerçekleşen mesafe ve süreye göre anlık hesap yaptığından, trafiğe takılmak veya rota uzaması ücreti artırır. VIP transferde ise fiyat sabittir, bu durumlar ücreti değiştirmez.'],
  ['Uçağım rötar yaparsa taksi durağı mı VIP transfer mi daha avantajlı?', 'Taksi durağında rötar sorun oluşturmaz çünkü karşılama zaten anlıktır. VIP transferde ise uçuş numarası takip edilerek karşılama saati otomatik güncellenir; ikisi de rötara karşı işlevseldir, fark karşılama şeklindedir.'],
  ['Tek başıma kısa mesafeli bir yolculukta hangisi daha mantıklı?', 'Az bagajla, kısa mesafeli ve tek kişilik bir yolculukta taksi durağı rezervasyon beklemeden anında hareket imkânı sunduğu için pratik olabilir.'],
  ['Grup hâlinde seyahat ederken hangisi tercih edilmeli?', 'Grup hâlinde, bagajlı veya sabit bütçe planlaması gereken yolculuklarda önceden rezervasyonlu VIP transfer hem fiyat belirsizliğini ortadan kaldırır hem de araç kapasitesini garanti eder.'],
  ['VIP transferde araç modeli önceden biliniyor mu?', 'Evet, araç sınıfı (örneğin Mercedes Vito veya Sprinter) rezervasyon sırasında belirlenir ve karşılama isim tabelasıyla yapılır; taksi durağında ise hangi araca denk geleceğiniz önceden bilinmez.'],
];

async function invalidateCache() {
  const domain = process.env.REPLIT_DEV_DOMAIN?.trim();
  const secret = process.env.AUTH_SECRET;
  if (!domain || !secret) throw new Error('Cache invalidation configuration missing');
  const requestBody = JSON.stringify({ slugs: [slug] });
  const signature = createHmac('sha256', secret).update(`blog-cache-revalidation:v1.${requestBody}`).digest('base64url');
  const response = await fetch(`https://${domain}/admin/api/cron/blog-cache-revalidation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-blog-cache-revalidation-signature': signature },
    body: requestBody,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Cache invalidation failed (${response.status})`);
}

try {
  const result = await sql.begin(async tx => {
    const [before] = await tx`
      SELECT id, slug, status, published_at, hero_image, hero_image_alt, og_image
      FROM content
      WHERE slug=${slug} AND content_type='BLOG_POST'
      FOR UPDATE`;
    if (!before) throw new Error('Blog not found');

    await tx`
      UPDATE content SET
        title='VIP Taksi ile Standart Taksi Arasındaki Farklar',
        seo_title='VIP Taksi ile Standart Taksi Farkları Nelerdir?',
        seo_description='Havalimanı taksi durağı ile önceden rezervasyonlu VIP taksi/transfer arasındaki fark nedir? Fiyatlandırma, araç kalitesi ve bekleme süresi karşılaştırması.',
        excerpt='Havalimanı taksi durağı ile önceden rezervasyonlu VIP taksi arasındaki temel farklar.',
        category='Karşılaştırma',
        tags=${sql.json(['vip taksi', 'standart taksi farkları', 'havalimanı taksi durağı', 'sabit fiyat taksi'])},
        author='Hevra Turizm Transfer Ekibi',
        read_time_minutes=6,
        body=${body},
        internal_links=${sql.json([
          { label: 'VIP transfer ile taksi arasındaki farklar', href: '/blog/vip-transfer-ile-taksi-arasindaki-farklar' },
          { label: 'İstanbul VIP transfer fiyatları nasıl belirlenir', href: '/blog/istanbul-vip-transfer-fiyatlari-nasil-belirlenir' },
          { label: 'teklif formu', href: '/iletisim' },
        ])},
        updated_at=now()
      WHERE id=${before.id}`;

    await tx`DELETE FROM faqs WHERE content_id=${before.id}`;
    for (const [sortOrder, [question, answer]] of faqs.entries()) {
      await tx`
        INSERT INTO faqs (content_id, question, answer, translations, sort_order)
        VALUES (${before.id}, ${question}, ${answer}, '{}'::jsonb, ${sortOrder})`;
    }

    const [after] = await tx`
      SELECT slug,status,published_at,updated_at,hero_image,hero_image_alt,og_image,body
      FROM content WHERE id=${before.id}`;
    if (
      after.slug !== before.slug ||
      after.status !== before.status ||
      after.published_at?.toISOString() !== before.published_at?.toISOString()
    ) throw new Error('Protected publication fields changed');
    if (
      after.hero_image !== before.hero_image ||
      after.hero_image_alt !== before.hero_image_alt ||
      after.og_image !== before.og_image
    ) throw new Error('Image fields changed');
    if (
      (after.body.match(/\[\[IMAGE:inline-1\]\]/g) ?? []).length !== 1 ||
      (after.body.match(/\[\[IMAGE:inline-2\]\]/g) ?? []).length !== 1
    ) throw new Error('Image placeholders were not preserved');

    return { ...after, faqCount: faqs.length };
  });
  await invalidateCache();
  console.log(JSON.stringify({ phase: 'text-updated', ...result }, null, 2));
} finally {
  await sql.end();
}