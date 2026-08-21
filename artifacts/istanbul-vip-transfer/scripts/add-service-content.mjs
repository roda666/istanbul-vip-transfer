/**
 * add-service-content.mjs
 *
 * 1. Adds rich Turkish introBody + contentSections + faqs to the 14 thin v1 service pages
 *    in the `content` table (content_type = 'SERVICE').
 * 2. Marks existing translations OUTDATED.
 * 3. Translates all 14 pages to EN / DE / RU / AR / FR / ES / IT / NL and publishes.
 *
 * Usage (from artifacts/istanbul-vip-transfer):
 *   node scripts/add-service-content.mjs
 */

import postgres from '../node_modules/postgres/cjs/src/index.js';
import OpenAI from '../node_modules/openai/index.js';

if (!process.env.OPENAI_API_KEY) { console.error('OPENAI_API_KEY not set'); process.exit(1); }
if (!process.env.DATABASE_URL)   { console.error('DATABASE_URL not set');   process.exit(1); }

const sql   = postgres(process.env.DATABASE_URL, { max: 4 });
const ai    = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL ?? process.env.OPENAI_TRANSLATION_MODEL ?? 'gpt-4o-mini';
const LANGS = ['en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl'];

const LANG_NAMES = {
  en: 'English', de: 'German', ru: 'Russian', ar: 'Arabic (Modern Standard Arabic, RTL)',
  fr: 'French',  es: 'Spanish', it: 'Italian', nl: 'Dutch',
};

const PRESERVED = [
  'VIP Transfer Istanbul', 'Istanbul VIP Transfer', 'IST', 'SAW',
  'Mercedes Vito', 'Mercedes Sprinter', 'WhatsApp', '7/24',
  'Osmangazi Köprüsü', 'TEM', 'D100',
];

// ── Content for 14 v1 service pages ──────────────────────────────────────────

