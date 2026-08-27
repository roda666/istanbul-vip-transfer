/**
 * Small, shared public UI vocabulary for controls that are not CMS content.
 * Keep this separate from the CMS so a missing record can never expose the
 * Turkish source text on a published non-Turkish route.
 */
export interface PublicUiCopy {
  location: {
    airport: string;
    province: string;
    district: string;
    region: string;
    hotelZone: string;
    other: string;
    loading: string;
    selectOrType: string;
    noResults: string;
    clearSelection: string;
  };
  vehicles: {
    previous: string;
    next: string;
    slide: (position: number) => string;
  };
  routes: {
    previous: string;
    next: string;
  };
  errors: {
    label: string;
    heading: string;
    message: string;
    retry: string;
    home: string;
  };
}

const copy = {
  tr: {
    location: { airport: 'Havalimanları', province: 'İller', district: 'İstanbul ilçeleri', region: 'Bölgeler', hotelZone: 'Otel bölgeleri', other: 'Diğer', loading: 'Yükleniyor…', selectOrType: 'Konum seçin veya yazın', noResults: 'Sonuç bulunamadı', clearSelection: 'Seçimi temizle' },
    vehicles: { previous: 'Önceki araç', next: 'Sonraki araç', slide: (position: number) => `Araç ${position}` },
    routes: { previous: 'Önceki güzergah', next: 'Sonraki güzergah' },
    errors: { label: 'Beklenmeyen hata', heading: 'Bir şeyler ters gitti', message: 'İşleminiz gerçekleştirilirken beklenmeyen bir hata oluştu. Tekrar deneyebilir veya ana sayfaya dönebilirsiniz.', retry: 'Tekrar dene', home: 'Ana sayfaya dön' },
  },
  en: {
    location: { airport: 'Airports', province: 'Provinces', district: 'Istanbul districts', region: 'Regions', hotelZone: 'Hotel areas', other: 'Other', loading: 'Loading…', selectOrType: 'Select or type a location', noResults: 'No results found', clearSelection: 'Clear selection' },
    vehicles: { previous: 'Previous vehicle', next: 'Next vehicle', slide: (position: number) => `Vehicle ${position}` },
    routes: { previous: 'Previous route', next: 'Next route' },
    errors: { label: 'Unexpected error', heading: 'Something went wrong', message: 'An unexpected error occurred while completing your request. Please try again or return to the home page.', retry: 'Try again', home: 'Back to home' },
  },
  de: {
    location: { airport: 'Flughäfen', province: 'Provinzen', district: 'Istanbuler Stadtteile', region: 'Regionen', hotelZone: 'Hotelbereiche', other: 'Weitere', loading: 'Wird geladen…', selectOrType: 'Ort auswählen oder eingeben', noResults: 'Keine Ergebnisse gefunden', clearSelection: 'Auswahl löschen' },
    vehicles: { previous: 'Vorheriges Fahrzeug', next: 'Nächstes Fahrzeug', slide: (position: number) => `Fahrzeug ${position}` },
    routes: { previous: 'Vorherige Strecke', next: 'Nächste Strecke' },
    errors: { label: 'Unerwarteter Fehler', heading: 'Etwas ist schiefgelaufen', message: 'Bei Ihrer Anfrage ist ein unerwarteter Fehler aufgetreten. Bitte versuchen Sie es erneut oder kehren Sie zur Startseite zurück.', retry: 'Erneut versuchen', home: 'Zur Startseite' },
  },
  ru: {
    location: { airport: 'Аэропорты', province: 'Провинции', district: 'Районы Стамбула', region: 'Регионы', hotelZone: 'Отельные зоны', other: 'Другое', loading: 'Загрузка…', selectOrType: 'Выберите или введите место', noResults: 'Ничего не найдено', clearSelection: 'Очистить выбор' },
    vehicles: { previous: 'Предыдущий автомобиль', next: 'Следующий автомобиль', slide: (position: number) => `Автомобиль ${position}` },
    routes: { previous: 'Предыдущий маршрут', next: 'Следующий маршрут' },
    errors: { label: 'Непредвиденная ошибка', heading: 'Что-то пошло не так', message: 'Во время обработки запроса произошла непредвиденная ошибка. Повторите попытку или вернитесь на главную страницу.', retry: 'Повторить', home: 'На главную' },
  },
  ar: {
    location: { airport: 'المطارات', province: 'المحافظات', district: 'أحياء إسطنبول', region: 'المناطق', hotelZone: 'مناطق الفنادق', other: 'أخرى', loading: 'جارٍ التحميل…', selectOrType: 'اختر موقعاً أو اكتبه', noResults: 'لا توجد نتائج', clearSelection: 'مسح الاختيار' },
    vehicles: { previous: 'المركبة السابقة', next: 'المركبة التالية', slide: (position: number) => `المركبة ${position}` },
    routes: { previous: 'المسار السابق', next: 'المسار التالي' },
    errors: { label: 'خطأ غير متوقع', heading: 'حدث خطأ ما', message: 'حدث خطأ غير متوقع أثناء معالجة طلبك. حاول مرة أخرى أو عد إلى الصفحة الرئيسية.', retry: 'حاول مجدداً', home: 'العودة إلى الرئيسية' },
  },
  es: {
    location: { airport: 'Aeropuertos', province: 'Provincias', district: 'Distritos de Estambul', region: 'Regiones', hotelZone: 'Zonas hoteleras', other: 'Otros', loading: 'Cargando…', selectOrType: 'Seleccione o escriba una ubicación', noResults: 'No se encontraron resultados', clearSelection: 'Borrar selección' },
    vehicles: { previous: 'Vehículo anterior', next: 'Siguiente vehículo', slide: (position: number) => `Vehículo ${position}` },
    routes: { previous: 'Ruta anterior', next: 'Siguiente ruta' },
    errors: { label: 'Error inesperado', heading: 'Algo salió mal', message: 'Se produjo un error inesperado al procesar su solicitud. Inténtelo de nuevo o vuelva a la página de inicio.', retry: 'Intentar de nuevo', home: 'Volver al inicio' },
  },
  fr: {
    location: { airport: 'Aéroports', province: 'Provinces', district: 'Quartiers d’Istanbul', region: 'Régions', hotelZone: 'Zones hôtelières', other: 'Autre', loading: 'Chargement…', selectOrType: 'Sélectionnez ou saisissez un lieu', noResults: 'Aucun résultat trouvé', clearSelection: 'Effacer la sélection' },
    vehicles: { previous: 'Véhicule précédent', next: 'Véhicule suivant', slide: (position: number) => `Véhicule ${position}` },
    routes: { previous: 'Itinéraire précédent', next: 'Itinéraire suivant' },
    errors: { label: 'Erreur inattendue', heading: 'Un problème est survenu', message: 'Une erreur inattendue est survenue pendant le traitement de votre demande. Réessayez ou retournez à l’accueil.', retry: 'Réessayer', home: 'Retour à l’accueil' },
  },
  it: {
    location: { airport: 'Aeroporti', province: 'Province', district: 'Distretti di Istanbul', region: 'Regioni', hotelZone: 'Zone alberghiere', other: 'Altro', loading: 'Caricamento…', selectOrType: 'Seleziona o digita una località', noResults: 'Nessun risultato trovato', clearSelection: 'Cancella selezione' },
    vehicles: { previous: 'Veicolo precedente', next: 'Veicolo successivo', slide: (position: number) => `Veicolo ${position}` },
    routes: { previous: 'Percorso precedente', next: 'Percorso successivo' },
    errors: { label: 'Errore imprevisto', heading: 'Qualcosa è andato storto', message: 'Si è verificato un errore imprevisto durante la richiesta. Riprova o torna alla pagina iniziale.', retry: 'Riprova', home: 'Torna alla pagina iniziale' },
  },
  nl: {
    location: { airport: 'Luchthavens', province: 'Provincies', district: 'Wijken van Istanbul', region: 'Regio’s', hotelZone: 'Hotelgebieden', other: 'Overig', loading: 'Laden…', selectOrType: 'Selecteer of typ een locatie', noResults: 'Geen resultaten gevonden', clearSelection: 'Selectie wissen' },
    vehicles: { previous: 'Vorige voertuig', next: 'Volgende voertuig', slide: (position: number) => `Voertuig ${position}` },
    routes: { previous: 'Vorige route', next: 'Volgende route' },
    errors: { label: 'Onverwachte fout', heading: 'Er is iets misgegaan', message: 'Er is een onverwachte fout opgetreden tijdens uw aanvraag. Probeer het opnieuw of ga terug naar de startpagina.', retry: 'Opnieuw proberen', home: 'Terug naar startpagina' },
  },
} satisfies Record<string, PublicUiCopy>;

/** Returns English for unknown locales, never Turkish. */
export function getPublicUiCopy(locale: string): PublicUiCopy {
  return copy[locale as keyof typeof copy] ?? copy.en;
}