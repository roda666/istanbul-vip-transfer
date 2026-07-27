import { useEffect } from 'react';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import BookingForm from '@/components/BookingForm';
import VehicleFleet from '@/components/VehicleFleet';
import Services from '@/components/Services';
import TrustSignals from '@/components/TrustSignals';
import Reviews from '@/components/Reviews';
import FAQ from '@/components/FAQ';
import Contact from '@/components/Contact';
import Footer from '@/components/Footer';
import WhatsAppFloat from '@/components/WhatsAppFloat';

function App() {
  useEffect(() => {
    document.title = 'İstanbul VIP Havalimanı Transfer | Mercedes ile Lüks Yolculuk';

    const metaDesc = document.querySelector('meta[name="description"]') || document.createElement('meta');
    metaDesc.setAttribute('name', 'description');
    metaDesc.setAttribute('content', 'İstanbul\'un en güvenilir VIP havalimanı transfer hizmeti. Mercedes Vito ve Sprinter ile İstanbul Havalimanı ve Sabiha Gökçen\'den 7/24 lüks, sabit fiyatlı transfer. Hemen WhatsApp ile rezervasyon yapın.');
    if (!document.querySelector('meta[name="description"]')) {
      document.head.appendChild(metaDesc);
    }

    const metaKeywords = document.querySelector('meta[name="keywords"]') || document.createElement('meta');
    metaKeywords.setAttribute('name', 'keywords');
    metaKeywords.setAttribute('content', 'istanbul havalimanı transfer, vip transfer istanbul, mercedes transfer istanbul, özel transfer istanbul, sabiha gökçen transfer');
    if (!document.querySelector('meta[name="keywords"]')) {
      document.head.appendChild(metaKeywords);
    }
  }, []);

  return (
    <div className="grain-overlay" style={{ background: '#0A0A0A', minHeight: '100dvh' }}>
      <Header />
      <main>
        <Hero />
        <BookingForm />
        <VehicleFleet />
        <Services />
        <TrustSignals />
        <Reviews />
        <FAQ />
        <Contact />
      </main>
      <Footer />
      <WhatsAppFloat />
    </div>
  );
}

export default App;
