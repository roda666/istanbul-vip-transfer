/**
 * Typed local blog content source.
 * Designed for future CMS migration: swap this file's exports for
 * async CMS SDK calls without touching the page components.
 *
 * Body format: markdown-like plain text, rendered by ArticleBody component.
 *   ## H2 heading
 *   ### H3 heading
 *   - list item
 *   [anchor text](url)
 *   **bold text**
 *   Empty line = paragraph / list separator
 */

export interface RelatedService {
  label: string;
  href: string;
}

export interface BlogPost {
  /** Display title — used as H1 in the article hero */
  title: string;
  /** Override for <title> / og:title when different from H1 */
  metaTitle?: string;
  /** URL-safe slug, e.g. "istanbul-havalimani-transfer-rehberi" */
  slug: string;
  /** 105–155 character meta description */
  description: string;
  /** ISO 8601 date string, e.g. "2026-07-27" */
  publishedAt: string;
  /** ISO 8601 date string — omit if never updated after publish */
  updatedAt?: string;
  /** Display category, e.g. "Transfer Rehberi" */
  category: string;
  /** Path to image in /public or an absolute URL. Omit if no suitable image. */
  image?: string;
  /** Descriptive alt text for the article image */
  imageAlt?: string;
  /**
   * Article body in markdown-like plain text.
   * Rendered by components/ArticleBody.tsx.
   * Swap for MDX or a CMS rich-text field when upgrading.
   */
  body: string;
  /** Links shown in the "İlgili Hizmetler" section at the bottom of the article. */
  relatedServices?: RelatedService[];
}

