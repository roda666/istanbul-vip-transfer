/**
 * Seed the 4 legal/compliance pages into the CMS (content table)
 * then translate each to 8 languages via OpenAI.
 *
 * Run: node scripts/seed-legal-pages.mjs
 * (Must be run from within the artifacts/istanbul-vip-transfer dir)
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import * as dotenv from '../node_modules/dotenv/lib/main.js';
dotenv.config({ path: '.env' });
dotenv.config({ path: '../../.env' });

import pg from '/home/runner/workspace/node_modules/.pnpm/pg@8.22.0/node_modules/pg/lib/index.js';
import OpenAI from '../node_modules/openai/index.mjs';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const openai = new OpenAI({
  apiKey:  process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
});

const LANGS = ['en', 'de', 'ru', 'ar', 'es', 'fr', 'it', 'nl'];

// ─── Page Content ───────────────────────────────────────────────────────────

const PAGES = [
  {
    slug:    'kvkk-aydinlatma-metni',
    title:   'KVKK Aydınlatma Metni',
    excerpt: '6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında İstanbul VIP Transfer olarak kişisel verilerinizin nasıl işlendiğine ilişkin aydınlatma metni.',
    body: `## 1. Veri Sorumlusu

Bu Aydınlatma Metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca hazırlanmıştır. **Istanbul VIP Transfer** ("Şirket") veri sorumlusu sıfatıyla hareket etmektedir.

**İletişim:** info@istanbulviptransfer.com — Tel: +90 532 660 08 47

## 2. İşlenen Kişisel Veriler

### Rezervasyon ve Transfer Hizmetleri

- Ad, soyad ve telefon numarası
- WhatsApp iletişim bilgisi
- Kalkış noktası ve varış noktası
- Transfer tarihi, saati ve yolcu sayısı
- Uçuş numarası (havalimanı transferlerinde)
- Özel yolcu notları (isteğe bağlı)

### Chatbot İletişimi

- Sohbet mesajları ve içerikleri
- Oturum tanımlayıcı bilgisi

### Bülten Aboneliği

- E-posta adresi
- Abonelik tarihi ve onay bilgisi

## 3. İşleme Amaçları ve Hukuki Dayanaklar

**Transfer hizmetinin planlanması ve sunulması:** KVKK md. 5/2-c — sözleşmenin kurulması veya ifası.

**WhatsApp üzerinden rezervasyon onayı ve iletişim:** KVKK md. 5/2-c — sözleşmenin ifası.

**Chatbot hizmetinin sunulması:** KVKK md. 5/2-e — veri sorumlusunun meşru menfaati.

**Bülten gönderilmesi:** KVKK md. 5/1 — açık rıza.

**Yasal yükümlülüklerin yerine getirilmesi:** KVKK md. 5/2-a — kanunlarda öngörülme.

## 4. Yurt İçi ve Yurt Dışı Veri Aktarımı

Kişisel verileriniz yalnızca hizmet sunumu için gerekli olduğu ölçüde aktarılmaktadır:

- **Meta Platforms Ireland Ltd. (WhatsApp Business):** Rezervasyon iletişimi için. Sunucular AB ve ABD'de bulunmaktadır; aktarım KVKK md. 9 kapsamında gerçekleşmektedir.
- **OpenAI, L.L.C.:** Chatbot yapay zeka hizmeti için veri işleyici sıfatıyla. Yalnızca hizmet kapsamında aktarım gerçekleşmektedir.
- **E-posta hizmet sağlayıcısı:** Bülten gönderimleri için.
- **Yetkili kamu kurumları ve mahkemeler:** Yalnızca yasal zorunluluk halinde.

## 5. Saklama Süreleri

- Rezervasyon bilgileri: Hizmet tamamlanmasından itibaren 10 yıl (TTK ve vergi mevzuatı uyarınca)
- Chatbot mesajları: 12 ay
- Bülten e-posta adresi: Abonelik iptali talebine kadar
- Yasal yükümlülük kapsamındaki veriler: İlgili mevzuatta öngörülen süre

## 6. İlgili Kişi Hakları (KVKK Madde 11)

KVKK'nın 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:

- Kişisel verilerinizin işlenip işlenmediğini öğrenme
- Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme
- İşleme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme
- Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme
- Eksik veya yanlış işlenmiş olması hâlinde düzeltilmesini isteme
- KVKK'nın 7. maddesi çerçevesinde silinmesini veya yok edilmesini isteme
- Düzeltme ve silme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme
- İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi sonucu aleyhinize bir sonucun ortaya çıkmasına itiraz etme
- Kanuna aykırı işlenmesi nedeniyle zararın giderilmesini talep etme

## 7. Başvuru Yöntemi

Haklarınızı kullanmak için **info@istanbulviptransfer.com** adresine e-posta gönderebilir veya **+90 532 660 08 47** numaralı WhatsApp hattımızdan iletişime geçebilirsiniz. Başvurunuzda kimliğinizi doğrulayan bilgileri paylaşmanız gerekmektedir. Talebiniz en geç 30 gün içinde yanıtlanacaktır.

Bu metin en son Ağustos 2026 tarihinde güncellenmiştir.`,
  },
  {
    slug:    'cerez-politikasi',
    title:   'Çerez Politikası',
    excerpt: 'İstanbul VIP Transfer web sitesinde kullanılan çerezler hakkında bilgi ve tercihlerinizi yönetme seçenekleriniz.',
    body: `## Çerez Nedir?

Çerezler, web sitelerinin ziyaretçi cihazlarına küçük metin dosyaları olarak kaydettiği verilerdir. Siteyi tekrar ziyaret ettiğinizde bu veriler tarayıcınız tarafından web sitesine geri gönderilir. Çerezler, tercihlerinizi hatırlamak ve hizmetlerin düzgün çalışmasını sağlamak için kullanılır.

## Kullandığımız Çerezler

### Zorunlu Çerezler

Bu çerezler sitenin temel işlevleri için gereklidir ve devre dışı bırakılamazlar.

- **ivt_admin_session:** Admin paneli oturumunu yönetir. Yalnızca yetkili yöneticiler için kullanılır.
- **ivt_chat_sid:** Chatbot oturum kimliğini saklar. Ziyaretçinin aynı konuşmayı sürdürmesini sağlar. 24 saat geçerlidir.
- **ivt_lang_pref:** Ziyaretçinin seçtiği dil tercihini hatırlar. 1 yıl geçerlidir.
- **ivt_cookie_consent:** Çerez tercihlerinizin kaydedildiğini gösterir. 1 yıl geçerlidir.

### Analitik ve Pazarlama Çerezleri

**Sitemiz herhangi bir analitik veya pazarlama çerezi kullanmamaktadır.** Google Analytics, Facebook Pixel veya benzeri üçüncü taraf izleme araçları yer almamaktadır.

## Çerez Yönetimi

Tarayıcınızın ayarlarından çerezleri yönetebilirsiniz. Çerezleri tamamen devre dışı bırakmanız halinde sitenin bazı işlevleri (dil tercihi hatırlama, chatbot gibi) düzgün çalışmayabilir.

## Üçüncü Taraf Çerezleri

Sitemiz doğrudan üçüncü taraf çerezleri yerleştirmemektedir. Ancak WhatsApp Business entegrasyonu kullanıldığında Meta'nın hizmet şartları geçerlidir.

## İletişim

Çerez politikamız hakkında sorularınız için **info@istanbulviptransfer.com** adresine ulaşabilirsiniz.

Bu politika en son Ağustos 2026 tarihinde güncellenmiştir.`,
  },
  {
    slug:    'kullanim-kosullari',
    title:   'Kullanım Koşulları',
    excerpt: 'İstanbul VIP Transfer hizmetleri ve web sitesinin kullanımına ilişkin şart ve koşullar.',
    body: `## 1. Kabul

Bu web sitesini ziyaret ederek veya hizmetlerimizden yararlanarak aşağıdaki kullanım koşullarını kabul etmiş sayılırsınız. Bu koşulları kabul etmiyorsanız siteyi kullanmaktan vazgeçmenizi rica ederiz.

## 2. Hizmetin Kapsamı

Istanbul VIP Transfer, İstanbul'da ve çevresinde aşağıdaki transfer hizmetlerini sunmaktadır:

- Havalimanı karşılama ve uğurlama transferleri (İstanbul Havalimanı ve Sabiha Gökçen)
- Şehir içi ve şehirler arası VIP transfer
- Otel transfer hizmetleri
- Saatlik şoförlü araç kiralama
- Kurumsal ve özel etkinlik transferleri

Tüm hizmetler lüks Mercedes araçlar ve profesyonel sürücüler ile sağlanmaktadır.

## 3. Rezervasyon ve Onay

Rezervasyon talepleri bu web sitesi üzerindeki form aracılığıyla iletilmekte ve **WhatsApp üzerinden onaylanmaktadır.** Rezervasyon, yalnızca WhatsApp onayı alındıktan sonra kesinleşmektedir. Onay alınmadan form doldurulması rezervasyon niteliği taşımamaktadır.

## 4. İptal ve Değişiklik

- İptal ve değişiklik talepleri WhatsApp (+90 532 660 08 47) üzerinden iletilmelidir.
- İptal koşulları rezervasyon sırasında WhatsApp üzerinden ayrıca bildirilir.
- Şirket, mücbir sebep hallerinde (doğal afet, salgın, resmi yasak vb.) hizmet vermekten vazgeçme hakkını saklı tutar.

## 5. Sorumluluk Sınırlamaları

Istanbul VIP Transfer, hizmetlerini titizlikle sunmaktadır. Ancak aşağıdaki durumlarda sorumluluk kabul edilmemektedir:

- Müşteri tarafından yanlış veya eksik iletilen rezervasyon bilgileri
- Trafik, grev veya doğal afet gibi şirketten bağımsız gecikmeler
- Müşterinin onaylı saatten geç ulaşması nedeniyle kaçırılan bağlantılar
- Üçüncü taraf hizmetlerden (uçuş iptali vb.) kaynaklanan durumlar

Şirketin azami sorumluluğu, söz konusu transferin hizmet bedeli ile sınırlıdır.

## 6. Fikri Mülkiyet

Bu web sitesindeki tüm içerikler (metin, görsel, logo, tasarım) Istanbul VIP Transfer'e aittir ve telif hakkı ile korunmaktadır. Önceden yazılı izin alınmaksızın hiçbir içerik kopyalanamaz, yeniden yayınlanamaz veya ticari amaçla kullanılamaz.

## 7. Uygulanacak Hukuk ve Uyuşmazlık Çözümü

Bu koşullar Türk Hukuku'na tabidir. Herhangi bir uyuşmazlıkta **İstanbul Mahkemeleri ve İcra Daireleri** yetkilidir. Uyuşmazlıklar öncelikle taraflar arasında dostane yollarla çözülmeye çalışılır.

## 8. Koşullarda Değişiklik

Şirket, kullanım koşullarını önceden bildirimde bulunmaksızın değiştirme hakkını saklı tutar. Değişiklikler yayınlandığı andan itibaren geçerlidir. Güncel koşullar her zaman bu sayfada yayınlanmaktadır.

Bu metin en son Ağustos 2026 tarihinde güncellenmiştir.`,
  },
  {
    slug:    'gizlilik-politikasi',
    title:   'Gizlilik Politikası',
    excerpt: 'İstanbul VIP Transfer olarak kişisel verilerinizin gizliliği ve korunmasına ilişkin genel politikamız.',
    body: `## Giriş

Istanbul VIP Transfer olarak ziyaretçilerimizin ve müşterilerimizin gizliliğine önem veriyoruz. Bu Gizlilik Politikası, web sitemizi ziyaret ettiğinizde veya hizmetlerimizi kullandığınızda kişisel verilerinizi nasıl topladığımızı, kullandığımızı ve koruduğumuzu açıklamaktadır.

Türk kullanıcılar için ayrıca [KVKK Aydınlatma Metni](/yasal/kvkk-aydinlatma-metni) geçerlidir.

## Topladığımız Veriler

Kişisel bilgiler yalnızca sizden doğrudan, açık şekilde aldığımızda toplanmaktadır:

- **İletişim bilgileri:** Ad, telefon numarası, e-posta adresi
- **Rezervasyon bilgileri:** Transfer tarihi, kalkış/varış noktası, yolcu sayısı, uçuş numarası
- **Chatbot mesajları:** Destek amacıyla gerçekleştirilen konuşma içerikleri
- **Bülten aboneliği:** E-posta adresi ve onay bilgisi

**Sitemiz çerez tabanlı izleme veya reklamcılık teknolojileri kullanmamaktadır.** Analitik çerez bulunmamaktadır.

## Verileri Nasıl Kullanıyoruz

Topladığımız veriler yalnızca şu amaçlarla kullanılır:

- Transfer hizmeti planlamak ve sunmak
- WhatsApp üzerinden rezervasyon onayı göndermek
- Chatbot üzerinden destek sağlamak
- Abonelik talebiniz varsa bülten göndermek
- Yasal yükümlülükleri yerine getirmek

**Verilerinizi pazarlama, profilleme veya üçüncü taraflara satış için kullanmıyoruz.**

## Veri Paylaşımı

Verileriniz yalnızca hizmet sunumu için zorunlu olduğu durumlarda paylaşılmaktadır:

- **WhatsApp Business (Meta):** Rezervasyon iletişimi
- **OpenAI:** Chatbot yapay zeka altyapısı (veri işleyici sıfatıyla)
- **E-posta servis sağlayıcısı:** Bülten gönderimleri
- **Yetkili merciler:** Yalnızca yasal zorunluluk halinde

## Uluslararası Veri Transferleri

Site 9 dilde hizmet sunmakta ve uluslararası kullanıcılara yönelik olarak faaliyet göstermektedir. Hizmet altyapısı kapsamında bazı veriler Türkiye dışındaki sunuculara (AB, ABD) aktarılabilmektedir. Bu aktarımlar KVKK ve AB GDPR çerçevesinde uygun güvenceler dahilinde gerçekleştirilmektedir.

## GDPR Kapsamındaki Haklarınız

Avrupa Ekonomik Bölgesi'nde ikamet ediyorsanız GDPR kapsamında aşağıdaki haklara sahipsiniz:

- Verilerinize erişim hakkı
- Verilerinizin düzeltilmesini isteme hakkı
- Verilerinizin silinmesini isteme hakkı ("unutulma hakkı")
- Veri işlemenin kısıtlanmasını isteme hakkı
- Veri taşınabilirliği hakkı
- İtiraz hakkı

Bu hakları kullanmak için **info@istanbulviptransfer.com** adresine başvurabilirsiniz. Talebiniz 30 gün içinde yanıtlanacaktır.

## Veri Güvenliği

Kişisel verilerinizi korumak için endüstri standardı teknik ve idari güvenlik önlemleri uygulanmaktadır. HTTPS zorlaması, SMTP şifre şifrelemesi ve erişim denetimi bu önlemler arasındadır.

## Çocukların Gizliliği

Hizmetlerimiz 18 yaş altı bireylere yönelik değildir. 18 yaş altı bireylerden bilerek kişisel veri toplamıyoruz.

## Politika Güncellemeleri

Bu politika zaman zaman güncellenebilir. Önemli değişiklikler bu sayfada yayınlanır.

**İletişim:** info@istanbulviptransfer.com

Bu metin en son Ağustos 2026 tarihinde güncellenmiştir.`,
  },
];

// ─── Translation ─────────────────────────────────────────────────────────────

const LANG_NAMES = {
  en: 'English', de: 'German', ru: 'Russian', ar: 'Arabic',
  es: 'Spanish', fr: 'French', it: 'Italian', nl: 'Dutch',
};

async function translatePage(page, lang) {
  const langName = LANG_NAMES[lang];
  const prompt = `Translate the following Turkish VIP transfer service legal page to ${langName}.
Rules:
- Preserve all markdown formatting exactly: ##, ###, -, **, [text](url)
- Keep all email addresses, phone numbers, and URLs untranslated
- Keep "Istanbul VIP Transfer", "WhatsApp", "Meta", "OpenAI", "KVKK", "GDPR", "Mercedes" untranslated
- For Arabic, use formal legal tone (فصحى)
- For the title, translate naturally (e.g. KVKK → equivalent data protection notice name)
- Return JSON: { "title": "...", "excerpt": "...", "body": "..." }

TITLE: ${page.title}
EXCERPT: ${page.excerpt}
BODY:
${page.body}`;

  const resp = await openai.chat.completions.create({
    model: 'gpt-5.4-mini',
    messages: [
      { role: 'system', content: 'You are a professional legal translator specializing in privacy and compliance documents. Return only valid JSON.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const raw = resp.choices[0].message.content;
  try {
    return JSON.parse(raw);
  } catch {
    console.error(`JSON parse error for ${lang}:`, raw.slice(0, 200));
    return null;
  }
}

// ─── DB helpers ──────────────────────────────────────────────────────────────

async function upsertSourcePage(client, page) {
  // Check if it exists
  const { rows } = await client.query(
    `SELECT id FROM content WHERE slug = $1 AND content_type = 'PAGE' LIMIT 1`,
    [page.slug],
  );

  if (rows.length > 0) {
    // Update existing
    await client.query(
      `UPDATE content SET title=$2, excerpt=$3, body=$4, status='PUBLISHED', updated_at=NOW()
       WHERE id=$1`,
      [rows[0].id, page.title, page.excerpt, page.body],
    );
    console.log(`  ↑ Updated TR source: ${page.slug}`);
    return rows[0].id;
  }

  // Insert new
  const { rows: newRows } = await client.query(
    `INSERT INTO content (slug, title, excerpt, body, content_type, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'PAGE', 'PUBLISHED', NOW(), NOW())
     RETURNING id`,
    [page.slug, page.title, page.excerpt, page.body],
  );
  console.log(`  + Inserted TR source: ${page.slug}`);
  return newRows[0].id;
}

async function upsertTranslation(client, entityId, lang, translated) {
  if (!translated) return;

  // entity_id column is TEXT; content.id is UUID — cast to text
  const entityIdText = String(entityId);

  // Check existing
  const { rows } = await client.query(
    `SELECT id FROM content_translations
     WHERE entity_type='content' AND entity_id=$1 AND target_language_code=$2 LIMIT 1`,
    [entityIdText, lang],
  );

  if (rows.length > 0) {
    await client.query(
      `UPDATE content_translations
       SET title=$2, excerpt=$3, body=$4, status='PUBLISHED', updated_at=NOW(), published_at=NOW(),
           is_ai_generated=true
       WHERE id=$1`,
      [rows[0].id, translated.title, translated.excerpt, translated.body],
    );
    console.log(`    ↑ Updated ${lang} translation`);
  } else {
    await client.query(
      `INSERT INTO content_translations
         (entity_type, entity_id, target_language_code, title, excerpt, body,
          status, is_ai_generated, published_at)
       VALUES
         ('content', $1, $2, $3, $4, $5, 'PUBLISHED', true, NOW())`,
      [entityIdText, lang, translated.title, translated.excerpt, translated.body],
    );
    console.log(`    + Inserted ${lang} translation`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const client = await pool.connect();
  try {
    for (const page of PAGES) {
      console.log(`\n📄 Processing: ${page.slug}`);

      // 1. Upsert TR source
      const entityId = await upsertSourcePage(client, page);

      // 2. Translate to all 8 langs in parallel
      console.log(`  🌐 Translating to ${LANGS.join(', ')}…`);
      const results = await Promise.allSettled(
        LANGS.map(async (lang) => {
          const t = await translatePage(page, lang);
          await upsertTranslation(client, entityId, lang, t);
          return lang;
        }),
      );

      for (const r of results) {
        if (r.status === 'rejected') {
          console.error(`  ✗ Translation error:`, r.reason?.message ?? r.reason);
        }
      }
    }

    console.log('\n✅ All 4 legal pages seeded successfully.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
