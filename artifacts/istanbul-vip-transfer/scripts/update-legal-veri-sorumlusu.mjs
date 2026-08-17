/**
 * update-legal-veri-sorumlusu.mjs
 * 
 * Updates the "Veri Sorumlusu" section of KVKK and Privacy Policy with
 * correct legal entity info (Hevra Turizm / TÜRSAB A-7377), then
 * re-translates all 8 non-TR languages via OpenAI.
 */

import postgres from '../node_modules/postgres/src/index.js';
import OpenAI from '../node_modules/openai/index.mjs';

const sql = postgres(process.env.DATABASE_URL);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const LANGS = ['en','de','ar','ru','es','fr','it','nl'];

// ── Updated TR bodies ─────────────────────────────────────────────────────────

const KVKK_VERI_SORUMLUSU_OLD = `## 1. Veri Sorumlusu

Bu Aydınlatma Metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca hazırlanmıştır. **Istanbul VIP Transfer** ("Şirket") veri sorumlusu sıfatıyla hareket etmektedir.

**İletişim:** info@istanbulviptransfer.com — Tel: +90 532 660 08 47`;

const KVKK_VERI_SORUMLUSU_NEW = `## 1. Veri Sorumlusu

Bu Aydınlatma Metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca hazırlanmıştır. **Hevra Turizm** (ticari unvan: The History Travel / VIP Transfer Istanbul) ("Şirket") veri sorumlusu sıfatıyla hareket etmektedir.

**Şirket Unvanı:** Hevra Turizm  
**Ticari Adı:** The History Travel  
**TÜRSAB Belge No:** A-7377  
**Adres:** Alemdar Mah. Ticarethane Sok. No:5/3 34110 Fatih/İSTANBUL  
**İletişim:** info@istanbulviptransfer.com — Tel: +90 532 660 08 47`;

const PRIVACY_OLD_INTRO = `Istanbul VIP Transfer olarak ziyaretçilerimizin ve müşterilerimizin gizliliğine önem veriyoruz. Bu Gizlilik Politikası, web sitemizi ziyaret ettiğinizde veya hizmetlerimizi kullandığınızda kişisel verilerinizi nasıl topladığımızı, kullandığımızı ve koruduğumuzu açıklamaktadır.`;

const PRIVACY_NEW_INTRO = `**Hevra Turizm** (ticari adı: The History Travel / VIP Transfer Istanbul, TÜRSAB Belge No: A-7377) olarak ziyaretçilerimizin ve müşterilerimizin gizliliğine önem veriyoruz. Bu Gizlilik Politikası, web sitemizi ziyaret ettiğinizde veya hizmetlerimizi kullandığınızda kişisel verilerinizi nasıl topladığımızı, kullandığımızı ve koruduğumuzu açıklamaktadır.

**Veri Sorumlusu:** Hevra Turizm — Alemdar Mah. Ticarethane Sok. No:5/3 34110 Fatih/İSTANBUL`;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function translate(body, targetLang) {
  const langNames = {
    en: 'English', de: 'German', ar: 'Arabic', ru: 'Russian',
    es: 'Spanish', fr: 'French', it: 'Italian', nl: 'Dutch',
  };
  
  const res = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      {
        role: 'system',
        content: `You are a professional legal translator. Translate the following Turkish legal document body to ${langNames[targetLang]}. 
Rules:
- Preserve all markdown formatting (## headings, **bold**, - lists, line breaks)  
- Keep Turkish proper names: "KVKK", "TÜRSAB" unchanged
- Keep company names, registration numbers, and addresses unchanged (these are proper nouns)
- Keep email addresses and phone numbers unchanged
- Be precise and formal — this is a legal document
- Return ONLY the translated text, no preamble`,
      },
      { role: 'user', content: body },
    ],
    temperature: 0.1,
    max_tokens: 4000,
  });

  return res.choices[0]?.message?.content?.trim() ?? '';
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log('Fetching KVKK and Privacy Policy from DB...');

  // Fetch current TR bodies
  const [kvkk] = await sql`SELECT id, body FROM content WHERE slug = 'kvkk-aydinlatma-metni'`;
  const [privacy] = await sql`SELECT id, body FROM content WHERE slug = 'gizlilik-politikasi'`;

  if (!kvkk || !privacy) {
    console.error('Could not find legal pages in DB');
    process.exit(1);
  }

  console.log('KVKK id:', kvkk.id);
  console.log('Privacy id:', privacy.id);

  // ── Update TR bodies ──────────────────────────────────────────────────────

  const updatedKvkkBody = kvkk.body.replace(KVKK_VERI_SORUMLUSU_OLD, KVKK_VERI_SORUMLUSU_NEW);
  if (updatedKvkkBody === kvkk.body) {
    console.warn('⚠️  KVKK veri sorumlusu section not found — check old string');
  } else {
    await sql`UPDATE content SET body = ${updatedKvkkBody}, updated_at = NOW() WHERE id = ${kvkk.id}`;
    console.log('✅ KVKK TR body updated');
  }

  const updatedPrivacyBody = privacy.body.replace(PRIVACY_OLD_INTRO, PRIVACY_NEW_INTRO);
  if (updatedPrivacyBody === privacy.body) {
    console.warn('⚠️  Privacy Policy intro not found — check old string');
  } else {
    await sql`UPDATE content SET body = ${updatedPrivacyBody}, updated_at = NOW() WHERE id = ${privacy.id}`;
    console.log('✅ Privacy Policy TR body updated');
  }

  // ── Re-translate all 8 non-TR langs in parallel ───────────────────────────

  const finalKvkkBody = updatedKvkkBody !== kvkk.body ? updatedKvkkBody : kvkk.body;
  const finalPrivacyBody = updatedPrivacyBody !== privacy.body ? updatedPrivacyBody : privacy.body;

  console.log('\nTranslating KVKK + Privacy Policy to 8 languages in parallel...');

  const tasks = LANGS.flatMap(lang => [
    { page: 'kvkk', lang, entityId: kvkk.id, body: finalKvkkBody },
    { page: 'privacy', lang, entityId: privacy.id, body: finalPrivacyBody },
  ]);

  const results = await Promise.allSettled(
    tasks.map(async ({ page, lang, entityId, body }) => {
      const translated = await translate(body, lang);
      // Upsert into content_translations
      await sql`
        INSERT INTO content_translations (
          entity_type, entity_id, source_language_code, target_language_code,
          status, body
        ) VALUES (
          'content', ${entityId.toString()}, 'tr', ${lang},
          'PUBLISHED', ${translated}
        )
        ON CONFLICT (entity_type, entity_id, target_language_code)
        DO UPDATE SET
          body   = EXCLUDED.body,
          status = 'PUBLISHED'
      `;
      console.log(`  ✓ ${page} → ${lang}`);
      return { page, lang };
    })
  );

  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length) {
    console.error('\n❌ Some translations failed:');
    failed.forEach(f => console.error(f.reason));
  } else {
    console.log('\n✅ All translations complete!');
  }

  await sql.end();
}

run().catch(err => { console.error(err); process.exit(1); });
