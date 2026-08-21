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
  es: [
    {
      question: '¿Cómo se determinan los precios de los traslados?',
      answer:
        'Los precios se calculan según la distancia, el tipo de vehículo y la ruta. Contáctenos por WhatsApp para solicitar un presupuesto; todos los detalles se comparten antes de confirmar la reserva.',
    },
    {
      question: '¿Cuánto equipaje puedo llevar?',
      answer:
        'El Mercedes Vito tiene capacidad para 7 pasajeros y 7 maletas grandes; el Mercedes Sprinter VIP admite 13 pasajeros y 13 maletas grandes. Si lleva equipaje adicional, avísenos al hacer la reserva para preparar el vehículo más adecuado.',
    },
    {
      question: '¿El conductor esperará si mi vuelo se retrasa?',
      answer:
        'Seguimos su vuelo en tiempo real. Si hay un retraso, su conductor recibe una notificación automáticamente. Para conocer las condiciones concretas de espera, consúltenos por WhatsApp al reservar.',
    },
    {
      question: '¿Qué métodos de pago aceptan?',
      answer:
        'Contáctenos por WhatsApp para conocer los métodos de pago disponibles; recibirá toda la información antes de confirmar su reserva.',
    },
    {
      question: '¿Con cuánta antelación debo reservar?',
      answer:
        'Recomendamos reservar con al menos 2 horas de antelación. Según la disponibilidad, también podemos organizar traslados con menos tiempo. En temporadas de alta demanda, como verano y festivos, recomendamos reservar con antelación.',
    },
    {
      question: '¿Puedo solicitar una silla infantil?',
      answer:
        'Sí. Indique la edad y el peso de su hijo al reservar y prepararemos gratuitamente la silla infantil adecuada. Disponemos de sillas para bebé, sillas orientadas hacia delante y elevadores.',
    },
  ],
  fr: [
    {
      question: 'Comment sont déterminés vos tarifs de transfert ?',
      answer:
        'Les tarifs dépendent de la distance, du type de véhicule et de l’itinéraire. Contactez-nous sur WhatsApp pour obtenir un devis ; tous les détails sont fournis avant la confirmation de votre réservation.',
    },
    {
      question: 'Quelle quantité de bagages puis-je emporter ?',
      answer:
        'Le Mercedes Vito accueille 7 passagers et 7 grandes valises ; le Mercedes Sprinter VIP peut accueillir 13 passagers et 13 grandes valises. Si vous avez des bagages supplémentaires, prévenez-nous lors de la réservation afin que nous préparions le véhicule adapté.',
    },
    {
      question: 'Le chauffeur attend-il si mon vol est retardé ?',
      answer:
        'Nous suivons votre vol en temps réel. En cas de retard, votre chauffeur est automatiquement informé. Pour connaître les conditions précises d’attente, contactez-nous sur WhatsApp lors de la réservation.',
    },
    {
      question: 'Quels moyens de paiement acceptez-vous ?',
      answer:
        'Contactez-nous sur WhatsApp pour connaître les moyens de paiement acceptés ; toutes les informations vous seront communiquées avant la confirmation de votre réservation.',
    },
    {
      question: 'Combien de temps à l’avance dois-je réserver ?',
      answer:
        'Nous recommandons de réserver au moins 2 heures à l’avance. Selon les disponibilités, nous pouvons également organiser un transfert à plus court délai. En haute saison, notamment l’été et les jours fériés, une réservation anticipée est vivement conseillée.',
    },
    {
      question: 'Puis-je demander un siège enfant ?',
      answer:
        'Oui. Indiquez simplement l’âge et le poids de votre enfant lors de la réservation. Nous fournissons gratuitement le siège enfant approprié, y compris les sièges bébé, les sièges face à la route et les rehausseurs.',
    },
  ],
  it: [
    {
      question: 'Come vengono determinati i prezzi dei trasferimenti?',
      answer:
        'I prezzi dipendono dalla distanza, dal tipo di veicolo e dal percorso. Contattaci via WhatsApp per un preventivo; tutti i dettagli vengono forniti prima della conferma della prenotazione.',
    },
    {
      question: 'Quanti bagagli posso portare?',
      answer:
        'Il Mercedes Vito può ospitare 7 passeggeri e 7 valigie grandi; il Mercedes Sprinter VIP può ospitare 13 passeggeri e 13 valigie grandi. Se hai bagagli extra, avvisaci al momento della prenotazione per organizzare il veicolo più adatto.',
    },
    {
      question: 'L’autista aspetterà se il mio volo è in ritardo?',
      answer:
        'Monitoriamo il tuo volo in tempo reale. In caso di ritardo, l’autista viene avvisato automaticamente. Per le condizioni specifiche di attesa, contattaci via WhatsApp al momento della prenotazione.',
    },
    {
      question: 'Quali metodi di pagamento accettate?',
      answer:
        'Contattaci via WhatsApp per conoscere i metodi di pagamento accettati; tutte le informazioni vengono fornite prima della conferma della prenotazione.',
    },
    {
      question: 'Con quanto anticipo devo prenotare?',
      answer:
        'Consigliamo di prenotare con almeno 2 ore di anticipo. In base alla disponibilità, possiamo spesso organizzare trasferimenti anche con un preavviso minore. Nei periodi più affollati, come l’estate e le festività, è vivamente consigliata la prenotazione anticipata.',
    },
    {
      question: 'Posso richiedere un seggiolino per bambini?',
      answer:
        'Sì. Indica l’età e il peso del bambino al momento della prenotazione; forniremo gratuitamente il seggiolino più adatto. Sono disponibili seggiolini per neonati, seggiolini rivolti in avanti e rialzi.',
    },
  ],
  nl: [
    {
      question: 'Hoe worden jullie transferprijzen bepaald?',
      answer:
        'De prijs is gebaseerd op de afstand, het voertuigtype en de route. Neem via WhatsApp contact met ons op voor een prijsopgave; alle details worden vóór de boekingsbevestiging gedeeld.',
    },
    {
      question: 'Hoeveel bagage kan ik meenemen?',
      answer:
        'De Mercedes Vito biedt plaats aan 7 passagiers en 7 grote koffers; de Mercedes Sprinter VIP biedt plaats aan 13 passagiers en 13 grote koffers. Laat het ons bij extra bagage tijdens het boeken weten, zodat we het meest geschikte voertuig kunnen regelen.',
    },
    {
      question: 'Wacht de chauffeur als mijn vlucht vertraging heeft?',
      answer:
        'Wij volgen uw vlucht in realtime. Bij vertraging krijgt uw chauffeur automatisch bericht. Vraag ons via WhatsApp bij het boeken naar de precieze wachttijdvoorwaarden.',
    },
    {
      question: 'Welke betaalmethoden accepteren jullie?',
      answer:
        'Neem via WhatsApp contact met ons op voor informatie over de beschikbare betaalmethoden; u ontvangt alle details voordat u de boeking bevestigt.',
    },
    {
      question: 'Hoe ver van tevoren moet ik boeken?',
      answer:
        'Wij raden aan minstens 2 uur van tevoren te boeken. Afhankelijk van de beschikbaarheid kunnen we transfers vaak ook op kortere termijn regelen. In drukke periodes, zoals de zomer en feestdagen, raden we vroeg boeken sterk aan.',
    },
    {
      question: 'Kan ik een kinderzitje aanvragen?',
      answer:
        'Ja. Vermeld bij het boeken de leeftijd en het gewicht van uw kind; wij zorgen kosteloos voor het juiste kinderzitje. Babyzitjes, voorwaarts gerichte zitjes en stoelverhogers zijn beschikbaar.',
    },
  ],
};

/**
 * Returns FAQ items in the requested language.
 * Turkish is only returned for an explicit Turkish request. A malformed or
 * unknown locale gets English, never Turkish source text on an international
 * route.
 */
export function getFaqs(lang: string): FaqItem[] {
  return faqsByLang[lang] ?? faqsByLang.en;
}

/** @deprecated Use getFaqs('tr') instead — kept for backward compat */
export const faqs = faqsByLang.tr;
