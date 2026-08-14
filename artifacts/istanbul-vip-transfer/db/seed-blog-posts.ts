/**
 * Idempotent seed: migrates the 3 static blog posts from lib/blog-data.ts
 * into the `content` table as BLOG_POST rows.
 *
 * Run with: npx tsx db/seed-blog-posts.ts
 *
 * Safe to run multiple times — uses ON CONFLICT DO NOTHING on the unique slug.
 * Existing rows are NOT touched (no updates).
 */
import { db } from './index';
import { content } from './schema';
import { sql } from 'drizzle-orm';

const BLOG_POSTS = [
  {
    slug:           'istanbul-havalimani-transfer-rehberi',
    title:          'İstanbul Havalimanı Transfer Rehberi',
    excerpt:        'İstanbul Havalimanı\'nda özel transfer nasıl çalışır? Rezervasyon adımları, karşılama süreci, bagaj planlaması ve araç seçimi hakkında kapsamlı rehber.',
    seoTitle:       'İstanbul Havalimanı Transfer Rehberi | VIP Transfer Istanbul',
    seoDescription: 'İstanbul Havalimanı\'nda özel transfer nasıl çalışır? Rezervasyon adımları, karşılama süreci, bagaj planlaması ve araç seçimi hakkında kapsamlı rehber.',
    heroImage:      '/images/blog/istanbul-havalimani-transfer-rehberi.jpg',
    heroImageAlt:   'İstanbul gece manzarası ve Boğaziçi Köprüsü — İstanbul Havalimanı Transfer Rehberi',
    category:       'Transfer Rehberi',
    publishedAt:    new Date('2026-07-27'),
    body: `İstanbul Havalimanı, Türkiye'nin en büyük ve en yoğun havalimanıdır. Yurt içi ve yurt dışı uçuşlarla her gün on binlerce yolcu bu terminale iner ve kalkar. Terminal büyüklüğü ve yoğunluğu, özellikle ilk kez gelen ziyaretçiler için ulaşım planlamasını güçleştirebilir. Önceden ayarlanmış bir özel transfer bu belirsizliği ortadan kaldırır: terminale indiğinizde sizi tabelayla bekleyen bir sürücü ve belirlediğiniz adrese giden planlı bir yolculuk.

Bu rehberde IST Havalimanı'ndan özel transfer hizmetinin nasıl çalıştığını, nasıl rezervasyon yapıldığını, terminaldeki karşılama sürecini ve doğru araç seçimini adım adım ele alıyoruz.

## Özel Havalimanı Transferi Neden Tercih Edilir?

Havalimanı transferinde birçok ulaşım seçeneği mevcuttur. Özel transfer hizmeti, yalnızca sizin grubunuz için tahsis edilmiş bir araç ve sürücü, önceden belirlenmiş bir güzergah ve bagaj yardımı sunmasıyla bu seçeneklerden ayrılır. Aşağıdaki durumlarda özel transfer özellikle değerli hale gelir:

- Fazla veya büyük bagajla seyahat edildiğinde
- Dört veya daha fazla kişilik gruplarla seyahat edildiğinde
- Gece geç veya sabah çok erken uçuşlarda
- Doğrudan otel, konut veya ofis adresine ulaşım istendiğinde
- İş seyahati veya kurumsal ziyaretlerde öngörülebilir bir transfer planı gerektiğinde

## Rezervasyon Nasıl Yapılır?

### Adım 1: Seyahat Bilgilerini Hazırlayın

Rezervasyon sürecini hızlı tamamlamak için şu bilgileri önceden belirlemeniz faydalıdır:

- Uçuş numaranız veya tahmini varış saatiniz
- İniş yapacağınız terminal (iç hat veya dış hat)
- Transfer adresi: otel adı ya da sokak adresi
- Yolcu sayısı ve yaklaşık bagaj adedi

### Adım 2: WhatsApp veya Telefon ile İletişime Geçin

[İstanbul Havalimanı VIP transfer hizmeti](/istanbul-havalimani-transfer) için WhatsApp veya telefonla iletişime geçilir. Seyahat bilgilerinizi paylaştıktan sonra size en uygun araç tahsis edilir ve onay bilgisi iletilir.

### Adım 3: Sürücü Bilgisini Alın

Transferinizden önce sürücünüzün adı ve araç bilgisi gönderilir. Bu sayede terminale indiğinizde kimi arayacağınızı veya hangi tabelayı arayacağınızı önceden bilirsiniz.

## Havalimanında Karşılama Süreci

İstanbul Havalimanı'nda bagajınızı teslim alıp gümrük çıkışını geçtikten sonra karşılama bölümüne ulaşırsınız. Sürücünüz bu bölgede isminizin veya şirket adınızın yazılı olduğu bir tabelayla bekler.

## Sık Sorulan Sorular

### Uçağım gecikirse sürücü beni bekler mi?

Evet. Rezervasyona eklenen uçuş numarası sayesinde sürücü gerçek zamanlı takip yapar ve bekleyişini buna göre ayarlar.

### Terminalde sürücüyü nasıl tanıyacağım?

Sürücünüz çıkış kapısında isminizin veya şirket adınızın yazılı olduğu bir tabelayla bekler.

### Gece yarısı veya sabah çok erken saatlerde transfer yapılıyor mu?

Evet, hizmet 7/24 kesintisiz çalışmaktadır.`,
  },
  {
    slug:           'sabiha-gokcen-transfer-rehberi',
    title:          'Sabiha Gökçen Havalimanı Transfer Rehberi',
    excerpt:        'Sabiha Gökçen Havalimanı\'nda ön rezervasyon, yolcu karşılama, uçuş bilgisi paylaşımı, bagaj gereksinimleri ve kapıdan kapıya transfer planlaması rehberi.',
    seoTitle:       'Sabiha Gökçen Havalimanı Transfer Rehberi | VIP Transfer Istanbul',
    seoDescription: 'Sabiha Gökçen Havalimanı\'nda ön rezervasyon, yolcu karşılama, uçuş bilgisi paylaşımı, bagaj gereksinimleri ve kapıdan kapıya transfer planlaması rehberi.',
    heroImage:      '/images/blog/sabiha-gokcen-transfer-rehberi.jpg',
    heroImageAlt:   'Mercedes Sprinter VIP transfer aracı — Sabiha Gökçen Havalimanı transfer planlaması',
    category:       'Transfer Rehberi',
    publishedAt:    new Date('2026-07-27'),
    body: `Sabiha Gökçen Havalimanı, İstanbul'un Anadolu yakasında yer alan ve hem iç hat hem dış hat seferlerine ev sahipliği yapan havalimanıdır. Şehrin Avrupa yakasındaki noktalara veya İstanbul dışına seyahat planlıyorsanız, ön rezervasyonlu bir özel transfer hem zamanlama hem de konfor açısından ciddi avantaj sağlar.

Bu rehberde SAW Havalimanı'ndan özel transfer planlamasına ilişkin ön rezervasyon, karşılama süreci, uçuş bilgisinin doğru paylaşımı, bagaj gereksinimleri ve araç seçimi konularını ele alıyoruz.

## Ön Rezervasyon Neden Önemlidir?

Sabiha Gökçen'den alınan transferlerde ön rezervasyon yaptırmak birçok açıdan kolaylık sağlar. Sürücü transferinize özel olarak hazırlanır; uçuş gecikmelerinde takip yapılır ve bekleme süresi güncellenir.

## Yolcu Karşılama Süreci

Sabiha Gökçen Havalimanı'nda bagaj teslim alındıktan sonra gümrük çıkışından geçilir. Sürücünüz çıkış bölgesinde isminizin veya şirket adınızın yazılı olduğu bir tabelayla bekler.

## Sık Sorulan Sorular

### Sabiha Gökçen'den İstanbul'un Avrupa yakasına transfer yapılabiliyor mu?

Evet. İstanbul'un hem Anadolu hem Avrupa yakasındaki adreslere transfer hizmeti verilmektedir.

### Uçuşum gecikirse ne yapmalıyım?

Uçuş numaranız kayıtlıysa sürücü gerçek zamanlı takip yapar ve bekleyişini buna göre düzenler.

### Gece geç saatlerde de transfer hizmeti veriliyor mu?

Evet, 7/24 hizmet sunulmaktadır.`,
  },
  {
    slug:           'vip-transfer-ile-taksi-arasindaki-farklar',
    title:          'VIP Transfer ile Taksi Arasındaki Farklar',
    excerpt:        'İstanbul\'da VIP özel transfer ile taksi arasındaki temel farklar: ön rezervasyon, araç planlaması, grup ve bagaj kapasitesi, havalimanı karşılaması.',
    seoTitle:       'VIP Transfer ile Taksi Arasındaki Farklar | İstanbul',
    seoDescription: 'İstanbul\'da VIP özel transfer ile taksi arasındaki temel farklar: ön rezervasyon, araç planlaması, grup ve bagaj kapasitesi, havalimanı karşılaması.',
    heroImage:      '/images/blog/vip-transfer-ile-taksi-arasindaki-farklar.jpg',
    heroImageAlt:   'Mercedes Vito VIP araç iç mekanı — özel transfer ve taksi karşılaştırması',
    category:       'VIP Ulaşım',
    publishedAt:    new Date('2026-07-27'),
    body: `İstanbul'da havalimanı veya şehir içi ulaşımı planlarken birden fazla seçenek arasından tercih yapılması gerekir. Bu yazıda VIP özel transfer hizmeti ile taksi arasındaki temel farkları dengeli bir bakış açısıyla ele alıyoruz.

## Ön Rezervasyon ve Planlama

VIP transfer hizmetinde yolculuk önceden planlanır. Kalkış adresi, hedef nokta, saat ve yolcu sayısı rezervasyon aşamasında belirlenir. Bu yapı özellikle havalimanı transferlerinde belirleyici bir fark yaratır.

## Araç Planlaması ve Kapasite

VIP transfer hizmetinde araç, yolcu sayısı ve bagaj miktarına göre önceden belirlenir. Mercedes Vito ve Mercedes Sprinter seçenekleri hem küçük hem büyük gruplar için uygun kapasiteler sunar.

## Havalimanı Karşılaması

VIP transferde sürücü terminalin çıkış kapısında isim tabelasıyla bekler. Uçuş gecikmelerinde otomatik takip yapılır ve bekleme süresi güncellenir.

## Sık Sorulan Sorular

### VIP transfer her zaman taksiden pahalı mıdır?

Fiyat karşılaştırması seyahatin niteliğine göre değişir. Büyük gruplar için tek bir araçla seyahat, birden fazla taksi tutmakla kıyaslandığında maliyet açısından avantajlı olabilir.

### VIP transfer rezervasyonu ne kadar önceden yapılmalı?

Mümkün olduğunca erkenden yapılması önerilir.`,
  },
];

async function seed() {
  console.log('🌱 Seeding blog posts…');

  for (const post of BLOG_POSTS) {
    try {
      await db
        .insert(content)
        .values({
          contentType:    'BLOG_POST',
          title:          post.title,
          slug:           post.slug,
          excerpt:        post.excerpt,
          seoTitle:       post.seoTitle,
          seoDescription: post.seoDescription,
          heroImage:      post.heroImage,
          heroImageAlt:   post.heroImageAlt,
          category:       post.category,
          body:           post.body,
          status:         'PUBLISHED',
          publishedAt:    post.publishedAt,
          indexable:      true,
          isActive:       true,
          displayOrder:   0,
          showOnHomepage: false,
          showInNav:      false,
          createdAt:      new Date(),
          updatedAt:      new Date(),
        } as never)
        .onConflictDoNothing();
      console.log(`  ✅ ${post.slug}`);
    } catch (err) {
      console.error(`  ❌ ${post.slug}:`, err);
    }
  }

  console.log('✅ Blog seed complete.');
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
