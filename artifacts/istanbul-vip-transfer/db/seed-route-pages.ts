/**
 * Idempotent content seed for the first intent-led route landing pages.
 * The public renderer never shows the legacy price columns; a booking request
 * is the only price CTA on these pages.
 */
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { ssl: false, max: 1 });

type RouteSeed = {
  slug: string;
  name: string;
  origin: string;
  destination: string;
  distanceKm: number;
  normal: [number, number];
  peak: [number, number];
  crossContinent: boolean;
  imagePath: string;
  relatedServiceSlug: string;
  displayOrder: number;
};

const ROUTES: RouteSeed[] = [
  { slug: 'ist-havalimani-taksim', name: 'İstanbul Havalimanı – Taksim Transferi', origin: 'İstanbul Havalimanı', destination: 'Taksim', distanceKm: 42, normal: [40, 65], peak: [60, 100], crossContinent: false, imagePath: '/route-images/ist-havalimani-taksim.jpg', relatedServiceSlug: 'istanbul-havalimani-transfer', displayOrder: 1 },
  { slug: 'istanbul-sapanca', name: 'İstanbul – Sapanca Transferi', origin: 'İstanbul', destination: 'Sapanca', distanceKm: 138, normal: [105, 135], peak: [125, 165], crossContinent: false, imagePath: '/hero-images/istanbul-sapanca-transfer.jpg', relatedServiceSlug: 'istanbul-sapanca-transfer', displayOrder: 2 },
  { slug: 'istanbul-havalimani-beyoglu', name: 'İstanbul Havalimanı – Beyoğlu Transferi', origin: 'İstanbul Havalimanı', destination: 'Beyoğlu', distanceKm: 41, normal: [40, 65], peak: [60, 100], crossContinent: false, imagePath: '/images/istanbul-havalimani-hero-alt.jpg', relatedServiceSlug: 'istanbul-havalimani-transfer', displayOrder: 3 },
  { slug: 'istanbul-havalimani-sultanahmet', name: 'İstanbul Havalimanı – Sultanahmet Transferi', origin: 'İstanbul Havalimanı', destination: 'Sultanahmet', distanceKm: 49, normal: [45, 70], peak: [70, 115], crossContinent: false, imagePath: '/hero-images/istanbul-havalimani-transfer.jpg', relatedServiceSlug: 'istanbul-havalimani-transfer', displayOrder: 4 },
  { slug: 'sabiha-gokcen-taksim', name: 'Sabiha Gökçen – Taksim Transferi', origin: 'Sabiha Gökçen Havalimanı', destination: 'Taksim', distanceKm: 45, normal: [60, 90], peak: [95, 150], crossContinent: true, imagePath: '/route-images/taksim-sabiha.jpg', relatedServiceSlug: 'sabiha-gokcen-havalimani-transfer', displayOrder: 5 },
  { slug: 'istanbul-havalimani-kadikoy', name: 'İstanbul Havalimanı – Kadıköy Transferi', origin: 'İstanbul Havalimanı', destination: 'Kadıköy', distanceKm: 56, normal: [60, 90], peak: [95, 140], crossContinent: true, imagePath: '/hero-images/sabiha-gokcen-havalimani-transfer.jpg', relatedServiceSlug: 'istanbul-havalimani-transfer', displayOrder: 6 },
  { slug: 'istanbul-bursa', name: 'İstanbul – Bursa Transferi', origin: 'İstanbul', destination: 'Bursa', distanceKm: 155, normal: [130, 165], peak: [155, 210], crossContinent: false, imagePath: '/hero-images/istanbul-bursa-transfer.jpg', relatedServiceSlug: 'istanbul-bursa-transfer', displayOrder: 7 },
  { slug: 'sabiha-gokcen-kadikoy', name: 'Sabiha Gökçen – Kadıköy Transferi', origin: 'Sabiha Gökçen Havalimanı', destination: 'Kadıköy', distanceKm: 34, normal: [35, 55], peak: [55, 85], crossContinent: false, imagePath: '/route-images/sultanahmet-sabiha.jpg', relatedServiceSlug: 'sabiha-gokcen-havalimani-transfer', displayOrder: 8 },
];

