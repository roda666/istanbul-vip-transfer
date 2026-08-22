/**
 * Database helpers for CMS-backed legal/policy pages.
 * content_type = 'PAGE', status = 'PUBLISHED'
 */
import { db } from '@/db';
import { content, contentTranslations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const LEGAL_SLUGS = [
  'kvkk-aydinlatma-metni',
  'cerez-politikasi',
  'kullanim-kosullari',
  'gizlilik-politikasi',
  'ticari-iletisim-bilgilendirmesi',
] as const;

export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export function isLegalSlug(slug: string): slug is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(slug);
}

export interface LegalPage {
  id:          string;
  slug:        string;
  title:       string;
  excerpt:     string;
  body:        string;
  updatedAt:   Date;
}

const COMMERCIAL_NOTICE_SLUG = 'ticari-iletisim-bilgilendirmesi';
const COMMERCIAL_NOTICE_UPDATED_AT = new Date('2026-08-22T00:00:00.000Z');

const COMMERCIAL_COMMUNICATION_NOTICES: Record<string, Omit<LegalPage, 'id' | 'slug' | 'updatedAt'>> = {
  tr: {
    title: 'Ticari İletişim Bilgilendirmesi',
    excerpt: 'Ticari elektronik ileti onayınıza ilişkin bilgilendirme metni.',
    body: `## Ticari Elektronik İleti Onayı

İstanbul VIP Transfer tarafından kampanya, teklif, hizmet güncellemesi ve memnuniyet iletişimlerinin telefon, SMS, WhatsApp veya e-posta yoluyla gönderilmesi için açık rızanız istenir.

## Onayınız ve Tercihleriniz

Onay vermek zorunda değilsiniz; onay vermemeniz transfer talebinizi veya hizmetimizi etkilemez. Onay verirseniz, tercihlerinizi dilediğiniz zaman değiştirebilir veya ticari ileti almayı ücretsiz olarak durdurabilirsiniz.

## Onayı Geri Çekme

İleti gönderildiğinde yer alan ret seçeneğini kullanabilir veya **info@istanbulviptransfer.com** adresi ile **+90 532 660 08 47** WhatsApp hattı üzerinden bize ulaşabilirsiniz.

Kişisel verilerinizin işlenmesine ilişkin ayrıntılar için [KVKK Aydınlatma Metni](/yasal/kvkk-aydinlatma-metni) sayfamızı inceleyebilirsiniz.`,
  },
  en: {
    title: 'Commercial Communications Notice',
    excerpt: 'Information about your consent to receive commercial electronic communications.',
    body: `## Consent to Commercial Communications

Istanbul VIP Transfer asks for your explicit consent before sending campaign, offer, service-update, or satisfaction communications by phone, SMS, WhatsApp, or email.

## Your Consent and Choices

Consent is optional. Refusing consent does not affect your transfer request or our service. If you consent, you may change your preferences or stop commercial communications free of charge at any time.

## Withdrawing Consent

Use the opt-out option included in a message, or contact us at **info@istanbulviptransfer.com** or via WhatsApp at **+90 532 660 08 47**.

For details about personal-data processing, see our [Privacy Policy](/en/yasal/gizlilik-politikasi).`,
  },
  de: {
    title: 'Hinweis zu kommerziellen Mitteilungen',
    excerpt: 'Informationen über Ihre Einwilligung in kommerzielle elektronische Mitteilungen.',
    body: `## Einwilligung in kommerzielle Mitteilungen

Istanbul VIP Transfer bittet vor dem Versand von Kampagnen, Angeboten, Service-Updates oder Zufriedenheitsmitteilungen per Telefon, SMS, WhatsApp oder E-Mail um Ihre ausdrückliche Einwilligung.

## Ihre Einwilligung und Wahlmöglichkeiten

Die Einwilligung ist freiwillig. Eine Ablehnung hat keinen Einfluss auf Ihre Transferanfrage oder unseren Service. Nach einer Einwilligung können Sie Ihre Einstellungen jederzeit ändern oder kommerzielle Mitteilungen kostenlos abbestellen.

## Widerruf der Einwilligung

Nutzen Sie die in einer Nachricht enthaltene Abmeldemöglichkeit oder kontaktieren Sie uns unter **info@istanbulviptransfer.com** bzw. über WhatsApp unter **+90 532 660 08 47**.

Weitere Informationen zur Verarbeitung personenbezogener Daten finden Sie in unserer [Datenschutzerklärung](/de/yasal/gizlilik-politikasi).`,
  },
  ru: {
    title: 'Уведомление о коммерческих сообщениях',
    excerpt: 'Информация о вашем согласии на получение коммерческих электронных сообщений.',
    body: `## Согласие на коммерческие сообщения

Istanbul VIP Transfer запрашивает ваше явное согласие перед отправкой кампаний, предложений, обновлений услуг или сообщений об удовлетворенности по телефону, SMS, WhatsApp или электронной почте.

## Ваше согласие и выбор

Согласие добровольно. Отказ не влияет на ваш запрос на трансфер или обслуживание. После согласия вы можете в любое время изменить настройки или бесплатно отказаться от коммерческих сообщений.

## Отзыв согласия

Воспользуйтесь возможностью отказа в полученном сообщении либо свяжитесь с нами по адресу **info@istanbulviptransfer.com** или через WhatsApp: **+90 532 660 08 47**.

Подробнее об обработке персональных данных — в нашей [Политике конфиденциальности](/ru/yasal/gizlilik-politikasi).`,
  },
  ar: {
    title: 'إشعار التواصل التجاري',
    excerpt: 'معلومات حول موافقتك على تلقي الاتصالات الإلكترونية التجارية.',
    body: `## الموافقة على التواصل التجاري

تطلب Istanbul VIP Transfer موافقتك الصريحة قبل إرسال الحملات والعروض وتحديثات الخدمة أو رسائل قياس الرضا عبر الهاتف أو الرسائل النصية أو WhatsApp أو البريد الإلكتروني.

## موافقتك وخياراتك

الموافقة اختيارية، ولا يؤثر رفضها في طلب النقل أو الخدمة. وإذا وافقت، يمكنك تعديل تفضيلاتك أو إيقاف الاتصالات التجارية مجانًا في أي وقت.

## سحب الموافقة

استخدم خيار إلغاء الاشتراك الوارد في الرسالة، أو تواصل معنا عبر **info@istanbulviptransfer.com** أو WhatsApp على الرقم **+90 532 660 08 47**.

للتفاصيل المتعلقة بمعالجة البيانات الشخصية، راجع [سياسة الخصوصية](/ar/yasal/gizlilik-politikasi).`,
  },
  fr: {
    title: 'Avis relatif aux communications commerciales',
    excerpt: 'Informations sur votre consentement à recevoir des communications électroniques commerciales.',
    body: `## Consentement aux communications commerciales

Istanbul VIP Transfer demande votre consentement explicite avant d’envoyer des campagnes, offres, mises à jour de service ou messages de satisfaction par téléphone, SMS, WhatsApp ou e-mail.

## Votre consentement et vos choix

Le consentement est facultatif. Le refuser n’affecte pas votre demande de transfert ni notre service. Après consentement, vous pouvez modifier vos préférences ou arrêter gratuitement les communications commerciales à tout moment.

## Retrait du consentement

Utilisez l’option de désinscription présente dans un message, ou contactez-nous à **info@istanbulviptransfer.com** ou via WhatsApp au **+90 532 660 08 47**.

Pour le traitement des données personnelles, consultez notre [Politique de confidentialité](/fr/yasal/gizlilik-politikasi).`,
  },
  es: {
    title: 'Aviso de comunicaciones comerciales',
    excerpt: 'Información sobre su consentimiento para recibir comunicaciones electrónicas comerciales.',
    body: `## Consentimiento para comunicaciones comerciales

Istanbul VIP Transfer solicita su consentimiento expreso antes de enviar campañas, ofertas, actualizaciones de servicio o comunicaciones de satisfacción por teléfono, SMS, WhatsApp o correo electrónico.

## Su consentimiento y sus opciones

El consentimiento es opcional. Rechazarlo no afecta a su solicitud de traslado ni a nuestro servicio. Si da su consentimiento, puede cambiar sus preferencias o dejar de recibir comunicaciones comerciales sin coste en cualquier momento.

## Retirada del consentimiento

Utilice la opción de baja incluida en un mensaje o contáctenos en **info@istanbulviptransfer.com** o por WhatsApp en el **+90 532 660 08 47**.

Para conocer el tratamiento de sus datos personales, consulte nuestra [Política de privacidad](/es/yasal/gizlilik-politikasi).`,
  },
  it: {
    title: 'Informativa sulle comunicazioni commerciali',
    excerpt: 'Informazioni sul consenso a ricevere comunicazioni elettroniche commerciali.',
    body: `## Consenso alle comunicazioni commerciali

Istanbul VIP Transfer richiede il consenso esplicito prima di inviare campagne, offerte, aggiornamenti del servizio o messaggi di soddisfazione tramite telefono, SMS, WhatsApp o e-mail.

## Il consenso e le tue scelte

Il consenso è facoltativo. Il rifiuto non influisce sulla richiesta di trasferimento o sul nostro servizio. Dopo il consenso, puoi modificare le preferenze o interrompere gratuitamente le comunicazioni commerciali in qualsiasi momento.

## Revoca del consenso

Usa l’opzione di annullamento presente in un messaggio oppure contattaci a **info@istanbulviptransfer.com** o via WhatsApp al numero **+90 532 660 08 47**.

Per i dettagli sul trattamento dei dati personali, consulta la nostra [Informativa sulla privacy](/it/yasal/gizlilik-politikasi).`,
  },
  nl: {
    title: 'Informatie over commerciële communicatie',
    excerpt: 'Informatie over uw toestemming voor commerciële elektronische communicatie.',
    body: `## Toestemming voor commerciële communicatie

Istanbul VIP Transfer vraagt uw uitdrukkelijke toestemming voordat wij campagnes, aanbiedingen, service-updates of tevredenheidsberichten versturen via telefoon, sms, WhatsApp of e-mail.

## Uw toestemming en keuzes

Toestemming is vrijwillig. Weigering heeft geen invloed op uw transfervoorstel of onze service. Na toestemming kunt u uw voorkeuren wijzigen of commerciële communicatie op elk moment gratis stopzetten.

## Toestemming intrekken

Gebruik de afmeldmogelijkheid in een bericht of neem contact op via **info@istanbulviptransfer.com** of WhatsApp: **+90 532 660 08 47**.

Lees onze [Privacyverklaring](/nl/yasal/gizlilik-politikasi) voor informatie over de verwerking van persoonsgegevens.`,
  },
};