const SERVICE_CONTENT = {

  'istanbul-havalimani-transfer': {
    introBody: 'İstanbul Havalimanı (IST), Türkiye\'nin ve Avrupa\'nın en büyük havalimanlarından biridir. Yılda 90 milyonun üzerinde yolcu kapasitesiyle tasarlanan terminal, karmaşık yönlendirme koridorları ve yoğun yolcu trafiğiyle dikkat çeker. Bu ortamda doğru kapıyı bulmak, bagajla yürümek ve uygun ulaşım sağlamak zaman kaybettirici olabilir.\n\nÖnceden rezervasyon yaptırılmış özel transfer tüm bu belirsizlikleri ortadan kaldırır. Terminal çıkışında isminizin yazılı olduğu tabelayı tutan profesyonel sürücünüz sizi karşılar; bagajınızı alır ve belirlediğiniz adrese konforlu ve zamanında götürür. IST\'den şehre veya şehirden havalimanına yapılan transferlerde Mercedes Vito veya Sprinter araçlar bireysel yolcular ve büyük gruplar için idealdir.',
    contentSections: [
      { id: 'ist-nasil-calisir', headingLevel: 'h2', heading: 'İST Havalimanı Özel Transferi Nasıl Çalışır?', body: 'Rezervasyon aşamasında uçuş numaranız, giriş saatiniz ve karşılanmak istediğiniz terminal belirtilir. Sürücü, uçuş takip sistemleri aracılığıyla gecikmeler dahil tüm değişiklikleri anlık olarak izler. Bagaj bandından çıktığınızda, arrivals çıkışında tabelayla sizi bekleyen sürücünüzü bulursunuz. İstanbul Havalimanı\'nın geniş terminal yapısını tanıyan sürücülerimiz, en kısa ve konforlu çıkış güzergahını kullanarak sizi araca yönlendirir.' },
      { id: 'ist-arac-secimi', headingLevel: 'h2', heading: 'Araç Seçimi ve Kapasite', body: 'İstanbul Havalimanı transferlerinde iki temel araç seçeneği sunulmaktadır. 1–7 yolcu ve standart bagaj için Mercedes Vito, 8–14 yolcu ve büyük bagaj grubu için Mercedes Sprinter tercih edilir. Araçlar klimatlı, geniş oturma düzenine sahip ve bagaj kapasitesi açısından havalimanı transferlerine uygun şekilde yapılandırılmıştır. İş seyahatleri, aile tatilleri veya grup organizasyonları için farklı kapasiteler arasından seçim yapılabilir.' },
      { id: 'ist-sureler', headingLevel: 'h2', heading: 'Havalimanından Şehre Tahmini Transfer Süreleri', body: 'İstanbul Havalimanı\'ndan şehir merkezine (Taksim, Şişli, Beşiktaş) mesafe yaklaşık 40–55 km\'dir. Trafik yoğunluğuna bağlı olarak transfer süresi 45 dakika ile 90 dakika arasında değişir. Anadolu yakasındaki destinasyonlara (Kadıköy, Üsküdar, Ataşehir) geçiş köprü trafiğiyle birlikte 70–110 dakika sürebilir. Sabah erken ve gece geç saatler trafik yoğunluğunun en az olduğu dilimlerdir.' },
      { id: 'ist-rezervasyon', headingLevel: 'h2', heading: '7/24 Rezervasyon ve Karşılama', body: 'İstanbul Havalimanı transfer rezervasyonu çevrim içi form, WhatsApp veya telefon aracılığıyla yapılabilir. Rezervasyon onayı mesaj yoluyla iletilir. Sürücünüz uçuş saatinizden yaklaşık 30 dakika önce terminalde hazır olur. Uçuş gecikmelerinde ek ücret talep edilmez; sürücü güncel bilgileri takip ederek bekleme süresini düzenler. Erken sabah ve gece yarısı geç saat transferleri dahil 7/24 hizmet verilmektedir.' },
    ],
    serviceArea: { title: 'Hizmet Kapsamı', description: 'İstanbul Havalimanı\'ndan şehrin tüm semtlerine ve çevre illere transfer.', areas: ['Taksim', 'Beşiktaş', 'Şişli', 'Maslak', 'Levent', 'Ataşehir', 'Kadıköy', 'Sultanahmet', 'Fatih', 'Bakırköy', 'Pendik', 'Bursa', 'Kocaeli'] },
    faqs: [
      { id: 'ist-faq-1', question: 'Rezervasyon ne kadar önceden yapılmalı?', answer: 'Mümkün olan en erken tarihte rezervasyon önerilmekle birlikte, uçuş saatinden en az 3–4 saat önce yapılması yeterlidir. Son dakika rezervasyonlarında müsaitliğe bağlı olarak hizmet sağlanmaya çalışılır.' },
      { id: 'ist-faq-2', question: 'Uçuşum gecikirse ne olur?', answer: 'Sürücü, uçuş takip sistemleri üzerinden gecikmeden haberdar olur. Bekleme süresi uzadığında ek ücret talep edilmez.' },
      { id: 'ist-faq-3', question: 'Kaçıncı çıkış kapısında bekleniyor?', answer: 'Rezervasyon onayında karşılama noktası belirtilir. Standart olarak yurt dışı arrivals çıkışında tabelayla karşılama yapılır.' },
      { id: 'ist-faq-4', question: 'Çocuk koltuğu talep edebilir miyim?', answer: 'Evet. Çocuk koltuğu ihtiyacını rezervasyon sırasında belirtin; önceden hazırlanır.' },
    ],
  },

  'sabiha-gokcen-havalimani-transfer': {
    introBody: 'Sabiha Gökçen Havalimanı (SAW), İstanbul\'un Anadolu yakasında yer alır ve hem iç hat hem dış hat seferlerine ev sahipliği yapar. Özellikle düşük maliyetli havayolları ve Anadolu yakası destinasyonlarından yoğun sefer sayısıyla öne çıkan SAW, Avrupa yakasına geçiş planlamasını kritik hale getirir.\n\nSabiha Gökçen\'den özel transfer hizmeti hem Anadolu yakasındaki otel ve adreslere hem de köprü geçişiyle Avrupa yakasına organize edilmektedir. Uçuş saatinizi ve varış noktanızı rezervasyon aşamasında belirterek planlamanızı zamanında ve konforlu şekilde tamamlayabilirsiniz.',
    contentSections: [
      { id: 'saw-guzergah', headingLevel: 'h2', heading: 'SAW\'dan Nereye Transfer Hizmeti Verilir?', body: 'Sabiha Gökçen\'den İstanbul\'un her iki yakasına transfer düzenlenmektedir. Anadolu yakasında Kadıköy, Üsküdar, Ataşehir, Maltepe ve Pendik\'e yakın mesafe transferleri yapılır. Avrupa yakasındaki noktalara (Taksim, Beşiktaş, Şişli, Fatih, Bakırköy) FSM veya Osmangazi Köprüsü güzergahlarından geçilerek ulaşılır. SAW\'dan İzmit, Gebze ve Adapazarı gibi Anadolu yakası şehirlerine de transfer hizmeti sağlanmaktadır.' },
      { id: 'saw-sureler', headingLevel: 'h2', heading: 'SAW\'dan Farklı Noktalara Tahmini Süreler', body: 'Sabiha Gökçen\'den Kadıköy\'e yaklaşık 25–40 dakika, Üsküdar\'a 30–45 dakika, Taksim\'e köprü trafiğine göre 50–90 dakika sürmektedir. SAW\'dan Anadolu yakası şehirlerine (İzmit yaklaşık 60–80 dk, Adapazarı/Sakarya yaklaşık 90 dk) ulaşım kolaylıkla planlanabilir. Trafiğin yoğun olduğu saatlerde süreler uzayabileceğinden rezervasyon saati buna göre belirlenir.' },
      { id: 'saw-gece', headingLevel: 'h2', heading: 'Gece Geç Saatinde Transfer', body: 'Sabiha Gökçen\'den gece 23:00\'ten sonra inen seferler için de transfer hizmeti verilmektedir. Gece geç saatlerinde toplu taşıma seçeneklerinin azalması nedeniyle özel transfer güvenli ve rahat bir alternatif sunar. Gece transferlerinde ek ücret talep edilmez; rezervasyon saatine göre sürücü hazır bulunur.' },
      { id: 'saw-rezervasyon', headingLevel: 'h2', heading: 'Rezervasyon ve Karşılama', body: 'SAW transferlerinde sürücü, arrivals çıkışında isminizin yazılı tabelayla bekler. Uçuş takip sistemi sayesinde gecikmeler otomatik olarak izlenir. WhatsApp veya web formu üzerinden yapılan rezervasyonlarda onay mesajla iletilir. Uçuş numaranızı ve beklediğiniz araç kapasitesini (Vito veya Sprinter) belirterek rezervasyonunuzu tamamlayabilirsiniz.' },
    ],
    serviceArea: { title: 'Hizmet Kapsamı', description: 'Sabiha Gökçen\'den İstanbul\'un tüm semtlerine ve Anadolu yakası şehirlerine transfer.', areas: ['Kadıköy', 'Üsküdar', 'Ataşehir', 'Pendik', 'Maltepe', 'Taksim', 'Beşiktaş', 'Şişli', 'Fatih', 'İzmit', 'Gebze', 'Adapazarı'] },
    faqs: [
      { id: 'saw-faq-1', question: 'SAW\'dan Taksim\'e ne kadar sürer?', answer: 'Trafik koşullarına bağlı olarak 50–90 dakika. Gece saatlerinde bu süre 45–55 dakikaya düşebilir.' },
      { id: 'saw-faq-2', question: 'SAW\'dan Anadolu yakasına transfer var mı?', answer: 'Evet. Kadıköy, Üsküdar, Ataşehir ve çevre ilçelere transfer düzenlenmektedir.' },
      { id: 'saw-faq-3', question: 'Gece transferi için ayrı rezervasyon gerekiyor mu?', answer: 'Standart rezervasyon süreciyle gece transferi yapılabilir. Ek ücret talep edilmez.' },
      { id: 'saw-faq-4', question: 'Uçuş gecikirse sürücü bekler mi?', answer: 'Evet. Sürücü uçuş takip sistemi üzerinden gecikmeden haberdar olur ve bekleme süresini düzenler.' },
    ],
  },

  'vip-transfer': {
    introBody: 'VIP transfer, kişiye özel tahsis edilmiş bir araç ve profesyonel sürücü eşliğinde yürütülen, önceden planlanmış özel ulaşım hizmetidir. Taksilerden veya toplu taşıma araçlarından farklı olarak, VIP transferde araç ve güzergah yalnızca yolcuya ayrılmıştır; başka yolcu alınmaz. Bu yapı; konfor, gizlilik, güvenilirlik ve zamanlama açısından belirgin bir üstünlük sağlar.\n\nİstanbul\'da VIP transfer hizmeti havalimanı transferlerinden şehir içi ulaşıma, şehirlerarası seyahatten özel tur organizasyonuna kadar geniş bir yelpazede sunulmaktadır. İş toplantıları, özel davetler, sağlık turizmi seyahatleri ve aile grupları için Mercedes Vito ve Sprinter araçlarla kapıdan kapıya profesyonel hizmet sağlanmaktadır.',
    contentSections: [
      { id: 'vip-fark', headingLevel: 'h2', heading: 'VIP Transfer ile Diğer Ulaşım Seçenekleri Arasındaki Farklar', body: 'Standart takside araç anlık bulunur; güzergah sabit değildir ve araç kapasitesi sınırlıdır. Havalimanı servislerinde güzergah ortaktır, diğer yolcular için durma yapılır. VIP transferde araç yalnızca sizin grubunuz için tahsis edilir. Kalkış ve varış noktanız, saatiniz ve güzergahınız önceden belirlenir. Sürücünüz terminalde ya da belirttiğiniz adreste sizi karşılar ve doğrudan hedefinize götürür.' },
      { id: 'vip-ne-zaman', headingLevel: 'h2', heading: 'VIP Transfer Hizmeti Hangi Durumlar İçin Uygundur?', body: 'Havalimanı transferleri (özellikle gece geç ve erken sabah saatlerinde); iş toplantıları ve kurumsal etkinlikler; düğün, nişan ve özel davetler; sağlık turizmi (hastane transferleri); şehirlerarası seyahatler; günlük tur organizasyonları ve alışveriş gezileri VIP özel transfer gerektiren başlıca durumlardır. Yolcu sayısı 1 kişiden 14 kişiye kadar gruplar araç kapasitesine göre düzenlenebilir.' },
      { id: 'vip-arac', headingLevel: 'h2', heading: 'Araç Donanımı ve Konfor Standartları', body: 'İstanbul VIP Transfer hizmetinde Mercedes Vito ve Mercedes Sprinter kullanılmaktadır. Her iki araç da profesyonel sürücü eşliğinde, temiz ve bakımlı olarak sunulmaktadır. Araçlar klimatlı ve geniş koltuk düzenine sahip olup bagaj kapasitesi açısından yeterlidir. Uzun mesafe transferlerde yolculuk konforu ön planda tutulur; sürücülerimiz İstanbul ve çevre il güzergahlarını iyi tanır, trafik durumuna göre en uygun rotayı tercih eder.' },
      { id: 'vip-rezervasyon', headingLevel: 'h2', heading: 'Rezervasyon ve Fiyatlandırma', body: 'VIP transfer rezervasyonu WhatsApp, telefon veya web formu üzerinden yapılabilir. Kalkış noktası, varış noktası, tarih, saat ve yolcu sayısı belirtilerek fiyat teklifi alınır. Fiyatlar güzergaha, araç tipine ve süreye göre değişiklik gösterir. Önceden net fiyat bilgisi sunulur; gizli ek ücret uygulanmaz. Onay mesajı ile rezervasyon tamamlanır.' },
    ],
    serviceArea: { title: 'Hizmet Kapsamı', description: 'İstanbul ve çevre illerden Türkiye geneline VIP özel transfer.', areas: ['İstanbul', 'Bursa', 'Kocaeli', 'Sakarya', 'Ankara', 'İzmir', 'Antalya'] },
    faqs: [
      { id: 'vip-faq-1', question: 'VIP transfer hizmetinde araç paylaşımı var mı?', answer: 'Hayır. Araç yalnızca sizin grubunuz için tahsis edilir. Başka yolcu alınmaz.' },
      { id: 'vip-faq-2', question: 'Kaç kişiyle seyahat edilebilir?', answer: 'Mercedes Vito ile 1–7 kişi, Mercedes Sprinter ile 1–14 kişi seyahat edilebilir.' },
      { id: 'vip-faq-3', question: 'Rezervasyon ne kadar önceden yapılmalı?', answer: 'Mümkün olan en erken tarihte rezervasyon önerilmekle birlikte birkaç saat öncesine kadar kabul edilebilir. Yoğun dönemlerde önceden planlamak kesinlikle önerilir.' },
      { id: 'vip-faq-4', question: 'Fiyat teklifi almak için ne yapmalıyım?', answer: 'WhatsApp veya form üzerinden kalkış noktası, varış noktası, tarih ve yolcu sayısını ileterek dakikalar içinde fiyat teklifi alabilirsiniz.' },
    ],
  },

  'sehirler-arasi-transfer': {
    introBody: 'Şehirlerarası seyahatte otobüs ya da tren tercih edilmediğinde; ya konfor yetersizdir ya da güzergah uygun değildir. Şehirlerarası özel transfer bu boşluğu dolduran çözümdür: istediğiniz saatte, belirlediğiniz adresten alınırsınız ve doğrudan varış noktanıza bırakılırsınız. Yolculuk boyunca araç yalnızca sizin ve grubunuza aittir.\n\nİstanbul\'dan Türkiye\'nin başlıca şehirlerine — Bursa, Sakarya, İzmit, Eskişehir ve daha fazlasına — Mercedes Vito ve Sprinter ile şehirlerarası özel transfer hizmeti sunulmaktadır. Uzun mesafeli yolculuklarda sürücü mola ihtiyaçlarını yolcularla birlikte planlar; yolculuk konforu ön planda tutulur.',
    contentSections: [
      { id: 'sehirler-arasi-guzergahlar', headingLevel: 'h2', heading: 'Hangi Şehirlere Şehirlerarası Transfer Yapılıyor?', body: 'İstanbul merkezli şehirlerarası transferlerde en sık talep edilen güzergahlar: İstanbul–Bursa (yaklaşık 2–2,5 saat), İstanbul–İzmit/Kocaeli (yaklaşık 1,5 saat), İstanbul–Sakarya/Adapazarı (yaklaşık 1,5–2 saat), İstanbul–Eskişehir (yaklaşık 3–3,5 saat). Farklı güzergahlar için de talebe göre organizasyon yapılmaktadır. Kalkış ve varış noktaları kapı kapı belirlenir; gar, otogar veya havalimanı geçişleri de planlanabilir.' },
      { id: 'sehirler-arasi-konfor', headingLevel: 'h2', heading: 'Uzun Mesafe Transferlerde Konfor ve Güvenlik', body: 'Uzun mesafeli transferlerde araç seçimi kritik önem taşır. Mercedes Vito ve Sprinter geniş oturma kapasitesi ve bagaj alanıyla uzun yolculuklara uygundur. Sürücülerimiz mola planlamasını yolcularla birlikte yapar; otoyol mola tesislerinde dinlenme araları organize edilebilir. Araçlar düzenli bakımdan geçmekte, yolculuk boyunca klima ve konfor donanımı aktif tutulmaktadır.' },
      { id: 'sehirler-arasi-fiyat', headingLevel: 'h2', heading: 'Fiyatlandırma ve Rezervasyon', body: 'Şehirlerarası transfer fiyatı; güzergah uzunluğuna, araç tipine ve yolcu sayısına göre belirlenir. Rezervasyon öncesinde net fiyat teklifi sunulur; yolculuk sırasında ek ücret talep edilmez. Tek yön veya gidiş-dönüş rezervasyon yapılabilir. Kalkış noktası olarak havalimanı, otel, konut veya iş adresi belirtilebilir.' },
      { id: 'sehirler-arasi-planlama', headingLevel: 'h2', heading: 'Seyahat Planlaması İçin Öneriler', body: 'Şehirlerarası transferlerde erken rezervasyon önerilmektedir. Özellikle hafta sonu ve bayram dönemlerinde talep artar. Gidiş-dönüş için aynı sürücüyle çalışmak yolculuğun tutarlı ve planlı geçmesini sağlar. Grubunuzun büyüklüğüne göre araç kapasitesi (Vito: 7 kişi, Sprinter: 14 kişi) seçilerek tüm grubun tek araçta konforla seyahat etmesi sağlanabilir.' },
    ],
    serviceArea: { title: 'Hizmet Kapsamı', description: 'İstanbul\'dan Türkiye\'nin tüm büyük şehirlerine şehirlerarası özel transfer.', areas: ['Bursa', 'İzmit', 'Kocaeli', 'Sakarya', 'Adapazarı', 'Eskişehir', 'Ankara', 'İzmir', 'Edirne'] },
    faqs: [
      { id: 'sehirler-faq-1', question: 'İstanbul\'dan Bursa\'ya transfer kaç saat sürer?', answer: 'Osmangazi Köprüsü üzerinden yaklaşık 2–2,5 saat.' },
      { id: 'sehirler-faq-2', question: 'Mola yapılabilir mi?', answer: 'Evet. Uzun yolculuklarda mola planlaması sürücüyle birlikte yapılır.' },
      { id: 'sehirler-faq-3', question: 'Bagaj için ek ücret alınıyor mu?', answer: 'Hayır. Standart bagaj için ek ücret uygulanmaz.' },
      { id: 'sehirler-faq-4', question: 'Gidiş-dönüş rezervasyon yapılabiliyor mu?', answer: 'Evet. Gidiş-dönüş için tek rezervasyonla iki yön planlanabilir.' },
    ],
  },

  'soforlu-arac-kiralama': {
    introBody: 'Şoförlü araç kiralama, size özel bir araç ve profesyonel sürücünün günün belirli saatlerinde veya tüm gün boyunca hizmetinizde bulunduğu esnek bir ulaşım modelidir. Havalimanı karşılama, şehir içi geziler, toplantılar arası ulaşım, alışveriş turları veya günlük program eşliği gibi farklı ihtiyaçlar için tek rezervasyonla çözüm sunar.\n\nİstanbul\'da saatlik veya günlük şoförlü araç kiralama hizmeti; bireysel iş seyahatleri, VIP misafir ağırlama, kurumsal etkinlikler ve uzun süreli şehir içi ihtiyaçlar için Mercedes Vito ve Sprinter araçlarla sunulmaktadır. Sürücü, belirlediğiniz süre boyunca yalnızca size hizmet eder.',
    contentSections: [
      { id: 'soforlu-kapsam', headingLevel: 'h2', heading: 'Şoförlü Araç Kiralama Neler Kapsar?', body: 'Saatlik kiralama modelinde araç ve sürücü belirlenen saatler arasında size tahsis edilir. Bu süre içinde şehir içinde birden fazla noktaya gidebilir, iş toplantıları arasında transfer yapabilir ya da şehir turu düzenleyebilirsiniz. Günlük kiralamada ise araç ve sürücü gün boyunca hizmetinizdedir. Havalimanı karşılama, otel transferi ve akşam etkinliğine gidiş-dönüş tek pakette organize edilebilir.' },
      { id: 'soforlu-is', headingLevel: 'h2', heading: 'İş Seyahatleri ve VIP Misafir Ağırlama', body: 'İstanbul\'a gelen iş ortaklarını, yabancı misafirleri veya üst düzey yöneticileri karşılamak için şoförlü araç kiralama profesyonel bir tercih olarak öne çıkar. Sürücü misafiri havalimanından alır; otel, toplantı noktaları ve etkinlik mekânları arasında kesintisiz ulaşım sağlar. Araç boyunca mahremiyete ve konfora önem verilir; görüşmeler araç içinde de sürdürülebilir.' },
      { id: 'soforlu-saatlik', headingLevel: 'h2', heading: 'Saatlik ve Günlük Rezervasyon Seçenekleri', body: 'Şoförlü araç kiralama saatlik ya da günlük esasla rezerve edilebilir. Saatlik kiralama minimum 3–4 saat üzerinden planlanmaktadır. Günlük kiralamada araç 8–10 saatliğine tahsis edilir. Planlanan güzergah ve durak noktaları önceden belirtilerek fiyat teklifi alınabilir. Kiralamada kilometre veya rota sınırlaması yoktur; yalnızca süre esas alınır.' },
      { id: 'soforlu-rezervasyon', headingLevel: 'h2', heading: 'Rezervasyon Süreci', body: 'Şoförlü araç kiralama rezervasyonu WhatsApp veya web formu üzerinden yapılabilir. İhtiyaç duyulan saat aralığı, başlangıç adresi ve genel güzergah bilgisi paylaşılarak fiyat teklifi alınır. Uzun dönemli veya tekrarlayan ihtiyaçlar için özel anlaşma yapılabilir. Kurumsal müşteriler için toplu fatura ve raporlama da sağlanmaktadır.' },
    ],
    serviceArea: { title: 'Hizmet Kapsamı', description: 'İstanbul\'un tüm semtlerinde ve çevre illere saatlik veya günlük şoförlü araç kiralama.', areas: ['İstanbul Avrupa Yakası', 'İstanbul Anadolu Yakası', 'Bursa', 'Kocaeli', 'Sakarya'] },
    faqs: [
      { id: 'soforlu-faq-1', question: 'Minimum kaç saat için kiralama yapılıyor?', answer: 'Minimum 3–4 saatlik kiralama planlanmaktadır.' },
      { id: 'soforlu-faq-2', question: 'Sürücü tüm gün hizmetimde olabilir mi?', answer: 'Evet. Günlük kiralama paketinde araç ve sürücü gün boyunca size tahsis edilir.' },
      { id: 'soforlu-faq-3', question: 'Havalimanı karşılaması da dahil mi?', answer: 'Evet. Günlük kiralama süresi içinde havalimanı karşılaması organize edilebilir.' },
      { id: 'soforlu-faq-4', question: 'Kaç kişiyle kullanılabilir?', answer: 'Mercedes Vito ile 1–7, Sprinter ile 1–14 kişilik gruplar için şoförlü kiralama yapılabilir.' },
    ],
  },

  'otel-transfer': {
    introBody: 'Otel transferi, havalimanından otele veya otelden havalimanına yapılan, önceden planlanan ve kişiye özel ulaşım hizmetidir. Standart havalimanı servisleri güzergah ortaklığı nedeniyle birden fazla otelde durmak zorunda kalabilir; özel otel transferinde araç yalnızca siz için çalışır ve doğrudan otelinize ulaşırsınız.\n\nİstanbul\'daki tüm büyük oteller, butik oteller ve apart otel adreslerine özel otel transfer hizmeti verilmektedir. Hem İstanbul Havalimanı (IST) hem de Sabiha Gökçen Havalimanı\'ndan (SAW) şehrin her iki yakasındaki otel adreslerine transfer organizasyonu sağlanmaktadır.',
    contentSections: [
      { id: 'otel-kapsam', headingLevel: 'h2', heading: 'Hangi Otellere Transfer Hizmeti Verilir?', body: 'İstanbul\'da Taksim, Beşiktaş, Şişli, Beyoğlu, Sultanahmet, Fatih, Levent, Maslak, Ataşehir ve Kadıköy gibi tüm ana turizm ve iş bölgelerindeki otellere transfer hizmeti verilmektedir. Boğaz manzaralı butik oteller, şehir merkezindeki zincir oteller ve çevre semtlerdeki apart daireler dahil tüm otel adreslerine kapı kapı hizmet sunulmaktadır.' },
      { id: 'otel-varis-kalkis', headingLevel: 'h2', heading: 'Varış ve Kalkış Transferleri', body: 'Otel varış transferinde sürücü, havalimanı çıkışında sizi tabelayla karşılar ve otelinize kadar refakat eder. Otel kalkış transferinde ise belirlenen saatte otelinizin önünden sizi alır ve havalimanına zamanında ulaştırır. Uçuş saatinize göre önerilen kalkış saati hesaplanır; İstanbul trafiğini bilen sürücülerimiz olası yoğunlukları göz önünde bulundurarak güzergahı planlar.' },
      { id: 'otel-grup', headingLevel: 'h2', heading: 'Bireysel ve Grup Otel Transferleri', body: 'Bireysel seyahat edenler için Mercedes Vito, aile grupları veya şirket gezileri için Mercedes Sprinter ile otel transferi organize edilmektedir. Aynı otele gelen farklı oda konukları için ortak araçla transfer de düzenlenebilir. Grup otel kabullerinde birden fazla havalimanı seferini tek koordinasyonla yönetmek mümkündür.' },
      { id: 'otel-rezervasyon', headingLevel: 'h2', heading: 'Rezervasyon Bilgileri', body: 'Otel transfer rezervasyonunda havalimanı adı, uçuş numarası veya saat, otel adı veya adresi ve yolcu sayısı belirtilmesi yeterlidir. Onay mesajı rezervasyon tamamlandığında iletilir. Otel değişiklikleri rezervasyon saatinden önce bildirildiğinde ücretsiz güncelleme yapılır.' },
    ],
    serviceArea: { title: 'Hizmet Kapsamı', description: 'İstanbul\'un tüm otel bölgelerine IST ve SAW havalimanlarından özel transfer.', areas: ['Taksim', 'Beyoğlu', 'Beşiktaş', 'Şişli', 'Sultanahmet', 'Fatih', 'Levent', 'Maslak', 'Kadıköy', 'Ataşehir'] },
    faqs: [
      { id: 'otel-faq-1', question: 'Otel transferi için bagaj alanı yeterli mi?', answer: 'Evet. Mercedes Vito ve Sprinter geniş bagaj bölmesiyle standart bavullar için uygundur. Fazla bagaj varsa rezervasyon sırasında belirtmeniz önerilir.' },
      { id: 'otel-faq-2', question: 'Otelden havalimanına transfer ne kadar önceden planlanmalı?', answer: 'Uçuş saatinden en az 30–45 dakika erken ayrılmanızı sağlayacak şekilde rezervasyon yapılması önerilir. Sürücü trafik tahminini göz önünde bulundurur.' },
      { id: 'otel-faq-3', question: 'Transfer sırasında birden fazla otelde durulabilir mi?', answer: 'Evet. Birden fazla otelden yolcu alınması veya birden fazla konuma bırakma organizasyonu yapılabilir.' },
      { id: 'otel-faq-4', question: 'Gece geç saatte otel transferi var mı?', answer: 'Evet. 7/24 hizmet kapsamında gece geç saatte otel transferi organize edilmektedir.' },
    ],
  },

  'saglik-turizmi-transfer': {
    introBody: 'Türkiye, sağlık turizmi alanında dünya genelinde tercih edilen destinasyonlar arasında yer almaktadır. İstanbul\'daki hastaneler, klinikler ve sağlık merkezleri her yıl binlerce yabancı hastaya hizmet vermektedir. Bu hastalarda ortak bir ihtiyaç vardır: havalimanından hastaneye, hastaneden otele ve randevular arasında güvenilir, konforlu özel ulaşım.\n\nSağlık turizmi transferleri, medikal seyahate özel planlama gerektiren özel bir hizmet kategorisidir. Muayene saatleri, ameliyat tarihleri veya kontrol randevularına göre esneklik sunan bir ulaşım düzeni, hastanın hem fiziksel konforunu hem de seyahat stresini azaltır.',
    contentSections: [
      { id: 'saglik-kapsam', headingLevel: 'h2', heading: 'Sağlık Turizmi Transferinde Hizmet Kapsamı', body: 'İstanbul Havalimanı veya Sabiha Gökçen\'den karşılama; hastane, klinik veya sağlık merkezi transferi; otel ve hastane arasında çoklu transfer; ameliyat sonrası konforlu dönüş transferi ve ileri tarihli randevu transferleri sağlık turizmi paketinde sunulan temel hizmetlerdir. Hasta tek başına olabilir ya da refakatçisiyle birlikte seyahat ediyor olabilir; her iki durum için kapasite planlaması yapılır.' },
      { id: 'saglik-hastaneler', headingLevel: 'h2', heading: 'İstanbul\'da Hangi Hastane ve Kliniklere Hizmet Verilir?', body: 'İstanbul\'un Avrupa yakasındaki ve Anadolu yakasındaki tüm hastane ve klinikler transfer kapsamındadır. Tıbbi estetik klinikleri, diş klinikleri, saç ekimi merkezleri, göz kliniği ve genel cerrahi branş sağlık kuruluşlarına ulaşım organize edilmektedir. Hastane adresini ve muayene/ameliyat saatini belirterek uygun transfer saati planlanabilir.' },
      { id: 'saglik-ameliyat-sonrasi', headingLevel: 'h2', heading: 'Ameliyat Sonrası Transfer', body: 'Ameliyat veya medikal prosedür sonrasında hasta konforuna özel dikkat gösterilmektedir. Yavaş kalkış, araç içinde yeterli alan ve temiz bir ortam sağlanır. Ameliyat sonrası transferlerde araç kapıya yakın park edilir; yardım gerektiğinde sürücü refakat eder. Uzun mesafeli konaklamalar ve şehir dışı hastane geçişlerine de transfer düzenlenebilir.' },
      { id: 'saglik-planlama', headingLevel: 'h2', heading: 'Sağlık Turizmi İçin Planlama', body: 'Sağlık turizmcileri için tavsiye; hastane randevularına 15–30 dakika erken ulaşmayı hedefleyen bir transfer planı oluşturmaktır. Randevu saatlerinde değişiklik olması durumunda transfer saatinin güncellenmesi için önceden iletişim bilgisi paylaşılır. Çoklu randevu ve farklı günlere yayılan program için toplu transfer paketi planlanabilir.' },
    ],
    serviceArea: { title: 'Hizmet Kapsamı', description: 'İstanbul\'daki tüm hastane ve klinikler ile havalimanı arasında sağlık turizmi transferi.', areas: ['İstanbul Tıp Fakültesi', 'Acıbadem Hastaneleri', 'Memorial', 'Medicana', 'Şişli Klinikleri', 'Nişantaşı Klinikleri', 'Bağcılar', 'Fatih', 'Ataşehir'] },
    faqs: [
      { id: 'saglik-faq-1', question: 'Ameliyat sonrasında hastaneden beni alabilir misiniz?', answer: 'Evet. Belirttiğiniz saatten itibaren hastane kapısında bekliyoruz. Gecikme durumunda lütfen bilgi verin.' },
      { id: 'saglik-faq-2', question: 'Tekerlekli sandalye veya özel ihtiyaç için düzenleme yapılıyor mu?', answer: 'Özel ihtiyaçlarınızı rezervasyon sırasında belirtin; uygun araç ve düzenleme için çözüm arayışına girilir.' },
      { id: 'saglik-faq-3', question: 'Refakatçim de aynı araçta gelebilir mi?', answer: 'Evet. Yolcu kapasitesi dahilinde refakatçiniz aynı araçta seyahat edebilir.' },
      { id: 'saglik-faq-4', question: 'Hastane adresim değişirse transfer güncellenebilir mi?', answer: 'Evet. Değişikliği önceden bildirmeniz halinde güncelleme ücretsiz yapılır.' },
    ],
  },

  'kurumsal-vip-transfer': {
    introBody: 'Kurumsal transfer hizmetleri, şirketlerin yöneticileri, çalışanları veya misafir iş ortakları için düzenlediği organize ve planlı ulaşım çözümlerini kapsar. Tek bir etkinlik için kapsamlı taşıma ya da düzenli aralıklarla tekrarlayan iş seyahatleri için koordineli araç tahsisi şeklinde yapılandırılabilir. Kurumsal transferin temel avantajı güvenilirlik ve marka uyumlu profesyonel hizmettir.\n\nİstanbul\'daki şirketler, yabancı ziyaretçi ağırlayan firmalar, konferans ve fuar organizatörleri ile otelcilik sektöründeki kurumsal yapılar için özel VIP transfer hizmeti sunulmaktadır. Mercedes Vito ve Sprinter araçlarla çoklu güzergah ve çok sayıda konuğu kapsayan büyük organizasyonlar da yönetilebilir.',
    contentSections: [
      { id: 'kurumsal-kapsam', headingLevel: 'h2', heading: 'Kurumsal VIP Transfer Neler Kapsar?', body: 'Havalimanı misafir karşılama ve uğurlama; konferans, zirve ve fuar organizasyonları için çoklu araç koordinasyonu; şirket ofisleri ve toplantı mekânları arasında şehir içi transfer; kurumsal gala, yemek ve etkinlik transferleri ile düzenli aralıklı yönetici transferleri kurumsal hizmetin başlıca başlıklarıdır. Tek araçtan çok araçlı organizasyona kadar ölçeklendirilebilir yapı sunulmaktadır.' },
      { id: 'kurumsal-etkinlik', headingLevel: 'h2', heading: 'Toplantı ve Organizasyon Transferleri', body: 'İstanbul\'da düzenlenen uluslararası konferanslar, ticari fuarlar ve kurumsal toplantılar için yurt dışından gelen katılımcıların havalimanı karşılamasından etkinlik mekânına transferine kadar tüm süreç organize edilebilir. Çok sayıda konuğu kapsayan organizasyonlarda birden fazla araç eş zamanlı koordine edilir; her araç için ayrı güzergah ve saat planı hazırlanır.' },
      { id: 'kurumsal-sozlesme', headingLevel: 'h2', heading: 'Sürekli ve Sözleşmeli Kurumsal Transfer', body: 'Düzenli iş seyahatlerine ihtiyaç duyan şirketler için aylık veya dönemsel sözleşmeli transfer anlaşması yapılabilir. Yönetici transferleri, çalışan havalimanı karşılamaları veya tekrarlayan güzergahlar için sabit araç ve sürücü tahsisi sağlanabilir. Sözleşmeli hizmet, her seferinde yeniden rezervasyon yapma ihtiyacını ortadan kaldırır ve kurumun ulaşım süreçlerini öngörülebilir kılar.' },
      { id: 'kurumsal-fatura', headingLevel: 'h2', heading: 'Kurumsal Fatura ve Raporlama', body: 'Kurumsal transfer hizmetlerinde fatura düzenlenmekte, talep halinde departman veya maliyet merkezi bazlı raporlama sağlanmaktadır. İş birliğinin başladığı ilk aşamada ödeme ve faturalama koşulları karşılıklı olarak belirlenir. Kurumsal anlaşma için yönetici veya satın alma birimi temsilcisiyle doğrudan iletişime geçilmesi önerilir.' },
    ],
    serviceArea: { title: 'Hizmet Kapsamı', description: 'İstanbul genelinde ve Türkiye\'nin başlıca şehirlerine kurumsal VIP transfer.', areas: ['İstanbul Avrupa Yakası', 'İstanbul Anadolu Yakası', 'Bursa', 'Kocaeli', 'Ankara', 'İzmir'] },
    faqs: [
      { id: 'kurumsal-faq-1', question: 'Kurumsal anlaşma için minimum araç sayısı var mı?', answer: 'Hayır. Tek araçtan başlayan ve büyük filo koordinasyonuna kadar uzanan esnek planlar hazırlanabilir.' },
      { id: 'kurumsal-faq-2', question: 'Çok sayıda konuğu aynı anda karşılayabilir misiniz?', answer: 'Evet. Birden fazla araç eş zamanlı olarak farklı terminallerde veya aynı terminalde koordine edilebilir.' },
      { id: 'kurumsal-faq-3', question: 'Kurumsal fatura kesiliyor mu?', answer: 'Kurumsal faturalama koşullarını rezervasyon aşamasında netleştirebilirsiniz.' },
      { id: 'kurumsal-faq-4', question: 'Şirketime ait özel güzergah veya program var — karşılayabilir misiniz?', answer: 'Evet. Kurumsal ihtiyaçlarınıza göre özel program planlaması yapabiliriz.' },
    ],
  },

  'istanbul-bursa-transfer': {
    introBody: 'Bursa, İstanbul\'a 150–170 km mesafede, Osmangazi Köprüsü güzergahıyla ulaşılan önemli bir Türkiye şehridir. İpek yolu geleneğini sürdüren tekstil sektörü ve otomotiv sanayisiyle tanınan Bursa; aynı zamanda Osmanlı\'nın ilk başkenti olarak tarihi miras açısından da büyük değer taşır. İstanbul\'dan Bursa\'ya iş amaçlı veya turistik seyahat edenler için özel transfer, toplu taşımaya göre daha hızlı ve konforlu bir seçenek sunar.\n\nİstanbul–Bursa özel transfer hizmeti; kalkış noktanıza göre Osmangazi Köprüsü veya E-80 güzergahından hareketle 1,5–2,5 saat içinde Bursa\'ya ulaşımı sağlar. Araç yalnızca sizin ve grubunuz için tahsis edilir; güzergah esnekliği mevcuttur.',
    contentSections: [
      { id: 'ist-bur-guzergah', headingLevel: 'h2', heading: 'İstanbul–Bursa Güzergahı ve Süre', body: 'Osmangazi Köprüsü güzergahı İstanbul–Bursa yolculuğunu önemli ölçüde kısaltmıştır. Avrupa yakasındaki kalkış noktalarından Osmangazi Köprüsü geçilerek yaklaşık 1,5–2 saat içinde Bursa merkezine ulaşılabilir. Anadolu yakası kalkışlarında ise güzergaha bağlı olarak süre 2–2,5 saate kadar uzayabilir. Kalkış noktanıza göre en uygun güzergah önceden planlanır.' },
      { id: 'ist-bur-varis', headingLevel: 'h2', heading: 'Bursa\'da Varış Noktaları', body: 'İstanbul–Bursa transferleri; Bursa Şehirlerarası Terminali, Osmangazi ve Nilüfer ilçe merkezi, Organize Sanayi Bölgesi (OSB), Uludağ etekleri, Gemlik ve çevre bölgeler dahil Bursa\'nın tüm noktalarına organize edilmektedir. İş toplantılarından turizm amaçlı ziyaretlere, hastane transferlerinden üniversite transfer organizasyonlarına kadar farklı ihtiyaçlar karşılanmaktadır.' },
      { id: 'ist-bur-gidis-donus', headingLevel: 'h2', heading: 'Gidiş-Dönüş Transfer Planlaması', body: 'İstanbul–Bursa gidiş-dönüş transferinde tek rezervasyonla her iki yön planlanabilir. Bursa\'da geçirilecek süreye göre araç Bursa\'da bekleme yapabilir ya da dönüş için ayrı bir saat belirlenir. Toplantı veya gezi programına göre esnek dönüş saati ayarlanabilir. Sabah gidip akşam dönmek isteyen iş seyahatçileri için bu model en çok tercih edilen seçenektir.' },
      { id: 'ist-bur-rezervasyon', headingLevel: 'h2', heading: 'Rezervasyon Nasıl Yapılır?', body: 'İstanbul–Bursa transfer rezervasyonu için kalkış adresinizi, varış noktanızı (Bursa\'da otel, ofis veya terminal), tarih ve saatinizi WhatsApp veya web formu üzerinden iletin. Araç tipi seçimi ve fiyat teklifi dakikalar içinde gönderilir. Gidiş ve dönüş saatlerini birlikte belirtirseniz tüm organizasyon tek seferde tamamlanır.' },
    ],
    serviceArea: { title: 'Hizmet Kapsamı', description: 'İstanbul\'dan Bursa ve çevre ilçelere özel transfer.', areas: ['Bursa Merkez', 'Osmangazi', 'Nilüfer', 'Yıldırım', 'Gemlik', 'İnegöl', 'Mudanya', 'Uludağ'] },
    faqs: [
      { id: 'ist-bur-faq-1', question: 'İstanbul\'dan Bursa\'ya transfer ne kadar sürer?', answer: 'Osmangazi Köprüsü üzerinden yaklaşık 1,5–2 saat.' },
      { id: 'ist-bur-faq-2', question: 'Gidiş-dönüş rezervasyon yapılabiliyor mu?', answer: 'Evet, tek rezervasyonla iki yön planlanabilir.' },
      { id: 'ist-bur-faq-3', question: 'Bursa\'da araç bekleme yapabilir mi?', answer: 'Evet. İş toplantısı veya gezi süresince araç Bursa\'da bekleme yapabilir.' },
      { id: 'ist-bur-faq-4', question: 'Uludağ\'a transfer yapılıyor mu?', answer: 'Evet. Uludağ etekleri ve teleferik durağına transfer organize edilmektedir.' },
    ],
  },

  'istanbul-sapanca-transfer': {
    introBody: 'Sapanca Gölü, İstanbul\'a yaklaşık 100 km mesafede ve TEM otoyolu üzerinde yer alan, sakin bir kaçış noktasıdır. Göl kıyısındaki doğal sit alanları, butik oteller ve Maşukiye\'ye olan yakınlığıyla Sapanca; dinlenme, doğa yürüyüşü veya romantik kaçamak arayanlar için İstanbul\'dan kolayca erişilebilir bir destinasyondur. İş amaçlı seyahat edenler için de Sapanca çevresindeki konferans merkezleri ve şirket yemeği mekânları tercih nedenidir.\n\nİstanbul\'dan Sapanca\'ya özel transfer TEM otoyolu güzergahından yaklaşık 1,5–2 saat içinde gerçekleşir. Transfer hizmetinde araç yalnız size ayrılır; gidişte ve dönüşte güzergah esnekliği mevcuttur.',
    contentSections: [
      { id: 'ist-sap-guzergah', headingLevel: 'h2', heading: 'İstanbul–Sapanca Güzergahı ve Süre', body: 'TEM otoyolu boyunca İstanbul\'dan Sapanca\'ya yaklaşık 1,5–2 saatlik kesintisiz bir yolculuk yapılır. Alternatif olarak Orhangazi güzergahı kullanılarak Maşukiye, Kartepe ve Sapanca Gölü\'nün kuzey kıyısına da geçiş sağlanabilir. Kalkış noktanıza ve varış adresinize göre en uygun güzergah belirlenir ve sürücü önceden bilgilendirilir.' },
      { id: 'ist-sap-varis', headingLevel: 'h2', heading: 'Sapanca\'da Varış Noktaları', body: 'Sapanca Gölü kıyısındaki oteller, Maşukiye yaylası, Sapanca şehir merkezi, Kartepe kayak merkezi yakını, Arifiye ve Adapazarı/Sakarya il merkezi dahil bölgenin tüm noktalarına transfer organize edilmektedir. Ayrıca Sapanca civarındaki retreat ve SPA merkezlerine de özel transfer yapılabilmektedir.' },
      { id: 'ist-sap-gidis-donus', headingLevel: 'h2', heading: 'Gidiş-Dönüş ve Günübirlik Planlama', body: 'Günübirlik ziyaretler için sabah kalkışla akşam dönüş şeklinde transfer planlaması yapılabilir. Konaklamalı ziyaretlerde tek yön transfer tercih edilebilir. Gidiş-dönüş rezervasyonlarında toplam süre ve bekleme tercihleri önceden belirtilerek fiyat teklifi alınır.' },
      { id: 'ist-sap-rezervasyon', headingLevel: 'h2', heading: 'Rezervasyon', body: 'İstanbul–Sapanca transfer rezervasyonu için kalkış noktanızı, varış adresinizi (otel adı veya köy/semt), tarih ve saatinizi WhatsApp veya web formu üzerinden iletin. Gidiş-dönüş veya yalnızca gidiş transferi planlanabilir.' },
    ],
    serviceArea: { title: 'Hizmet Kapsamı', description: 'İstanbul\'dan Sapanca ve çevre destinasyonlara özel transfer.', areas: ['Sapanca Gölü', 'Maşukiye', 'Kartepe', 'Arifiye', 'Adapazarı', 'Sakarya'] },
    faqs: [
      { id: 'ist-sap-faq-1', question: 'İstanbul\'dan Sapanca ne kadar sürer?', answer: 'TEM otoyolu üzerinden yaklaşık 1,5–2 saat.' },
      { id: 'ist-sap-faq-2', question: 'Maşukiye\'ye de transfer yapılıyor mu?', answer: 'Evet, Maşukiye dahil Sapanca çevresindeki tüm noktalara transfer hizmeti verilmektedir.' },
      { id: 'ist-sap-faq-3', question: 'Gidiş-dönüş rezervasyon yapılabiliyor mu?', answer: 'Evet, tek rezervasyonla iki yön planlanabilir.' },
      { id: 'ist-sap-faq-4', question: 'Kartepe\'ye de transfer yapılıyor mu?', answer: 'Evet. Kartepe kayak merkezi ve çevre bölgelere de transfer organize edilmektedir.' },
    ],
  },

  'istanbul-gunubirlik-turlar': {
    introBody: 'İstanbul ve çevresi, günübirlik tur için birbirinden güzel destinasyonlar sunar. Saatlerce trafik stresine girmeden komşu şehirlere, doğa alanlarına veya tarihi mekânlara ulaşmak isteyenler için özel araçlı günübirlik turlar en konforlu seçenektir. Sürücü tüm gün boyunca size eşlik eder, güzergah tercihleri esnek tutulur ve akşam İstanbul\'a aynı araçla dönülür.\n\nİstanbul çevresinden en çok tercih edilen günübirlik tur destinasyonları arasında Bursa, Sapanca–Maşukiye, Yalova ve Edirne öne çıkmaktadır. Her destinasyon için ayrı tur sayfalarında detaylı bilgi bulabilirsiniz. İstanbul\'dan hareket, destinasyonda gezi ve akşam dönüş şeklinde tek bir rezervasyonla planlanır.',
    contentSections: [
      { id: 'gunubirlik-destinasyonlar', headingLevel: 'h2', heading: 'Popüler Günübirlik Tur Destinasyonları', body: 'Bursa, Osmanlı tarihi ve İskender kebabıyla öne çıkar; Osmangazi Köprüsü üzerinden yaklaşık 2 saatte ulaşılır. Sapanca ve Maşukiye, gölün dingin kıyıları ve doğa manzarasıyla 1,5–2 saatlik yolculuk mesafesindedir. Yalova, termal kaplıcaları ve Atatürk Köşkü\'yle kısa sürede keşfedilebilir. Edirne, Selimiye Camii ve tarihi çarşılarıyla kültür tutkunları için değerli bir duraktır.' },
      { id: 'gunubirlik-planlama', headingLevel: 'h2', heading: 'Günübirlik Tur Planlaması', body: 'Günübirlik turlar sabah 08:00–09:00 kalkışıyla akşam 18:00–20:00 arasında tamamlanacak şekilde düzenlenebilir. Destinasyondaki zaman nasıl kullanılacağı konusunda sürücü yönlendirme yapabilir. Öğle yemeği planlaması ve gezi durakları önceden belirlenebilir. Araca bindiğiniz andan ineceğiniz ana kadar konfor ve güvenlik önceliklidir.' },
      { id: 'gunubirlik-gruplar', headingLevel: 'h2', heading: 'Bireysel ve Grup Turları', body: 'Bireysel veya çift için Mercedes Vito, büyük aile grupları veya arkadaş toplulukları için Mercedes Sprinter ile günübirlik tur organizasyonu yapılmaktadır. Grup büyüklüğüne göre araç seçimi yapılır ve herkes aynı araçla seyahat eder. Farklı destinasyonlar için özel program oluşturulabilir.' },
      { id: 'gunubirlik-rezervasyon', headingLevel: 'h2', heading: 'Rezervasyon', body: 'Günübirlik tur transferi için gitmek istediğiniz destinasyonu, tarihini ve kişi sayısını belirterek WhatsApp veya web formu üzerinden rezervasyon başlatabilirsiniz. Her destinasyon için özel sayfalarımızda daha fazla bilgi ve güzergah detayı bulunmaktadır.' },
    ],
    serviceArea: { title: 'Hizmet Kapsamı', description: 'İstanbul çevresindeki tüm günübirlik tur destinasyonlarına özel transfer.', areas: ['Bursa', 'Sapanca', 'Maşukiye', 'Yalova', 'Edirne', 'Polonezköy', 'Ağva', 'Şile'] },
    faqs: [
      { id: 'gunubirlik-faq-1', question: 'Bir günde birden fazla destinasyon gezilebilir mi?', answer: 'Güzergahlar birbirine yakınsa birden fazla nokta ziyareti planlanabilir. Sürücüyle önceden koordine edilmesi önerilir.' },
      { id: 'gunubirlik-faq-2', question: 'Giriş ücretleri ve öğle yemeği dahil mi?', answer: 'Hayır. Transfer ücreti yalnızca araç ve sürücüyü kapsar. Giriş ve yemek masrafları ayrıca ödenir.' },
      { id: 'gunubirlik-faq-3', question: 'Tur güzergahını özelleştirebilir miyim?', answer: 'Evet. Güzergah ve duraklarınızı önceden belirterek özel program oluşturabilirsiniz.' },
      { id: 'gunubirlik-faq-4', question: 'Kaç kişiyle tura çıkılabilir?', answer: 'Mercedes Vito ile 1–7 kişi, Sprinter ile 1–14 kişi. Gruplar için araç seçimi yapılır.' },
    ],
  },

  'sapanca-masukiye-turu': {
    introBody: 'Sapanca Gölü ve Maşukiye, İstanbul\'a sadece 1,5–2 saat mesafede doğa kaçamağı yaşatır. Gölün dingin kıyıları, Maşukiye köyünün yemyeşil dokusu ve bölgedeki kahvaltı mekânları İstanbul\'dan günübirlik olarak ulaşılabilecek en popüler rotalar arasında yer almaktadır.\n\nSapanca ve Maşukiye günübirlik tur transferi; İstanbul\'dan hareketli, bölgede gezdirme ve dönüş şeklinde planlanmaktadır. Araç ve sürücü tüm gün boyunca size eşlik eder, güzergah isteklerinize göre esneklik sağlanır.',
    contentSections: [
      { id: 'sapanca-guzergah', headingLevel: 'h2', heading: 'Güzergah ve Ziyaret Noktaları', body: 'Sapanca turu güzergahı Sapanca Gölü kıyısı, Maşukiye yaylası, Arifiye ve isteğe bağlı olarak Adapazarı şehir merkezini kapsamaktadır. Doğa içi restoranlar, gölde tekne gezisi veya doğa yürüyüşü gibi aktiviteler güzergaha eklenebilir. Sürücü bölgeyi tanıyan yerel mekânlar konusunda yönlendirme yapabilir. Kartepe kayak merkezi ve çevre bölgeler de programa dahil edilebilir.' },
      { id: 'sapanca-sure', headingLevel: 'h2', heading: 'Tur Süresi ve Planlama', body: 'Sapanca–Maşukiye günübirlik turu sabah 08:00–09:00 gibi başlayıp akşam 18:00–19:00 arası tamamlanacak şekilde planlanabilir. Daha uzun süreli programlar veya farklı kalkış saatleri için esnek rezervasyon yapılabilir. Maşukiye\'de kahvaltı, Sapanca Gölü\'nde öğle yemeği gibi kombinasyonlar önceden planlanabilir.' },
      { id: 'sapanca-aktivite', headingLevel: 'h2', heading: 'Bölgede Yapılabilecek Aktiviteler', body: 'Maşukiye\'de doğa yürüyüşü ve fotoğraf turları; Sapanca Gölü\'nde tekne gezisi; yöresel kahvaltı ve restoran ziyaretleri; Kartepe\'de kışın kayak, yazın teleferik; Arifiye\'deki tarihi noktalar bölgede yapılabilecek başlıca aktiviteler arasındadır. Sürücünüz tüm bu noktalara rahatça eşlik eder.' },
      { id: 'sapanca-rezervasyon', headingLevel: 'h2', heading: 'Tur Rezervasyonu', body: 'İstanbul içinden kalkış adresinizi belirterek WhatsApp veya form üzerinden tur transferi rezervasyonu yapabilirsiniz. Tur programınızı ve özel isteklerinizi paylaşarak sürücüyle koordinasyonu önceden sağlayabilirsiniz. Kişi sayısına göre Vito veya Sprinter seçimi yapılır.' },
    ],
    serviceArea: { title: 'Hizmet Kapsamı', description: 'İstanbul\'dan Sapanca Gölü ve Maşukiye bölgesine günübirlik tur transferi.', areas: ['Sapanca', 'Maşukiye', 'Kartepe', 'Arifiye', 'Adapazarı', 'Sapanca Gölü Kıyısı'] },
    faqs: [
      { id: 'sapanca-faq-1', question: 'İstanbul\'dan Sapanca ne kadar sürer?', answer: 'Yaklaşık 1,5–2 saat (trafiğe bağlı).' },
      { id: 'sapanca-faq-2', question: 'Tur sırasında istediğimiz yerde durabiliriz?', answer: 'Evet. Sürücü tüm gün size eşlik eder ve güzergah esneklik sağlar.' },
      { id: 'sapanca-faq-3', question: 'Maşukiye\'de kahvaltı mekânı önerebilir misiniz?', answer: 'Sürücülerimiz bölgeyi iyi tanır ve tercihlerinize göre yerel mekân önerisinde bulunabilir.' },
      { id: 'sapanca-faq-4', question: 'Kış aylarında Kartepe\'ye kayak turu yapılabiliyor mu?', answer: 'Evet. Kış sezonunda Kartepe kayak merkezine transfer ve bekleme hizmeti verilmektedir.' },
    ],
  },

  'bursa-gunubirlik-tur': {
    introBody: 'Bursa, tarihi camiler, Osmanlı çarşıları ve ünlü İskender kebabıyla İstanbul\'dan günübirlik ziyaret için değerli bir kültür destinasyonudur. Feribot ya da Osmangazi Köprüsü üzerinden özel araçla İstanbul–Bursa arası yaklaşık 2–2,5 saat sürmektedir.\n\nBursa günübirlik tur transferinde araç sabah İstanbul\'dan hareket eder; Bursa\'da yeterli süre geçirilir ve akşam İstanbul\'a dönülür. Ulu Cami, Kapalıçarşı ve Uludağ Teleferik Durağı gibi popüler noktalar sürücü eşliğinde rahatça tamamlanabilir.',
    contentSections: [
      { id: 'bursa-gezi', headingLevel: 'h2', heading: 'Bursa\'da Gezilecek Yerler', body: 'Bursa\'da popüler ziyaret noktaları arasında Ulu Cami, Yeşil Cami ve Türbesi, Kapalıçarşı ve Eski Aynalı Çarşı, İskender lokantaları, Muradiye Külliyesi, Tofaş Müzesi ve Uludağ Teleferik Durağı yer almaktadır. Çekim noktaları birbirine yakın mesafededir; gün içinde büyük bir kısmı rahatça ziyaret edilebilir.' },
      { id: 'bursa-ulasim', headingLevel: 'h2', heading: 'İstanbul–Bursa Güzergahı', body: 'İstanbul–Bursa arası Osmangazi Köprüsü geçişiyle 2–2,5 saat içinde tamamlanmaktadır. Alternatif olarak Topçular\'dan feribotle Mudanya\'ya geçiş yaklaşık 1 saat sürer; bu güzergah Marmara deniz manzarasıyla keyifli bir alternatif sunar. Güzergah tercihi rezervasyon sırasında belirtilebilir.' },
      { id: 'bursa-program', headingLevel: 'h2', heading: 'Örnek Günübirlik Tur Programı', body: 'Sabah 08:00–09:00 arasında İstanbul\'dan kalkış; 10:30–11:00 civarında Bursa\'ya varış; öğle yemeğinde İskender; öğleden sonra tarihi çarşı ve cami gezisi; Uludağ Teleferik ziyareti isteğe bağlı; akşam 17:00–18:00 dönüş yolculuğu; İstanbul\'a akşam 19:00–20:00 varış. Program kişisel tercihlere göre esneyebilir.' },
      { id: 'bursa-rezervasyon', headingLevel: 'h2', heading: 'Tur Rezervasyonu', body: 'Bursa günübirlik tur transferini kalkış noktanızı belirterek form veya WhatsApp üzerinden organize edebilirsiniz. Gruptaki kişi sayısına göre araç seçimi yapılır. Feribot tercih eden katılımcılar için güzergah önceden belirtilmelidir.' },
    ],
    serviceArea: { title: 'Hizmet Kapsamı', description: 'İstanbul\'dan Bursa ve çevresine günübirlik tur transferi.', areas: ['Bursa Merkez', 'Osmangazi', 'Nilüfer', 'Uludağ', 'Mudanya', 'Gemlik'] },
    faqs: [
      { id: 'bursa-faq-1', question: 'Bursa turu bir günde tamamlanıyor mu?', answer: 'Evet. Sabah 08:00–09:00 kalkışla akşam 19:00–20:00 dönüşüyle rahatça yapılabilir.' },
      { id: 'bursa-faq-2', question: 'Feribot veya köprü güzergahı tercih edebilir miyim?', answer: 'Evet. Rezervasyon sırasında güzergah tercihini belirtmeniz yeterlidir.' },
      { id: 'bursa-faq-3', question: 'Uludağ ziyareti de dahil edilebilir mi?', answer: 'Evet. Uludağ Teleferik Durağı programa eklenebilir; isteğe bağlıdır.' },
      { id: 'bursa-faq-4', question: 'Kişi sayısına göre araç seçeneği var mı?', answer: 'Evet. Vito ile 7, Sprinter ile 14 kişilik gruplar için tur planlanabilir.' },
    ],
  },

  'yalova-gunubirlik-tur': {
    introBody: 'Yalova, kaplıcaları ve doğal güzellikleriyle İstanbul\'a yakın bir termal turizm merkezidir. İstanbul\'dan karayoluyla 1,5–2 saat veya Yenikapı\'dan feribotle yaklaşık 1 saatte ulaşılabilen Yalova, özellikle kaplıca deneyimi arayanlar ve doğa yürüyüşçüleri için tercih edilen bir günübirlik destinasyondur.\n\nYalova günübirlik tur transferinde araç İstanbul\'dan hareket eder; Yalova\'da kaplıca, Termal kasabası veya Atatürk Köşkü gibi noktalar gezilir ve aynı gün İstanbul\'a dönülür. Sürücü tüm gün boyunca yolcularla birlikte bulunur.',
    contentSections: [
      { id: 'yalova-gezi', headingLevel: 'h2', heading: 'Yalova\'da Gezilecek Noktalar', body: 'Yalova Termal Kaplıcaları, Atatürk Köşkü ve Çiftlik, Yalova şehir merkezi, Armutlu ilçesi ve Çınarcık sahili Yalova\'da popüler ziyaret noktaları arasındadır. Termal bölgede çeşitli SPA ve kaplıca tesisleri yer almakta olup gün bileti ile giriş yapılabilir; sürücü bu süre zarfında bekleme hizmeti sağlar.' },
      { id: 'yalova-ulasim', headingLevel: 'h2', heading: 'İstanbul–Yalova Güzergahı', body: 'İstanbul\'dan Yalova\'ya karayoluyla (TEM–Osmangazi Köprüsü) yaklaşık 1,5–2 saat veya Yenikapı\'dan feribot ile yaklaşık 1 saat ulaşılabilir. Köprü güzergahı doğrudan ve hızlıdır; feribot Marmara Denizi manzarasıyla alternatif bir güzergah sunar. Rezervasyon sırasında tercih belirtilebilir.' },
      { id: 'yalova-program', headingLevel: 'h2', heading: 'Örnek Tur Programı', body: 'Sabah 08:00–09:00 İstanbul\'dan kalkış; 10:00–10:30 Yalova\'ya varış; Atatürk Köşkü ve çiftlik ziyareti; öğlen Yalova merkezi veya Çınarcık\'ta yemek; öğleden sonra Termal Kaplıca tesis ziyareti; akşam 16:00–17:00 dönüş yolculuğu; İstanbul\'a akşam 18:00–19:00 varış. Program tercihlere göre düzenlenebilir.' },
      { id: 'yalova-rezervasyon', headingLevel: 'h2', heading: 'Tur Planlaması ve Rezervasyon', body: 'Yalova günübirlik tur transferi için kalkış adresinizi ve kişi sayısını belirterek rezervasyon yapabilirsiniz. Program isteklerinizi (kaplıca, gezinti, öğle yemeği tercihi) belirtmeniz halinde sürücü planlamaya yardımcı olur. Feribot tercihi varsa ek araştırma süresi için erken rezervasyon yapılması önerilir.' },
    ],
    serviceArea: { title: 'Hizmet Kapsamı', description: 'İstanbul\'dan Yalova ve çevre destinasyonlara günübirlik tur transferi.', areas: ['Yalova Merkez', 'Termal', 'Armutlu', 'Çınarcık', 'Altınova'] },
    faqs: [
      { id: 'yalova-faq-1', question: 'Yalova turu ne kadar sürer?', answer: 'Sabah çıkışıyla akşam dönüşü şeklinde tam gün tur planlanabilir (yaklaşık 8–10 saat).' },
      { id: 'yalova-faq-2', question: 'Kaplıcaya giriş ücreti dahil mi?', answer: 'Hayır. Transfer ücretine giriş ücretleri dahil değildir. Kaplıca tesisi giriş ücretleri ayrıca ödenir.' },
      { id: 'yalova-faq-3', question: 'Feribot güzergahı tercih edebilir miyim?', answer: 'Evet. Yenikapı–Yalova feribot güzergahı için rezervasyon sırasında belirtmeniz yeterlidir.' },
      { id: 'yalova-faq-4', question: 'Yalova Termal\'e transfer yapılıyor mu?', answer: 'Evet. Yalova Termal kasabası ve kaplıca tesislerine doğrudan transfer organize edilmektedir.' },
    ],
  },
};