function intro(route: RouteSeed) {
  return `${route.origin} ile ${route.destination} arası yaklaşık ${route.distanceKm} km’dir; normal trafikte yolculuk çoğu gün ${route.normal[0]}–${route.normal[1]} dakika, yoğun saatlerde ${route.peak[0]}–${route.peak[1]} dakika sürer. Süre, çıkış saati, hava koşulları, köprü veya ana arter yoğunluğu ve terminal/otel girişindeki beklemeye göre değişebilir.`;
}

function transportOptions(route: RouteSeed) {
  return [
    { name: 'Toplu taşıma', summary: `${route.origin} ve ${route.destination} arasında aktarmalı hatlarla ilerleme seçeneğidir.`, downside: 'Bagajla aktarma, yoğun saatlerde ayakta yolculuk ve son duraktan otele ek ulaşım gerekebilir.' },
    { name: 'Havalimanı/şehir servisi', summary: 'Belirli duraklar arasında daha düzenli bir alternatif olabilir.', downside: 'Kapıdan kapıya hizmet vermez; kalkış saatine uymak ve duraktan konaklamaya ayrıca ulaşmak gerekir.' },
    { name: 'Taksi', summary: 'Anlık araç bulunursa doğrudan yolculuk sağlar.', downside: 'Yoğun saatlerde araç bulma, bagaj alanı ve yolculuk koşulları her araçta aynı değildir.' },
    { name: 'Özel transfer', summary: 'Uçuş veya buluşma bilgisine göre kapıdan kapıya planlanan, araç ve yolcu sayısına göre düzenlenen seçenektir.', downside: 'Önceden talep oluşturmak gerekir; uygunluk ve teklif rotaya, saate ve gruba göre teyit edilir.' },
  ];
}

function routeNotes(route: RouteSeed) {
  const crossing = route.crossContinent
    ? 'Rota yaka geçişi içerdiği için köprü bağlantılarındaki yoğunluk süreyi belirgin biçimde uzatabilir.'
    : 'Rota ana arterlerdeki yoğunluğa göre değişebilir; çıkış saati planlamada önemlidir.';
  return [
    `${route.origin} çıkışında terminal, otel veya adres bilgisi net verildiğinde buluşma planı daha akıcı yapılır.`,
    crossing,
    `${route.destination} çevresindeki dar sokaklar, otel girişleri veya etkinlik saatleri son bölümde ek zaman gerektirebilir.`,
    'Uçuş inişi, bagaj alımı ve gümrük sonrası buluşma süresi için rezervasyon notuna uçuş numarası eklenebilir.',
  ];
}

function faqs(route: RouteSeed) {
  return [
    { question: `${route.origin} ile ${route.destination} arası kaç km?`, answer: `${route.origin} ile ${route.destination} arası yaklaşık ${route.distanceKm} km’dir. Bu değer kullanılan bağlantıya, alınış ve bırakılış adresinin tam konumuna göre küçük farklar gösterebilir. Özellikle terminal çıkışı, otel kapısı veya şehir içindeki tek yön uygulamaları toplam yol mesafesini değiştirebilir; planlamada yaklaşık değer olarak düşünülmelidir.` },
    { question: `${route.origin} – ${route.destination} transferi ne kadar sürer?`, answer: `Normal trafikte yolculuk genellikle ${route.normal[0]}–${route.normal[1]} dakika sürer. Sabah ve akşam yoğunluğu, yağış, etkinlik günleri ve ana arterlerdeki kazalar süreyi ${route.peak[0]}–${route.peak[1]} dakikaya uzatabilir. Randevu veya uçuş bağlantısı varsa, hareket saatini bu değişkenliği hesaba katarak planlamak daha güvenlidir.` },
    { question: 'Yoğun saatte ne kadar erken çıkmalıyım?', answer: `Yoğun saat için en az ${route.peak[1] - route.normal[1] + 20} dakika ek pay bırakmak iyi bir başlangıçtır. Bu rota için güncel trafik koşulları, hava durumu ve terminal/otel çevresindeki erişim dikkate alınmalıdır. Kesin bir varış saati gereken durumlarda, talep formunda hedef saati paylaşın; planlama buna göre yapılabilir.` },
    { question: 'Bagajlı yolcular için hangi ulaşım seçeneği daha pratiktir?', answer: `Bagajlı yolcular için kapıdan kapıya planlanan özel transfer genellikle en pratiktir. Toplu taşıma veya servis alternatiflerinde aktarma, merdiven, durak–otel arası ek ulaşım ve yoğun saatlerde yer bulma gibi adımlar olabilir. Uygun araç kapasitesi için yolcu ve büyük bagaj sayısını teklif talebinde belirtmek yeterlidir.` },
    { question: 'Bu rotada fiyat neden sayfada yazmıyor?', answer: 'Bu rota için sabit bir fiyat sayfada yayımlanmaz. Araç sınıfı, yolcu sayısı, buluşma saati, adres ayrıntısı, bekleme ihtiyacı ve ek hizmetler teklifi etkileyebildiği için net bilgi talep üzerinden hazırlanır. Formdan veya WhatsApp üzerinden güzergâh ve saat bilgisi paylaşarak güncel teklif isteyebilirsiniz.' },
    { question: 'Uçuş gecikirse transfer planı değiştirilebilir mi?', answer: 'Uçuş gecikmesi durumunda plan, paylaşılan uçuş bilgisi ve operasyon uygunluğuna göre güncellenebilir. Rezervasyon notuna uçuş numarası eklemek, iniş saati değiştiğinde durumu daha kolay takip etmeye yardımcı olur. Gecikmeyi fark ettiğiniz anda WhatsApp üzerinden bilgi vermeniz, alternatif planlama için en hızlı yoldur.' },
  ];
}

