/**
 * Language catalog — languages the OpenAI translation provider handles reliably,
 * plus a few low-resource languages explicitly marked providerSupported: false.
 *
 * Order: Turkish (source), then the 8 launched languages, then the rest.
 * All locale codes are valid BCP 47; scripts are ISO 15924.
 *
 * Shared between the seed script and (indirectly, via the DB) the admin UI.
 */

import { LOCALE_REGISTRY } from '../lib/i18n/locale-registry';

/**
 * The 9 supported locale codes — derived from the registry so adding a new
 * locale to locale-registry.ts is the ONLY change required.
 */
export const CORE_LANGS: readonly string[] = LOCALE_REGISTRY.map((l) => l.code);

export interface CatalogLanguage {
  code: string;
  locale: string;
  name: string;
  nativeName: string;
  turkishName: string;
  script: string;
  direction: 'ltr' | 'rtl';
  /** Defaults to true. */
  providerSupported?: boolean;
}

export const LANGUAGE_CATALOG: CatalogLanguage[] = [
  // ── Core 9 (TR source + 8 launched) ─────────────────────────────────────
  { code: 'tr', locale: 'tr-TR', name: 'Turkish', nativeName: 'Türkçe', turkishName: 'Türkçe', script: 'Latn', direction: 'ltr' },
  { code: 'en', locale: 'en-GB', name: 'English', nativeName: 'English', turkishName: 'İngilizce', script: 'Latn', direction: 'ltr' },
  { code: 'de', locale: 'de-DE', name: 'German', nativeName: 'Deutsch', turkishName: 'Almanca', script: 'Latn', direction: 'ltr' },
  { code: 'ru', locale: 'ru-RU', name: 'Russian', nativeName: 'Русский', turkishName: 'Rusça', script: 'Cyrl', direction: 'ltr' },
  { code: 'ar', locale: 'ar-SA', name: 'Arabic', nativeName: 'العربية', turkishName: 'Arapça', script: 'Arab', direction: 'rtl' },

  // ── Rest of catalog (passive by default) ─────────────────────────────────
  { code: 'sq', locale: 'sq-AL', name: 'Albanian', nativeName: 'Shqip', turkishName: 'Arnavutça', script: 'Latn', direction: 'ltr' },
  { code: 'az', locale: 'az-AZ', name: 'Azerbaijani', nativeName: 'Azərbaycanca', turkishName: 'Azerbaycanca', script: 'Latn', direction: 'ltr' },
  { code: 'eu', locale: 'eu-ES', name: 'Basque', nativeName: 'Euskara', turkishName: 'Baskça', script: 'Latn', direction: 'ltr' },
  { code: 'be', locale: 'be-BY', name: 'Belarusian', nativeName: 'Беларуская', turkishName: 'Belarusça', script: 'Cyrl', direction: 'ltr' },
  { code: 'bn', locale: 'bn-BD', name: 'Bengali', nativeName: 'বাংলা', turkishName: 'Bengalce', script: 'Beng', direction: 'ltr' },
  { code: 'bs', locale: 'bs-BA', name: 'Bosnian', nativeName: 'Bosanski', turkishName: 'Boşnakça', script: 'Latn', direction: 'ltr' },
  { code: 'bg', locale: 'bg-BG', name: 'Bulgarian', nativeName: 'Български', turkishName: 'Bulgarca', script: 'Cyrl', direction: 'ltr' },
  { code: 'ca', locale: 'ca-ES', name: 'Catalan', nativeName: 'Català', turkishName: 'Katalanca', script: 'Latn', direction: 'ltr' },
  { code: 'zh', locale: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文', turkishName: 'Çince (Basitleştirilmiş)', script: 'Hans', direction: 'ltr' },
  { code: 'zh-TW', locale: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文', turkishName: 'Çince (Geleneksel)', script: 'Hant', direction: 'ltr' },
  { code: 'hr', locale: 'hr-HR', name: 'Croatian', nativeName: 'Hrvatski', turkishName: 'Hırvatça', script: 'Latn', direction: 'ltr' },
  { code: 'cs', locale: 'cs-CZ', name: 'Czech', nativeName: 'Čeština', turkishName: 'Çekçe', script: 'Latn', direction: 'ltr' },
  { code: 'da', locale: 'da-DK', name: 'Danish', nativeName: 'Dansk', turkishName: 'Danca', script: 'Latn', direction: 'ltr' },
  { code: 'nl', locale: 'nl-NL', name: 'Dutch', nativeName: 'Nederlands', turkishName: 'Felemenkçe', script: 'Latn', direction: 'ltr' },
  { code: 'et', locale: 'et-EE', name: 'Estonian', nativeName: 'Eesti', turkishName: 'Estonca', script: 'Latn', direction: 'ltr' },
  { code: 'fi', locale: 'fi-FI', name: 'Finnish', nativeName: 'Suomi', turkishName: 'Fince', script: 'Latn', direction: 'ltr' },
  { code: 'fr', locale: 'fr-FR', name: 'French', nativeName: 'Français', turkishName: 'Fransızca', script: 'Latn', direction: 'ltr' },
  { code: 'gl', locale: 'gl-ES', name: 'Galician', nativeName: 'Galego', turkishName: 'Galiçyaca', script: 'Latn', direction: 'ltr' },
  { code: 'ka', locale: 'ka-GE', name: 'Georgian', nativeName: 'ქართული', turkishName: 'Gürcüce', script: 'Geor', direction: 'ltr' },
  { code: 'el', locale: 'el-GR', name: 'Greek', nativeName: 'Ελληνικά', turkishName: 'Yunanca', script: 'Grek', direction: 'ltr' },
  { code: 'gu', locale: 'gu-IN', name: 'Gujarati', nativeName: 'ગુજરાતી', turkishName: 'Guceratça', script: 'Gujr', direction: 'ltr' },
  { code: 'he', locale: 'he-IL', name: 'Hebrew', nativeName: 'עברית', turkishName: 'İbranice', script: 'Hebr', direction: 'rtl' },
  { code: 'hi', locale: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी', turkishName: 'Hintçe', script: 'Deva', direction: 'ltr' },
  { code: 'hu', locale: 'hu-HU', name: 'Hungarian', nativeName: 'Magyar', turkishName: 'Macarca', script: 'Latn', direction: 'ltr' },
  { code: 'is', locale: 'is-IS', name: 'Icelandic', nativeName: 'Íslenska', turkishName: 'İzlandaca', script: 'Latn', direction: 'ltr' },
  { code: 'id', locale: 'id-ID', name: 'Indonesian', nativeName: 'Bahasa Indonesia', turkishName: 'Endonezce', script: 'Latn', direction: 'ltr' },
  { code: 'it', locale: 'it-IT', name: 'Italian', nativeName: 'Italiano', turkishName: 'İtalyanca', script: 'Latn', direction: 'ltr' },
  { code: 'ja', locale: 'ja-JP', name: 'Japanese', nativeName: '日本語', turkishName: 'Japonca', script: 'Jpan', direction: 'ltr' },
  { code: 'kk', locale: 'kk-KZ', name: 'Kazakh', nativeName: 'Қазақша', turkishName: 'Kazakça', script: 'Cyrl', direction: 'ltr' },
  { code: 'ko', locale: 'ko-KR', name: 'Korean', nativeName: '한국어', turkishName: 'Korece', script: 'Kore', direction: 'ltr' },
  { code: 'lv', locale: 'lv-LV', name: 'Latvian', nativeName: 'Latviešu', turkishName: 'Letonca', script: 'Latn', direction: 'ltr' },
  { code: 'lt', locale: 'lt-LT', name: 'Lithuanian', nativeName: 'Lietuvių', turkishName: 'Litvanca', script: 'Latn', direction: 'ltr' },
  { code: 'mk', locale: 'mk-MK', name: 'Macedonian', nativeName: 'Македонски', turkishName: 'Makedonca', script: 'Cyrl', direction: 'ltr' },
  { code: 'ms', locale: 'ms-MY', name: 'Malay', nativeName: 'Bahasa Melayu', turkishName: 'Malayca', script: 'Latn', direction: 'ltr' },
  { code: 'ml', locale: 'ml-IN', name: 'Malayalam', nativeName: 'മലയാളം', turkishName: 'Malayalamca', script: 'Mlym', direction: 'ltr' },
  { code: 'mr', locale: 'mr-IN', name: 'Marathi', nativeName: 'मराठी', turkishName: 'Marathice', script: 'Deva', direction: 'ltr' },
  { code: 'mn', locale: 'mn-MN', name: 'Mongolian', nativeName: 'Монгол', turkishName: 'Moğolca', script: 'Cyrl', direction: 'ltr' },
  { code: 'no', locale: 'nb-NO', name: 'Norwegian', nativeName: 'Norsk', turkishName: 'Norveççe', script: 'Latn', direction: 'ltr' },
  { code: 'fa', locale: 'fa-IR', name: 'Persian', nativeName: 'فارسی', turkishName: 'Farsça', script: 'Arab', direction: 'rtl' },
  { code: 'pl', locale: 'pl-PL', name: 'Polish', nativeName: 'Polski', turkishName: 'Lehçe', script: 'Latn', direction: 'ltr' },
  { code: 'pt', locale: 'pt-PT', name: 'Portuguese', nativeName: 'Português', turkishName: 'Portekizce', script: 'Latn', direction: 'ltr' },
  { code: 'pt-BR', locale: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)', turkishName: 'Portekizce (Brezilya)', script: 'Latn', direction: 'ltr' },
  { code: 'ro', locale: 'ro-RO', name: 'Romanian', nativeName: 'Română', turkishName: 'Rumence', script: 'Latn', direction: 'ltr' },
  { code: 'sr', locale: 'sr-RS', name: 'Serbian', nativeName: 'Српски', turkishName: 'Sırpça', script: 'Cyrl', direction: 'ltr' },
  { code: 'sk', locale: 'sk-SK', name: 'Slovak', nativeName: 'Slovenčina', turkishName: 'Slovakça', script: 'Latn', direction: 'ltr' },
  { code: 'sl', locale: 'sl-SI', name: 'Slovenian', nativeName: 'Slovenščina', turkishName: 'Slovence', script: 'Latn', direction: 'ltr' },
  { code: 'es', locale: 'es-ES', name: 'Spanish', nativeName: 'Español', turkishName: 'İspanyolca', script: 'Latn', direction: 'ltr' },
  { code: 'es-MX', locale: 'es-MX', name: 'Spanish (Mexico)', nativeName: 'Español (México)', turkishName: 'İspanyolca (Meksika)', script: 'Latn', direction: 'ltr' },
  { code: 'sw', locale: 'sw-KE', name: 'Swahili', nativeName: 'Kiswahili', turkishName: 'Svahili', script: 'Latn', direction: 'ltr' },
  { code: 'sv', locale: 'sv-SE', name: 'Swedish', nativeName: 'Svenska', turkishName: 'İsveççe', script: 'Latn', direction: 'ltr' },
  { code: 'tl', locale: 'fil-PH', name: 'Tagalog (Filipino)', nativeName: 'Tagalog', turkishName: 'Tagalogca (Filipince)', script: 'Latn', direction: 'ltr' },
  { code: 'ta', locale: 'ta-IN', name: 'Tamil', nativeName: 'தமிழ்', turkishName: 'Tamilce', script: 'Taml', direction: 'ltr' },
  { code: 'te', locale: 'te-IN', name: 'Telugu', nativeName: 'తెలుగు', turkishName: 'Teluguca', script: 'Telu', direction: 'ltr' },
  { code: 'th', locale: 'th-TH', name: 'Thai', nativeName: 'ไทย', turkishName: 'Tayca', script: 'Thai', direction: 'ltr' },
  { code: 'uk', locale: 'uk-UA', name: 'Ukrainian', nativeName: 'Українська', turkishName: 'Ukraynaca', script: 'Cyrl', direction: 'ltr' },
  { code: 'ur', locale: 'ur-PK', name: 'Urdu', nativeName: 'اردو', turkishName: 'Urduca', script: 'Arab', direction: 'rtl' },
  { code: 'uz', locale: 'uz-UZ', name: 'Uzbek', nativeName: 'Oʻzbekcha', turkishName: 'Özbekçe', script: 'Latn', direction: 'ltr' },
  { code: 'vi', locale: 'vi-VN', name: 'Vietnamese', nativeName: 'Tiếng Việt', turkishName: 'Vietnamca', script: 'Latn', direction: 'ltr' },

  // ── Low-resource — provider does NOT reliably support these ──────────────
  { code: 'am', locale: 'am-ET', name: 'Amharic', nativeName: 'አማርኛ', turkishName: 'Amharca', script: 'Ethi', direction: 'ltr', providerSupported: false },
  { code: 'bo', locale: 'bo-CN', name: 'Tibetan', nativeName: 'བོད་སྐད་', turkishName: 'Tibetçe', script: 'Tibt', direction: 'ltr', providerSupported: false },
  { code: 'dv', locale: 'dv-MV', name: 'Divehi', nativeName: 'ދިވެހި', turkishName: 'Divehice', script: 'Thaa', direction: 'rtl', providerSupported: false },
  { code: 'ug', locale: 'ug-CN', name: 'Uyghur', nativeName: 'ئۇيغۇرچە', turkishName: 'Uygurca', script: 'Arab', direction: 'rtl', providerSupported: false },
];
