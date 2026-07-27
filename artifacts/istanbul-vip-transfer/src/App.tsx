import { useEffect } from 'react';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import BookingForm from '@/components/BookingForm';
import VehicleFleet from '@/components/VehicleFleet';
import Services from '@/components/Services';
import TrustSignals from '@/components/TrustSignals';
import FAQ from '@/components/FAQ';
import Contact from '@/components/Contact';
import Footer from '@/components/Footer';
import WhatsAppFloat from '@/components/WhatsAppFloat';

function App() {
  useEffect(() => {
    document.title = 'İstanbul VIP Havalimanı Transfer | Mercedes ile Lüks Yolculuk';

    const metaDesc = document.querySelector('meta[name="description"]') || document.createElement('meta');
    metaDesc.setAttribute('name', 'description');
    metaDesc.setAttribute('content', 'İstanbul VIP havalimanı transfer hizmeti. Mercedes Vito ve Sprinter VIP ile İstanbul Havalimanı (IST) ve Sabiha Gökçen (SAW) transferleri. 7/24 WhatsApp ile rezervasyon.');
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
        <FAQ />
        <Contact />
      </main>
      <Footer />
      <WhatsAppFloat />
    </div>
  );
}

export default App;
