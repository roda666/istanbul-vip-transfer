import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/i18n/seo';
import { getPublishedServicePageLangs } from '@/lib/service-page-cms';
import Link from 'next/link';
import TrServicePageHero from '@/components/TrServicePageHero';
import BookingForm from '@/components/BookingForm';
import VehicleFleet from '@/components/VehicleFleet';
import Contact from '@/components/Contact';
import ServiceFAQ from '@/components/ServiceFAQ';
import { SITE } from '@/lib/site-config';

const DRAFT = false;

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/soforlu-arac-kiralama`;

export async function generateMetadata(): Promise<Metadata> {
  const publishedLangs = await getPublishedServicePageLangs('soforlu-arac-kiralama');
  const alts = await buildAlternates('/soforlu-arac-kiralama', publishedLangs);
  return {
    title: 'Şoförlü Araç Kiralama İstanbul | Günlük VIP Şoför Hizmeti',
    description:
      'İstanbul\'da şoförlü araç kiralama hizmeti. Saatlik veya günlük olarak Mercedes Vito veya Sprinter ile toplantı, alışveriş ve etkinlik transferleri.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: 'Şoförlü Araç Kiralama İstanbul | Günlük VIP Şoför Hizmeti',
      description:
        'İstanbul\'da şoförlü araç kiralama hizmeti. Saatlik veya günlük olarak Mercedes Vito veya Sprinter ile toplantı, alışveriş ve etkinlik transferleri.',
      url: PAGE,
      siteName: 'VIP Transfer Istanbul',
      locale: 'tr_TR',
      type: 'website',
      images: [SITE.ogImage],
    },
    robots: DRAFT
      ? { index: false, follow: true }
      : { index: true, follow: true },
  };
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: BASE },
    { '@type': 'ListItem', position: 2, name: 'Hizmetler', item: `${BASE}/hizmetler` },
    { '@type': 'ListItem', position: 3, name: 'Şoförlü Araç Kiralama', item: PAGE },
  ],
};

const serviceSchema = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Şoförlü Araç Kiralama İstanbul',
  description:
    'İstanbul genelinde saatlik veya günlük şoförlü araç kiralama hizmeti. Mercedes Vito ve Sprinter ile toplantı, alışveriş, etkinlik ve şehir içi transferler.',
  provider: {
    '@type': 'LocalBusiness',
    name: 'VIP Transfer Istanbul',
    telephone: SITE.phoneE164,
    email: SITE.email,
  },
  areaServed: { '@type': 'City', name: 'İstanbul' },
  serviceType: 'Chauffeur Service',
};

const faqs = [
  {
    q: 'Şoförlü araç kiralama için en az kaç saat hizmet alabiliyorum?',
    a: 'Hizmet süresi ihtiyacınıza göre belirlenir. Yarım günlük ve tam günlük seçeneklerin yanı sıra belirli rota bazlı transferler de düzenlenebilir. WhatsApp üzerinden güzergah ve süre paylaşılarak en uygun düzenleme yapılır.',
  },
  {
    q: 'Araç kiralama sırasında sürücüm beni bekler mi?',
    a: 'Evet. Şoförünüz siz toplantınızda, alışverişinizde veya restoranınızdayken araçla o noktada bekler. Ek gizli maliyet yoktur; durumunuzdaki değişikliği WhatsApp üzerinden iletebilirsiniz.',
  },
  {
    q: 'Birden fazla durak veya güzergah değişikliği yapabilir miyim?',
    a: 'Evet, gün içinde dilediğiniz kadar durak ekleyebilirsiniz. Sürücünüz tamamen sizin planınıza göre hareket eder; önceden her noktayı belirlemeniz gerekmez.',
  },
  {
    q: 'Büyük valiz veya alışveriş çantam için yeterli bagaj alanı var mı?',
    a: 'Mercedes Vito ve Sprinter her ikisi de geniş bagaj kapasitesine sahiptir. Özellikle Sprinter, büyük gruplar veya çok sayıda bagaj için tercih edilmektedir. Özel yük durumları rezervasyon sırasında belirtilmelidir.',
  },
  {
    q: 'Toplantım veya randevum planlanandan erken ya da geç biterse ne olur?',
    a: 'Planınız değiştiğinde sürücünüzle doğrudan WhatsApp üzerinden iletişime geçerek saati güncelleyebilirsiniz. Sürücünüz esneklikle hareket eder.',
  },
];

export default function SoforluAracKiralamaPage() {
  return (
    <>
      <TrServicePageHero slug="soforlu-arac-kiralama" pageKey="soforlu" />

      {/* ── Hizmet Tanımı ── */}
      <section className="py-16 md:py-20" style={{ background: '#EEF3F9' }}>
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
                style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43' }}
              >
                Kendi Programınıza Göre Çalışan Bir Araç
              </h2>
              <p
                className="text-sm leading-relaxed mb-4"
                style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}
              >
                Şoförlü araç kiralama hizmetimizde belirlediğiniz süre boyunca tek bir araç ve tek
                bir sürücü yalnızca sizin için çalışır. Toplantıdan toplantıya, alışveriş
                merkezinden otele, havalimanından etkinlik alanına — güzergahı siz belirlersiniz,
                sürücünüz uygular.
              </p>
              <p
                className="text-sm leading-relaxed"
                style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}
              >
                Taksimetre ya da havuz sistemine bağlı olmadığından araç siz dönene kadar
                bekler. İstanbul trafiğini yönetmek, park yeri aramak veya uygulama üzerinden
                araç çağırmak yerine zamanınızı işinize ayırabilirsiniz.
              </p>
            </div>
            <div className="space-y-4">
              {[
                {
                  title: 'İş Seyahatleri',
                  desc: 'Aynı günde birden fazla toplantı veya ziyaret noktası olan iş insanları için şehir içi koordinasyon.',
                },
                {
                  title: 'Şehir Turu ve Turizm',
                  desc: 'Galata, Kapalıçarşı, Boğaz, Adalar gibi İstanbul noktalarına kendi temponuzda özel rehberli olmayan seyahat.',
                },
                {
                  title: 'Alışveriş Transferleri',
                  desc: 'Nişantaşı, Bağcılar, Forum İstanbul gibi alışveriş güzergahlarında bagajlarla birlikte konforlu ulaşım.',
                },
                {
                  title: 'Özel Etkinlikler',
                  desc: 'Düğün, nişan, mezuniyet veya özel kutlamalar için özel araç ve sürücü tahsisi.',
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
                    style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}
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
              Şoförlü Kiralama Kimler İçin Uygun?
            </h2>
            <ul className="grid md:grid-cols-2 gap-3">
              {[
                'Birden fazla iş randevusu olan yöneticiler ve iş insanları',
                'İstanbul\'u özgün bir programla gezmek isteyen yabancı ziyaretçiler',
                'Alışveriş veya kişisel program planlayanlar',
                'Özel etkinlik veya kutlama sahipleri',
                'Türkiye\'ye ilk kez gelen ve şehri keşfetmek isteyen aileler',
                'Havalimanı bağlantısını gün içi planına entegre etmek isteyenler',
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
            Nasıl Rezervasyon Yapılır?
          </h2>
          <ol className="space-y-5">
            {[
              { n: '01', text: 'WhatsApp veya telefon ile ulaşın ve tarih, saat ve güzergah bilgilerini paylaşın.' },
              { n: '02', text: 'Grubunuzun büyüklüğüne göre Mercedes Vito veya Sprinter tahsis edilir.' },
              { n: '03', text: 'Belirttiğiniz adrese veya havalimanına belirlenen saatte gelir.' },
              { n: '04', text: 'Gün boyunca sürücünüz sizinle iletişimde kalır; plan değişikliklerine anında uyum sağlar.' },
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
              { label: 'Kurumsal VIP Transfer', href: '/kurumsal-vip-transfer' },
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
