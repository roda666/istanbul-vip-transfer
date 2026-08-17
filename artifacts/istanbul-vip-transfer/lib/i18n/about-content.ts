/**
 * lib/i18n/about-content.ts
 *
 * SEO-friendly "About Us" article for the Hakkımızda page.
 * Each locale gets a full ~600-word article rendered by HakkimizdaArticle.tsx.
 * Sections: intro, whoWeAre, fleet, services, whyUs, satisfaction, cta.
 */

export interface AboutSection {
  heading: string;
  body: string | string[];   // string = single paragraph; string[] = multiple paragraphs or list items
  isList?: boolean;           // render body as <ul> list
}

export interface AboutContent {
  pageTitle: string;
  intro: string;
  sections: AboutSection[];
}

export const ABOUT_CONTENT: Record<string, AboutContent> = {
  tr: {
    pageTitle: 'İstanbul VIP Transfer: Güvenilir Yolculuğun Adresi',
    intro: 'İstanbul — iki kıtayı birleştiren, her köşesinde tarih soluk alan, dünyaya açılan bir şehir. Bu büyülü şehirde ulaşım, sıradan bir ihtiyaçtan çok daha fazlası; zamanı ve konforu doğru değerlendirmenin meselesidir. İstanbul VIP Transfer olarak yolcularımıza tam da bu deneyimi sunuyoruz: zamanında, güvenli ve eksiksiz bir yolculuk.',
    sections: [
      {
        heading: 'Biz Kimiz?',
        body: 'Hevra Turizm bünyesinde hizmet veren İstanbul VIP Transfer, Türkiye Seyahat Acenteleri Birliği\'ne (TÜRSAB) kayıtlı, lisanslı bir özel ulaşım şirketidir. Yolcu güvenliğini ve memnuniyetini her şeyin önünde tutan anlayışımızla, bireysel yolculardan kurumsal delegasyonlara kadar geniş bir müşteri kitlesine hizmet sunuyoruz. Felsefemiz basit: her müşteri farklıdır, her yolculuğun kendine özgü gereksinimleri vardır. Havalimanı karşılamasından şehirlerarası transfere, günübirlik tura ya da kurumsal tahsise kadar tüm hizmetlerimizi bu anlayışla tasarlıyoruz.',
      },
      {
        heading: 'Araç Filomuz',
        body: 'Filomuz tamamen Mercedes-Benz araçlardan oluşmaktadır. Mercedes Vito, altı yolcuya kadar bireysel ve küçük grup transferlerinde tercih edilen seçenektir; konforlu ve çevik yapısıyla İstanbul trafiğini kolayca aşar. Mercedes Sprinter VIP ise on iki yolcuya kadar büyük gruplar, kurumsal heyetler ve sağlık turizmi grupları için idealdir; geniş iç hacmi, kliması, deri koltukları ve su servisi ile konforlu bir yolculuk deneyimi sunar. Araçlarımız düzenli teknik bakımdan geçmekte, sürücülerimiz profesyonel eğitim almış, lisanslı ve deneyimli kişilerden oluşmaktadır.',
      },
      {
        heading: 'Hizmet Yelpazemiz',
        isList: true,
        body: [
          'Havalimanı Transferi — İstanbul Havalimanı (IST) ve Sabiha Gökçen Havalimanı\'ndan (SAW) karşılama tabelasıyla transfer',
          'VIP & Şehir İçi — Otel transferleri, kurumsal VIP hizmetler, şoförlü araç kiralama',
          'Şehirlerarası Transfer — İstanbul\'dan Ankara, Bursa, Antalya, İzmir ve daha fazlasına kapıdan kapıya özel transfer',
          'Günübirlik Turlar — Sapanca–Maşukiye, Bursa ve Yalova\'ya özel tur hizmetleri',
          'Sağlık Turizmi Transferi — Hastane ve klinik transferleri, tedavi süreci boyunca düzenli ulaşım',
          'Özel Etkinlik Ulaşımı — Düğün araçları, protokol transferleri, VIP misafir karşılama',
        ],
      },
      {
        heading: 'Neden İstanbul VIP Transfer?',
        isList: true,
        body: [
          'TÜRSAB onaylı lisanslı şirket olarak tüm operasyonlarımızı resmi güvence altında yürütüyoruz',
          '7/24 hizmet anlayışımızla müşteri hizmetlerimize her an ulaşabilirsiniz',
          'Uçuş takip sistemlerimizle uçak gecikmelerine anlık adaptasyon sağlıyoruz',
          'Şeffaf fiyatlandırma: ek ücret yok, sürpriz fatura yok',
          'Türkçe, İngilizce, Rusça ve Arapça dahil birçok dilde destek',
        ],
      },
      {
        heading: 'Müşteri Memnuniyeti, Önceliğimiz',
        body: 'Google değerlendirmelerimiz ve yıllar içinde biriktirdiğimiz tekrar müşteri oranı, sunduğumuz hizmet kalitesinin en güvenilir kanıtıdır. Her yorumu dikkatle okur, her geri bildirimi hizmetimizi geliştirmek için bir fırsat olarak değerlendiririz.',
      },
      {
        heading: 'Sizin İçin Burdayız',
        body: 'İster ilk kez İstanbul\'a geliyorsunuz, ister her ay bu şehire iş için uçuyorsunuz; her seferinde aynı kaliteli, güvenilir ve zamanında hizmeti alacağınızı bilmek istiyorsunuz. İstanbul VIP Transfer olarak tam da bunu vaat ediyoruz. Rezervasyon için WhatsApp, telefon veya web sitemiz üzerinden bize ulaşın.',
      },
    ],
  },

  en: {
    pageTitle: 'Istanbul VIP Transfer: Your Address for Reliable Travel',
    intro: 'Istanbul — a city that bridges two continents, breathes history at every corner, and opens onto the world. In this magnificent city, transportation is far more than an ordinary need; it is a matter of making the best use of your time and comfort. At Istanbul VIP Transfer, we offer our passengers exactly this experience: a journey that is punctual, safe, and flawless.',
    sections: [
      {
        heading: 'Who Are We?',
        body: 'Istanbul VIP Transfer, operating under Hevra Turizm, is a licensed private transportation company registered with the Turkish Travel Agencies Association (TÜRSAB). With a philosophy that places passenger safety and satisfaction above all else, we serve a wide clientele ranging from individual travellers to corporate delegations. Our philosophy is simple: every customer is different, and every journey has its own unique requirements. We design all our services — from airport meet-and-greet to intercity transfers, day tours and corporate allocations — with this understanding.',
      },
      {
        heading: 'Our Vehicle Fleet',
        body: 'Our fleet consists entirely of Mercedes-Benz vehicles. The Mercedes Vito is the preferred choice for individual and small-group transfers of up to six passengers; its comfortable and agile build navigates Istanbul traffic with ease. The Mercedes Sprinter VIP is ideal for larger groups, corporate delegations and health-tourism groups of up to twelve passengers, delivering a comfortable journey experience with its spacious interior, air conditioning, leather seats and water service. Our vehicles undergo regular technical maintenance, and our drivers are professionally trained, licensed and experienced.',
      },
      {
        heading: 'Our Range of Services',
        isList: true,
        body: [
          'Airport Transfers — Meet-and-greet service from Istanbul Airport (IST) and Sabiha Gökçen Airport (SAW) to any destination',
          'VIP & City Services — Hotel transfers, corporate VIP services, chauffeured vehicle hire',
          'Intercity Transfers — Door-to-door private transfers from Istanbul to Ankara, Bursa, Antalya, Izmir and beyond',
          'Day Tours — Private day tours to Sapanca–Maşukiye, Bursa and Yalova',
          'Medical Tourism Transfers — Hospital and clinic transfers with consistent transport throughout treatment',
          'Special Event Transport — Wedding vehicles, protocol transfers, VIP guest reception',
        ],
      },
      {
        heading: 'Why Istanbul VIP Transfer?',
        isList: true,
        body: [
          'As a TÜRSAB-approved licensed company, all our operations are conducted under official assurance',
          'Our 24/7 service approach means you can reach our customer support at any time',
          'Our flight-tracking systems enable real-time adaptation to flight delays',
          'Transparent pricing: no hidden charges, no surprise invoices',
          'Support in Turkish, English, Russian, Arabic and more',
        ],
      },
      {
        heading: 'Customer Satisfaction is Our Priority',
        body: 'Our Google reviews and the repeat-customer rate we have built up over the years are the most reliable testament to the quality of service we provide. We read every review carefully and treat every piece of feedback as an opportunity to improve our service.',
      },
      {
        heading: 'We Are Here for You',
        body: 'Whether you are visiting Istanbul for the first time or flying to this city for business every month, you want to know that you will receive the same high-quality, reliable and punctual service every time. At Istanbul VIP Transfer, that is exactly what we promise. Contact us for reservations via WhatsApp, phone or our website.',
      },
    ],
  },

  de: {
    pageTitle: 'Istanbul VIP Transfer: Ihre Adresse für zuverlässige Reisen',
    intro: 'Istanbul — eine Stadt, die zwei Kontinente verbindet, an jeder Ecke Geschichte atmet und sich der Welt öffnet. In dieser faszinierenden Stadt ist Transport weit mehr als ein gewöhnliches Bedürfnis; es ist eine Frage der richtigen Nutzung von Zeit und Komfort. Bei Istanbul VIP Transfer bieten wir unseren Fahrgästen genau dieses Erlebnis: eine pünktliche, sichere und makellose Reise.',
    sections: [
      {
        heading: 'Wer sind wir?',
        body: 'Istanbul VIP Transfer, das unter Hevra Turizm tätig ist, ist ein lizenziertes privates Transportunternehmen, das beim Türkischen Reisebüroverbund (TÜRSAB) registriert ist. Mit einer Philosophie, die Passagiersicherheit und Zufriedenheit über alles stellt, bedienen wir eine breite Kundschaft von Einzelreisenden bis hin zu Unternehmensdelegationen. Unsere Philosophie ist einfach: Jeder Kunde ist anders, und jede Reise hat ihre eigenen Anforderungen. Wir gestalten alle unsere Dienstleistungen — vom Flughafen-Empfang bis zu Fernstrecken-Transfers, Tagestouren und Unternehmensallokationen — mit diesem Verständnis.',
      },
      {
        heading: 'Unsere Fahrzeugflotte',
        body: 'Unsere Flotte besteht ausschließlich aus Mercedes-Benz-Fahrzeugen. Der Mercedes Vito ist die bevorzugte Wahl für Einzel- und Kleingruppenfahrten mit bis zu sechs Passagieren. Der Mercedes Sprinter VIP ist ideal für größere Gruppen mit bis zu zwölf Passagieren mit geräumigem Innenraum, Klimaanlage, Ledersitzen und Wasserservice. Unsere Fahrzeuge werden regelmäßig gewartet, und unsere Fahrer sind professionell ausgebildet, lizenziert und erfahren.',
      },
      {
        heading: 'Unser Leistungsumfang',
        isList: true,
        body: [
          'Flughafentransfers — Empfangsservice vom Flughafen Istanbul (IST) und Sabiha Gökçen (SAW) zu jedem Ziel',
          'VIP & Stadtservice — Hoteltransfers, Corporate-VIP-Service, Fahrergestellte Fahrzeuge',
          'Fernstrecken-Transfer — Tür-zu-Tür-Private-Transfers von Istanbul nach Ankara, Bursa, Antalya, Izmir und mehr',
          'Tagesausflüge — Private Tagestouren nach Sapanca–Maşukiye, Bursa und Yalova',
          'Medizintourismus-Transfers — Krankenhaus- und Kliniktransfers während der Behandlung',
          'Sondertransport — Hochzeitsfahrzeuge, Protokolltransfers, VIP-Gästeempfang',
        ],
      },
      {
        heading: 'Warum Istanbul VIP Transfer?',
        isList: true,
        body: [
          'Als TÜRSAB-zugelassenes lizenziertes Unternehmen führen wir alle Operationen unter offizieller Gewährleistung durch',
          'Unser 24/7-Service bedeutet, dass Sie unseren Kundendienst jederzeit erreichen können',
          'Unsere Flugverfolgungssysteme ermöglichen eine Echtzeit-Anpassung bei Flugverspätungen',
          'Transparente Preisgestaltung: keine versteckten Gebühren, keine überraschenden Rechnungen',
          'Support auf Türkisch, Englisch, Russisch, Arabisch und weiteren Sprachen',
        ],
      },
      {
        heading: 'Kundenzufriedenheit hat für uns Priorität',
        body: 'Unsere Google-Bewertungen und die Stammkundenquote, die wir im Laufe der Jahre aufgebaut haben, sind das zuverlässigste Zeugnis für die Qualität unseres Services. Wir lesen jede Bewertung sorgfältig und betrachten jedes Feedback als Chance, unseren Service zu verbessern.',
      },
      {
        heading: 'Wir sind für Sie da',
        body: 'Ob Sie zum ersten Mal nach Istanbul kommen oder jeden Monat geschäftlich in diese Stadt fliegen — Sie möchten wissen, dass Sie jedes Mal denselben hochwertigen, zuverlässigen und pünktlichen Service erhalten. Das ist genau das, was Istanbul VIP Transfer verspricht. Kontaktieren Sie uns per WhatsApp, Telefon oder über unsere Website.',
      },
    ],
  },

  ru: {
    pageTitle: 'Istanbul VIP Transfer: Ваш адрес надёжных поездок',
    intro: 'Стамбул — город, соединяющий два континента, дышащий историей на каждом углу и открытый миру. В этом удивительном городе транспорт — это гораздо больше, чем обычная необходимость; это вопрос грамотного использования времени и комфорта. В Istanbul VIP Transfer мы предлагаем нашим пассажирам именно такой опыт: своевременную, безопасную и безупречную поездку.',
    sections: [
      {
        heading: 'Кто мы?',
        body: 'Istanbul VIP Transfer, действующий под брендом Hevra Turizm, — это лицензированная частная транспортная компания, зарегистрированная в Ассоциации туристических агентств Турции (TÜRSAB). Ставя безопасность и удовлетворённость пассажиров на первое место, мы обслуживаем широкую клиентуру — от индивидуальных путешественников до корпоративных делегаций. Наша философия проста: каждый клиент уникален, и каждая поездка имеет свои особые требования.',
      },
      {
        heading: 'Наш автопарк',
        body: 'Наш автопарк состоит исключительно из автомобилей Mercedes-Benz. Mercedes Vito — идеальный выбор для индивидуальных и малогрупповых трансферов (до 6 пассажиров). Mercedes Sprinter VIP подходит для крупных групп и корпоративных делегаций (до 12 пассажиров) и оснащён просторным салоном, кондиционером, кожаными сиденьями и водой. Все автомобили регулярно проходят техническое обслуживание, а наши водители профессионально обучены, лицензированы и опытны.',
      },
      {
        heading: 'Наши услуги',
        isList: true,
        body: [
          'Трансферы из аэропорта — встреча с табличкой в аэропорту Стамбула (IST) и Сабиха Гёкчен (SAW)',
          'VIP и городские услуги — трансферы в отели, корпоративный VIP-сервис, аренда автомобиля с водителем',
          'Межгородские трансферы — поездки из Стамбула в Анкару, Бурсу, Анталью, Измир и другие города',
          'Однодневные экскурсии — в Сапанджу–Масукие, Бурсу и Ялову',
          'Трансферы для медицинского туризма — в больницы и клиники на протяжении всего лечения',
          'Специальные мероприятия — свадебные автомобили, протокольные трансферы, приём VIP-гостей',
        ],
      },
      {
        heading: 'Почему Istanbul VIP Transfer?',
        isList: true,
        body: [
          'Как компания, лицензированная TÜRSAB, мы работаем под официальными гарантиями',
          'Служба поддержки доступна 24/7 — мы на связи в любое время',
          'Системы отслеживания рейсов обеспечивают адаптацию к задержкам в реальном времени',
          'Прозрачные цены: без скрытых платежей и неожиданных счетов',
          'Обслуживание на турецком, английском, русском, арабском и других языках',
        ],
      },
      {
        heading: 'Удовлетворённость клиентов — наш приоритет',
        body: 'Наши отзывы в Google и высокий процент повторных клиентов — наиболее надёжное свидетельство качества нашего сервиса. Мы внимательно читаем каждый отзыв и используем каждое замечание как возможность для улучшения.',
      },
      {
        heading: 'Мы здесь для вас',
        body: 'Приезжаете ли вы в Стамбул впервые или летаете сюда по делам каждый месяц — вы хотите знать, что каждый раз получите одинаково качественный, надёжный и пунктуальный сервис. Именно это и обещает Istanbul VIP Transfer. Свяжитесь с нами через WhatsApp, телефон или наш сайт.',
      },
    ],
  },

  ar: {
    pageTitle: 'Istanbul VIP Transfer: عنوانك للسفر الموثوق',
    intro: 'إسطنبول — مدينة تجمع بين قارتين، وتتنفس التاريخ في كل زاوية، وتنفتح على العالم. في هذه المدينة الرائعة، التنقل أكثر بكثير من مجرد ضرورة؛ إنه مسألة الاستغلال الأمثل للوقت والراحة. في Istanbul VIP Transfer، نقدم لركابنا هذه التجربة بالضبط: رحلة في الموعد المحدد وآمنة ومثالية.',
    sections: [
      {
        heading: 'من نحن؟',
        body: 'Istanbul VIP Transfer، العاملة تحت مظلة Hevra Turizm، شركة نقل خاصة مرخصة مسجلة في جمعية وكالات السفر التركية (TÜRSAB). بفلسفة تضع سلامة الركاب ورضاهم في المقام الأول، نخدم شريحة واسعة من العملاء تتراوح بين المسافرين الأفراد والوفود المؤسسية. فلسفتنا بسيطة: كل عميل مختلف، وكل رحلة لها متطلباتها الخاصة.',
      },
      {
        heading: 'أسطولنا من المركبات',
        body: 'يتكون أسطولنا بالكامل من سيارات Mercedes-Benz. Mercedes Vito هو الخيار المفضل للرحلات الفردية والمجموعات الصغيرة (حتى 6 ركاب). أما Mercedes Sprinter VIP فمثالي للمجموعات الكبيرة (حتى 12 راكباً) بفضل مساحته الداخلية الواسعة والتكييف والمقاعد الجلدية وخدمة المياه. تخضع مركباتنا لصيانة فنية منتظمة، وسائقونا مدربون احترافياً ومرخصون وذوو خبرة.',
      },
      {
        heading: 'خدماتنا',
        isList: true,
        body: [
          'نقل المطار — خدمة الاستقبال من مطار إسطنبول (IST) ومطار صبيحة كوكجن (SAW)',
          'خدمات VIP والمدينة — نقل الفنادق وخدمات VIP المؤسسية وتأجير السيارات مع سائق',
          'النقل بين المدن — نقل خاص من باب إلى باب من إسطنبول إلى أنقرة وبورصة وأنطاليا وإزمير وغيرها',
          'جولات ليوم واحد — جولات خاصة إلى سابانجا وبورصة ويالوفا',
          'نقل السياحة الطبية — النقل إلى المستشفيات والعيادات طوال فترة العلاج',
          'نقل المناسبات الخاصة — سيارات الأفراح والنقل البروتوكولي واستقبال ضيوف VIP',
        ],
      },
      {
        heading: 'لماذا Istanbul VIP Transfer؟',
        isList: true,
        body: [
          'بصفتنا شركة مرخصة معتمدة من TÜRSAB، تسير جميع عملياتنا تحت ضمان رسمي',
          'خدماتنا متاحة 24/7 — يمكنك التواصل مع فريق دعم العملاء في أي وقت',
          'أنظمة تتبع الرحلات لدينا تتكيف مع التأخيرات في الوقت الفعلي',
          'أسعار شفافة: لا رسوم مخفية ولا فواتير مفاجئة',
          'دعم باللغات التركية والإنجليزية والروسية والعربية وغيرها',
        ],
      },
      {
        heading: 'رضا العملاء أولويتنا',
        body: 'تُعدّ تقييماتنا على Google ومعدل العملاء المتكررين الذي بنيناه على مر السنين أوثق دليل على جودة الخدمة التي نقدمها. نقرأ كل تقييم بعناية ونعتبر كل ملاحظة فرصة لتحسين خدمتنا.',
      },
      {
        heading: 'نحن هنا من أجلك',
        body: 'سواء كنت تزور إسطنبول للمرة الأولى أو تسافر إليها شهرياً لأغراض العمل، تريد أن تعلم أنك ستحصل على نفس الخدمة عالية الجودة والموثوقة والمنضبطة في كل مرة. هذا بالضبط ما يعد به Istanbul VIP Transfer. تواصل معنا عبر واتساب أو الهاتف أو موقعنا الإلكتروني.',
      },
    ],
  },

  fr: {
    pageTitle: 'Istanbul VIP Transfer : Votre adresse pour des voyages fiables',
    intro: 'Istanbul — une ville qui relie deux continents, respire l\'histoire à chaque coin de rue et s\'ouvre sur le monde. Dans cette ville magnifique, le transport est bien plus qu\'un simple besoin ; c\'est une question de gestion optimale du temps et du confort. Chez Istanbul VIP Transfer, nous offrons à nos passagers exactement cette expérience : un voyage ponctuel, sûr et irréprochable.',
    sections: [
      {
        heading: 'Qui sommes-nous ?',
        body: 'Istanbul VIP Transfer, opérant sous Hevra Turizm, est une société de transport privé agréée, enregistrée auprès de l\'Association des agences de voyages turques (TÜRSAB). Avec une philosophie qui place la sécurité et la satisfaction des passagers au premier plan, nous servons une clientèle étendue allant des voyageurs individuels aux délégations d\'entreprises. Notre philosophie est simple : chaque client est différent, et chaque voyage a ses propres exigences.',
      },
      {
        heading: 'Notre flotte de véhicules',
        body: 'Notre flotte est entièrement composée de véhicules Mercedes-Benz. Le Mercedes Vito est le choix privilégié pour les transferts individuels et en petits groupes (jusqu\'à 6 passagers). Le Mercedes Sprinter VIP est idéal pour les grands groupes (jusqu\'à 12 passagers) avec un habitacle spacieux, climatisation, sièges en cuir et service d\'eau. Nos véhicules font l\'objet d\'entretiens réguliers et nos chauffeurs sont professionnellement formés, agréés et expérimentés.',
      },
      {
        heading: 'Notre gamme de services',
        isList: true,
        body: [
          'Transferts aéroport — Service d\'accueil depuis l\'aéroport d\'Istanbul (IST) et Sabiha Gökçen (SAW)',
          'VIP & services urbains — Transferts hôtels, services VIP entreprises, location avec chauffeur',
          'Transferts interurbains — Transferts privés porte-à-porte d\'Istanbul vers Ankara, Bursa, Antalya, Izmir et au-delà',
          'Excursions d\'une journée — Tours privés vers Sapanca–Maşukiye, Bursa et Yalova',
          'Transferts tourisme médical — Hôpitaux et cliniques tout au long du traitement',
          'Transport événementiel — Voitures de mariage, transferts protocolaires, accueil VIP',
        ],
      },
      {
        heading: 'Pourquoi Istanbul VIP Transfer ?',
        isList: true,
        body: [
          'En tant que société agréée TÜRSAB, toutes nos opérations sont menées sous garantie officielle',
          'Notre service 24h/24 7j/7 vous permet de joindre notre équipe à tout moment',
          'Nos systèmes de suivi des vols permettent une adaptation en temps réel aux retards',
          'Tarification transparente : aucun frais caché, aucune facture surprise',
          'Assistance en turc, anglais, russe, arabe et d\'autres langues',
        ],
      },
      {
        heading: 'La satisfaction client est notre priorité',
        body: 'Nos avis Google et notre taux de clients fidèles, construits au fil des années, témoignent de la qualité de nos services. Nous lisons chaque avis avec attention et considérons chaque retour comme une opportunité d\'amélioration.',
      },
      {
        heading: 'Nous sommes là pour vous',
        body: 'Que vous visitiez Istanbul pour la première fois ou que vous y veniez chaque mois pour affaires, vous voulez avoir la certitude de bénéficier à chaque fois du même service de qualité, fiable et ponctuel. C\'est exactement ce que promet Istanbul VIP Transfer. Contactez-nous par WhatsApp, téléphone ou via notre site web.',
      },
    ],
  },

  es: {
    pageTitle: 'Istanbul VIP Transfer: Su dirección para viajes confiables',
    intro: 'Estambul — una ciudad que une dos continentes, respira historia en cada rincón y se abre al mundo. En esta magnífica ciudad, el transporte es mucho más que una necesidad ordinaria; es una cuestión de aprovechar al máximo el tiempo y el confort. En Istanbul VIP Transfer, ofrecemos a nuestros pasajeros exactamente esta experiencia: un viaje puntual, seguro e impecable.',
    sections: [
      {
        heading: '¿Quiénes somos?',
        body: 'Istanbul VIP Transfer, que opera bajo Hevra Turizm, es una empresa de transporte privado con licencia, registrada en la Asociación de Agencias de Viajes de Turquía (TÜRSAB). Con una filosofía que pone la seguridad y satisfacción de los pasajeros por encima de todo, servimos a una amplia clientela que va desde viajeros individuales hasta delegaciones corporativas. Nuestra filosofía es sencilla: cada cliente es diferente y cada viaje tiene sus propios requisitos.',
      },
      {
        heading: 'Nuestra flota de vehículos',
        body: 'Nuestra flota está compuesta íntegramente por vehículos Mercedes-Benz. El Mercedes Vito es la opción preferida para traslados individuales y en grupos pequeños de hasta seis pasajeros. El Mercedes Sprinter VIP es ideal para grupos más grandes (hasta 12 pasajeros) con amplio interior, aire acondicionado, asientos de cuero y servicio de agua. Nuestros vehículos pasan mantenimientos técnicos periódicos y nuestros conductores son profesionalmente formados, con licencia y experiencia.',
      },
      {
        heading: 'Nuestros servicios',
        isList: true,
        body: [
          'Traslados al aeropuerto — Servicio de bienvenida desde el Aeropuerto de Estambul (IST) y Sabiha Gökçen (SAW)',
          'VIP y servicios urbanos — Traslados de hotel, servicios VIP corporativos, vehículo con conductor',
          'Traslados interurbanos — Traslados privados puerta a puerta desde Estambul a Ankara, Bursa, Antalya, Izmir y más',
          'Excursiones de un día — Tours privados a Sapanca–Maşukiye, Bursa y Yalova',
          'Traslados de turismo médico — Hospitales y clínicas durante todo el tratamiento',
          'Transporte para eventos especiales — Coches de boda, traslados de protocolo, recepción de VIP',
        ],
      },
      {
        heading: '¿Por qué Istanbul VIP Transfer?',
        isList: true,
        body: [
          'Como empresa con licencia aprobada por TÜRSAB, todas nuestras operaciones se realizan bajo garantía oficial',
          'Nuestro servicio 24/7 le permite contactar con nuestro equipo en cualquier momento',
          'Nuestros sistemas de seguimiento de vuelos permiten adaptación en tiempo real a los retrasos',
          'Precios transparentes: sin cargos ocultos ni facturas sorpresa',
          'Atención en turco, inglés, ruso, árabe y otros idiomas',
        ],
      },
      {
        heading: 'La satisfacción del cliente es nuestra prioridad',
        body: 'Nuestras reseñas en Google y la tasa de clientes recurrentes que hemos acumulado a lo largo de los años son el testimonio más fiable de la calidad de nuestro servicio. Leemos cada reseña con atención y consideramos cada comentario como una oportunidad de mejora.',
      },
      {
        heading: 'Estamos aquí para usted',
        body: 'Ya sea que visite Estambul por primera vez o vuele a esta ciudad cada mes por negocios, desea saber que recibirá el mismo servicio de alta calidad, confiable y puntual cada vez. Eso es exactamente lo que promete Istanbul VIP Transfer. Contáctenos por WhatsApp, teléfono o nuestra página web.',
      },
    ],
  },

  it: {
    pageTitle: 'Istanbul VIP Transfer: Il vostro indirizzo per viaggi affidabili',
    intro: 'Istanbul — una città che unisce due continenti, respira storia ad ogni angolo e si apre al mondo. In questa magnifica città, il trasporto è molto più di una semplice necessità; è una questione di sfruttare al meglio il tempo e il comfort. In Istanbul VIP Transfer, offriamo ai nostri passeggeri esattamente questa esperienza: un viaggio puntuale, sicuro e impeccabile.',
    sections: [
      {
        heading: 'Chi siamo?',
        body: 'Istanbul VIP Transfer, che opera sotto Hevra Turizm, è una società di trasporto privato autorizzata, registrata presso l\'Associazione delle Agenzie di Viaggio Turche (TÜRSAB). Con una filosofia che mette la sicurezza e la soddisfazione dei passeggeri al primo posto, serviamo una vasta clientela che spazia dai viaggiatori individuali alle delegazioni aziendali. La nostra filosofia è semplice: ogni cliente è diverso e ogni viaggio ha le proprie esigenze particolari.',
      },
      {
        heading: 'La nostra flotta di veicoli',
        body: 'La nostra flotta è composta interamente da veicoli Mercedes-Benz. Il Mercedes Vito è la scelta preferita per transfer individuali e in piccoli gruppi (fino a 6 passeggeri). Il Mercedes Sprinter VIP è ideale per gruppi più grandi (fino a 12 passeggeri) con ampi interni, aria condizionata, sedili in pelle e servizio acqua. I nostri veicoli vengono sottoposti a manutenzione tecnica regolare e i nostri autisti sono professionalmente formati, autorizzati ed esperti.',
      },
      {
        heading: 'La nostra gamma di servizi',
        isList: true,
        body: [
          'Transfer aeroporto — Servizio di accoglienza dall\'Aeroporto di Istanbul (IST) e Sabiha Gökçen (SAW)',
          'VIP e servizi urbani — Transfer hotel, servizi VIP aziendali, auto con conducente',
          'Transfer intercity — Transfer privati porta a porta da Istanbul ad Ankara, Bursa, Antalya, Izmir e oltre',
          'Gite di un giorno — Tour privati a Sapanca–Maşukiye, Bursa e Yalova',
          'Transfer turismo medico — Ospedali e cliniche durante tutto il percorso di cura',
          'Trasporto per eventi speciali — Auto da cerimonia, transfer protocollari, accoglienza VIP',
        ],
      },
      {
        heading: 'Perché Istanbul VIP Transfer?',
        isList: true,
        body: [
          'Come azienda con licenza approvata da TÜRSAB, tutte le nostre operazioni sono condotte con garanzia ufficiale',
          'Il nostro servizio 24/7 vi permette di contattare il nostro team in qualsiasi momento',
          'I nostri sistemi di tracciamento dei voli consentono un adattamento in tempo reale ai ritardi',
          'Prezzi trasparenti: nessun costo nascosto, nessuna fattura a sorpresa',
          'Assistenza in turco, inglese, russo, arabo e altre lingue',
        ],
      },
      {
        heading: 'La soddisfazione del cliente è la nostra priorità',
        body: 'Le nostre recensioni su Google e il tasso di clienti abituali che abbiamo accumulato negli anni sono la testimonianza più affidabile della qualità del nostro servizio. Leggiamo ogni recensione con attenzione e consideriamo ogni feedback come un\'opportunità di miglioramento.',
      },
      {
        heading: 'Siamo qui per voi',
        body: 'Che visitiate Istanbul per la prima volta o che ci veniate ogni mese per affari, volete sapere che riceverete ogni volta lo stesso servizio di alta qualità, affidabile e puntuale. È esattamente questo ciò che promette Istanbul VIP Transfer. Contattateci tramite WhatsApp, telefono o il nostro sito web.',
      },
    ],
  },

  nl: {
    pageTitle: 'Istanbul VIP Transfer: Uw adres voor betrouwbare reizen',
    intro: 'Istanbul — een stad die twee continenten verbindt, op elke hoek geschiedenis ademt en zich opent naar de wereld. In deze prachtige stad is vervoer veel meer dan een gewone behoefte; het is een kwestie van het optimaal benutten van tijd en comfort. Bij Istanbul VIP Transfer bieden wij onze passagiers precies deze ervaring: een tijdige, veilige en vlekkeloze reis.',
    sections: [
      {
        heading: 'Wie zijn wij?',
        body: 'Istanbul VIP Transfer, werkend onder Hevra Turizm, is een erkend privé-transportbedrijf dat geregistreerd is bij de Turkse vereniging van reisbureaus (TÜRSAB). Met een filosofie die de veiligheid en tevredenheid van passagiers vooropstelt, bedienen wij een brede klantenkring van individuele reizigers tot bedrijfsdelegaties. Onze filosofie is eenvoudig: elke klant is anders en elke reis heeft zijn eigen unieke vereisten.',
      },
      {
        heading: 'Onze voertuigvloot',
        body: 'Onze vloot bestaat volledig uit Mercedes-Benz voertuigen. De Mercedes Vito is de voorkeurskeuze voor individuele en kleine groepstransfers (tot 6 passagiers). De Mercedes Sprinter VIP is ideaal voor grotere groepen (tot 12 passagiers) met een ruim interieur, airconditioning, lederen stoelen en waterservice. Onze voertuigen ondergaan regelmatige technische onderhoudsbeurten en onze chauffeurs zijn professioneel opgeleid, erkend en ervaren.',
      },
      {
        heading: 'Ons dienstenaanbod',
        isList: true,
        body: [
          'Luchthaventransfers — Ontvangstservice vanuit Istanbul Airport (IST) en Sabiha Gökçen (SAW)',
          'VIP & stedelijke diensten — Hoteltransfers, zakelijke VIP-diensten, auto met chauffeur',
          'Intercitytransfers — Deur-tot-deur privétransfers van Istanbul naar Ankara, Bursa, Antalya, Izmir en verder',
          'Dagtochten — Privétours naar Sapanca–Maşukiye, Bursa en Yalova',
          'Medisch toerisme transfers — Ziekenhuizen en klinieken gedurende de gehele behandeling',
          'Bijzonder evenementenvervoer — Trouwauto\'s, protocoltransfers, ontvangst VIP-gasten',
        ],
      },
      {
        heading: 'Waarom Istanbul VIP Transfer?',
        isList: true,
        body: [
          'Als TÜRSAB-goedgekeurd erkend bedrijf worden alle operaties uitgevoerd onder officiële garantie',
          'Onze 24/7 service betekent dat u onze klantenservice altijd kunt bereiken',
          'Onze vluchtvolgsystemen zorgen voor real-time aanpassing aan vertragingen',
          'Transparante prijzen: geen verborgen kosten, geen verrassende facturen',
          'Ondersteuning in Turks, Engels, Russisch, Arabisch en andere talen',
        ],
      },
      {
        heading: 'Klanttevredenheid is onze prioriteit',
        body: 'Onze Google-reviews en de herhalingsklantrate die wij door de jaren heen hebben opgebouwd, zijn het meest betrouwbare bewijs van de kwaliteit van onze service. We lezen elke review zorgvuldig en beschouwen elke feedback als een kans om onze service te verbeteren.',
      },
      {
        heading: 'Wij zijn er voor u',
        body: 'Of u nu voor het eerst naar Istanbul komt of elke maand voor zaken naar deze stad vliegt — u wilt weten dat u elke keer dezelfde hoogwaardige, betrouwbare en stipte service ontvangt. Dat is precies wat Istanbul VIP Transfer belooft. Neem contact met ons op via WhatsApp, telefoon of onze website.',
      },
    ],
  },
};