export const blogPosts: BlogPost[] = [
  {
    title: 'İstanbul Havalimanı Transfer Rehberi',
    metaTitle: 'İstanbul Havalimanı Transfer Rehberi | VIP Transfer Istanbul',
    slug: 'istanbul-havalimani-transfer-rehberi',
    description:
      'İstanbul Havalimanı\'nda özel transfer nasıl çalışır? Rezervasyon adımları, karşılama süreci, bagaj planlaması ve araç seçimi hakkında kapsamlı rehber.',
    publishedAt: '2026-07-27',
    category: 'Transfer Rehberi',
    image: '/images/blog/istanbul-havalimani-transfer-rehberi.jpg',
    imageAlt: 'İstanbul gece manzarası ve Boğaziçi Köprüsü — İstanbul Havalimanı Transfer Rehberi',
    relatedServices: [
      { label: 'İstanbul Havalimanı Transfer', href: '/istanbul-havalimani-transfer' },
      { label: 'Otel Transfer', href: '/otel-transfer' },
      { label: 'Şoförlü Araç Kiralama', href: '/soforlu-arac-kiralama' },
    ],
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

Karşılama sürecinde bilmeniz gerekenler:

- Uçuşunuz gecikirse uçuş numaranıza dayalı gerçek zamanlı takip sayesinde sürücü bekleme planını günceller.
- Sürücüyü terminalde bulamazsanız rezervasyon sırasında verilen numarayı arayabilirsiniz.
- Gece geç saatlerde veya sabah erken saatlerde de hizmet kesintisiz devam etmektedir.

## Bagaj Planlaması

Taşıyacağınız bagaj miktarı, hangi aracın tahsis edileceğini doğrudan etkiler. Rezervasyon sırasında yolcu sayısı ve bagaj adetini belirtmeniz bu kararı kolaylaştırır.

[Araç filomuz](/araclar) hakkında detaylı bilgi almak, hangi aracın sizin için uygun olduğunu netleştirmenize yardımcı olur.

## Araç Seçimi

### Mercedes Vito

Küçük ve orta büyüklükteki gruplar için uygundur. Şehir içi kullanımda manevra kabiliyeti yüksektir ve standart bagaj kapasitesi pek çok grup için yeterlidir.

### Mercedes Sprinter

Daha büyük gruplar veya fazla miktarda bagaj taşıyanlar için tercih edilmektedir. Geniş iç mekanı hem şehir içi hem şehirler arası uzun mesafeli transferlerde yolculara konforlu bir deneyim sunar.

## Transfer Öncesi Yapılması Gerekenler

Birkaç pratik adım transferinizin sorunsuz geçmesini sağlar:

- **Uçuş numaranızı paylaşın.** Gecikme durumunda sürücüye haber vermek için kullanılır.
- **Adresinizi tam ve doğru yazın.** Otel veya konut adresinizin eksiksiz olduğundan emin olun.
- **Plan değişikliklerini bildirin.** Saatiniz veya adresiniz değişirse sürücüyü önceden haberdar edin.
- **Erken rezervasyon yapın.** Gece geç ve sabah erken seferler için rezervasyonun zamanında tamamlanması planlamayı kolaylaştırır.

Havalimanı transferinin yanı sıra [otel transfer hizmetimiz](/otel-transfer) ve [şoförlü araç kiralama seçeneğimiz](/soforlu-arac-kiralama) de ihtiyaçlarınıza göre değerlendirebileceğiniz hizmetler arasındadır.

## Sık Sorulan Sorular

### Uçağım gecikirse sürücü beni bekler mi?

Evet. Rezervasyona eklenen uçuş numarası sayesinde sürücü gerçek zamanlı takip yapar ve bekleyişini buna göre ayarlar.

### Terminalde sürücüyü nasıl tanıyacağım?

Sürücünüz çıkış kapısında isminizin veya şirket adınızın yazılı olduğu bir tabelayla bekler. Göremezseniz rezervasyon sırasında paylaşılan numarayı arayabilirsiniz.

### Gece yarısı veya sabah çok erken saatlerde transfer yapılıyor mu?

Evet, hizmet 7/24 kesintisiz çalışmaktadır. Bu saatler için rezervasyonun önceden tamamlanması yeterlidir.

### Kaç kişiyle aynı araçla seyahat edebilirim?

Yolcu sayısına ve bagaj miktarına göre uygun araç belirlenir. Büyük gruplar için Mercedes Sprinter, küçük gruplar için Vito genellikle tercih edilir.

### İç hat terminal ile dış hat terminal arasında fark var mı?

Her iki terminalden de karşılama yapılmaktadır. Rezervasyon sırasında terminali belirtmeniz sürücünün doğru bölgede beklenmesini sağlar.`,
  },

  {
    title: 'Sabiha Gökçen Havalimanı Transfer Rehberi',
    metaTitle: 'Sabiha Gökçen Havalimanı Transfer Rehberi | VIP Transfer Istanbul',
    slug: 'sabiha-gokcen-transfer-rehberi',
    description:
      'Sabiha Gökçen Havalimanı\'nda ön rezervasyon, yolcu karşılama, uçuş bilgisi paylaşımı, bagaj gereksinimleri ve kapıdan kapıya transfer planlaması rehberi.',
    publishedAt: '2026-07-27',
    category: 'Transfer Rehberi',
    image: '/images/blog/sabiha-gokcen-transfer-rehberi.jpg',
    imageAlt: 'Mercedes Sprinter VIP transfer aracı — Sabiha Gökçen Havalimanı transfer planlaması',
    relatedServices: [
      { label: 'Sabiha Gökçen Transfer', href: '/sabiha-gokcen-havalimani-transfer' },
      { label: 'Otel Transfer', href: '/otel-transfer' },
      { label: 'Şehirler Arası Transfer', href: '/sehirler-arasi-transfer' },
    ],
    body: `Sabiha Gökçen Havalimanı, İstanbul'un Anadolu yakasında yer alan ve hem iç hat hem dış hat seferlerine ev sahipliği yapan havalimanıdır. Şehrin Avrupa yakasındaki noktalara veya İstanbul dışına seyahat planlıyorsanız, ön rezervasyonlu bir özel transfer hem zamanlama hem de konfor açısından ciddi avantaj sağlar. Terminale indiğinizde sizi isminizle karşılayan bir sürücü ve hazır bir araç, seyahatin en yorucu aşamasını ortadan kaldırır.

Bu rehberde SAW Havalimanı'ndan özel transfer planlamasına ilişkin ön rezervasyon, karşılama süreci, uçuş bilgisinin doğru paylaşımı, bagaj gereksinimleri ve araç seçimi konularını ele alıyoruz.

## Ön Rezervasyon Neden Önemlidir?

Sabiha Gökçen'den alınan transferlerde ön rezervasyon yaptırmak birçok açıdan kolaylık sağlar. Sürücü transferinize özel olarak hazırlanır; uçuş gecikmelerinde takip yapılır ve bekleme süresi güncellenir. Büyük bir grupla ya da fazla bagajla seyahat ettiğinizde araç kapasitesinin önceden doğru planlanması da ön rezervasyonla mümkündür.

Ön rezervasyonun sağladığı başlıca faydalar:

- Terminale indiğinizde hazır bekleyen araç ve sürücü
- Uçuş gecikmelerinde otomatik güncellenen bekleme süresi
- Grubunuza ve bagajınıza göre önceden belirlenen araç kapasitesi
- Çıkış sonrası tabelayla doğrudan karşılama

## Yolcu Karşılama Süreci

Sabiha Gökçen Havalimanı'nda bagaj teslim alındıktan sonra gümrük çıkışından geçilir. Sürücünüz çıkış bölgesinde isminizin veya şirket adınızın yazılı olduğu bir tabelayla bekler.

Karşılama aşamasında dikkat edilmesi gerekenler:

- Çıkışta tabelayı göremezseniz rezervasyon sırasında verilen numarayı arayabilirsiniz.
- Uçuşunuz gecikirse uçuş takibi sayesinde sürücü bu bilgiden otomatik olarak haberdar olur.
- Gece geç ve sabah erken saatlerde de karşılama hizmeti kesintisiz verilmektedir.

## Uçuş Bilgisini Nasıl Paylaşmalısınız?

Rezervasyon sırasında doğru uçuş bilgisini paylaşmak, sürücünün zamanında ve doğru planlamayla gelmesini sağlar.

- **Uçuş numaranızı** paylaşın; bu bilgi gecikme durumunda gerçek zamanlı takip yapılmasına imkân tanır.
- Uçuş numaranızı bilmiyorsanız tahmini varış saatinizi belirtmeniz yeterlidir; sürücü bu saate göre planlamasını yapar.
- Varış saatiniz değişirse WhatsApp üzerinden güncel bilgiyi iletebilirsiniz.

## Bagaj ve Araç Gereksinimleri

Yolculukta taşıyacağınız bagaj miktarı, hangi aracın tahsis edileceğini etkiler. Rezervasyon sırasında yolcu sayısını ve yaklaşık bagaj adetini belirtmek en uygun aracın seçilmesini sağlar.

[Araç filomuzda](/araclar) yer alan Mercedes Vito ve Sprinter seçenekleri farklı grup büyüklükleri ve bagaj kapasiteleri için uygundur.

## Mercedes Vito ve Sprinter Seçimi

### Mercedes Vito

Küçük ve orta büyüklükteki gruplar için uygundur. Sabiha Gökçen'den İstanbul'un çeşitli noktalarına yapılan transferlerde tercih edilmektedir.

### Mercedes Sprinter

Daha büyük gruplar veya fazla miktarda bagaj taşıyan yolcular için daha uygun bir seçenektir. Geniş iç mekanı hem kısa hem uzun mesafeli transferlerde konforlu bir ortam sağlar. Özellikle [şehirler arası transfer](/sehirler-arasi-transfer) planları için Sprinter değerlendirilebilecek bir seçenektir.

## Kapıdan Kapıya Transfer Planlaması

Sabiha Gökçen'den kapıdan kapıya transfer planlamasında birkaç noktanın göz önünde bulundurulması önerilir:

- Kalkış noktanız bir otel ise adresin tam ve eksiksiz paylaşılması sürücünün doğru konuma gitmesini sağlar.
- Şehrin farklı bölgelerine yapılan transferlerde trafik koşulları değişkenlik gösterebileceğinden esnek bir zaman planlaması yapılması önerilir.
- Dönüş transferi de aynı hizmet kapsamında planlanabilir; çıkış transferleri için uçuş saatinizden yeterli süre öncesinde rezervasyon yaptırmanız önerilir.

[Sabiha Gökçen Havalimanı transfer sayfamızda](/sabiha-gokcen-havalimani-transfer) hizmete ilişkin daha fazla bilgiye ulaşabilirsiniz.

Otelinizdeki konaklamanız süresince de transfer ihtiyacınız olursa [otel transfer hizmetimizi](/otel-transfer) inceleyebilirsiniz.

## Sık Sorulan Sorular

### Sabiha Gökçen'den İstanbul'un Avrupa yakasına transfer yapılabiliyor mu?

Evet. İstanbul'un hem Anadolu hem Avrupa yakasındaki adreslere transfer hizmeti verilmektedir. Hedef adresinizi rezervasyon sırasında belirtmeniz yeterlidir.

### Uçuşum gecikirse ne yapmalıyım?

Uçuş numaranız kayıtlıysa sürücü gerçek zamanlı takip yapar ve bekleyişini buna göre düzenler. Durumu WhatsApp üzerinden de iletebilirsiniz.

### Gece geç saatlerde de transfer hizmeti veriliyor mu?

Evet, 7/24 hizmet sunulmaktadır. Gece geç seferler için rezervasyonun önceden tamamlanması önerilir.

### Büyük veya fazla bagaj taşıyorsam hangi aracı seçmeliyim?

Fazla bagaj için Mercedes Sprinter geniş iç hacmiyle daha uygun bir seçenektir. Rezervasyon sırasında bagaj durumunuzu belirtmeniz doğru aracın tahsis edilmesini sağlar.

### Rezervasyonu ne kadar önceden yapmalıyım?

Mümkün olduğunca erkenden rezervasyon yapılması önerilir. Sabah erken veya gece geç seferler için en az birkaç saat öncesinden tamamlamak planlama açısından avantaj sağlar.`,
  },

  {
    title: 'VIP Transfer ile Taksi Arasındaki Farklar',
    metaTitle: 'VIP Transfer ile Taksi Arasındaki Farklar | İstanbul',
    slug: 'vip-transfer-ile-taksi-arasindaki-farklar',
    description:
      'İstanbul\'da VIP özel transfer ile taksi arasındaki temel farklar: ön rezervasyon, araç planlaması, grup ve bagaj kapasitesi, havalimanı karşılaması.',
    publishedAt: '2026-07-27',
    category: 'VIP Ulaşım',
    image: '/images/blog/vip-transfer-ile-taksi-arasindaki-farklar.jpg',
    imageAlt: 'Mercedes Vito VIP araç iç mekanı — özel transfer ve taksi karşılaştırması',
    relatedServices: [
      { label: 'VIP Transfer', href: '/vip-transfer' },
      { label: 'İstanbul Havalimanı Transfer', href: '/istanbul-havalimani-transfer' },
      { label: 'Kurumsal VIP Transfer', href: '/kurumsal-vip-transfer' },
      { label: 'Şoförlü Araç Kiralama', href: '/soforlu-arac-kiralama' },
    ],
    body: `İstanbul'da havalimanı veya şehir içi ulaşımı planlarken birden fazla seçenek arasından tercih yapılması gerekir. Bu yazıda VIP özel transfer hizmeti ile taksi arasındaki temel farkları dengeli bir bakış açısıyla ele alıyoruz. Her iki seçenek de farklı ihtiyaçlar için değer sunmaktadır; doğru tercihi yapabilmek için ikisi arasındaki yapısal farklılıkları anlamak yeterlidir.

## Ön Rezervasyon ve Planlama

VIP transfer hizmetinde yolculuk önceden planlanır. Kalkış adresi, hedef nokta, saat ve yolcu sayısı rezervasyon aşamasında belirlenir. Bu yapı özellikle havalimanı transferlerinde belirleyici bir fark yaratır: sürücü uçuş bilginize göre sizi zamanında karşılamaya hazırdır; uçuş gecikmelerinde ise takip yapılarak bekleme süresi güncellenir.

Taksiye anlık talep esasıyla ulaşılır; araç arandığı veya durağından bulunduğu anda hizmet başlar. Bu yaklaşım hızlı ve esnek olmakla birlikte, belirli bir saatte terminalde karşılanmanız gerekiyorsa önceden planlanmış bir transfer daha fazla güvence sağlar.

**Ne zaman hangi yaklaşım öne çıkar?** Büyük bir grupla seyahat ediliyorsa, uçuş takibi isteniyorsa veya kesin bir saatte terminalde beklenmesi gerekiyorsa ön rezervasyon avantaj sağlar.

## Araç Planlaması ve Kapasite

VIP transfer hizmetinde araç, yolcu sayısı ve bagaj miktarına göre önceden belirlenir. [Mercedes Vito ve Mercedes Sprinter](/araclar) seçenekleri hem küçük hem büyük gruplar için uygun kapasiteler sunar.

Standart bir taksi genellikle 3-4 yolcuya ve sınırlı miktarda bagaja uygundur. Büyük grup veya çok sayıda valiz söz konusu olduğunda ek araç gerekebilir ya da düzenleme güçleşebilir.

Bu fark özellikle [havalimanı transferlerinde](/istanbul-havalimani-transfer) belirginleşir: büyük bir grupla veya fazla valizle terminale inildiğinde hangi araçla hareket edileceğini önceden bilmek pratikte ciddi kolaylık sağlar.

## Grup Seyahati ve Bagaj Gereksinimleri

### Küçük Gruplar

2-4 kişilik küçük gruplar için her iki seçenek de işlevsel olabilir. Önceden planlanmış bir seyahatte VIP transfer belirlilik sağlarken, kısa ve anlık şehir içi hareketlerde taksi pratik bir tercih olabilir.

### Büyük Gruplar

5 veya daha fazla kişilik gruplar için tek bir araçta seyahat etmek hem pratik hem de koordinasyon açısından avantajlıdır. [VIP transfer hizmetinde](/vip-transfer) Mercedes Sprinter bu tür gruplar için uygun kapasiteye sahiptir.

### Özel Bagaj Durumları

Fazla valiz, büyük spor ekipmanı veya medikal cihaz gibi özel yük durumlarında aracı önceden planlamak gereklidir. VIP transfer rezervasyonunda bu detaylar önceden paylaşılabilir.

## Havalimanı Karşılaması

Havalimanı karşılaması, iki hizmet türü arasındaki en belirgin fark noktalarından birini oluşturur.

VIP transferde sürücü terminalin çıkış kapısında isim tabelasıyla bekler. Uçuş gecikmelerinde otomatik takip yapılır ve bekleme süresi güncellenir. Bu yaklaşım özellikle terminale yabancı olan yolcular veya yurt dışından gelen ziyaretçiler için fark yaratır.

Taksiye ulaşmak için terminalde taksi durağına yönelmek ya da uygulamadan araç çağırmak gerekir. Yoğun saatlerde bekleme süresi değişkenlik gösterebilir.

## Kurumsal Kullanım

Şirketler ve kurumlar için [kurumsal VIP transfer hizmeti](/kurumsal-vip-transfer) fatura düzenleme imkânıyla birlikte gelir ve düzenli seyahat planlamasına imkân tanır. Yönetici transferleri veya iş misafiri karşılama için öngörülebilir bir yapı sunar.

[Şoförlü araç kiralama hizmetimiz](/soforlu-arac-kiralama) de gün boyu şehir içi ulaşım planlayanlar için değerlendirilebilecek bir seçenektir.

## Hangi Durumlarda VIP Transfer Öne Çıkar?

Aşağıdaki senaryolarda VIP transfer hizmetini tercih etmek pratik avantaj sağlar:

- Havalimanından belirlenen adrese planlı ve saatinde ulaşım gerektiğinde
- Dört veya daha fazla kişilik gruplarla seyahat edildiğinde
- Fazla veya özel bagaj taşındığında
- Uçuş takibi ve isim tabelası ile karşılama istendiğinde
- Kurumsal seyahatlerde fatura düzenlenmesi gerektiğinde
- Gece geç veya sabah çok erken transferlerde

## Sık Sorulan Sorular

### VIP transfer her zaman taksiden pahalı mıdır?

Fiyat karşılaştırması seyahatin niteliğine göre değişir. Büyük gruplar için tek bir araçla seyahat, birden fazla taksi tutmakla kıyaslandığında maliyet açısından avantajlı olabilir. Güncel bilgi için teklif alınması önerilir.

### Taksiden her koşulda üstün müdür?

Hayır. Anlık ve kısa şehir içi hareketlerde taksi pratik ve hızlı bir seçenektir. VIP transferin değeri özellikle önceden planlanmış, büyük gruplu veya özel ihtiyaçlı seyahatlerde ön plana çıkar.

### İstanbul'da gece geç saatlerde taksi bulmak güç müdür?

İstanbul'da gece geç saatlerde taksi bulmak bazı bölgelerde daha güç olabilir. Önceden planlanan bir transfer bu belirsizliği ortadan kaldırır.

### VIP transfer rezervasyonu ne kadar önceden yapılmalı?

Mümkün olduğunca erkenden yapılması önerilir. En az birkaç saat öncesinden bilgi paylaşılması planlamayı kolaylaştırır.

### Büyük grupta VIP transfer nasıl planlanır?

Grup büyüklüğü ve bagaj miktarı rezervasyon sırasında paylaşılır; buna göre en uygun araç tahsis edilir. Herkesin aynı araçta seyahat etmesi koordinasyonu basitleştirir.`,
  },
];

/** Look up a single post by slug. Returns undefined if not found. */
export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}

/** Return all published slugs — used by generateStaticParams. */
export function getAllSlugs(): string[] {
  return blogPosts.map((p) => p.slug);
}

/** True when there is at least one published article. */
export const BLOG_LIVE = blogPosts.length > 0;
