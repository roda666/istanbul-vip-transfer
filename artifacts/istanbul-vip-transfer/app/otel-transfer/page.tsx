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
const PAGE = `${BASE}/otel-transfer`;

export const metadata: Metadata = {
  title: 'Otel Transfer İstanbul | Havalimanı–Otel VIP Ulaşım',
  description:
    'İstanbul\'da havalimanından otele, otelden havalimanına ve oteller arası Mercedes VIP transfer hizmeti. Karşılama tabelası ile kapıdan kapıya özel ulaşım.',
  alternates: { canonical: PAGE },
  openGraph: {
    title: 'Otel Transfer İstanbul | Havalimanı–Otel VIP Ulaşım',
    description:
      'İstanbul\'da havalimanından otele, otelden havalimanına ve oteller arası Mercedes VIP transfer hizmeti. Karşılama tabelası ile kapıdan kapıya özel ulaşım.',
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
    { '@type': 'ListItem', position: 3, name: 'Otel Transfer', item: PAGE },
  ],
};

const serviceSchema = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Otel Transfer İstanbul',
  description:
    'İstanbul\'daki tüm otellere ve otellerden havalimanlarına Mercedes Vito ve Sprinter araçlarla kapıdan kapıya VIP transfer hizmeti.',
  provider: {
    '@type': 'LocalBusiness',
    name: 'VIP Transfer Istanbul',
    telephone: SITE.phoneE164,
    email: SITE.email,
  },
  areaServed: { '@type': 'City', name: 'İstanbul' },
  serviceType: 'Hotel Transfer',
};

const faqs = [
  {
    q: 'Uçağım gecikmesi durumunda sürücüm yine beni karşılar mı?',
    a: 'Evet. Rezervasyonunuzda uçuş numaranız yer alıyorsa sürücümüz gerçek zamanlı uçuş takibi yapar ve gecikmenize göre karşılama saatini günceller. Güncellenmiş varış zamanınızı sürücünüze WhatsApp üzerinden de iletebilirsiniz.',
  },
  {
    q: 'Terminalde karşılama tabelası kullanılıyor mu?',
    a: 'Evet, sürücümüz terminaldeki çıkış kapısında isminizin veya şirket adınızın yazılı olduğu bir tabelayla bekler. Böylece sizi tanımak için zaman kaybedilmez.',
  },
  {
    q: 'Birden fazla kişi varsa aynı araçla gidebilir miyiz?',
    a: 'Evet. Grubunuzun büyüklüğüne göre Mercedes Vito veya Sprinter tahsis edilir. Rezervasyon sırasında kişi sayısını ve bagaj miktarını belirtmeniz planlamayı kolaylaştırır.',
  },
  {
    q: 'İstanbul\'daki her otele hizmet veriyor musunuz?',
    a: 'Hem Avrupa hem Anadolu yakasındaki otellere hizmet verilmektedir. Otelinizin adresini rezervasyon sırasında paylaşmanız yeterlidir.',
  },
  {
    q: 'Gece geç saatlerde veya sabah erken transferler mümkün mü?',
    a: 'Evet, hizmetimiz sabah erken ve gece geç saatlerde de çalışır. Önceden rezervasyon yapılması ve saatin netleştirilmesi yeterlidir.',
  },
];

