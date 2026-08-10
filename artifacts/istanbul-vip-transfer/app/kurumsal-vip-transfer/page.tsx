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
const PAGE = `${BASE}/kurumsal-vip-transfer`;

export const metadata: Metadata = {
  title: 'Kurumsal VIP Transfer İstanbul | Faturalı Şirket Transferi',
  description:
    'İstanbul\'da kurumsal VIP transfer hizmeti. Yönetici ve iş misafiri transferlerinde fatura düzenleme, karşılama tabelası ve Mercedes araç tahsisi.',
  alternates: { canonical: PAGE },
  openGraph: {
    title: 'Kurumsal VIP Transfer İstanbul | Faturalı Şirket Transferi',
    description:
      'İstanbul\'da kurumsal VIP transfer hizmeti. Yönetici ve iş misafiri transferlerinde fatura düzenleme, karşılama tabelası ve Mercedes araç tahsisi.',
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

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: BASE },
    { '@type': 'ListItem', position: 2, name: 'Hizmetler', item: `${BASE}/hizmetler` },
    { '@type': 'ListItem', position: 3, name: 'Kurumsal VIP Transfer', item: PAGE },
  ],
};

const serviceSchema = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Kurumsal VIP Transfer İstanbul',
  description:
    'Şirketler ve kurumlar için İstanbul\'da yönetici transferleri, misafir karşılama, çoklu rezervasyon koordinasyonu ve fatura desteği içeren profesyonel transfer hizmeti.',
  provider: {
    '@type': 'LocalBusiness',
    name: 'VIP Transfer Istanbul',
    telephone: SITE.phoneE164,
    email: SITE.email,
  },
  areaServed: { '@type': 'City', name: 'İstanbul' },
  serviceType: 'Corporate Transfer',
};

const faqs = [
  {
    q: 'Kurumsal transferlerde fatura düzenleyebiliyor musunuz?',
    a: 'Evet, kurumsal müşterilerimize fatura düzenlenmektedir. Rezervasyon sırasında şirket unvanı, vergi dairesi ve vergi numarası bilgilerini paylaşmanız yeterlidir.',
  },
  {
    q: 'Birden fazla yöneticimiz aynı gün farklı transferlere ihtiyaç duyuyor. Koordinasyon sağlanabilir mi?',
    a: 'Evet. Birden fazla araç ve sürücü için önceden planlama yapılabilir. Saatler, güzergahlar ve kişi bilgileri önceden paylaşıldığında koordinasyon kolaylıkla sağlanır.',
  },
  {
    q: 'Yurt dışından gelen iş misafirimiz İngilizce konuşuyor. Karşılama nasıl gerçekleşecek?',
    a: 'Sürücümüz terminalde isim veya şirket adının yazılı olduğu tabelayla bekler. Temel İngilizce iletişim sağlanabilir. Misafirinizin özel ihtiyaçları için seyahat öncesinde WhatsApp üzerinden koordinasyon yapılması önerilir.',
  },
  {
    q: 'Transfer ücretini şirket olarak ödeyebilir miyiz?',
    a: 'Ödeme koşulları kurumsal ihtiyaca göre şekillenir. Fatura düzenlemesi ve ödeme sürecine ilişkin detaylar rezervasyon öncesinde paylaşılarak netleştirilir.',
  },
  {
    q: 'Toplantı beklenenden erken biterse ya da uzarsa sürücü esnek davranabilir mi?',
    a: 'Evet. Toplantı süreniz değiştiğinde sürücünüzle doğrudan iletişim kurularak bekleyiş planı güncellenir. Kurumsal hizmetimizde esneklik temel bir unsurdur.',
  },
];

export default function KurumsalVipTransferPage() {
  return (
    <>
      <PageHero pageKey="kurumsal" />

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
                Şirketiniz Adına Profesyonel Transfer
              </h2>
              <p
                className="text-sm leading-relaxed mb-4"
                style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}
              >
                İstanbul&apos;da iş bağlantılarınızı en iyi izlenimi bırakarak karşılamak için kurumsal
                transfer hizmetimiz; uçuş takibi, isim tabelasıyla karşılama, doğrudan toplantı
                yerine ya da otele transfer ve şirket adına fatura düzenlemeyi tek kapsamda sunar.
              </p>
              <p
                className="text-sm leading-relaxed"
                style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}
              >
                Sekreter veya toplantı koordinatörü üzerinden ön planlama yapılabilir. Birden fazla
                araç gerektiren organizasyonlarda çoklu rezervasyon koordinasyonu sağlanır.
              </p>
            </div>
            <div className="space-y-4">
              {[
                {
                  title: 'Yönetici Transferleri',
                  desc: 'CEO, genel müdür veya üst düzey yöneticiler için düzenli şehir içi ve havalimanı transferleri.',
                },
                {
                  title: 'İş Misafiri Karşılama',
                  desc: 'Yurt içi ve yurt dışı iş misafirlerini havalimanında tabelayla karşılama ve doğrudan toplantı noktasına transfer.',
                },
                {
                  title: 'Çoklu Rezervasyon Organizasyonu',
                  desc: 'Konferans, zirve veya fuar gibi birden fazla katılımcının olduğu organizasyonlar için koordineli araç tahsisi.',
                },
                {
                  title: 'Fatura Düzenleme',
                  desc: 'Şirket muhasebe sürecinizle uyumlu fatura desteği. Kurumsal vergi numarasıyla kesim yapılır.',
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
              Kurumsal Transfer Kimler İçin Tasarlandı?
            </h2>
            <ul className="grid md:grid-cols-2 gap-3">
              {[
                'Düzenli yönetici transferine ihtiyaç duyan şirket ve kurumlar',
                'Yabancı iş ortakları veya yatırımcıları karşılamak isteyen firmalar',
                'Kongre, fuar veya zirve organizatörleri',
                'Çoklu transfer koordinasyonu gerektiren etkinlik planlayıcıları',
                'Muhasebe uyumlu fatura isteyen kurumsal satın alma departmanları',
                'İstanbul üzerinden şehirlerarası iş transferi planlayan şirketler',
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
            Süreç
          </p>
          <h2
            className="text-xl md:text-2xl font-bold mb-8 text-center"
            style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#183247' }}
          >
            Kurumsal Transfer Süreci
          </h2>
          <ol className="space-y-5">
            {[
              { n: '01', text: 'WhatsApp veya telefon aracılığıyla tarih, saat, kişi sayısı ve güzergah bilgilerini paylaşın. Fatura için şirket bilgilerinizi de iletebilirsiniz.' },
              { n: '02', text: 'Yolcu sayısı ve organizasyonun kapsamına göre uygun araç veya araçlar tahsis edilir; sürücü ve araç bilgisi önceden bildirilir.' },
              { n: '03', text: 'Sürücünüz havalimanında isim veya şirket tabelasıyla karşılar; toplantı noktasına ya da otele doğrudan transfer sağlanır.' },
              { n: '04', text: 'Hizmet tamamlandıktan sonra kurumsal fatura düzenlenerek şirket adresine iletilir.' },
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
              { label: 'Şoförlü Araç Kiralama', href: '/soforlu-arac-kiralama' },
              { label: 'İstanbul Havalimanı Transfer', href: '/istanbul-havalimani-transfer' },
              { label: 'Şehirler Arası Transfer', href: '/sehirler-arasi-transfer' },
              { label: 'Tüm Hizmetler', href: '/hizmetler' },
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
