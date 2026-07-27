import { motion } from 'framer-motion';
import { Phone, Mail, MapPin, Instagram, Facebook, Twitter } from 'lucide-react';

const quickLinks = [
  { label: 'Ana Sayfa', href: '#hero' },
  { label: 'Araçlarımız', href: '#araclar' },
  { label: 'Hizmetlerimiz', href: '#hizmetler' },
  { label: 'Rezervasyon', href: '#rezervasyon' },
  { label: 'İletişim', href: '#iletisim' },
];

const services = [
  'Havalimanı Transferi',
  'Otel Transferi',
  'Şehir Turu',
  'Kurumsal Transfer',
  'Özel Etkinlik Transferi',
  'VIP Gece Transferi',
];

export default function Footer() {
  const handleNavClick = (href: string) => {
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer style={{ background: '#080808', borderTop: '1px solid rgba(201, 168, 76, 0.15)' }} data-testid="footer">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-16 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand Column */}
          <div className="lg:col-span-1">
            <div className="mb-5">
              <div className="text-2xl font-bold tracking-widest uppercase mb-1" style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#C9A84C', letterSpacing: '0.15em' }}>
                VIP Transfer
              </div>
              <div className="text-[10px] tracking-[0.35em] uppercase" style={{ color: '#555', fontFamily: 'Inter, sans-serif' }}>
                Istanbul
              </div>
            </div>
            <p className="text-sm leading-relaxed mb-7" style={{ color: '#666', fontFamily: 'Inter, sans-serif' }}>
              İstanbul&apos;un en güvenilir VIP transfer hizmeti. Lüks Mercedes araçlar, profesyonel sürücüler, 7/24 hizmet.
            </p>

            {/* Social */}
            <div className="flex items-center gap-3" data-testid="footer-social">
              {[
                { icon: Instagram, label: 'Instagram' },
                { icon: Facebook, label: 'Facebook' },
                { icon: Twitter, label: 'Twitter/X' },
              ].map(({ icon: Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  className="w-9 h-9 rounded flex items-center justify-center transition-all duration-300 hover:-translate-y-0.5 hover:border-[#C9A84C]"
                  style={{ background: 'rgba(201, 168, 76, 0.08)', border: '1px solid rgba(201, 168, 76, 0.15)', color: '#888' }}
                  aria-label={label}
                  data-testid={`social-${label.toLowerCase()}`}
                >
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs tracking-[0.2em] uppercase mb-6" style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}>
              Hızlı Bağlantılar
            </h4>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={(e) => { e.preventDefault(); handleNavClick(link.href); }}
                    className="text-sm transition-colors duration-300 hover:text-[#C9A84C] cursor-pointer flex items-center gap-2 group"
                    style={{ color: '#666', fontFamily: 'Inter, sans-serif' }}
                    data-testid={`footer-link-${link.label}`}
                  >
                    <span className="w-4 h-px transition-all duration-300 group-hover:w-6" style={{ background: '#C9A84C', opacity: 0.5 }} />
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-xs tracking-[0.2em] uppercase mb-6" style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}>
              Hizmetlerimiz
            </h4>
            <ul className="space-y-3">
              {services.map((service) => (
                <li key={service}>
                  <span
                    className="text-sm flex items-center gap-2"
                    style={{ color: '#666', fontFamily: 'Inter, sans-serif' }}
                  >
                    <span className="w-4 h-px" style={{ background: 'rgba(201,168,76,0.3)', display: 'inline-block', flexShrink: 0 }} />
                    {service}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-xs tracking-[0.2em] uppercase mb-6" style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}>
              İletişim
            </h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Phone size={15} style={{ color: '#C9A84C', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <p className="text-sm" style={{ color: '#CCC', fontFamily: 'Inter, sans-serif' }}>+90 5XX XXX XX XX</p>
                  <p className="text-xs mt-0.5" style={{ color: '#555', fontFamily: 'Inter, sans-serif' }}>7/24 Açık</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Mail size={15} style={{ color: '#C9A84C', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <p className="text-sm" style={{ color: '#CCC', fontFamily: 'Inter, sans-serif' }}>info@viptransfer.ist</p>
                  <p className="text-xs mt-0.5" style={{ color: '#555', fontFamily: 'Inter, sans-serif' }}>E-posta ile ulaşın</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <MapPin size={15} style={{ color: '#C9A84C', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <p className="text-sm" style={{ color: '#CCC', fontFamily: 'Inter, sans-serif' }}>İstanbul, Türkiye</p>
                  <p className="text-xs mt-0.5" style={{ color: '#555', fontFamily: 'Inter, sans-serif' }}>Tüm İstanbul'a hizmet</p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <motion.div
          className="mt-14 pt-7 flex flex-col md:flex-row items-center justify-between gap-4"
          style={{ borderTop: '1px solid rgba(201, 168, 76, 0.1)' }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          data-testid="footer-bottom"
        >
          <p className="text-xs text-center md:text-left" style={{ color: '#444', fontFamily: 'Inter, sans-serif' }}>
            &copy; {new Date().getFullYear()} VIP Transfer Istanbul. Tüm hakları saklıdır.
          </p>
          <p className="text-xs" style={{ color: '#333', fontFamily: 'Inter, sans-serif' }}>
            İstanbul&apos;un Premium Transfer Hizmeti
          </p>
        </motion.div>
      </div>
    </footer>
  );
}