// ── Field extraction / application (same as bulk-translate.mjs) ───────────────

function extractTranslatableFields(b) {
  const out = {};
  out['hero.badge']        = b.hero?.badge        ?? '';
  out['hero.title']        = b.hero?.title        ?? '';
  out['hero.subtitle']     = b.hero?.subtitle     ?? '';
  out['hero.crumb']        = b.hero?.crumb        ?? '';
  out['hero.ctaPrimary']   = b.hero?.ctaPrimary   ?? '';
  out['hero.ctaSecondary'] = b.hero?.ctaSecondary ?? '';
  out['seo.ogTitle']       = b.seo?.ogTitle       ?? '';
  out['seo.ogDescription'] = b.seo?.ogDescription ?? '';
  (b.features ?? []).forEach((f, i) => { out[`feature.${i}`] = f; });
  if (b.introBody) out['introBody'] = b.introBody;
  if (b.contentSections) {
    b.contentSections.forEach((s, i) => {
      out[`contentSection.${i}.heading`] = s.heading ?? '';
      out[`contentSection.${i}.body`]    = s.body    ?? '';
    });
  }
  if (b.serviceArea) {
    out['serviceArea.title']       = b.serviceArea.title       ?? '';
    out['serviceArea.description'] = b.serviceArea.description ?? '';
    (b.serviceArea.areas ?? []).forEach((a, i) => { out[`serviceArea.area.${i}`] = a; });
  }
  if (b.faqs) {
    b.faqs.forEach((f, i) => {
      out[`faq.${i}.question`] = f.question ?? '';
      out[`faq.${i}.answer`]   = f.answer   ?? '';
    });
  }
  return out;
}