function getCommercialCommunicationNotice(lang: string): LegalPage {
  const notice = COMMERCIAL_COMMUNICATION_NOTICES[lang] ?? COMMERCIAL_COMMUNICATION_NOTICES.en;
  return {
    id: `static:${COMMERCIAL_NOTICE_SLUG}`,
    slug: COMMERCIAL_NOTICE_SLUG,
    updatedAt: COMMERCIAL_NOTICE_UPDATED_AT,
    ...notice,
  };
}

/** Fetch Turkish (source) legal page from the content table. */
export async function getLegalPage(slug: string): Promise<LegalPage | null> {
  if (slug === COMMERCIAL_NOTICE_SLUG) return getCommercialCommunicationNotice('tr');
  try {
    const [row] = await db
      .select({
        id:        content.id,
        slug:      content.slug,
        title:     content.title,
        excerpt:   content.excerpt,
        body:      content.body,
        updatedAt: content.updatedAt,
      })
      .from(content)
      .where(
        and(
          eq(content.slug,        slug),
          eq(content.contentType, 'PAGE'),
          eq(content.status,      'PUBLISHED'),
        ),
      )
      .limit(1);

    if (!row) return null;
    return {
      id:        row.id,
      slug:      row.slug      ?? slug,
      title:     row.title     ?? '',
      excerpt:   row.excerpt   ?? '',
      body:      row.body      ?? '',
      updatedAt: row.updatedAt ?? new Date(),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch translated legal page from content_translations.
 * Returns null if no published translation exists for the given language.
 */
export async function getLegalPageTranslation(
  slug: string,
  lang: string,
): Promise<LegalPage | null> {
  if (slug === COMMERCIAL_NOTICE_SLUG) return getCommercialCommunicationNotice(lang);
  try {
    const [source] = await db
      .select({ id: content.id })
      .from(content)
      .where(
        and(
          eq(content.slug,        slug),
          eq(content.contentType, 'PAGE'),
          eq(content.status,      'PUBLISHED'),
        ),
      )
      .limit(1);

    if (!source) return null;

    const [trans] = await db
      .select({
        slug:      contentTranslations.slug,
        title:     contentTranslations.title,
        excerpt:   contentTranslations.excerpt,
        body:      contentTranslations.body,
        updatedAt: contentTranslations.updatedAt,
      })
      .from(contentTranslations)
      .where(
        and(
          eq(contentTranslations.entityType,         'content'),
          eq(contentTranslations.entityId,           source.id),
          eq(contentTranslations.targetLanguageCode, lang),
          eq(contentTranslations.status,             'PUBLISHED'),
        ),
      )
      .limit(1);

    if (!trans) return null;
    return {
      id:        source.id,
      slug:      trans.slug      ?? slug,
      title:     trans.title     ?? '',
      excerpt:   trans.excerpt   ?? '',
      body:      trans.body      ?? '',
      updatedAt: trans.updatedAt ?? new Date(),
    };
  } catch {
    return null;
  }
}
