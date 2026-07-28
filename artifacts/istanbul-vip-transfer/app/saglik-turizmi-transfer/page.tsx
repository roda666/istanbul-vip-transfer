import type { Metadata } from 'next';
import Link from 'next/link';
import PageHero from '@/components/PageHero';
import BookingForm from '@/components/BookingForm';
import VehicleFleet from '@/components/VehicleFleet';
import Contact from '@/components/Contact';
import ServiceFAQ from '@/components/ServiceFAQ';
import { SITE } from '@/lib/site-config';

const DRAFT = false;

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/saglik-turizmi-transfer`;

export const metadata: Metadata = {
  title: 'Sağlık Turizmi Transfer İstanbul | Hastane VIP Ulaşım',
  description:
    'İstanbul\'a sağlık turizmi amacıyla gelen hastalar için havalimanından hastaneye, klinikten otele ve randevular arası özel Mercedes transfer hizmeti.',
  alternates: { canonical: PAGE },
  openGraph: {
    title: 'Sağlık Turizmi Transfer İstanbul | Hastane VIP Ulaşım',
    description:
      'İstanbul\'a sağlık turizmi amacıyla gelen hastalar için havalimanından hastaneye, klinikten otele ve randevular arası özel Mercedes transfer hizmeti.',
    url: PAGE,
    siteName: 'VIP Transfer Istanbul',
    locale: 'tr_TR',
    type: 'website',
  },
  robots: DRAFT
    ? { index: false, follow: true }
    : { index: true, follow: true },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: BASE },
    { '@type': 'ListItem', position: 2, name: 'Hizmetler', item: `${BASE}/hizmetler` },
    { '@type': 'ListItem', position: 3, name: 'Sağlık Turizmi Transfer', item: PAGE },
  ],
};

const serviceSchema = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Sağlık Turizmi Transfer İstanbul',
  description:
    'İstanbul\'daki hastane, klinik ve tedavi merkezlerine havalimanı karşılama, randevular arası ve otel transferlerini kapsayan özel ulaşım hizmeti.',
  provider: {
    '@type': 'LocalBusiness',
    name: 'VIP Transfer Istanbul',
    telephone: SITE.phoneE164,
    email: SITE.email,
  },
  areaServed: { '@type': 'City', name: 'İstanbul' },
  serviceType: 'Medical Tourism Transfer',
};

const faqs = [
  {
    q: 'Tedavi sürecim birkaç gün sürüyor. Her gün aynı sürücüyü talep edebilir miyim?',
    a: 'Tercih ettiğiniz sürücü bildirilirse müsaitlik durumuna göre aynı sürücüyle devam edilmeye çalışılır. Değişiklik gerektiğinde önceden bilgilendirme yapılır.',
  },
  {
    q: 'Tekerlekli sandalye kullanan bir hasta için uygun araç mevcut mu?',
    a: 'Sprinter aracı geniş iç hacmiyle tekerlekli sandalye ve medikal ekipmanın taşınmasına elverişlidir. Özel ihtiyacınızı rezervasyon aşamasında belirtmeniz planlamayı kolaylaştırır.',
  },
  {
    q: 'Hastanede bekleme süresi uzarsa sürücü ne kadar bekler?',
    a: 'Ameliyat veya tedavi süresinin uzaması durumunda sürücünüzle WhatsApp üzerinden iletişim kurularak bekleyiş düzenlenir. Gereksiz beklemeyi önlemek için önceden yaklaşık süre bilgisi paylaşmanız yeterlidir.',
  },
  {
    q: 'Yurt dışından geliyorum; sürücünüz İngilizce veya Arapça konuşabiliyor mu?',
    a: 'Temel düzeyde iletişim sağlanabilmektedir. Karmaşık bilgilendirme için WhatsApp yazışmasıyla seyahat öncesinde detaylar açıkça paylaşılabilir; bu yöntem en güvenilir iletişim biçimidir.',
  },
  {
    q: 'Sadece hastane adını biliyorum, adres elimde yok. Yine de yönlendirilebilir miyim?',
    a: 'Evet. Hastane veya klinik adını paylaşmanız yeterlidir. Sürücünüz güncel navigasyon sistemleri aracılığıyla doğru adresi belirler.',
  },
];

export default function SaglikTurizmiTransferPage() {
  return (
    <>
      <PageHero
        breadcrumbs={[
          { label: 'Ana Sayfa', href: '/' },
          { label: 'Hizmetler', href: '/hizmetler' },
          { label: 'Sağlık Turizmi Transfer' },
        ]}
        title="Sağlık Turizmi Transfer İstanbul"
        subtitle="Hastane, klinik ve tedavi merkezlerine havalimanından karşılama, randevular arası ve otel–hastane gidiş-dönüş transferleri."
      />

      {/* ── Hizmet Tanımı ── */}
      <section className="py-16 md:py-20" style={{ background: '#0D0D0D' }}>
        <div className="max-w-5xl mx-auto px-5 md:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div>
              <p
                className="text-xs tracking-[0.25em] uppercase mb-3"
                style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}
              >
                Hizmet Hakkında
              </p>
              <h2
                className="text-2xl md:text-3xl font-bold mb-5"
                style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#FFFFFF' }}
              >
                Tedavi Sürecinizde Güvenilir Ulaşım
              </h2>
              <p
                className="text-sm leading-relaxed mb-4"
                style={{ color: '#888', fontFamily: 'Inter, sans-serif' }}
              >
                Sağlık turizmi amacıyla İstanbul&apos;a gelen misafirler için havalimanından doğrudan
                hastaneye veya otele, iki randevu arasında klinike, tedavi sonrasında tekrar konaklamaya
                — tüm transferler tek koordinasyonla yürütülür. Sürücünüz isim tabelasıyla karşılar,
                bagajlarınıza yardım eder ve sakin, konforlu bir ortam sağlar.
              </p>
              <p
                className="text-sm leading-relaxed"
                style={{ color: '#888', fontFamily: 'Inter, sans-serif' }}
              >
                Tedavi süreçleri zaman zaman uzayabilir veya değişebilir. Bu nedenle sürücülerimiz
                esnek bekleme planlamasına alışkındır ve gelişmeleri WhatsApp üzerinden anlık takip eder.
              </p>
            </div>
            <div className="space-y-4">
              {[
                {
                  title: 'Havalimanı → Hastane / Klinik',
                  desc: 'IST veya SAW\'dan direkt olarak tedavi merkezinize karşılama ve transfer.',
                },
                {
                  title: 'Klinik → Otel / Konaklama',
                  desc: 'Tedavi veya operasyon sonrası otelinize ya da konakladığınız adrese güvenli ulaşım.',
                },
                {
                  title: 'Randevular Arası Transfer',
                  desc: 'İki farklı klinik, laboratuvar veya kontrol noktası arasındaki gün içi transferler.',
                },
                {
                  title: 'Günlük Tekrarlayan Transferler',
                  desc: 'Birkaç günlük tedavi programı kapsamında otel–hastane gidiş-dönüş.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="p-4 rounded"
                  style={{ border: '1px solid rgba(201,168,76,0.12)', background: 'rgba(201,168,76,0.03)' }}
                >
                  <p
                    className="text-sm font-medium mb-1"
                    style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}
                  >
                    {item.title}
                  </p>
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: '#777', fontFamily: 'Inter, sans-serif' }}
                  >
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Kimler için ── */}
      <section className="py-14 md:py-16" style={{ background: '#EDF3F7' }}>
        <div className="max-w-5xl mx-auto px-5 md:px-8">
          <div
            className="rounded p-8 md:p-10"
            style={{ border: '1px solid rgba(199,154,50,0.2)', background: '#FFFDF8' }}
          >
            <p
              className="text-xs tracking-[0.25em] uppercase mb-3"
              style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}
            >
              Kimler İçin Uygundur
            </p>
            <h2
              className="text-xl md:text-2xl font-bold mb-6"
              style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#183247' }}
            >
              Bu Hizmet Kimler İçin Tasarlandı?
            </h2>
            <ul className="grid md:grid-cols-2 gap-3">
              {[
                'Cerrahi operasyon, diş tedavisi veya estetik prosedür için İstanbul\'a gelen hastalar',
                'Saç ekimi, göz ameliyatı ve diğer tıbbi prosedürler için gelen misafirler',
                'Çeşitli kontrollere birden fazla kez gelecek olan hastalar',
                'Yurt dışından gelen ve Türkçe bilmeyen sağlık turizmi misafirleri',
                'Hasta ile birlikte seyahat eden refakatçiler',
                'Tur operatörleri ve sağlık turizmi acenteleri',
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm"
                  style={{ color: '#304A5E', fontFamily: 'Inter, sans-serif' }}
                >
                  <span
                    className="mt-1.5 flex-shrink-0 rounded-full"
                    style={{ width: '5px', height: '5px', background: '#C9A84C' }}
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Nasıl Çalışır ── */}
      <section className="py-14 md:py-16" style={{ background: '#F7F5EF' }}>
        <div className="max-w-3xl mx-auto px-5 md:px-8">
          <p
            className="text-xs tracking-[0.25em] uppercase mb-3 text-center"
            style={{ color: '#C99A32', fontFamily: 'Inter, sans-serif' }}
          >
            Rezervasyon
          </p>
          <h2
            className="text-xl md:text-2xl font-bold mb-8 text-center"
            style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#183247' }}
          >
            Transfer Nasıl Planlanır?
          </h2>
          <ol className="space-y-5">
            {[
              { n: '01', text: 'WhatsApp üzerinden klinik veya hastane adı, tarih ve varış saatinizi paylaşın. Karşılamada kullanılacak isim de belirtilmelidir.' },
              { n: '02', text: 'Grubunuza ve bagaj durumuna göre Mercedes Vito veya Sprinter tahsis edilir; Sprinter özellikle ekstra alan gerektiren durumlar için uygundur.' },
              { n: '03', text: 'Sürücünüz terminalde isim tabelasıyla sizi karşılar; sakin ve konforlu bir ortamda doğrudan tedavi merkezinize götürür.' },
              { n: '04', text: 'Tedavi süresi değişirse sürücünüzle WhatsApp üzerinden anlık iletişim kurularak bekleyiş planı güncellenir.' },
            ].map((step) => (
              <li key={step.n} className="flex gap-5 items-start">
                <span
                  className="text-lg font-bold flex-shrink-0"
                  style={{ color: 'rgba(201,168,76,0.4)', fontFamily: 'Playfair Display, Georgia, serif', minWidth: '2rem' }}
                >
                  {step.n}
                </span>
                <p
                  className="text-sm leading-relaxed pt-1"
                  style={{ color: '#304A5E', fontFamily: 'Inter, sans-serif' }}
                >
                  {step.text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <VehicleFleet />
      <BookingForm />
      <ServiceFAQ items={faqs} />

      {/* ── İlgili Hizmetler ── */}
      <section className="py-14 md:py-16" style={{ background: '#EDF3F7' }}>
        <div className="max-w-5xl mx-auto px-5 md:px-8">
          <p
            className="text-xs tracking-[0.25em] uppercase mb-6 text-center"
            style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}
          >
            İlgili Hizmetler
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { label: 'Otel Transfer', href: '/otel-transfer' },
              { label: 'İstanbul Havalimanı Transfer', href: '/istanbul-havalimani-transfer' },
              { label: 'Tüm Hizmetler', href: '/hizmetler' },
              { label: 'İletişim', href: '/iletisim' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-5 py-2.5 rounded text-xs tracking-wider uppercase transition-colors duration-200 hover:bg-[#C9A84C]/10"
                style={{
                  border: '1px solid rgba(201,168,76,0.25)',
                  color: '#C9A84C',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Contact />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
    </>
  );
}