function applyTranslatedFields(base, translated) {
  const t = JSON.parse(JSON.stringify(base));
  for (const [key, value] of Object.entries(translated)) {
    if (!value) continue;
    if      (key === 'hero.badge')        t.hero.badge          = value;
    else if (key === 'hero.title')        t.hero.title          = value;
    else if (key === 'hero.subtitle')     t.hero.subtitle       = value;
    else if (key === 'hero.crumb')        t.hero.crumb          = value;
    else if (key === 'hero.ctaPrimary')   t.hero.ctaPrimary     = value;
    else if (key === 'hero.ctaSecondary') t.hero.ctaSecondary   = value;
    else if (key === 'seo.ogTitle')       t.seo.ogTitle         = value;
    else if (key === 'seo.ogDescription') t.seo.ogDescription   = value;
    else if (key === 'introBody')         t.introBody           = value;
    else if (key.startsWith('feature.')) {
      const idx = parseInt(key.slice(8), 10);
      if (!isNaN(idx) && idx < t.features.length) t.features[idx] = value;
    }
    else if (key.startsWith('contentSection.')) {
      const parts = key.split('.');
      if (parts.length === 3 && t.contentSections) {
        const idx = parseInt(parts[1], 10);
        const field = parts[2];
        if (!isNaN(idx) && idx < t.contentSections.length && (field === 'heading' || field === 'body'))
          t.contentSections[idx][field] = value;
      }
    }
    else if (key === 'serviceArea.title' && t.serviceArea)       t.serviceArea.title = value;
    else if (key === 'serviceArea.description' && t.serviceArea) t.serviceArea.description = value;
    else if (key.startsWith('serviceArea.area.') && t.serviceArea) {
      const idx = parseInt(key.slice('serviceArea.area.'.length), 10);
      if (!isNaN(idx) && idx < t.serviceArea.areas.length) t.serviceArea.areas[idx] = value;
    }
    else if (key.startsWith('faq.') && t.faqs) {
      const parts = key.split('.');
      if (parts.length === 3) {
        const idx = parseInt(parts[1], 10);
        const field = parts[2];
        if (!isNaN(idx) && idx < t.faqs.length && (field === 'question' || field === 'answer'))
          t.faqs[idx][field] = value;
      }
    }
  }
  return t;
}

