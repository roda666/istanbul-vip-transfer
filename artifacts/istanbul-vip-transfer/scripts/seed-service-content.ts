/**
 * Seed script — populates all 14 service pages with rich v2 body content.
 *
 * Rules:
 *  - NO invented prices, distances, journey times, statistics, or guarantees.
 *  - Content is descriptive and factual about the SERVICE TYPE, not the business.
 *  - Existing translated rows are marked OUTDATED so they are queued for re-translation.
 *  - Idempotent: safe to re-run (UPDATE only, never INSERT).
 *
 * Usage: node_modules/.bin/tsx scripts/seed-service-content.ts
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { ServicePageBody } from '../lib/service-page-types.js';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error('❌ DATABASE_URL eksik'); process.exit(1); }

const sqlClient = postgres(DB_URL, { max: 3 });
const db = drizzle(sqlClient, { schema });

// ──────────────────────────────────────────────────────────────────────────────
// Content definitions — all 14 service pages
// ──────────────────────────────────────────────────────────────────────────────

interface ServiceSeedData {
  slug: string;
  category: string;
  body: ServicePageBody;
}

const SERVICES: ServiceSeedData[] = [

  // ── 1. İstanbul Havalimanı Transfer ──────────────────────────────────────
  {
    slug: 'istanbul-havalimani-transfer',
    category: 'airport',
    body: {
      version: 2,
      hero: {
        badge: 'İstanbul Havalimanı (IST)',
        title: 'İstanbul Havalimanı VIP Transfer',
        subtitle: 'İstanbul Havalimanı\'ndan (IST) İstanbul\'un tüm ilçelerine, otellere ve iş merkezlerine özel araçla kapıdan kapıya ulaşım hizmeti.',
        crumb: 'IST Havalimanı Transfer',
        ctaPrimary: 'Rezervasyon ve Fiyat',
        ctaSecondary: 'Hemen Ara',
      },
      features: [
        'İsminize tabelayla karşılama — gidiş kapısında sizi bekliyoruz',
        'Kapıdan kapıya özel araç — taksi kuyruğu yok',
        'Bagaj yardımı dahil — valizlerinizi biz taşırız',
        'Yolculuk boyunca klima ve Wi-Fi imkânı',
        '7/24 hizmet — sabah erken, gece geç uçuş fark etmez',
        'Uçuş takibi — gecikmede aracınız sizi bekler',
      ],
      seo: {
        ogTitle: 'İstanbul Havalimanı VIP Transfer | Özel Araç',
        ogDescription: 'İstanbul Havalimanı\'ndan (IST) özel Mercedes araçla kapıdan kapıya VIP transfer hizmeti. İsminize tabela, bagaj yardımı.',
      },
      introBody: 'İstanbul Havalimanı (IST), Avrupa yakasında hizmet veren ana havalimanıdır. Uçuşun ardından yolculuğunuzun geri kalanının da konforlu geçmesi için özel araç transferi en pratik tercih olarak öne çıkar. Toplu ulaşıma ya da taksiye bekleme yapmadan, doğrudan otele, konaklama adresinize veya iş yerinize yönelirsiniz. Tüm alışlarımızda şoförümüz isminizin yazılı olduğu bir tabelayla gidiş kapısında sizi karşılar.',
      contentSections: [
        {
          id: 'ist-nasil-calisir',
          headingLevel: 'h2',
          heading: 'Transfer Nasıl İşler?',
          body: 'Rezervasyon sırasında uçuş bilgilerinizi, otel veya adres bilginizi paylaşırsınız. Şoförümüz iniş saatinizi takip eder; gecikmeler durumunda bekleme süresi otomatik olarak güncellenir. Pasaport kontrolü ve bagaj alımını tamamladıktan sonra karşılama alanında isim tabelası tutan şoförünüzü bulursunuz. Araç park alanına geçiş yapılır ve yolculuğunuz başlar.',
        },
        {
          id: 'ist-arac-secenekleri',
          headingLevel: 'h2',
          heading: 'Araç Seçenekleri',
          body: 'Mercedes Vito, küçük gruplar ve bireysel yolcular için idealdir. Geniş bagaj kapasitesiyle valiz taşıma konusunda sıkıntı yaşanmaz. Daha büyük gruplar ya da fazla bagaj için Mercedes Sprinter tercih edilebilir. Tüm araçlarımız klimalı ve bakımlıdır; yolculuk süresi boyunca konforlu bir seyahat ortamı sağlanır.',
        },
        {
          id: 'ist-hizmet-kapsamı',
          headingLevel: 'h2',
          heading: 'Hizmet Kapsamı ve İpuçları',
          body: 'Havalimanından şehrin herhangi bir noktasına transfer yapılmaktadır: Sultanahmet, Taksim, Levent, Beşiktaş, Kadıköy, Üsküdar ve diğer tüm ilçeler dahildir. Uçuşunuzun iniş saatini ve bekleme süresini göz önünde bulundurarak erken rezervasyon yapmanız, hem araç bulunurluğunu hem de planlamanızı kolaylaştırır. İstanbul trafiğinin yoğun olabileceği saatlerde yola çıkış saatinizi şoförünüzle önceden değerlendirmeniz önerilir.',
        },
        {
          id: 'ist-isletme-transferleri',
          headingLevel: 'h2',
          heading: 'Kurumsal ve Grup Transferleri',
          body: 'Çok sayıda kişiyi karşılamak ya da birden fazla noktadan alım yapmak için grup transferi planlaması da yapılabilir. Kurumsal seyahat organizasyonlarında fatura düzenleme imkânı mevcuttur. İş seyahatlerinde araç içinde sessiz çalışma ortamı sağlanmakta, gereksiz sohbetten kaçınılmaktadır.',
        },
      ],
      serviceArea: {
        title: 'Hizmet Verdiğimiz Bölgeler',
        description: 'İstanbul Havalimanı\'ndan (IST) İstanbul\'un tüm ilçelerine ve çevre şehirlere transfer hizmeti sağlanmaktadır.',
        areas: ['Sultanahmet', 'Taksim', 'Beşiktaş', 'Levent', 'Maslak', 'Kadıköy', 'Üsküdar', 'Beyoğlu', 'Şişli', 'Bakırköy', 'Bahçelievler', 'Ataşehir', 'Ümraniye', 'Pendik', 'Avcılar'],
      },
      faqs: [
        {
          id: 'ist-faq-1',
          question: 'Uçuşum gecikirse aracım beni bekler mi?',
          answer: 'Evet. Uçuş bilgilerinizi kayıt sırasında alıyoruz ve şoförümüz anlık uçuş takibi yaparak iniş saatinizi takip eder. Gecikmeler durumunda aracınız sizi beklemeye devam eder.',
        },
        {
          id: 'ist-faq-2',
          question: 'Şoförü nerede bulurum?',
          answer: 'Şoförümüz isminizin yazılı olduğu bir tabela ile gidiş kapısında sizi bekler. Pasaport kontrolü ve bagajınızı teslim aldıktan sonra karşılama alanına geçmeniz yeterlidir.',
        },
        {
          id: 'ist-faq-3',
          question: 'Gece uçuşları için de hizmet var mı?',
          answer: 'Evet, 7/24 hizmet sunmaktayız. Gece geç ya da sabah erken saatlerdeki uçuşlar için de aynı standartlarda karşılama yapılır.',
        },
        {
          id: 'ist-faq-4',
          question: 'Kaç bavulumla seyahat edebilirim?',
          answer: 'Araç kapasitesine bağlı olmakla birlikte, Mercedes Vito\'da bireysel seyahat için orta boy iki büyük bavul ve el bagajı sorunsuz taşınabilmektedir. Fazla bagaj varsa Sprinter tercih edilebilir; rezervasyon sırasında belirtmeniz yeterlidir.',
        },
        {
          id: 'ist-faq-5',
          question: 'Ödemeyi nasıl yapabilirim?',
          answer: 'Ödeme seçenekleri hakkında rezervasyon aşamasında bilgi alabilirsiniz. Yolculuk öncesi veya sonrasında çeşitli ödeme yöntemleri değerlendirilebilir.',
        },
      ],
      schemaExtras: {
        serviceType: 'Airport Transfer',
        openingHours: 'Mo-Su 00:00-24:00',
        availableLanguage: ['Turkish', 'English'],
      },
    },
  },

  // ── 2. Sabiha Gökçen Transfer ─────────────────────────────────────────────
  {
    slug: 'sabiha-gokcen-havalimani-transfer',
    category: 'airport',
    body: {
      version: 2,
      hero: {
        badge: 'Sabiha Gökçen Havalimanı (SAW)',
        title: 'Sabiha Gökçen Havalimanı VIP Transfer',
        subtitle: 'Sabiha Gökçen Havalimanı\'ndan (SAW) Anadolu ve Avrupa yakasının tüm noktalarına özel araçla kapıdan kapıya ulaşım.',
        crumb: 'SAW Havalimanı Transfer',
        ctaPrimary: 'Rezervasyon ve Fiyat',
        ctaSecondary: 'Hemen Ara',
      },
      features: [
        'SAW çıkışında isim tabelasıyla karşılama',
        'Anadolu ve Avrupa yakasına transfer',
        'Bagaj yardımı dahil',
        'Uçuş gecikmelerini takip ediyoruz',
        '7/24 hizmet — her saatte karşılama',
        'Trafiği bilen deneyimli şoförler',
      ],
      seo: {
        ogTitle: 'Sabiha Gökçen Transfer | VIP Özel Araç (SAW)',
        ogDescription: 'Sabiha Gökçen Havalimanı\'ndan özel Mercedes araçla İstanbul\'un her noktasına VIP transfer. İsim tabelası, 7/24.',
      },
      introBody: 'Sabiha Gökçen Havalimanı (SAW), İstanbul\'un Anadolu yakasında, Pendik ilçesinde konuşlanmaktadır. Düşük maliyetli ve charter uçuşların önemli bir kısmı bu havalimanından gerçekleşir. SAW\'dan şehir merkezine ya da Avrupa yakasına ulaşmak için özel araç transferi, toplu taşıma araçlarına göre çok daha konforlu ve doğrudan bir seçenektir.',
      contentSections: [
        {
          id: 'saw-karsilama-sureci',
          headingLevel: 'h2',
          heading: 'Karşılama ve Alım Süreci',
          body: 'Uçuşunuz inerken şoförümüz anlık bilgilendirme sistemi sayesinde iniş saatinizi takip eder. Bagajınızı aldıktan sonra dış kapıda isminizin yazılı olduğu tabela ile şoförünüzü bulursunuz. Araç park alanına geçilir ve belirlediğiniz adrese doğru yola çıkılır.',
        },
        {
          id: 'saw-mesafe-bilgisi',
          headingLevel: 'h2',
          heading: 'Anadolu ve Avrupa Yakasına Ulaşım',
          body: 'SAW\'dan Kadıköy, Üsküdar, Ataşehir ve Ümraniye gibi Anadolu yakası noktalarına ulaşım görece daha hızlı olabilir. Taksim, Beşiktaş, Şişli gibi Avrupa yakası destinasyonlara ise köprü geçişleriyle ulaşım sağlanmaktadır. İstanbul trafiği saate ve güne göre değişkenlik gösterdiğinden, rezervasyon yaparken yola çıkış saatinizi göz önünde bulundurmanız önerilir.',
        },
        {
          id: 'saw-ozel-arac-avantajlari',
          headingLevel: 'h2',
          heading: 'Neden Özel Araç?',
          body: 'Havalimanı servis otobüsleri ve metro bağlantıları her adrese doğrudan ulaşım sağlamaz; aktarma gerektirir ve bagajlı yolculuk için yorucu olabilir. Özel araç ile havalimanı kapısından doğrudan hedef adresinize kesintisiz ulaşırsınız.',
        },
      ],
      serviceArea: {
        title: 'Hizmet Verdiğimiz Bölgeler',
        description: 'Sabiha Gökçen\'den İstanbul\'un tüm ilçelerine transfer yapılmaktadır.',
        areas: ['Kadıköy', 'Üsküdar', 'Ataşehir', 'Ümraniye', 'Kartal', 'Maltepe', 'Taksim', 'Beşiktaş', 'Şişli', 'Sultanahmet', 'Beyoğlu', 'Bakırköy', 'Pendik', 'Gebze'],
      },
      faqs: [
        {
          id: 'saw-faq-1',
          question: 'Sabiha Gökçen\'den Avrupa yakasına da transfer yapıyor musunuz?',
          answer: 'Evet, Taksim, Beşiktaş, Şişli, Bakırköy dahil Avrupa yakasının tüm noktalarına transfer hizmeti sunulmaktadır.',
        },
        {
          id: 'saw-faq-2',
          question: 'Uçuşum gecikirse ne olur?',
          answer: 'Uçuş takibi yapıyoruz. Gecikme durumunda şoförümüz beklemeye devam eder, ek ücret talep edilmez.',
        },
        {
          id: 'saw-faq-3',
          question: 'Gece geç uçuşlarda hizmet alabilir miyim?',
          answer: '7/24 hizmet vermekteyiz. Gece yarısı ya da sabah erken saatlerde de karşılama yapılmaktadır.',
        },
        {
          id: 'saw-faq-4',
          question: 'Şoför nerede bekliyor olacak?',
          answer: 'Şoförümüz isminizin yazılı tabelayla dış kapıda beklemektedir. Bagajınızı teslim aldıktan sonra çıkışta kolayca bulabilirsiniz.',
        },
      ],
      schemaExtras: {
        serviceType: 'Airport Transfer',
        openingHours: 'Mo-Su 00:00-24:00',
        availableLanguage: ['Turkish', 'English'],
      },
    },
  },

  // ── 3. VIP Transfer İstanbul ──────────────────────────────────────────────
  {
    slug: 'vip-transfer',
    category: 'vip',
    body: {
      version: 2,
      hero: {
        badge: 'VIP Transfer',
        title: 'VIP Transfer İstanbul',
        subtitle: 'İstanbul\'da her türlü özel transfer ihtiyacınız için Mercedes Vito ve Sprinter ile konforlu, güvenilir ve kişiselleştirilmiş VIP ulaşım.',
        crumb: 'VIP Transfer',
        ctaPrimary: 'Rezervasyon ve Fiyat',
        ctaSecondary: 'Hemen Ara',
      },
      features: [
        'Havalimanı, otel, konut ve iş yeri transferi',
        'Deneyimli ve güvenilir şoförler',
        'Temiz ve klimalı Mercedes araçlar',
        'Saatlik veya güzergah bazlı hizmet',
        'Şehir içi her ilçeye ulaşım',
        'Özel isteklere uyarlanabilir rota',
      ],
      seo: {
        ogTitle: 'VIP Transfer İstanbul | Mercedes Özel Araç',
        ogDescription: 'İstanbul\'da Mercedes Vito ve Sprinter ile özel VIP transfer. Havalimanı, otel ve şehir içi tüm transfer ihtiyaçlarınız için.',
      },
      introBody: 'İstanbul\'da kaliteli ve konforlu ulaşım için VIP özel araç transferi, standart taksi ya da toplu taşımaya göre çok daha kişiselleştirilmiş bir deneyim sunar. İster havalimanı karşılaması olsun, ister otel alışı, ister şehir içi randevu transferi — ihtiyacınıza göre araç ve güzergah planlanır.',
      contentSections: [
        {
          id: 'vip-hizmet-turleri',
          headingLevel: 'h2',
          heading: 'Hangi Durumlarda VIP Transfer?',
          body: 'Havalimanı transferleri, otel check-in/check-out ulaşımları, iş toplantılarına ulaşım, düğün ve özel etkinlik transferleri, alışveriş turları ve şehir içi kurumsal seyahatler bu hizmetin en sık kullanım alanlarındandır. Özel transfer, konfor ve gizlilik açısından da tercih edilmektedir.',
        },
        {
          id: 'vip-arac-filomuz',
          headingLevel: 'h2',
          heading: 'Araç Filomuz',
          body: 'Hizmetlerimizde Mercedes Vito ve Mercedes Sprinter araçlar kullanılmaktadır. Vito, bireysel yolcular ve küçük gruplar için idealdir; geniş içi mekânı ve konforlu koltukları ile şehir içi seyahatler için uygundur. Sprinter ise daha büyük gruplar veya fazla bagaj için tercih edilen seçenektir.',
        },
        {
          id: 'vip-nasil-rezervasyon',
          headingLevel: 'h2',
          heading: 'Rezervasyon ve Planlama',
          body: 'Transfer taleplerinizi en az birkaç saat öncesinden iletmeniz, hem araç müsaitliği hem de doğru planlama açısından önerilir. Adres, tarih ve saat bilgilerinizi paylaştıktan sonra ayrıntılar teyit edilir. Saatlik kiralama taleplerinde de aynı süreç geçerlidir.',
        },
        {
          id: 'vip-istanbul-bilgisi',
          headingLevel: 'h2',
          heading: 'İstanbul\'da Trafik ve Planlama',
          body: 'İstanbul, gün içinde farklı saatlerde yoğun trafik yaşayan bir metropoldür. Özellikle sabah ve akşam saatlerinde köprü ve ana arterler üzerinde yoğunluk artmaktadır. Şoförlerimiz şehrin trafik koşullarına hâkimdir ve güzergahı koşullara göre değerlendirirler.',
        },
      ],
      serviceArea: {
        title: 'Hizmet Bölgelerimiz',
        description: 'İstanbul\'un tüm Avrupa ve Anadolu yakası ilçelerine VIP transfer hizmeti sunulmaktadır.',
        areas: ['Taksim', 'Beşiktaş', 'Şişli', 'Levent', 'Maslak', 'Sultanahmet', 'Beyoğlu', 'Kadıköy', 'Üsküdar', 'Ataşehir', 'Bakırköy', 'Ümraniye', 'Sarıyer', 'Pendik', 'Avcılar'],
      },
      faqs: [
        {
          id: 'vip-faq-1',
          question: 'Şehir içi transferlerde hangi araçlar kullanılıyor?',
          answer: 'Mercedes Vito (bireysel/küçük grup) ve Mercedes Sprinter (büyük grup/fazla bagaj) araçlar kullanılmaktadır. Tercihinizi rezervasyon sırasında belirtebilirsiniz.',
        },
        {
          id: 'vip-faq-2',
          question: 'Saatlik araç kiralama imkânı var mı?',
          answer: 'Evet. Saatlik bazda araç ve şoför tahsisi de yapılabilmektedir. Toplantı, etkinlik veya çoklu durak içeren seyahatler için uygun bir seçenektir.',
        },
        {
          id: 'vip-faq-3',
          question: 'Gece geç saatlerde hizmet alabilir miyim?',
          answer: '7/24 hizmet vermekteyiz. Gece geç ya da sabah erken saatlerde de transfer talebinde bulunabilirsiniz.',
        },
      ],
      schemaExtras: {
        serviceType: 'Limousine Service',
        openingHours: 'Mo-Su 00:00-24:00',
        availableLanguage: ['Turkish', 'English', 'Arabic'],
      },
    },
  },

  // ── 4. Şehirler Arası Transfer ────────────────────────────────────────────
  {
    slug: 'sehirler-arasi-transfer',
    category: 'intercity',
    body: {
      version: 2,
      hero: {
        badge: 'Şehirler Arası Özel Transfer',
        title: 'Şehirler Arası VIP Transfer',
        subtitle: 'İstanbul merkezli şehirler arası özel araç transferi. Kapıdan kapıya konforlu ulaşım — aktarma yok, bekleme yok.',
        crumb: 'Şehirler Arası Transfer',
        ctaPrimary: 'Rezervasyon ve Fiyat',
        ctaSecondary: 'Hemen Ara',
      },
      features: [
        'Kapıdan kapıya özel araç — otobüs terminaline gitme gerek yok',
        'Belirlediğiniz saatte yola çıkış',
        'Klimalı ve konforlu Mercedes araç',
        'Yol boyunca mola planlaması yapılabilir',
        'Bagaj kapasitesi yüksek araçlar',
        'İstanbul çıkışlı tüm şehirlere hizmet',
      ],
      seo: {
        ogTitle: 'Şehirler Arası VIP Transfer | İstanbul Çıkışlı',
        ogDescription: 'İstanbul\'dan şehirler arası özel Mercedes transferi. Kapıdan kapıya, aktarmasız, konforlu uzun yol ulaşımı.',
      },
      introBody: 'Şehirler arası seyahatte otobüs terminali ya da havalimanı kullanmak zorunda kalmadan, kendi adresinizden direkt hedef noktanıza özel araçla ulaşabilirsiniz. Kendi programınıza göre yola çıkma saatini belirlemeniz, mola vermek istediğinizde durabilmeniz ve tüm yolculuğu rahat bir ortamda tamamlamanız şehirler arası özel transferin en önemli avantajlarıdır.',
      contentSections: [
        {
          id: 'intercity-popüler-güzergahlar',
          headingLevel: 'h2',
          heading: 'Sık Kullanılan Güzergahlar',
          body: 'İstanbul\'dan Bursa, Sapanca, Ankara, İzmit, Yalova, Tekirdağ ve Edirne\'ye uzanan güzergahlar en sık tercih edilenler arasındadır. Ayrıca plaj tatil bölgeleri, termal merkezler ve çevre şehirlerdeki hastanelere de şehirler arası transfer yapılmaktadır.',
        },
        {
          id: 'intercity-planlama',
          headingLevel: 'h2',
          heading: 'Yolculuğunuzu Nasıl Planlarsınız?',
          body: 'Gidilecek şehir, alım adresi, hedef adres, tarih ve saat bilgilerinizi paylaşmanız yeterlidir. Uzun güzergahlarda ara mola talep edebilir, birden fazla durak için güzergah özelleştirme yapabilirsiniz. Grup seyahatlerinde araç kapasitesine göre planlama yapılır.',
        },
        {
          id: 'intercity-araç-konforu',
          headingLevel: 'h2',
          heading: 'Uzun Yolda Konfor',
          body: 'Mercedes Vito ve Sprinter araçlar geniş bagaj kapasitesi ve konforlu koltuk düzenleriyle uzun yol seyahatlerine uygundur. Tüm araçlarımız klimadır. Yolculuk boyunca şoförünüz güzergâhı takip eder; trafik veya yol koşullarına göre alternatif yollar değerlendirilebilir.',
        },
        {
          id: 'intercity-farklıliklari',
          headingLevel: 'h2',
          heading: 'Özel Transferin Otobüse Göre Farkları',
          body: 'Şehirlerarası otobüslerde terminal saatine uymak, kalabalık bekleme salonlarında vakit geçirmek ve aktarma yapmak gerekebilir. Özel araç transferinde terminalden değil kendi adresinizden yola çıkarsınız; yolculuk boyunca araç yalnızca size aittir.',
        },
      ],
      serviceArea: {
        title: 'Hizmet Verilen Şehirler',
        description: 'İstanbul merkezli şehirler arası transferde Marmara Bölgesi\'nin tüm şehirlerine ve çevre illere ulaşım sağlanmaktadır.',
        areas: ['Bursa', 'Sapanca', 'Ankara', 'İzmit', 'Yalova', 'Tekirdağ', 'Edirne', 'Çanakkale', 'Balıkesir', 'Gebze', 'Kocaeli'],
      },
      faqs: [
        {
          id: 'intercity-faq-1',
          question: 'İstanbul\'dan hangi şehirlere transfer yapıyorsunuz?',
          answer: 'Bursa, Sapanca, Ankara, İzmit, Yalova, Tekirdağ, Edirne başta olmak üzere İstanbul çıkışlı birçok şehre transfer hizmeti verilmektedir. Hedefinizi belirtmeniz yeterlidir.',
        },
        {
          id: 'intercity-faq-2',
          question: 'Yolculuk sırasında mola verebilir miyiz?',
          answer: 'Evet. Yol üzerinde mola vermek istediğinizde şoförünüze belirtmeniz yeterlidir; uygun bir yerde durabilirsiniz.',
        },
        {
          id: 'intercity-faq-3',
          question: 'Birden fazla kişiyle seyahat edersek araç seçimi nasıl olur?',
          answer: 'Kişi sayısına ve bagaj miktarına göre Mercedes Vito veya Sprinter tercih edilir. Rezervasyon sırasında kişi sayısını belirtmeniz yeterlidir.',
        },
        {
          id: 'intercity-faq-4',
          question: 'Erken sabah veya gece geç saatlerde de yola çıkabilir miyim?',
          answer: '7/24 hizmet vermekteyiz. İstediğiniz saatte yola çıkış ayarlanabilir.',
        },
      ],
      schemaExtras: {
        serviceType: 'Intercity Transfer Service',
        openingHours: 'Mo-Su 00:00-24:00',
        availableLanguage: ['Turkish', 'English'],
      },
    },
  },

  // ── 5. Şoförlü Araç Kiralama ──────────────────────────────────────────────
  {
    slug: 'soforlu-arac-kiralama',
    category: 'rental',
    body: {
      version: 2,
      hero: {
        badge: 'Şoförlü Araç Kiralama',
        title: 'Şoförlü Araç Kiralama İstanbul',
        subtitle: 'İstanbul\'da saatlik veya günlük olarak şoförlü Mercedes araç kiralayın — toplantı, alışveriş, etkinlik ve özel programlar için.',
        crumb: 'Şoförlü Araç Kiralama',
        ctaPrimary: 'Rezervasyon ve Fiyat',
        ctaSecondary: 'Hemen Ara',
      },
      features: [
        'Saatlik ya da günlük kiralama seçeneği',
        'Çoklu durak ve esnek güzergah',
        'Toplantı, etkinlik ve alışveriş için ideal',
        'İstanbul\'u bilen deneyimli şoför',
        'Araçta bekletilebilir — randevu aralarında şoför hazır',
        'Fatura ile şirketler için uygundur',
      ],
      seo: {
        ogTitle: 'Şoförlü Araç Kiralama İstanbul | Günlük VIP Şoför',
        ogDescription: 'İstanbul\'da günlük veya saatlik şoförlü Mercedes araç kiralama. Toplantı, alışveriş ve özel programa uygun esnek hizmet.',
      },
      introBody: 'Şoförlü araç kiralama, tek bir transferden farklı olarak sizi tüm gün ya da birkaç saat boyunca takip eden bir araç ve şoför güvencesi sunar. Toplantıdan toplantıya, alışveriş merkezinden restorana, etkinlikten etkinliğe kadar tüm gün programınızı şoförle koordineli şekilde yönetebilirsiniz.',
      contentSections: [
        {
          id: 'rental-kullanim-alanlari',
          headingLevel: 'h2',
          heading: 'Hangi Durumlar İçin?',
          body: 'Birden fazla iş toplantısı olan kurumsal seyahatler, alışveriş turu programları, düğün ve özel tören transferleri, sağlık turizminde hastane ve klinik arası transferler ve İstanbul turlarında rehberli araç hizmetleri bu hizmetin başlıca kullanım alanlarıdır.',
        },
        {
          id: 'rental-saatlik-günlük',
          headingLevel: 'h2',
          heading: 'Saatlik ve Günlük Seçenekler',
          body: 'Yalnızca birkaç saatlik programınız varsa saatlik, tam gün süren organizasyonunuz varsa günlük kiralama tercih edebilirsiniz. Bekleme süreleri (toplantı, randevu arası) dahildir; şoförünüz araçta sizi bekler.',
        },
        {
          id: 'rental-kurumsal',
          headingLevel: 'h2',
          heading: 'Kurumsal Kullanım',
          body: 'Şirket ziyaretçileri, yöneticiler ve yabancı iş ortakları için şoförlü araç, profesyonel bir karşılama ve ulaşım deneyimi sağlar. Fatura düzenleme imkânı mevcuttur.',
        },
      ],
      serviceArea: {
        title: 'Hizmet Kapsamı',
        description: 'İstanbul genelinde, talep halinde çevre şehirlere de günlük araç tahsisi yapılmaktadır.',
        areas: ['Taksim', 'Levent', 'Maslak', 'Beşiktaş', 'Şişli', 'Kadıköy', 'Ataşehir', 'Bayrampaşa', 'Büyükdere Caddesi', 'Boğaz köprüleri güzergahları'],
      },
      faqs: [
        {
          id: 'rental-faq-1',
          question: 'Saatlik kiralama için minimum süre var mı?',
          answer: 'Minimum süre hakkında rezervasyon sırasında bilgi alabilirsiniz; programınızı paylaşmanız yeterlidir.',
        },
        {
          id: 'rental-faq-2',
          question: 'Şoför toplantı aralarında bekleyebilir mi?',
          answer: 'Evet. Şoförlü araç kiralama hizmetinde şoförünüz randevu ya da toplantı sürelerinde araçla size yakın bir noktada bekler.',
        },
        {
          id: 'rental-faq-3',
          question: 'Şirket faturası kesiliyor mu?',
          answer: 'Evet, kurumsal kullanım için fatura düzenleme imkânı mevcuttur. Şirket bilgilerinizi rezervasyon aşamasında paylaşmanız yeterlidir.',
        },
        {
          id: 'rental-faq-4',
          question: 'İstanbul dışına çıkış mümkün mü?',
          answer: 'Günlük veya saatlik kiralama kapsamında çevre şehirlere de çıkış talep edilebilir. Güzergâhı önceden paylaşmanız yeterlidir.',
        },
      ],
      schemaExtras: {
        serviceType: 'Chauffeur Service',
        openingHours: 'Mo-Su 00:00-24:00',
        availableLanguage: ['Turkish', 'English'],
      },
    },
  },

  // ── 6. Otel Transfer ──────────────────────────────────────────────────────
  {
    slug: 'otel-transfer',
    category: 'airport',
    body: {
      version: 2,
      hero: {
        badge: 'Otel Transfer Hizmeti',
        title: 'Otel Transfer İstanbul',
        subtitle: 'Havalimanından otele, otelden havalimanına ve oteller arası Mercedes VIP transfer. Karşılama tabelası ile kapıdan kapıya konforlu ulaşım.',
        crumb: 'Otel Transfer',
        ctaPrimary: 'Rezervasyon ve Fiyat',
        ctaSecondary: 'Hemen Ara',
      },
      features: [
        'Havalimanı–Otel–Havalimanı transferi',
        'Oteller arası geçiş transferi',
        'Otel kapısından alım ve bırakma',
        'İsim tabelasıyla karşılama',
        'Her ölçekte otel bölgesine ulaşım',
        'Erken check-out ve gece geç uçuş saatlerine uygun',
      ],
      seo: {
        ogTitle: 'Otel Transfer İstanbul | Havalimanı–Otel VIP',
        ogDescription: 'İstanbul\'da havalimanından otele, otelden havalimanına Mercedes VIP transfer. İsim tabelası, 7/24 hizmet.',
      },
      introBody: 'İstanbul\'daki otellerden havalimanlarına ya da tam tersi güzergahta özel araç transferi, konaklama deneyiminizin sorunsuz bir parçası hâline gelebilir. Sultanahmet\'ten Beşiktaş\'a, Taksim\'den Levent\'e kadar şehrin önde gelen otel bölgelerinin tümüne hizmet verilmektedir.',
      contentSections: [
        {
          id: 'otel-güzergah-türleri',
          headingLevel: 'h2',
          heading: 'Otel Transferi Türleri',
          body: 'Havalimanı–Otel: Hem İstanbul Havalimanı (IST) hem de Sabiha Gökçen (SAW) üzerinden doğrudan otele ulaşım. Otel–Havalimanı: Check-out sırasında otelden alım yapılır, zamanında havalimanına ulaşırsınız. Oteller Arası Geçiş: Birden fazla otelde konaklama durumunda araç ve şoför ile oteller arasında geçiş yapılır.',
        },
        {
          id: 'otel-check-out-zamanlaması',
          headingLevel: 'h2',
          heading: 'Check-out Zamanlaması ve Planlama',
          body: 'Uçuş saatinize göre otel check-out zamanınızı planlayabilir, şoförünüzün sizi tam istediğiniz saatte karşılamasını sağlayabilirsiniz. Gece geç ya da sabah erken sefer saatlerine de uyumlu 7/24 hizmet sunulmaktadır.',
        },
        {
          id: 'otel-bölgeleri',
          headingLevel: 'h2',
          heading: 'Hizmet Verilen Otel Bölgeleri',
          body: 'Sultanahmet ve tarihi yarımadanın butik otelleri, Taksim ve Beyoğlu otelciliği, Şişli ve Levent kurumsal otelleri, Kadıköy ve Ataşehir\'in modern tesisleri ve boğaz manzaralı Beşiktaş ile Sarıyer otellerinin tümüne ulaşım sağlanmaktadır.',
        },
      ],
      serviceArea: {
        title: 'Hizmet Verilen Otel Bölgeleri',
        description: 'İstanbul\'un tüm popüler konaklama bölgelerine transfer yapılmaktadır.',
        areas: ['Sultanahmet', 'Taksim', 'Beyoğlu', 'Beşiktaş', 'Şişli', 'Levent', 'Maslak', 'Kadıköy', 'Üsküdar', 'Ataşehir', 'Sarıyer', 'Bakırköy', 'Ümraniye'],
      },
      faqs: [
        {
          id: 'otel-faq-1',
          question: 'Otelimin kapısından mı alıyorsunuz?',
          answer: 'Evet. Şoförümüz otel girişinde ya da lobby alanında sizi karşılar ve doğrudan havalimanına götürür.',
        },
        {
          id: 'otel-faq-2',
          question: 'Check-out\'tan önce araç hazır olabilir mi?',
          answer: 'Evet. Talep ettiğiniz saatte aracınız otelin önünde hazır bulunur.',
        },
        {
          id: 'otel-faq-3',
          question: 'İki farklı otelden alım yapılabilir mi?',
          answer: 'Evet, aynı araçla birden fazla otelden alım planlanabilir. Güzergahınızı önceden belirtmeniz yeterlidir.',
        },
      ],
      schemaExtras: {
        serviceType: 'Hotel Transfer',
        openingHours: 'Mo-Su 00:00-24:00',
        availableLanguage: ['Turkish', 'English', 'Arabic'],
      },
    },
  },

  // ── 7. Sağlık Turizmi Transfer ────────────────────────────────────────────
  {
    slug: 'saglik-turizmi-transfer',
    category: 'health',
    body: {
      version: 2,
      hero: {
        badge: 'Sağlık Turizmi Transferi',
        title: 'Sağlık Turizmi Transfer İstanbul',
        subtitle: 'İstanbul\'a sağlık turizmi amacıyla gelen hastalar için havalimanı–hastane–otel arası özel Mercedes transfer hizmeti.',
        crumb: 'Sağlık Turizmi Transfer',
        ctaPrimary: 'Rezervasyon ve Fiyat',
        ctaSecondary: 'Hemen Ara',
      },
      features: [
        'Havalimanından kliniğe veya hastaneye doğrudan transfer',
        'Randevu günlerinde hastane alım-bırakma hizmeti',
        'Otel–klinik–otel günlük transferler',
        'Refakatçi yolcu desteği',
        'Rahat ve hijyenik araç ortamı',
        'Özel ihtiyaçlara göre araç seçimi',
      ],
      seo: {
        ogTitle: 'Sağlık Turizmi Transfer İstanbul | Hastane VIP',
        ogDescription: 'İstanbul\'da sağlık turizmi için havalimanı, hastane ve otel arası özel Mercedes transfer hizmeti. Hasta konforu önceliğimiz.',
      },
      introBody: 'İstanbul, diş tedavisinden estetik cerrahiye, göz ameliyatlarından saç ekimine kadar pek çok alanda yüksek nitelikli sağlık hizmetleri sunan önemli bir tıp turizmi merkezidir. Tedavi sürecinde ulaşımın konforlu ve stressiz olması, iyileşme sürecini de olumlu etkiler. Sağlık turizmi transfer hizmetimiz; havalimanı karşılamasından hastane geliş-gidişlerine kadar tüm ulaşım adımlarını kapsar.',
      contentSections: [
        {
          id: 'saglik-transfer-aşamaları',
          headingLevel: 'h2',
          heading: 'Tedavi Sürecinde Transfer Planlaması',
          body: 'Tedavi programınız genellikle birden fazla gün ve randevu içerir. İlk gelişte havalimanından otele ya da kliniğe karşılama, muayene ve tedavi günlerinde otel–klinik–otel transferleri ve taburculuk ya da kontrol randevularında da aynı hizmet planlanabilir. Tüm program sizi dinleyerek oluşturulur.',
        },
        {
          id: 'saglik-hasta-konforu',
          headingLevel: 'h2',
          heading: 'Hasta Konforu ve Gizlilik',
          body: 'Araç içinde sessiz ve sakin bir ortam sağlanır. Gerektiğinde refakatçiniz de aynı araçta yolculuk yapabilir. Hastane ve klinik giriş noktasına kadar bırakma yapılır, çıkışta araç bekler.',
        },
        {
          id: 'saglik-hastaneler',
          headingLevel: 'h2',
          heading: 'Hizmet Verilen Sağlık Kuruluşları',
          body: 'İstanbul\'un Avrupa ve Anadolu yakasındaki özel hastaneler, estetik ve plastik cerrahi klinikleri, diş klinikleri, göz tedavi merkezleri ve fizik tedavi merkezlerine ulaşım sağlanmaktadır.',
        },
      ],
      serviceArea: {
        title: 'Hizmet Kapsamı',
        description: 'İstanbul\'daki tüm sağlık kuruluşlarına ve konaklama tesislerine transfer yapılmaktadır.',
        areas: ['Şişli', 'Beşiktaş', 'Nişantaşı', 'Levent', 'Maslak', 'Kadıköy', 'Ataşehir', 'Pendik', 'Ümraniye', 'Bakırköy', 'Mecidiyeköy'],
      },
      faqs: [
        {
          id: 'saglik-faq-1',
          question: 'Ameliyat sonrası yolculuk için uygun araç var mı?',
          answer: 'Evet. Ameliyat sonrası konfor gereksinimi gözetilerek araç içinde rahat oturma imkânı sağlanır. Özel ihtiyaçlarınızı önceden belirtmeniz önerilir.',
        },
        {
          id: 'saglik-faq-2',
          question: 'Refakatçim de aynı araçta gelebilir mi?',
          answer: 'Evet, refakatçiniz aynı araçta yolculuk yapabilir.',
        },
        {
          id: 'saglik-faq-3',
          question: 'Her gün farklı bir hastaneye transfer yapılabilir mi?',
          answer: 'Evet. Tedavi programınızdaki her randevu için ayrı transfer planlanabilir ya da saatlik araç kiralama tercih edilebilir.',
        },
        {
          id: 'saglik-faq-4',
          question: 'Türkçe bilmesem de iletişim kurabilir miyim?',
          answer: 'İngilizce ve Arapça konuşan şoförlerimiz mevcuttur. İletişim konusunda rezervasyon aşamasında bilgi alabilirsiniz.',
        },
      ],
      schemaExtras: {
        serviceType: 'Medical Tourism Transfer',
        openingHours: 'Mo-Su 00:00-24:00',
        availableLanguage: ['Turkish', 'English', 'Arabic'],
      },
    },
  },

  // ── 8. Kurumsal VIP Transfer ──────────────────────────────────────────────
  {
    slug: 'kurumsal-vip-transfer',
    category: 'corporate',
    body: {
      version: 2,
      hero: {
        badge: 'Kurumsal VIP Transfer',
        title: 'Kurumsal VIP Transfer İstanbul',
        subtitle: 'Yöneticiler ve iş misafirleri için İstanbul\'da profesyonel kurumsal transfer. Fatura düzenleme, karşılama tabelası ve tahsis Mercedes araç.',
        crumb: 'Kurumsal VIP Transfer',
        ctaPrimary: 'Kurumsal Teklif Al',
        ctaSecondary: 'Hemen Ara',
      },
      features: [
        'Şirket faturası kesimi',
        'Yönetici ve misafir için sessiz, özel araç ortamı',
        'Havalimanı karşılaması — isim tabelası ile',
        'Toplantı saatlerine göre esnek transfer planlaması',
        'Önceden belirlenmiş şoför tahsisi',
        'Kurumsal seyahat yöneticisiyle koordinasyon',
      ],
      seo: {
        ogTitle: 'Kurumsal VIP Transfer İstanbul | Faturalı Şirket',
        ogDescription: 'İstanbul\'da yönetici ve iş misafirleri için kurumsal VIP transfer. Fatura, tabelayla karşılama, Mercedes araç.',
      },
      introBody: 'İstanbul\'da kurumsal seyahatlerde ulaşım, şirketin profesyonel imajının bir parçasıdır. Yabancı iş ortaklarınızı ya da üst düzey yöneticilerinizi konforu ve düzeni garantilemiş bir araçla karşılamak, ilk izlenimi güçlendirir. Kurumsal transfer hizmetimiz, hem tekil hem de düzenli iş seyahatlerine uyarlanabilir.',
      contentSections: [
        {
          id: 'kurumsal-fatura',
          headingLevel: 'h2',
          heading: 'Fatura ve Ön Anlaşma',
          body: 'Şirket adına fatura düzenlenmesi mümkündür. Aylık veya toplu transfer talebi olan şirketler için ön anlaşma yapılarak düzenli hizmet planlanabilir. Seyahat yöneticileriyle koordineli çalışma süreçleri desteklenir.',
        },
        {
          id: 'kurumsal-misafir-karsilama',
          headingLevel: 'h2',
          heading: 'İş Misafiri Karşılama Standardı',
          body: 'Yabancı iş misafiri ya da üst düzey yönetici karşılamalarında isim tabelası, temiz araç, zamanında bulunuş ve gerektiğinde şehir hakkında yönlendirme sağlanmaktadır. Araç içinde iş görüşmesi yapmak isteyenler için sessiz ve mahrem bir ortam korunur.',
        },
        {
          id: 'kurumsal-plan-yönetimi',
          headingLevel: 'h2',
          heading: 'Çoklu Transferlerin Yönetimi',
          body: 'Aynı anda birden fazla kişiyi farklı noktalara ulaştırmanız gerekiyorsa, bu talebi önceden iletmeniz yeterlidir; her güzergah için uygun araç planlanır. Konferans, fuar ve büyük kurumsal etkinlikler için toplu transfer koordinasyonu da yapılabilir.',
        },
      ],
      serviceArea: {
        title: 'Kurumsal Hizmet Bölgeleri',
        description: 'İstanbul\'un tüm iş ve finans merkezlerine ulaşım sağlanmaktadır.',
        areas: ['Levent', 'Maslak', 'Şişli', 'Mecidiyeköy', 'Beşiktaş', 'Taksim', 'Ataşehir', 'Ümraniye', 'Kadıköy', 'İstanbul Havalimanı (IST)', 'Sabiha Gökçen (SAW)'],
      },
      faqs: [
        {
          id: 'kurumsal-faq-1',
          question: 'Düzenli aylık transfer için anlaşma yapılabiliyor mu?',
          answer: 'Evet. Düzenli kurumsal transfer ihtiyacı olan şirketler için aylık ya da dönemsel hizmet planı oluşturulabilmektedir.',
        },
        {
          id: 'kurumsal-faq-2',
          question: 'Şirket faturası nasıl talep edilir?',
          answer: 'Şirket unvanı ve vergi bilgilerinizi rezervasyon sırasında iletmeniz yeterlidir; fatura hizmet tamamlanmasının ardından düzenlenir.',
        },
        {
          id: 'kurumsal-faq-3',
          question: 'Konferans veya fuar için toplu transfer sağlayabiliyor musunuz?',
          answer: 'Evet, büyük organizasyonlar için birden fazla araç ve koordineli transfer planlaması yapılabilmektedir.',
        },
      ],
      schemaExtras: {
        serviceType: 'Corporate Transfer',
        openingHours: 'Mo-Su 00:00-24:00',
        availableLanguage: ['Turkish', 'English'],
      },
    },
  },

  // ── 9. İstanbul–Bursa Transfer ────────────────────────────────────────────
  {
    slug: 'istanbul-bursa-transfer',
    category: 'intercity',
    body: {
      version: 2,
      hero: {
        badge: 'İstanbul–Bursa Özel Transfer',
        title: 'İstanbul–Bursa VIP Transfer',
        subtitle: 'İstanbul\'dan Bursa\'ya veya Bursa\'dan İstanbul\'a Mercedes özel araçla kapıdan kapıya konforlu şehirler arası transfer.',
        crumb: 'İstanbul–Bursa Transfer',
        ctaPrimary: 'Rezervasyon ve Fiyat',
        ctaSecondary: 'Hemen Ara',
      },
      features: [
        'Kapıdan kapıya özel araç — terminal yok',
        'Feribot veya köprü güzergah seçeneği',
        'İstediğiniz saatte yola çıkış',
        'Geniş bagaj kapasiteli Mercedes',
        'Yol üzeri mola imkânı',
        'Grup ve aile transferleri için uygun',
      ],
      seo: {
        ogTitle: 'İstanbul–Bursa Transfer | Özel Mercedes Araç',
        ogDescription: 'İstanbul\'dan Bursa\'ya kapıdan kapıya özel VIP transfer. Kendi saatinizde yola çıkın, konforla ulaşın.',
      },
      introBody: 'İstanbul ile Bursa arasındaki yolculuk, köprü güzergahı veya feribot seçeneğiyle tamamlanabilir. Özel araç ile yola çıktığınızda kendi adresinizden alınır, doğrudan Bursa\'daki hedefinize ulaşırsınız. Otobüs terminaline gitme ve saate uymak zorunda kalma yükümlülüğü olmaksızın programınıza göre yola çıkabilirsiniz.',
      contentSections: [
        {
          id: 'bursa-güzergah',
          headingLevel: 'h2',
          heading: 'Güzergah Seçenekleri',
          body: 'İstanbul–Bursa güzergahında iki ana seçenek mevcuttur: Osmangazi Köprüsü üzerinden otoyol yolu veya Yalova üzerinden feribot güzergahı. Her iki seçenek de konumunuza ve tercihlerinize göre değerlendirilebilir.',
        },
        {
          id: 'bursa-nereye',
          headingLevel: 'h2',
          heading: 'Bursa\'da Hangi Noktalara Hizmet Var?',
          body: 'Bursa şehir merkezi, Osmangazi, Nilüfer, Yıldırım ilçeleri, Bursa Havalimanı, alışveriş merkezleri, hastaneler ve tarihi ilçe merkezleri dahil Bursa\'nın tüm noktalarına ulaşım sağlanmaktadır.',
        },
        {
          id: 'bursa-dönüş',
          headingLevel: 'h2',
          heading: 'Dönüş Transferi',
          body: 'Gidiş–dönüş rezervasyonu yapılabilir ya da yalnızca gidiş talep edilebilir. Bursa\'dan İstanbul\'a dönüş için de aynı hizmet koşullarında araç planlanır.',
        },
      ],
      serviceArea: {
        title: 'Hizmet Güzergahı',
        description: 'İstanbul\'dan Bursa\'ya ve Bursa\'dan İstanbul\'a tüm noktalara ulaşım sağlanmaktadır.',
        areas: ['İstanbul (tüm ilçeler)', 'İstanbul Havalimanı', 'Sabiha Gökçen', 'Yalova (feribot)', 'Bursa Osmangazi', 'Bursa Nilüfer', 'Bursa Yıldırım', 'Bursa Havalimanı'],
      },
      faqs: [
        {
          id: 'bursa-faq-1',
          question: 'Feribot veya köprü güzergahını ben seçebilir miyim?',
          answer: 'Evet, güzergah tercihinizi önceden belirtebilirsiniz. Her iki seçenek de mümkündür.',
        },
        {
          id: 'bursa-faq-2',
          question: 'Gidiş–dönüş rezervasyonu yaptırabilir miyim?',
          answer: 'Evet, gidiş ve dönüş için ayrı ayrı rezervasyon alınabilir ya da birlikte planlanabilir.',
        },
        {
          id: 'bursa-faq-3',
          question: 'İstanbul Havalimanı\'ndan Bursa\'ya direkt transfer yapılıyor mu?',
          answer: 'Evet. İstanbul Havalimanı (IST) veya Sabiha Gökçen (SAW) çıkışlı Bursa transferi yapılmaktadır.',
        },
      ],
      schemaExtras: {
        serviceType: 'Intercity Transfer',
        openingHours: 'Mo-Su 00:00-24:00',
        availableLanguage: ['Turkish', 'English'],
      },
    },
  },

  // ── 10. İstanbul–Sapanca Transfer ─────────────────────────────────────────
  {
    slug: 'istanbul-sapanca-transfer',
    category: 'intercity',
    body: {
      version: 2,
      hero: {
        badge: 'İstanbul–Sapanca Özel Transfer',
        title: 'İstanbul–Sapanca VIP Transfer',
        subtitle: 'İstanbul\'dan Sapanca Gölü ve çevresine özel Mercedes araçla kapıdan kapıya rahat ve konforlu şehirler arası transfer.',
        crumb: 'İstanbul–Sapanca Transfer',
        ctaPrimary: 'Rezervasyon ve Fiyat',
        ctaSecondary: 'Hemen Ara',
      },
      features: [
        'Kapıdan kapıya özel araç hizmeti',
        'Doğal yoğunluklu hafta sonu seyahatlerine uygun',
        'Aile ve grup transferleri için ideal',
        'Geniş bagaj ve piknik malzemesi kapasitesi',
        'Belirlediğiniz saatte yola çıkış',
        'Yol üzeri mola planlaması yapılabilir',
      ],
      seo: {
        ogTitle: 'İstanbul–Sapanca Transfer | VIP Özel Araç',
        ogDescription: 'İstanbul\'dan Sapanca\'ya özel Mercedes araçla kapıdan kapıya VIP transfer. Konforlu hafta sonu ve tatil transferi.',
      },
      introBody: 'Sapanca Gölü ve Maşukiye bölgesi, İstanbul\'un en yakın doğa kaçamak noktaları arasında yer almaktadır. Hafta sonu tatilleri, doğa yürüyüşleri ve termal tesislere yönelik seyahatler için özel araç transferi, otobüs ya da araç kirasına göre çok daha konforlu bir seçenektir.',
      contentSections: [
        {
          id: 'sapanca-bölge',
          headingLevel: 'h2',
          heading: 'Sapanca Bölgesi Hakkında',
          body: 'Sapanca, Kocaeli\'ne bağlı bir ilçedir. Sapanca Gölü çevresi, Maşukiye vadisi ve çevre köyler doğa turizmi açısından öne çıkmaktadır. Bölgedeki termal oteller, bungalov tesisleri ve yürüyüş parkurları ziyaretçileri çeken başlıca unsurlardır.',
        },
        {
          id: 'sapanca-güzergah',
          headingLevel: 'h2',
          heading: 'Güzergah ve Hizmet Kapsamı',
          body: 'İstanbul\'dan otoyol üzerinden Sapanca\'ya ulaşılmaktadır. Otoyol güzergahında yolculuk nispeten düzenli akar; hafta sonu trafiğine karşın özel araçla doğrudan hedefe ulaşmak mümkündür. Bölge içinde birden fazla noktaya uğranabilir.',
        },
        {
          id: 'sapanca-dönüş',
          headingLevel: 'h2',
          heading: 'Dönüş Seçenekleri',
          body: 'Gün sonunda ya da tatil bitiminizde İstanbul\'a dönüş transferi de planlanabilir. Sabah gidiş akşam dönüş ya da birkaç günlük konaklama sonrası dönüş için ayrı rezervasyon yapılabilir.',
        },
      ],
      serviceArea: {
        title: 'Hizmet Kapsamı',
        description: 'İstanbul\'dan Sapanca ve çevresine tüm noktalara transfer yapılmaktadır.',
        areas: ['İstanbul (tüm ilçeler)', 'Sapanca Gölü kıyısı', 'Maşukiye', 'Sapanca merkez', 'Kocaeli', 'Körfez', 'Adapazarı'],
      },
      faqs: [
        {
          id: 'sapanca-faq-1',
          question: 'Tek gün gidip dönüş için araç ayarlanabilir mi?',
          answer: 'Evet. Sabah gidiş akşam dönüş programı için gidiş–dönüş rezervasyonu yapılabilir ya da günlük araç kiralama tercih edilebilir.',
        },
        {
          id: 'sapanca-faq-2',
          question: 'Büyük bagaj veya piknik malzemeleriyle yolculuk yapılabilir mi?',
          answer: 'Evet. Mercedes Vito ve Sprinter geniş bagaj kapasitesiyle piknik malzemeleri ve fazla eşya için uygundur.',
        },
        {
          id: 'sapanca-faq-3',
          question: 'Maşukiye\'ye de transfer yapılıyor mu?',
          answer: 'Evet. Sapanca çevresindeki Maşukiye, Kızderbent ve diğer bölge noktalarına da ulaşım sağlanmaktadır.',
        },
      ],
      schemaExtras: {
        serviceType: 'Intercity Transfer',
        openingHours: 'Mo-Su 00:00-24:00',
        availableLanguage: ['Turkish', 'English'],
      },
    },
  },

  // ── 11. İstanbul Günübirlik Turlar ────────────────────────────────────────
  {
    slug: 'istanbul-gunubirlik-turlar',
    category: 'tour',
    body: {
      version: 2,
      hero: {
        badge: 'İstanbul Şehir Turu',
        title: 'İstanbul Günübirlik Tur',
        subtitle: 'İstanbul\'un tarihi ve kültürel mekânlarını özel Mercedes araçla, kendi programınıza göre günübirlik keşfedin.',
        crumb: 'İstanbul Günübirlik Tur',
        ctaPrimary: 'Tur Rezervasyonu',
        ctaSecondary: 'Hemen Ara',
      },
      features: [
        'Kişiye özel güzergah — hazır tur programı yok',
        'Şoförlü Mercedes araç — kendinize ait',
        'Tarihi yarımada, Boğaz, Avrupa ve Anadolu yakası',
        'Molalarda fotoğraf ve gözlem durağı',
        'Rehber ihtiyacınızı önceden belirtin',
        'Yalnız, çift veya aile gruplarına uygun',
      ],
      seo: {
        ogTitle: 'İstanbul Günübirlik Tur | Özel Araçlı Şehir Keşfi',
        ogDescription: 'İstanbul\'u özel Mercedes araçla günübirlik keşfedin. Sultanahmet, Boğaz, Kapalıçarşı ve daha fazlası — kendi programınıza göre.',
      },
      introBody: 'İstanbul, binlerce yıllık tarihi ve iki kıtayı buluşturan eşsiz coğrafyasıyla her ziyaretçiye farklı bir deneyim sunar. Sultanahmet\'in tarihi siluetinden Boğaz\'ın büyüleyici manzarasına, Kapalıçarşı\'nın çarşı kültüründen modern Beyoğlu\'nun kozmopolit havasına kadar şehir çok katmanlı bir keşif alanı sunar. Özel araçlı günübirlik tur, şehri turistik kalabalıktan uzak, kendi hızınızda deneyimlemenizi sağlar.',
      contentSections: [
        {
          id: 'istanbul-tur-noktalari',
          headingLevel: 'h2',
          heading: 'Popüler Güzergah Noktaları',
          body: 'Sultanahmet bölgesi (Ayasofya, Topkapı, Sultanahmet Camii çevresi), Kapalıçarşı ve Mısır Çarşısı, Boğaz güzergahı (Bebek, Ortaköy, Sarıyer), Karaköy ve Galata, Beyoğlu ve İstiklal Caddesi, Kadıköy ve Moda çarşısı bu turu tercih edenlerin en sık istediği noktalardandır.',
        },
        {
          id: 'istanbul-program-olusturma',
          headingLevel: 'h2',
          heading: 'Programınızı Nasıl Oluşturursunuz?',
          body: 'Hangi semtleri ya da mekânları görmek istediğinizi önceden belirtmeniz yeterlidir. Bütçe veya zaman kısıtlamalarınıza göre güzergah birlikte şekillendirilebilir. Rezervasyon sırasında tercihlerinizi paylaşmanız planlamayı kolaylaştırır.',
        },
        {
          id: 'istanbul-aile-tur',
          headingLevel: 'h2',
          heading: 'Aile ve Grup Turları',
          body: 'Çocuklu aileler için daha kısa ve molalı güzergahlar tercih edilebilir. Büyük gruplar için Mercedes Sprinter ile rahatlıkla hareket edilebilir. Gün boyunca araç ve şoför gruba tahsis edilir.',
        },
      ],
      serviceArea: {
        title: 'Ziyaret Edilebilecek Bölgeler',
        description: 'İstanbul\'un her semtine özel tur güzergahı planlanabilmektedir.',
        areas: ['Sultanahmet', 'Kapalıçarşı', 'Mısır Çarşısı', 'Galata', 'Beyoğlu', 'Ortaköy', 'Bebek', 'Sarıyer', 'Kadıköy', 'Moda', 'Üsküdar', 'Boğaz hattı'],
      },
      faqs: [
        {
          id: 'istanbul-tur-faq-1',
          question: 'Gezi programını biz mi belirliyoruz?',
          answer: 'Evet, programı siz belirlersiniz. Görmek istediğiniz yerleri önceden iletmeniz yeterlidir; güzergah buna göre planlanır.',
        },
        {
          id: 'istanbul-tur-faq-2',
          question: 'Tur kaç saat sürüyor?',
          answer: 'Güzergaha bağlı olarak yarım günlük ya da tam günlük turlar planlanabilir. Saati siz belirlersiniz.',
        },
        {
          id: 'istanbul-tur-faq-3',
          question: 'Müze girişleri dahil mi?',
          answer: 'Müze ya da mekân giriş ücretleri dahil değildir. Ulaşım ve şoför hizmeti sunulmaktadır.',
        },
        {
          id: 'istanbul-tur-faq-4',
          question: 'Çocuklu aile için uygun mu?',
          answer: 'Evet. Çocuklu aileler için güzergah ve mola planı buna göre düzenlenebilir.',
        },
      ],
      schemaExtras: {
        serviceType: 'City Tour Transfer',
        openingHours: 'Mo-Su 08:00-21:00',
        availableLanguage: ['Turkish', 'English', 'Arabic'],
      },
    },
  },

  // ── 12. Sapanca–Maşukiye Turu ─────────────────────────────────────────────
  {
    slug: 'sapanca-masukiye-turu',
    category: 'tour',
    body: {
      version: 2,
      hero: {
        badge: 'Sapanca & Maşukiye Turu',
        title: 'Sapanca–Maşukiye Günübirlik Turu',
        subtitle: 'İstanbul\'dan Sapanca Gölü ve Maşukiye vadisine özel Mercedes araçla konforlu günübirlik doğa turu.',
        crumb: 'Sapanca–Maşukiye Turu',
        ctaPrimary: 'Tur Rezervasyonu',
        ctaSecondary: 'Hemen Ara',
      },
      features: [
        'İstanbul\'dan kapıdan kapıya alım ve bırakma',
        'Sapanca Gölü kıyısında mola imkânı',
        'Maşukiye vadisinde yürüyüş ve fotoğraf durakları',
        'Kendi programınıza göre esnek güzergah',
        'Sabah erken hareket seçeneği',
        'Aile ve küçük gruplar için uygun araçlar',
      ],
      seo: {
        ogTitle: 'Sapanca–Maşukiye Günübirlik Turu | İstanbul\'dan',
        ogDescription: 'İstanbul\'dan Sapanca Gölü ve Maşukiye\'ye özel araçla günübirlik doğa turu. Konforlu, kişiye özel program.',
      },
      introBody: 'Sapanca Gölü\'nün dingin kıyıları ve Maşukiye\'nin serin orman vadisi, İstanbul\'dan kolayca erişilebilen iki sevilen doğa durağıdır. Hafta sonu ya da tatil günlerinde kalabalık tur gruplarına katılmadan, kendi programınıza göre bu güzergahı özel araçla keşfedebilirsiniz.',
      contentSections: [
        {
          id: 'sapanca-tur-guzergah',
          headingLevel: 'h2',
          heading: 'Tur Güzergahı',
          body: 'Tipik güzergah; İstanbul çıkışı, otoyol yolculuğu, Sapanca Gölü kenarında mola (kahvaltı ya da çay durağı), Maşukiye vadisi keşfi ve akşam İstanbul\'a dönüşten oluşur. Güzergah tercihlere göre değiştirilebilir; Kızderbent, Karavil ya da çevre köyler eklenebilir.',
        },
        {
          id: 'sapanca-tur-program',
          headingLevel: 'h2',
          heading: 'Esnek Program',
          body: 'Maşukiye\'de ne kadar vakit geçireceğinizi, hangi noktalarda durmak istediğinizi önceden belirtebilirsiniz. Doğa yürüyüşçüleri için uygun durak noktaları planlanabilir; çocuklu aileler için daha kısa ve molaları bol bir program tercih edilebilir.',
        },
        {
          id: 'sapanca-tur-dönüş',
          headingLevel: 'h2',
          heading: 'Dönüş Transferi',
          body: 'Gün sonunda, istediğiniz saatte İstanbul\'a dönüş yapılır. Akşam yemeği için Sapanca ya da Maşukiye\'de biraz daha kalıp daha geç dönmek de planlanabilir.',
        },
      ],
      serviceArea: {
        title: 'Tur Güzergahı',
        description: 'İstanbul çıkışlı Sapanca Gölü ve Maşukiye vadisi turu.',
        areas: ['İstanbul (her ilçeden alım)', 'Sapanca Gölü kıyısı', 'Maşukiye', 'Kızderbent', 'Karavil', 'Adapazarı'],
      },
      faqs: [
        {
          id: 'sapanca-tur-faq-1',
          question: 'Tür süresi ne kadar?',
          answer: 'Güzergaha göre tam günlük bir tur planlanmaktadır. Dönüş saatini siz belirlersiniz.',
        },
        {
          id: 'sapanca-tur-faq-2',
          question: 'Maşukiye\'de yürüyüş yapılabiliyor mu?',
          answer: 'Evet. Maşukiye vadisinde yürüyüş yollarına araçla ulaşılmakta, istediğiniz süre bölgede kalınabilmektedir.',
        },
        {
          id: 'sapanca-tur-faq-3',
          question: 'Çocuklu aileler için uygun mu?',
          answer: 'Evet. Güzergah yaş grubuna göre düzenlenebilir; ara molalar ve daha kısa yürüyüş durağı seçilebilir.',
        },
      ],
      schemaExtras: {
        serviceType: 'Day Tour',
        openingHours: 'Mo-Su 07:00-22:00',
        availableLanguage: ['Turkish', 'English'],
      },
    },
  },

  // ── 13. Bursa Günübirlik Tur ──────────────────────────────────────────────
  {
    slug: 'bursa-gunubirlik-tur',
    category: 'tour',
    body: {
      version: 2,
      hero: {
        badge: 'Bursa Günübirlik Turu',
        title: 'Bursa Günübirlik Tur',
        subtitle: 'İstanbul\'dan Yeşil Bursa\'ya özel Mercedes araçla günübirlik keşif turu — tarihi mekanlar, çarşılar ve doğa.',
        crumb: 'Bursa Günübirlik Tur',
        ctaPrimary: 'Tur Rezervasyonu',
        ctaSecondary: 'Hemen Ara',
      },
      features: [
        'İstanbul\'dan kapıdan kapıya alım',
        'Feribot veya köprü güzergah seçeneği',
        'Bursa tarihi merkezi ve çarşılar',
        'Uludağ bölgesine çıkış (talep üzerine)',
        'Esnek güzergah — kendi programınıza göre',
        'Aile ve gruplar için uygun araçlar',
      ],
      seo: {
        ogTitle: 'Bursa Günübirlik Tur | İstanbul\'dan Özel Araç',
        ogDescription: 'İstanbul\'dan Bursa\'ya özel Mercedes araçla günübirlik tur. Tarihi merkez, yeşil doğa ve Uludağ keşfi.',
      },
      introBody: 'Bursa, Osmanlı İmparatorluğu\'nun ilk başkentlerinden biri olarak zengin tarihi mirasa sahip bir şehirdir. İpek ticaretinin merkezi olan Kapalı Çarşı ve bedestenleri, yeşil dokusuyla Uludağ etekleri, tarihi camiler ve kentsel dokusu ile şehir, gün içinde keşfedilebilecek pek çok alan sunmaktadır.',
      contentSections: [
        {
          id: 'bursa-tur-noktalar',
          headingLevel: 'h2',
          heading: 'Ziyaret Edilebilecek Noktalar',
          body: 'Ulu Cami ve çevresi, Bursa Kapalı Çarşı ve Bedesteni, Koza Hanı, Tofaş Anadolu Arabaları Müzesi, Yeşil Cami ve türbesi, Muradiye külliyesi ve Uludağ etekleri bu turda ziyaret edilen başlıca noktalardır. Hangi noktaları eklemek istediğinizi önceden belirtebilirsiniz.',
        },
        {
          id: 'bursa-güzergah-seçimi',
          headingLevel: 'h2',
          heading: 'Güzergah: Feribot mu Köprü mü?',
          body: 'İstanbul–Bursa güzergahında iki seçenek mevcuttur. Köprü güzergahı Osmangazi Köprüsü üzerinden otoyolla ilerler. Feribot güzergahı ise Yalova iskelesi üzerinden geçer. Her iki seçenek de tercih ve koşullara göre değerlendirilebilir; tercihini önceden belirtmen yeterlidir.',
        },
        {
          id: 'bursa-uludag',
          headingLevel: 'h2',
          heading: 'Uludağ\'a Çıkış Talebi',
          body: 'Mevsim koşullarına bağlı olarak Uludağ eteklerine ya da kayak merkezine çıkış eklenebilir. Bu istek önceden belirtilirse güzergaha dahil edilebilir.',
        },
      ],
      serviceArea: {
        title: 'Tur Güzergahı',
        description: 'İstanbul\'dan Bursa\'ya özel araçlı günübirlik tur güzergahı.',
        areas: ['İstanbul (her ilçeden alım)', 'Yalova (feribot)', 'Bursa merkez', 'Osmangazi', 'Nilüfer', 'Uludağ etekleri', 'Bursa tarihi çarşılar'],
      },
      faqs: [
        {
          id: 'bursa-tur-faq-1',
          question: 'Bursa turunda hangi yerlere gidilir?',
          answer: 'Güzergah size özeldir. Ulu Cami, Kapalı Çarşı, Koza Hanı, Yeşil Cami ve Uludağ etekleri önerilmekle birlikte siz hangi noktaları istediğinizi belirlersiniz.',
        },
        {
          id: 'bursa-tur-faq-2',
          question: 'Gidiş–dönüş aynı günde mi tamamlanır?',
          answer: 'Evet, tur tek günde gidip dönüş şeklinde planlanmaktadır. Bursa\'da geceleme yapmak isteyenler için yalnızca gidiş transferi de düzenlenebilir.',
        },
        {
          id: 'bursa-tur-faq-3',
          question: 'Feribot biletini kim alır?',
          answer: 'Feribot güzergahı tercih edilmesi durumunda bilet alımı konusunda önceden bilgi verilmektedir; süreç açıklanır.',
        },
      ],
      schemaExtras: {
        serviceType: 'Day Tour',
        openingHours: 'Mo-Su 07:00-22:00',
        availableLanguage: ['Turkish', 'English'],
      },
    },
  },

  // ── 14. Yalova Günübirlik Tur ─────────────────────────────────────────────
  {
    slug: 'yalova-gunubirlik-tur',
    category: 'tour',
    body: {
      version: 2,
      hero: {
        badge: 'Yalova Günübirlik Turu',
        title: 'Yalova Günübirlik Tur',
        subtitle: 'İstanbul\'dan Yalova\'ya özel Mercedes araçla günübirlik tur — termal bölgeler, doğal güzellikler ve huzurlu bir gün.',
        crumb: 'Yalova Günübirlik Tur',
        ctaPrimary: 'Tur Rezervasyonu',
        ctaSecondary: 'Hemen Ara',
      },
      features: [
        'İstanbul\'dan kapıdan kapıya alım',
        'Feribot üzerinden konforlu yolculuk seçeneği',
        'Termal oteller ve tesisler çevresi',
        'Yalova\'nın doğal parkları ve bahçeleri',
        'Kişiye özel güzergah planı',
        'Aile ve küçük gruplar için uygun',
      ],
      seo: {
        ogTitle: 'Yalova Günübirlik Tur | İstanbul\'dan Özel Transfer',
        ogDescription: 'İstanbul\'dan Yalova\'ya özel araçla günübirlik tur. Termal tatil ve doğa için konforlu VIP ulaşım.',
      },
      introBody: 'Yalova, İstanbul\'a feribot bağlantısıyla kolayca erişilebilen, termal kaynakları ve yeşil doğasıyla öne çıkan bir tatil bölgesidir. Günübirlik olarak termal tesislere gitmek, Atatürk\'ün Yalova Köşkü çevresini ya da doğa parklarını ziyaret etmek için özel araç transferi konforlu bir seçenek sunar.',
      contentSections: [
        {
          id: 'yalova-güzergah',
          headingLevel: 'h2',
          heading: 'İstanbul\'dan Yalova\'ya Ulaşım',
          body: 'İstanbul\'dan Yalova\'ya ulaşmak için Topçular ya da Bursa feribotu güzergahı ya da karayolu seçeneği kullanılabilir. Her iki seçenek de araçla seyahate elverişlidir. Güzergah ve ulaşım yöntemini önceden belirtmeniz yeterlidir.',
        },
        {
          id: 'yalova-aktiviteler',
          headingLevel: 'h2',
          heading: 'Yalova\'da Neler Yapılabilir?',
          body: 'Termal tesislerinde günübirlik kaplıca kullanımı, Atatürk\'ün Yalova Köşkü\'nün ziyareti, Yalova\'nın botanik bahçeleri ve çevre parklarda yürüyüş, sahil boyunca yürüyüş ve yerel restoranlarda öğle yemeği bu turu tercih edenlerin sık yaptığı aktiviteler arasındadır.',
        },
        {
          id: 'yalova-termal',
          headingLevel: 'h2',
          heading: 'Termal Bölge Transferi',
          body: 'Çiftlikköy ilçesindeki termal oteller bölgesine araçla transfer yapılmaktadır. Günlük kaplıca ya da SPA kullanımı için termal tesise ulaşım ve gün sonunda dönüş planlanabilir. Termal tesis seçimi ve bilet işlemleri kişinin kendisine aittir.',
        },
      ],
      serviceArea: {
        title: 'Tur Güzergahı',
        description: 'İstanbul\'dan Yalova\'ya özel araçlı günübirlik tur.',
        areas: ['İstanbul (her ilçeden alım)', 'Yalova merkez', 'Çiftlikköy (termal)', 'Termal bölge', 'Yalova sahil', 'Atatürk Köşkü çevresi'],
      },
      faqs: [
        {
          id: 'yalova-tur-faq-1',
          question: 'Yalova turunda termal tesise girişi de sağlıyor musunuz?',
          answer: 'Termal tesise ulaşım sağlanmaktadır; tesis giriş ücreti kişisel olarak karşılanmaktadır.',
        },
        {
          id: 'yalova-tur-faq-2',
          question: 'Feribot güzergahı kullanılıyor mu?',
          answer: 'Feribot güzergahı tercih edilebilir. Önceden belirtmeniz halinde güzergah buna göre planlanır.',
        },
        {
          id: 'yalova-tur-faq-3',
          question: 'Çocuklarla ziyaret için uygun mu?',
          answer: 'Evet. Güzergah ve program yaş grubuna göre düzenlenebilir.',
        },
        {
          id: 'yalova-tur-faq-4',
          question: 'Aynı günde dönüş yapılıyor mu?',
          answer: 'Evet, tam günlük tur olarak planlanmaktadır. Dönüş saatini siz belirlersiniz.',
        },
      ],
      schemaExtras: {
        serviceType: 'Day Tour',
        openingHours: 'Mo-Su 07:00-22:00',
        availableLanguage: ['Turkish', 'English'],
      },
    },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Seed runner
// ──────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  Servis Sayfası İçerik Tohumu (v2 Body Seed)');
  console.log('  ' + new Date().toLocaleString('tr-TR'));
  console.log('══════════════════════════════════════════════════════════\n');

  let ok = 0; let fail = 0;

  for (const service of SERVICES) {
    try {
      // 1. Find content row
      const [row] = await db.select({ id: schema.content.id })
        .from(schema.content)
        .where(and(
          eq(schema.content.slug, service.slug),
          eq(schema.content.contentType, 'SERVICE'),
        ))
        .limit(1);

      if (!row) {
        console.error(`  ❌ KAYIT YOK: ${service.slug}`);
        fail++;
        continue;
      }

      // 2. Update source content row
      await db.update(schema.content).set({
        category: service.category,
        body:     JSON.stringify(service.body) as never,
        updatedAt: new Date(),
      }).where(eq(schema.content.id, row.id));

      // 3. Mark all existing translations as OUTDATED (source body changed)
      const updatedTx = await db.update(schema.contentTranslations).set({
        status:    'OUTDATED',
        updatedAt: new Date(),
      }).where(and(
        eq(schema.contentTranslations.entityType, 'service_page'),
        eq(schema.contentTranslations.entityId,   row.id),
      )).returning({ id: schema.contentTranslations.id });

      console.log(`  ✅ ${service.slug} — kategori:${service.category}, ${updatedTx.length} çeviri OUTDATED olarak işaretlendi`);
      ok++;
    } catch (err) {
      console.error(`  ❌ ${service.slug}: ${err instanceof Error ? err.message : String(err)}`);
      fail++;
    }
  }

  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`  Tamamlandı: ${ok} başarılı, ${fail} hata`);
  console.log('══════════════════════════════════════════════════════════\n');

  await sqlClient.end();
}

main().catch(err => {
  console.error('Seed hatası:', err);
  process.exit(1);
});
