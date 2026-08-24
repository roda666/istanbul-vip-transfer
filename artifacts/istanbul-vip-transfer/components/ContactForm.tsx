'use client';

/**
 * ContactForm — general enquiry form for the İletişim page.
 * Submits to POST /data/contact (distinct from the booking form).
 * Labels/text come from the dictionary so all 9 locales work.
 */
import { useState, useRef, useEffect } from 'react';
import { useLang } from '@/lib/i18n/context';
import { trackEvent } from '@/lib/analytics';
import { localePath } from '@/lib/locale-path';

interface FormState {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

const INIT: FormState = { name: '', email: '', phone: '', subject: '', message: '' };

export default function ContactForm() {
  const { dict, lang } = useLang();
  const cf = dict.contactForm;

  const [form, setForm]       = useState<FormState>(INIT);
  const [errors, setErrors]   = useState<Partial<FormState>>({});
  const [status, setStatus]   = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [serverError, setServerError] = useState('');
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const websiteHoneypotRef = useRef<HTMLInputElement>(null);
  const companyHoneypotRef = useRef<HTMLInputElement>(null);
  const [formGuardToken, setFormGuardToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/data/form-guard?form=contact', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { token?: string } | null) => {
        if (active && data?.token) setFormGuardToken(data.token);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  function validate(): boolean {
    const e: Partial<FormState> = {};
    if (!form.name.trim())                             e.name    = cf.requiredName;
    if (!form.email.trim())                            e.email   = cf.requiredEmail;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = cf.invalidEmail;
    if (!form.subject.trim())                          e.subject = cf.requiredSubject;
    if (!form.message.trim())                          e.message = cf.requiredMessage;
    else if (form.message.trim().length < 10)          e.message = cf.minMessage;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setStatus('submitting');
    setServerError('');

    try {
      const res = await fetch('/data/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    form.name.trim(),
          email:   form.email.trim(),
          phone:   form.phone.trim(),
          subject: form.subject.trim(),
          message: form.message.trim(),
          locale:  lang,
          newsletterConsent,
           formGuardToken,
           website: websiteHoneypotRef.current?.value ?? '',
           company: companyHoneypotRef.current?.value ?? '',
        }),
      });

      if (res.status === 429) {
        setServerError(cf.rateLimit);
        setStatus('error');
        return;
      }
      if (!res.ok) {
        setServerError(cf.errorMessage);
        setStatus('error');
        return;
      }
      setStatus('success');
      setForm(INIT);
      // GA4: contact form successfully submitted
      trackEvent('contact_form_submit', {
        page_path: window.location.pathname,
      });
    } catch {
      setServerError(cf.errorMessage);
      setStatus('error');
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormState]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  }

  if (status === 'success') {
    return (
      <div style={{
        background: '#f0fdf4',
        border: '1px solid #86efac',
        borderRadius: '12px',
        padding: '2rem',
        textAlign: 'center',
        maxWidth: '560px',
        margin: '0 auto',
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</div>
        <h3 style={{ color: '#15803d', fontWeight: 700, fontSize: '1.2rem', marginBottom: '0.5rem' }}>
          {cf.successTitle}
        </h3>
        <p style={{ color: '#166534', fontSize: '0.95rem' }}>{cf.successMessage}</p>
      </div>
    );
  }

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '1rem',
    background: '#fff',
    color: '#111',
    outline: 'none',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  };
  const errorStyle: React.CSSProperties = {
    color: '#dc2626',
    fontSize: '0.8rem',
    marginTop: '0.25rem',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontWeight: 600,
    fontSize: '0.9rem',
    color: '#374151',
    marginBottom: '0.35rem',
  };

  return (
    <section style={{ padding: '4rem 1.5rem', background: '#f8fafc' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        {/* Header */}
        <p style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.12em', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
          {cf.sectionLabel}
        </p>
        <h2 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', fontWeight: 800, color: '#111', marginBottom: '0.6rem' }}>
          {cf.heading}
        </h2>
        <p style={{ color: '#6b7280', fontSize: '0.97rem', marginBottom: '2rem', lineHeight: 1.6 }}>
          {cf.subheading}
        </p>

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Honeypots — hidden from humans, filled only by bots */}
          <input
            ref={websiteHoneypotRef}
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="url"
            style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0 }}
            aria-hidden="true"
          />
          <input
            ref={companyHoneypotRef}
            name="company"
            type="text"
            tabIndex={-1}
            autoComplete="organization"
            style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0 }}
            aria-hidden="true"
          />

          {/* Name */}
          <div>
            <label htmlFor="cf-name" style={labelStyle}>{cf.nameLabel} *</label>
            <input
              id="cf-name"
              name="name"
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={handleChange}
              placeholder={cf.namePlaceholder}
              style={{ ...fieldStyle, borderColor: errors.name ? '#dc2626' : '#d1d5db' }}
            />
            {errors.name && <p style={errorStyle}>{errors.name}</p>}
          </div>

          {/* Email + Phone row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label htmlFor="cf-email" style={labelStyle}>{cf.emailLabel} *</label>
              <input
                id="cf-email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                placeholder={cf.emailPlaceholder}
                style={{ ...fieldStyle, borderColor: errors.email ? '#dc2626' : '#d1d5db' }}
              />
              {errors.email && <p style={errorStyle}>{errors.email}</p>}
            </div>
            <div>
              <label htmlFor="cf-phone" style={labelStyle}>
                {cf.phoneLabel} <span style={{ fontWeight: 400, color: '#9ca3af' }}>{cf.phoneOptional}</span>
              </label>
              <input
                id="cf-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={handleChange}
                placeholder={cf.phonePlaceholder}
                style={fieldStyle}
              />
            </div>
          </div>

          {/* Subject */}
          <div>
            <label htmlFor="cf-subject" style={labelStyle}>{cf.subjectLabel} *</label>
            <input
              id="cf-subject"
              name="subject"
              type="text"
              value={form.subject}
              onChange={handleChange}
              placeholder={cf.subjectPlaceholder}
              style={{ ...fieldStyle, borderColor: errors.subject ? '#dc2626' : '#d1d5db' }}
            />
            {errors.subject && <p style={errorStyle}>{errors.subject}</p>}
          </div>

          {/* Message */}
          <div>
            <label htmlFor="cf-message" style={labelStyle}>{cf.messageLabel} *</label>
            <textarea
              id="cf-message"
              name="message"
              rows={5}
              value={form.message}
              onChange={handleChange}
              placeholder={cf.messagePlaceholder}
              style={{ ...fieldStyle, resize: 'vertical', minHeight: '120px', borderColor: errors.message ? '#dc2626' : '#d1d5db' }}
            />
            {errors.message && <p style={errorStyle}>{errors.message}</p>}
          </div>

          {/* Server error */}
          {status === 'error' && serverError && (
            <p style={{ color: '#dc2626', fontSize: '0.9rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0.75rem 1rem' }}>
              {serverError}
            </p>
          )}

          {/* Optional newsletter consent */}
          <label style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.65rem',
            cursor: 'pointer',
            color: '#374151',
            fontSize: '0.9rem',
            lineHeight: 1.55,
          }}>
            <input
              type="checkbox"
              checked={newsletterConsent}
              onChange={(event) => setNewsletterConsent(event.target.checked)}
              style={{ marginTop: '0.2rem', accentColor: '#1a1a2e', flexShrink: 0, width: '1rem', height: '1rem' }}
              data-testid="contact-newsletter-checkbox"
            />
            <span>
              {cf.newsletterConsent}{' '}
              <a
                href={localePath('/yasal/kvkk-aydinlatma-metni', lang)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#1d4ed8', textDecoration: 'underline' }}
              >
                {cf.kvkkLink}
              </a>{' '}
              {lang === 'tr' ? 've' : '/'}{' '}
              <a
                href={localePath('/yasal/ticari-iletisim-bilgilendirmesi', lang)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#1d4ed8', textDecoration: 'underline' }}
              >
                {cf.commercialLink}
              </a>
            </span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={status === 'submitting'}
            style={{
              background: status === 'submitting' ? '#9ca3af' : '#1a1a2e',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.85rem 2rem',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
              alignSelf: 'flex-start',
            }}
          >
            {status === 'submitting' ? cf.submitting : cf.submitButton}
          </button>
        </form>
      </div>
    </section>
  );
}