async function translateServiceFields(fields, targetLang) {
  const langName = LANG_NAMES[targetLang] ?? targetLang;
  const sys = `You are an expert translation engine for luxury VIP transportation content.
Translate all JSON values from Turkish to ${langName}.
CRITICAL: Keep ALL keys exactly as-is — translate ONLY values.
Preserve verbatim: ${PRESERVED.map(s => `"${s}"`).join(', ')}
Do NOT translate URLs, slugs, numbers, or email addresses.
For Arabic: Modern Standard Arabic. Wrap LTR inline strings (phone, URL, IST, SAW, TEM) with \\u202A...\\u202C.
Maintain premium, professional tone.
Return ONLY valid JSON with the same keys and translated string values.`;

  const user = `Translate these ${Object.keys(fields).length} service page fields to ${langName}:\n\n${JSON.stringify(fields, null, 2)}\n\nReturn translated JSON with identical keys.`;

  const res = await ai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });
  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty OpenAI response');
  return JSON.parse(raw);
}

async function withRetry(fn, label, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try { return await fn(); }
    catch (err) {
      if (attempt === maxAttempts) throw err;
      console.warn(`  [retry ${attempt}/${maxAttempts}] ${label}: ${err.message}`);
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
}

// ── Phase 1: Inject Turkish content into service_pages body ──────────────────

async function injectTurkishContent() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('PHASE 1: Inject Turkish content into 14 service pages');
  console.log('═══════════════════════════════════════════════════');

  const slugs = Object.keys(SERVICE_CONTENT);

  // Fetch all service pages in one query
  const rows = await sql`
    SELECT id::text as id, slug, body
    FROM content
    WHERE content_type = 'SERVICE' AND slug = ANY(${slugs})
    ORDER BY slug
  `;

  console.log(`Found ${rows.length} of ${slugs.length} service pages in DB`);
  const missing = slugs.filter(s => !rows.find(r => r.slug === s));
  if (missing.length) console.warn(`  ⚠ Missing slugs: ${missing.join(', ')}`);

  const updatedIds = [];

  for (const row of rows) {
    const content = SERVICE_CONTENT[row.slug];
    if (!content) continue;

    let body;
    try { body = JSON.parse(row.body); } catch { body = null; }

    if (!body || !body.hero) {
      console.warn(`  ⚠ ${row.slug}: malformed body, skipping`);
      continue;
    }

    // Merge new content into existing body
    body.version        = 2;
    body.introBody      = content.introBody;
    body.contentSections = content.contentSections;
    body.faqs           = content.faqs;
    if (content.serviceArea) body.serviceArea = content.serviceArea;

    await sql`
      UPDATE content
      SET body = ${JSON.stringify(body)}, updated_at = NOW()
      WHERE id::text = ${row.id}
    `;
    updatedIds.push({ id: row.id, slug: row.slug, body });
    console.log(`  ✓ Updated body: ${row.slug}`);
  }

  // Mark existing translations OUTDATED
  if (updatedIds.length > 0) {
    const ids = updatedIds.map(r => r.id);
    const result = await sql`
      UPDATE content_translations
      SET status = 'OUTDATED', updated_at = NOW()
      WHERE entity_type = 'service_page'
        AND entity_id = ANY(${ids})
        AND target_language_code != 'tr'
    `;
    console.log(`  Marked existing translations OUTDATED`);
  }

  console.log(`\nPhase 1 done: ${updatedIds.length} pages updated`);
  return updatedIds;
}

