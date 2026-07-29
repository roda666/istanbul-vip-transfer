/**
 * FAQ data — locale-aware.
 *
 * getFaqs(lang) returns question/answer pairs in the requested language.
 * The legacy named export `faqs` returns Turkish (backward compat for
 * static-page imports that have not been updated yet).
 */

export interface FaqItem {
  question: string;
  answer: string;
}

const faqsByLang: Record<string, FaqItem[]> = {
  tr: [
    {
      question: 'Transfer ücretleriniz nasıl belirleniyor?',
      answer:
        'Fiyatlar mesafeye, araç tipine ve güzergaha göre belirlenir. Fiyat bilgisi almak için WhatsApp üzerinden bizimle iletişime geçin; rezervasyon öncesinde size bilgi verilir.',
    },
    {
      question: 'Kaç bagaj taşıyabilirim?',
      answer:
        'Mercedes Vito ile 7 yolcu ve 7 büyük bagaj, Mercedes Sprinter VIP ile ise 13 yolcu ve 13 büyük bagaj kapasitesi sunuyoruz. Fazla bagajınız varsa lütfen rezervasyon sırasında bilgi verin, en uygun aracı birlikte belirleyelim.',
    },
    {
      question: 'Uçuşum gecikirse sürücü bekler mi?',
      answer:
        'Uçuşunuzu takip ediyoruz. Gecikme durumunda sürücünüz bilgilendirilir. Bekleme koşulları ve detaylar için rezervasyon sırasında WhatsApp üzerinden bilgi alabilirsiniz.',
    },
    {
      question: 'Hangi ödeme yöntemlerini kabul ediyorsunuz?',
      answer:
        'Ödeme yöntemleri hakkında bilgi almak için WhatsApp üzerinden bizimle iletişime geçin; rezervasyon öncesinde size detay verilir.',
    },
    {
      question: 'Ne kadar önceden rezervasyon yapmalıyım?',
      answer:
        'En az 2 saat öncesinden rezervasyon yapmanızı öneririz. Ancak müsaitlik durumuna göre çok daha kısa sürelerde de transferinizi organize edebiliriz. Yoğun sezonlarda (yaz ayları, bayramlar) önceden rezervasyon yapmanız kesinlikle tavsiye edilir.',
    },
    {
      question: 'Çocuk koltuğu talep edebilir miyim?',
      answer:
        'Evet, rezervasyon sırasında çocuğunuzun yaşını ve ağırlığını belirtmeniz yeterlidir. Uygun çocuk koltuğunu ücretsiz olarak hazırlıyoruz. Bebek koltuğu, öne bakan koltuk veya yükseltici koltuk talep edebilirsiniz.',
    },
  ],
  en: [
    {
      question: 'How are your transfer prices determined?',
      answer:
        'Prices are based on distance, vehicle type, and route. Contact us via WhatsApp for a quote; full pricing details are provided before you confirm your booking.',
    },
    {
      question: 'How much luggage can I bring?',
      answer:
        'The Mercedes Vito accommodates 7 passengers and 7 large bags; the Mercedes Sprinter VIP fits 13 passengers and 13 large bags. If you have extra luggage, please let us know at the time of booking so we can arrange the most suitable vehicle.',
    },
    {
      question: 'Will the driver wait if my flight is delayed?',
      answer:
        'We monitor your flight in real time. If there is a delay, your driver is notified automatically. For specific waiting-time conditions, please ask us via WhatsApp when booking.',
    },
    {
      question: 'What payment methods do you accept?',
      answer:
        'Please contact us via WhatsApp for details on accepted payment methods; full information is provided before you confirm your booking.',
    },
    {
      question: 'How far in advance should I book?',
      answer:
        'We recommend booking at least 2 hours ahead. Depending on availability, we can often arrange transfers at shorter notice as well. During busy periods (summer, public holidays) advance booking is strongly advised.',
    },
    {
      question: 'Can I request a child seat?',
      answer:
        'Yes — simply mention your child\'s age and weight when booking. We provide the appropriate child seat free of charge. Infant seats, forward-facing seats, and booster seats are all available.',
    },
  ],
  de: [
    {
      question: 'Wie werden Ihre Transferpreise festgelegt?',
      answer:
        'Die Preise richten sich nach Entfernung, Fahrzeugtyp und Route. Kontaktieren Sie uns per WhatsApp für ein Angebot; alle Details werden vor der Buchungsbestätigung mitgeteilt.',
    },
    {
      question: 'Wie viel Gepäck kann ich mitnehmen?',
      answer:
        'Der Mercedes Vito bietet Platz für 7 Passagiere und 7 große Koffer; der Mercedes Sprinter VIP fasst 13 Passagiere und 13 große Koffer. Bei Übergepäck informieren Sie uns bitte bei der Buchung.',
    },
    {
      question: 'Wartet der Fahrer bei Flugverspätung?',
      answer:
        'Wir verfolgen Ihren Flug in Echtzeit. Bei Verspätungen wird Ihr Fahrer automatisch informiert. Genaue Wartezeiten erfragen Sie bitte bei der Buchung per WhatsApp.',
    },
    {
      question: 'Welche Zahlungsmethoden akzeptieren Sie?',
      answer:
        'Bitte kontaktieren Sie uns per WhatsApp für Informationen zu den akzeptierten Zahlungsmethoden; vollständige Details werden vor der Buchungsbestätigung mitgeteilt.',
    },
    {
      question: 'Wie weit im Voraus sollte ich buchen?',
      answer:
        'Wir empfehlen, mindestens 2 Stunden im Voraus zu buchen. Je nach Verfügbarkeit können wir auch kurzfristiger organisieren. In Stoßzeiten (Sommer, Feiertage) empfehlen wir eine frühzeitige Buchung.',
    },
    {
      question: 'Kann ich einen Kindersitz anfordern?',
      answer:
        'Ja — geben Sie einfach bei der Buchung Alter und Gewicht Ihres Kindes an. Wir stellen den passenden Kindersitz kostenlos bereit. Babyschalen, vorwärtsgerichtete Sitze und Sitzerhöhungen sind verfügbar.',
    },
  ],
  ru: [
    {
      question: 'Как формируются цены на трансфер?',
      answer:
        'Цены зависят от расстояния, типа автомобиля и маршрута. Напишите нам в WhatsApp для получения расчёта; все детали сообщаются до подтверждения бронирования.',
    },
    {
      question: 'Сколько багажа можно взять?',
      answer:
        'Mercedes Vito вмещает 7 пассажиров и 7 больших сумок; Mercedes Sprinter VIP — 13 пассажиров и 13 больших сумок. При наличии лишнего багажа сообщите нам при бронировании.',
    },
    {
      question: 'Будет ли водитель ждать при задержке рейса?',
      answer:
        'Мы отслеживаем ваш рейс в режиме реального времени. При задержке водитель получает уведомление автоматически. Подробные условия ожидания уточняйте через WhatsApp при бронировании.',
    },
    {
      question: 'Какие способы оплаты вы принимаете?',
      answer:
        'Пожалуйста, свяжитесь с нами через WhatsApp для получения информации о принимаемых способах оплаты; все детали предоставляются до подтверждения бронирования.',
    },
    {
      question: 'За сколько нужно бронировать заранее?',
      answer:
        'Рекомендуем бронировать не менее чем за 2 часа. В зависимости от доступности мы можем организовать трансфер и в более короткие сроки. В пиковые периоды (лето, праздники) раннее бронирование настоятельно рекомендуется.',
    },
    {
      question: 'Можно ли заказать детское кресло?',
      answer:
        'Да — просто укажите возраст и вес ребёнка при бронировании. Подходящее детское кресло предоставляется бесплатно. Доступны автолюльки, кресла для детей и бустеры.',
    },
  ],
  ar: [
    {
      question: 'كيف يتم تحديد أسعار النقل؟',
      answer:
        'تُحدَّد الأسعار بناءً على المسافة ونوع المركبة والمسار. تواصل معنا عبر واتساب للحصول على عرض سعر؛ تُقدَّم جميع التفاصيل قبل تأكيد الحجز.',
    },
    {
      question: 'كم من الأمتعة يمكنني إحضارها؟',
      answer:
        'تتسع سيارة مرسيدس فيتو لـ 7 ركاب و7 حقائب كبيرة؛ أما مرسيدس سبرينتر VIP فتتسع لـ 13 راكباً و13 حقيبة كبيرة. إذا كان لديك أمتعة إضافية، يرجى إخبارنا عند الحجز.',
    },
    {
      question: 'هل سينتظر السائق إذا تأخرت رحلتي؟',
      answer:
        'نتابع رحلتك في الوقت الفعلي. في حال وقوع تأخير، يتلقى السائق إشعاراً تلقائياً. لمعرفة شروط الانتظار بالتفصيل، تواصل معنا عبر واتساب عند الحجز.',
    },
    {
      question: 'ما طرق الدفع التي تقبلونها؟',
      answer:
        'تواصل معنا عبر واتساب للحصول على معلومات حول طرق الدفع المتاحة؛ تُقدَّم التفاصيل الكاملة قبل تأكيد الحجز.',
    },
    {
      question: 'كم من الوقت يجب الحجز مسبقاً؟',
      answer:
        'نوصي بالحجز قبل ساعتين على الأقل. وبحسب التوفر، يمكننا في الغالب ترتيب النقل في وقت أقصر. خلال أوقات الذروة (الصيف، الأعياد) يُنصح بشدة بالحجز المبكر.',
    },
    {
      question: 'هل يمكنني طلب مقعد للأطفال؟',
      answer:
        'نعم — ما عليك سوى ذكر عمر طفلك ووزنه عند الحجز. نوفر مقعد الأطفال المناسب مجاناً. تتوفر مقاعد للرضع ومقاعد للأطفال الأكبر سناً ومقاعد رفع.',
    },
  ],
};

/**
 * Returns FAQ items in the requested language.
 * Falls back to Turkish if the language is not found.
 */
export function getFaqs(lang: string): FaqItem[] {
  return faqsByLang[lang] ?? faqsByLang.tr;
}

/** @deprecated Use getFaqs('tr') instead — kept for backward compat */
export const faqs = faqsByLang.tr;