export default function OtelTransferPage() {
  return (
    <>
      <PageHero
        breadcrumbs={[
          { label: 'Ana Sayfa', href: '/' },
          { label: 'Hizmetler', href: '/hizmetler' },
          { label: 'Otel Transfer' },
        ]}
        title="Otel Transfer İstanbul"
        subtitle="Havalimanından otelinize, otelinizden havalimanına ve İstanbul içi otel transferlerinde isim tabelası ile karşılama ve kapıdan kapıya hizmet."
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
                Otelinize İlk Adımdan Sonuncuya Kadar
              </h2>
              <p
                className="text-sm leading-relaxed mb-4"
                style={{ color: '#888', fontFamily: 'Inter, sans-serif' }}
              >
                İstanbul&apos;a varışınızda terminaldeki kalabalıkta taksi aramanız, anlaşmazlık
                yaşamanız ya da uygulama beklemek zorunda kalmanız gerekmez. Sürücümüz çıkış
                kapısında sizi isminizle karşılar, bagajlarınıza yardım eder ve doğrudan otelinize
                götürür.
              </p>
              <p
                className="text-sm leading-relaxed"
                style={{ color: '#888', fontFamily: 'Inter, sans-serif' }}
              >
                Dönüş transferinizde de aynı rahatlık geçerlidir. Uçuş saatinize göre erken alış
                saati planlanır; check-out sonrası bagajlarınızla birlikte havalimanında
                bırakılırsınız.
              </p>
            </div>
            <div className="space-y-4">
              {[
                {
                  title: 'Havalimanı → Otel',
                  desc: 'IST veya SAW\'dan otelinize direkt teslim. İsim tabelası, bagaj yardımı ve uçuş takibi.',
                },
                {
                  title: 'Otel → Havalimanı',
                  desc: 'Uçuş saatinize göre erken planlama ile check-out sonrası konforlu dönüş transferi.',
                },
                {
                  title: 'Oteller Arası Transfer',
                  desc: 'Otel değişikliği veya şehrin farklı noktalarındaki oteller arasında bagajlarla ulaşım.',
                },
                {
                  title: 'Otel Bazlı Şehir Transferleri',
                  desc: 'Otelinizden müze, çarşı veya istediğiniz İstanbul noktasına günlük transferler.',
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
      <section className="py-14 md:py-16" style={{ background: '#0A0A0A' }}>
        <div className="max-w-5xl mx-auto px-5 md:px-8">
          <div
            className="rounded p-8 md:p-10"
            style={{ border: '1px solid rgba(201,168,76,0.15)', background: 'rgba(201,168,76,0.02)' }}
          >
            <p
              className="text-xs tracking-[0.25em] uppercase mb-3"
              style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}
            >
              Kimler İçin Uygundur
            </p>
            <h2
              className="text-xl md:text-2xl font-bold mb-6"
              style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#FFFFFF' }}
            >
              Otel Transfer Hizmeti Kimler İçin Uygundur?
            </h2>
            <ul className="grid md:grid-cols-2 gap-3">
              {[
                'Tatil veya iş seyahati amacıyla İstanbul\'a gelen bireyler ve aileler',
                'Büyük otel grupları ve tur operatörü misafirleri',
                'Kongre, fuar veya etkinlik katılımcıları',
                'Havalimanı transferini kendi düzenlemek istemeyen seyahat acenteleri',
                'İstanbul\'da otel değiştiren misafirler',
                'Gece geç ya da sabah erken uçuşu olan yolcular',
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm"
                  style={{ color: '#888', fontFamily: 'Inter, sans-serif' }}
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
      <section className="py-14 md:py-16" style={{ background: '#0D0D0D' }}>
        <div className="max-w-3xl mx-auto px-5 md:px-8">
          <p
            className="text-xs tracking-[0.25em] uppercase mb-3 text-center"
            style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}
          >
            Süreç
          </p>
          <h2
            className="text-xl md:text-2xl font-bold mb-8 text-center"
            style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#FFFFFF' }}
          >
            Transfer Süreci Nasıl İşler?
          </h2>
          <ol className="space-y-5">
            {[
              { n: '01', text: 'WhatsApp üzerinden uçuş numaranızı veya tahmini varış saatinizi ve otel adresinizi paylaşın.' },
              { n: '02', text: 'Grubunuzun büyüklüğüne uygun Mercedes Vito veya Sprinter tahsis edilir; sürücü bilgileri önceden iletilir.' },
              { n: '03', text: 'Sürücünüz terminaldeki çıkış kapısında isim tabelasıyla sizi karşılar ve bagajlarınıza yardım eder.' },
              { n: '04', text: 'Otelinize doğrudan ulaşırsınız. Dönüş transferiniz için de aynı süreç aynı kolaylıkla işler.' },
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
                  style={{ color: '#888', fontFamily: 'Inter, sans-serif' }}
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
      <section className="py-14 md:py-16" style={{ background: '#0D0D0D' }}>
        <div className="max-w-5xl mx-auto px-5 md:px-8">
          <p
            className="text-xs tracking-[0.25em] uppercase mb-6 text-center"
            style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}
          >
            İlgili Hizmetler
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { label: 'İstanbul Havalimanı Transfer', href: '/istanbul-havalimani-transfer' },
              { label: 'Sabiha Gökçen Transfer', href: '/sabiha-gokcen-havalimani-transfer' },
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