// ── Phase 2: Translate all updated pages to 8 languages ──────────────────────

async function translateAllPages(updatedPages) {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('PHASE 2: Translate all updated pages to 8 languages');
  console.log('═══════════════════════════════════════════════════');

  // Fetch current metadata for each page
  const ids = updatedPages.map(r => r.id);
  const metas = await sql`
    SELECT id::text as id, slug, title, seo_title, seo_description, hero_image_alt, excerpt
    FROM content
    WHERE id::text = ANY(${ids})
  `;
  const metaMap = Object.fromEntries(metas.map(m => [m.id, m]));
  const bodyMap = Object.fromEntries(updatedPages.map(r => [r.id, r.body]));

  // Build task list: page × lang
  const tasks = [];
  for (const page of updatedPages) {
    for (const lang of LANGS) {
      tasks.push({ id: page.id, slug: page.slug, lang });
    }
  }

  console.log(`Total translation tasks: ${tasks.length}`);

  const results = { ok: [], failed: [] };

  // Process 2 tasks at a time
  for (let i = 0; i < tasks.length; i += 2) {
    const batch = tasks.slice(i, i + 2);
    await Promise.all(batch.map(async ({ id, slug, lang }) => {
      const label = `${slug}→${lang}`;
      try {
        const parsedBody = bodyMap[id];
        const meta = metaMap[id] ?? {};

        if (!parsedBody || !parsedBody.hero) {
          console.warn(`  ⚠ ${label}: no body`);
          results.failed.push(label + '(no body)');
          return;
        }

        const fields = extractTranslatableFields(parsedBody);
        console.log(`  Translating ${label} (${Object.keys(fields).length} fields)...`);

        const translated = await withRetry(
          () => translateServiceFields(fields, lang),
          label,
        );

        const translatedBody = applyTranslatedFields(parsedBody, translated);

        // Arabic RTL LTR markers
        if (lang === 'ar') {
          const wrap = (s) => s ? `\u202A${s}\u202C` : s;
          if (translatedBody.hero) {
            translatedBody.hero.ctaPrimary   = translatedBody.hero.ctaPrimary   ? wrap(translatedBody.hero.ctaPrimary)   : translatedBody.hero.ctaPrimary;
            translatedBody.hero.ctaSecondary = translatedBody.hero.ctaSecondary ? wrap(translatedBody.hero.ctaSecondary) : translatedBody.hero.ctaSecondary;
          }
        }

        await sql`
          INSERT INTO content_translations (
            entity_type, entity_id, source_language_code, target_language_code,
            status, title, slug, excerpt, body,
            meta_title, meta_description,
            is_ai_generated, ai_model, ai_prompt_version,
            draft_at, published_at, updated_at
          ) VALUES (
            'service_page', ${id}, 'tr', ${lang},
            'PUBLISHED',
            ${translatedBody.hero?.title ?? meta.title ?? null},
            ${slug + '-' + lang},
            ${meta.excerpt ?? null},
            ${JSON.stringify(translatedBody)},
            ${translatedBody.seo?.ogTitle ?? meta.seo_title ?? null},
            ${translatedBody.seo?.ogDescription ?? meta.seo_description ?? null},
            true, ${MODEL}, 'sp-content-v2',
            now(), now(), now()
          )
          ON CONFLICT (entity_type, entity_id, target_language_code)
          DO UPDATE SET
            status           = 'PUBLISHED',
            title            = EXCLUDED.title,
            body             = EXCLUDED.body,
            meta_title       = EXCLUDED.meta_title,
            meta_description = EXCLUDED.meta_description,
            is_ai_generated  = true,
            ai_model         = EXCLUDED.ai_model,
            ai_prompt_version = EXCLUDED.ai_prompt_version,
            draft_at         = now(),
            published_at     = now(),
            updated_at       = now()
        `;
        results.ok.push(label);
        console.log(`  ✓ ${label}`);
      } catch (err) {
        results.failed.push(label);
        console.error(`  ✗ ${label}: ${err.message}`);
      }
    }));
  }

  console.log(`\nPhase 2 done: ${results.ok.length} OK, ${results.failed.length} failed`);
  if (results.failed.length) console.log('  Failed:', results.failed);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const start = Date.now();
  console.log(`\nModel: ${MODEL}`);

  const updatedPages = await injectTurkishContent();

  if (updatedPages.length === 0) {
    console.log('\nNo pages updated — exiting.');
  } else {
    await translateAllPages(updatedPages);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n✅ All done in ${elapsed}s`);
  await sql.end();
}

main().catch(async (err) => {
  console.error('Fatal:', err.message);
  await sql.end();
  process.exit(1);
});
