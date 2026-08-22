import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { localePath } from '@/lib/locale-path';
import ar from '@/lib/i18n/dictionaries/ar';
import de from '@/lib/i18n/dictionaries/de';
import en from '@/lib/i18n/dictionaries/en';
import es from '@/lib/i18n/dictionaries/es';
import fr from '@/lib/i18n/dictionaries/fr';
import itDictionary from '@/lib/i18n/dictionaries/it';
import nl from '@/lib/i18n/dictionaries/nl';
import ru from '@/lib/i18n/dictionaries/ru';
import tr from '@/lib/i18n/dictionaries/tr';

const mocks = vi.hoisted(() => {
  const reservationRequests = {
    referenceNumber: Symbol('referenceNumber'),
  };
  const newsletterSubscribers = {
    id: Symbol('subscriberId'),
    normalizedEmail: Symbol('subscriberEmail'),
  };
  const newsletterConsentEvents = {
    id: Symbol('consentEventId'),
  };
  const auditLogs = { id: Symbol('auditLogId') };

  return {
    db: {
      insert: vi.fn(),
      select: vi.fn(),
      update: vi.fn(),
    },
    reservationRequests,
    newsletterSubscribers,
    newsletterConsentEvents,
    auditLogs,
    getAdminNotifyEmails: vi.fn(),
    sendEmailDetailed: vi.fn(),
    selectLimit: vi.fn(),
  };
});

vi.mock('@/db', () => ({ db: mocks.db }));
vi.mock('@/db/schema', () => ({
  reservationRequests: mocks.reservationRequests,
  newsletterSubscribers: mocks.newsletterSubscribers,
  newsletterConsentEvents: mocks.newsletterConsentEvents,
  auditLogs: mocks.auditLogs,
}));
vi.mock('@/lib/email', () => ({
  getAdminNotifyEmails: mocks.getAdminNotifyEmails,
  sendEmailDetailed: mocks.sendEmailDetailed,
}));
vi.mock('@/lib/i18n/active-locales', () => ({
  getPublicLangCodes: vi.fn().mockResolvedValue(['tr', 'en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl']),
}));
vi.mock('drizzle-orm', () => ({
  eq: (...values: unknown[]) => values,
}));

import { POST } from '../../app/data/contact/route';

function contactRequest(
  body: Record<string, unknown>,
  ip: string,
) {
  return new NextRequest('http://localhost/data/contact', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify({
      name: 'Newsletter Visitor',
      email: 'visitor@example.com',
      phone: '',
      subject: 'Transfer question',
      message: 'I would like more information about a transfer.',
      locale: 'en',
      ...body,
    }),
  });
}

describe('contact form newsletter consent', () => {
  beforeEach(() => {
    mocks.db.insert.mockReset();
    mocks.db.select.mockReset();
    mocks.db.update.mockReset();
    mocks.selectLimit.mockReset().mockResolvedValue([]);
    mocks.getAdminNotifyEmails.mockReset().mockResolvedValue([]);
    mocks.sendEmailDetailed.mockReset();

    mocks.db.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: mocks.selectLimit,
        }),
      }),
    });
    mocks.db.update.mockReturnValue({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    });
    mocks.db.insert.mockImplementation((table: unknown) => {
      if (table === mocks.newsletterSubscribers) {
        return {
          values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ id: 'new-subscriber-id' }]),
          })),
        };
      }
      return { values: vi.fn().mockResolvedValue(undefined) };
    });
  });

  it('does not create newsletter records when consent is unchecked', async () => {
    const response = await POST(contactRequest({ newsletterConsent: false }, '10.0.0.1'));

    expect(response.status).toBe(200);
    expect(mocks.db.select).not.toHaveBeenCalled();
    expect(mocks.db.insert).toHaveBeenCalledWith(mocks.reservationRequests);
    expect(mocks.db.insert).not.toHaveBeenCalledWith(mocks.newsletterSubscribers);
    expect(mocks.db.insert).not.toHaveBeenCalledWith(mocks.newsletterConsentEvents);
  });

  it('creates an active subscriber and localized granted-consent event when opted in', async () => {
    const response = await POST(contactRequest({ newsletterConsent: true, locale: 'de' }, '10.0.0.2'));

    expect(response.status).toBe(200);
    const subscriberInsert = mocks.db.insert.mock.calls.find(
      ([table]) => table === mocks.newsletterSubscribers,
    )?.[0];
    expect(subscriberInsert).toBe(mocks.newsletterSubscribers);

    const subscriberValues = mocks.db.insert.mock.results
      .find((result, index) => mocks.db.insert.mock.calls[index][0] === mocks.newsletterSubscribers)
      ?.value.values.mock.calls[0][0];
    expect(subscriberValues).toMatchObject({
      normalizedEmail: 'visitor@example.com',
      status: 'ACTIVE',
      preferredLanguage: 'de',
      source: 'contact-form',
    });

    const consentValues = mocks.db.insert.mock.results
      .find((result, index) => mocks.db.insert.mock.calls[index][0] === mocks.newsletterConsentEvents)
      ?.value.values.mock.calls[0][0];
    expect(consentValues).toMatchObject({
      subscriberId: 'new-subscriber-id',
      normalizedEmail: 'visitor@example.com',
      action: 'GRANTED',
      language: 'de',
      source: 'contact-form',
    });
  });

  it('reactivates an existing subscriber and still records a fresh consent event', async () => {
    mocks.selectLimit.mockResolvedValue([{ id: 'existing-subscriber-id' }]);

    const response = await POST(contactRequest({ newsletterConsent: true }, '10.0.0.3'));

    expect(response.status).toBe(200);
    expect(mocks.db.insert).not.toHaveBeenCalledWith(mocks.newsletterSubscribers);
    expect(mocks.db.update).toHaveBeenCalledWith(mocks.newsletterSubscribers);

    const consentValues = mocks.db.insert.mock.results
      .find((result, index) => mocks.db.insert.mock.calls[index][0] === mocks.newsletterConsentEvents)
      ?.value.values.mock.calls[0][0];
    expect(consentValues).toMatchObject({
      subscriberId: 'existing-subscriber-id',
      action: 'GRANTED',
      source: 'contact-form',
    });
  });

  it('keeps existing contact validation intact', async () => {
    const response = await POST(contactRequest({ message: 'short', newsletterConsent: true }, '10.0.0.4'));

    expect(response.status).toBe(422);
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });

  it('rejects an unsupported locale before creating contact or consent records', async () => {
    const response = await POST(contactRequest({ newsletterConsent: true, locale: 'zz' }, '10.0.0.5'));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Unsupported or unpublished locale',
    });
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });

  it('builds Turkish and localized legal notice paths correctly', () => {
    expect(localePath('/yasal/kvkk-aydinlatma-metni', 'tr')).toBe('/yasal/kvkk-aydinlatma-metni');
    expect(localePath('/yasal/ticari-iletisim-bilgilendirmesi', 'ar'))
      .toBe('/ar/yasal/ticari-iletisim-bilgilendirmesi');
  });

  it('uses the same consent wording and legal labels as booking in all nine languages', () => {
    for (const dictionary of [tr, en, de, ru, ar, fr, es, itDictionary, nl]) {
      expect(dictionary.contactForm.newsletterConsent).toBe(dictionary.booking.newsletterConsent);
      expect(dictionary.contactForm.kvkkLink).toBe(dictionary.booking.kvkkLink);
      expect(dictionary.contactForm.commercialLink).toBe(dictionary.booking.commercialLink);
    }
  });
});