async function seed() {
  for (const route of ROUTES) {
    const description = `${route.origin} ile ${route.destination} arasında, yolcu sayısı ve planınıza göre organize edilen özel transfer talebi.`;
    await sql`
      INSERT INTO transfer_routes (
        slug, name, origin, destination, distance_km, duration_minutes,
        normal_duration_min_minutes, normal_duration_max_minutes,
        peak_duration_min_minutes, peak_duration_max_minutes, has_cross_continent_passage,
        price_vito_min_eur, price_vito_max_eur, price_sprinter_min_eur, price_sprinter_max_eur,
        image_path, display_order, active, description, intro_paragraph, transport_options, route_notes, faq_items,
        seo_title, seo_description, og_title, og_description, related_service_slug, indexable, created_at, updated_at
      ) VALUES (
        ${route.slug}, ${route.name}, ${route.origin}, ${route.destination}, ${route.distanceKm}, ${route.normal[1]},
        ${route.normal[0]}, ${route.normal[1]}, ${route.peak[0]}, ${route.peak[1]}, ${route.crossContinent},
        0, 0, 0, 0, ${route.imagePath}, ${route.displayOrder}, true, ${description}, ${intro(route)},
        ${sql.json(transportOptions(route))}, ${sql.json(routeNotes(route))}, ${sql.json(faqs(route))},
        ${`${route.name} | Mesafe ve Süre Bilgisi`}, ${intro(route)}, ${route.name}, ${intro(route)}, ${route.relatedServiceSlug}, true, now(), now()
      )
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        origin = EXCLUDED.origin,
        destination = EXCLUDED.destination,
        distance_km = EXCLUDED.distance_km,
        duration_minutes = EXCLUDED.duration_minutes,
        normal_duration_min_minutes = EXCLUDED.normal_duration_min_minutes,
        normal_duration_max_minutes = EXCLUDED.normal_duration_max_minutes,
        peak_duration_min_minutes = EXCLUDED.peak_duration_min_minutes,
        peak_duration_max_minutes = EXCLUDED.peak_duration_max_minutes,
        has_cross_continent_passage = EXCLUDED.has_cross_continent_passage,
        image_path = EXCLUDED.image_path,
        display_order = EXCLUDED.display_order,
        description = EXCLUDED.description,
        intro_paragraph = EXCLUDED.intro_paragraph,
        transport_options = EXCLUDED.transport_options,
        route_notes = EXCLUDED.route_notes,
        faq_items = EXCLUDED.faq_items,
        seo_title = EXCLUDED.seo_title,
        seo_description = EXCLUDED.seo_description,
        og_title = EXCLUDED.og_title,
        og_description = EXCLUDED.og_description,
        related_service_slug = EXCLUDED.related_service_slug,
        updated_at = now()
    `;
  }
  await sql.end();
}

seed().catch(async (error) => {
  console.error('Route page seed failed:', error);
  await sql.end();
  process.exit(1);
});