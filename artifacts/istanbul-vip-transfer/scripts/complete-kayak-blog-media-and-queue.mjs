import { createHmac } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import postgres from '../node_modules/postgres/src/index.js';
import OpenAI from '../node_modules/openai/index.js';
import sharp from '../node_modules/sharp/dist/index.cjs';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const model = 'gpt-image-2';
const sidecar = process.env.REPLIT_SIDECAR_ENDPOINT ?? 'http://127.0.0.1:1106';
const slug = 'kayak-turlarinda-vip-transfer-rehberi';
const generatedDir = new URL('../../../attached_assets/generated_images/', import.meta.url);
const guard = 'no text, no logos, no brand marks, no readable signage, no visible number plate';
const specs = [
  {
    key: 'hero',
    fileName: 'kayak-transfer-hero.jpg',
    alt: 'Kayak merkezine giden VIP transfer aracı',
    prompt: 'Photorealistic three-quarter front view of a black Mercedes Sprinter van parked on a snow-cleared road with snow-covered pine trees on both sides, soft overcast winter daylight, crisp cold atmosphere. Editorial automotive travel photography, natural colour grading, no text, no logos, no brand emblems, no visible number plate.',
  },
  {
    key: 'inline1',
    fileName: 'kayak-ekipmani-yukleme.jpg',
    alt: 'Kayak ekipmanlarının transfer aracına yüklenmesi',
    prompt: 'Photorealistic overhead flat-lay of ski bags, ski boots bags, and helmets arranged neatly on a clean light grey floor next to an open van trunk, soft even daylight. Minimal editorial product photography, muted neutral colours, no text, no logos, no brand marks.',
  },
  {
    key: 'inline2',
    fileName: 'uzak-kayak-merkezi-transfer.jpg',
    alt: 'Uçakla ulaşılan bir kayak merkezine giden VIP transfer aracı',
    prompt: 'Photorealistic wide shot of a black van driving on a mountain road with distant snow-capped peaks under a clear blue winter sky, soft daylight. Editorial travel photography, natural colour grading, no text, no logos, no readable signage, no number plates.',
  },
].map(spec => ({ ...spec, prompt: `${guard}. ${spec.prompt} ${guard}.` }));

const body = `Türkiye'deki kayak merkezleri İstanbul'a farklı uzaklıklarda konumlanıyor; bazılarına doğrudan kara yoluyla, bazılarına ise önce uçakla sonra kısa bir transferle ulaşılıyor. Bu yazıda hem yakın hem uzak seçenekleri ve kayak ekipmanı taşımanın pratik detaylarını anlatıyoruz.

## İstanbul'a yakın kayak merkezleri

**Kartepe (Kocaeli).** İstanbul'a yaklaşık 140 kilometre, yolculuk süresi yaklaşık 1 saat. Bu kısa mesafe, Kartepe'yi özellikle günübirlik kayak turları için en pratik seçenek hâline getiriyor — sabah gidip akşam dönmek mümkün.

**Uludağ (Bursa).** İstanbul'a yaklaşık 190 kilometre. Doğrudan kara yoluyla dağa çıkılabileceği gibi, Bursa'daki teleferik istasyonuna kadar transferle gidilip oradan teleferikle yaklaşık 30 dakikada kayak merkezine ulaşmak da mümkündür. Mesafesi nedeniyle Uludağ genellikle hafta sonu veya birkaç günlük konaklamalı turlar için tercih edilir. Ayrıntılı güzergâh bilgisi için [Bursa/Uludağ/İnegöl/Kartepe transfer rehberi](/blog/istanbul-bursa-uludag-inegol-kartepe-transfer) yazımıza bakabilirsiniz.

[[IMAGE:inline-1]]

## Uçakla ulaşılan kayak merkezleri

Erciyes (Kayseri) ve Palandöken (Erzurum) gibi daha uzak kayak merkezlerine kara yoluyla gitmek günün büyük kısmını alacağından, bu merkezlere genellikle önce uçakla gidilir, ardından havalimanından kayak merkezine kısa bir VIP transferle ulaşılır. Bu modelde VIP transferin rolü, Bodrum örneğinde olduğu gibi, yolculuğun son ve en pratik bölümünü üstlenmektir — havalimanından otele veya kayak merkezine doğrudan, ekipman taşıma dahil.

[[IMAGE:inline-2]]

## Kayak ekipmanı nasıl taşınır?

Kayak seyahatlerinde standart bagaja ek olarak şu ekipmanlar taşınır: kayak/snowboard çantası, bot çantası, kask ve kayak kıyafetleri. Bunlar hacimli olduğu için rezervasyon sırasında mutlaka belirtilmelidir:

- **1-2 kişilik gruplar**, standart bagaja ek kayak ekipmanıyla genellikle Mercedes Vito'ya sığar.
- **3 kişiyi aşan gruplar** veya herkesin kendi ekipmanıyla seyahat ettiği durumlarda Mercedes Sprinter'ın geniş bagaj hacmi gereklidir.

Ekipman bilgisi önceden verilmediğinde, yerinde araç değişikliği gerekebileceğinden bu detayın rezervasyon formunda eksiksiz belirtilmesi önerilir.

## Sezon yoğunluğu ve rezervasyon zamanlaması

Kayak sezonu (aralık-mart) özellikle hafta sonlarında ve yarıyıl tatili döneminde yoğunlaşır. Bu dönemlerde:

- Kartepe ve Uludağ'a günübirlik talep hafta sonları belirgin şekilde artar.
- Kar yağışı yoğun günlerde dağ yollarındaki trafik ve sürüş koşulları değişebilir; bu durumda yolculuk süresi normalden uzun sürebilir.

Hafta sonu ve yarıyıl tatili döneminde araç bulunabilirliği için birkaç gün öncesinden rezervasyon önerilir.

## Rezervasyon için gereken bilgiler

- Kalkış noktası ve varış (Kartepe / Uludağ / havalimanı + uzak kayak merkezi)
- Tarih ve saat (günübirlik mi, konaklamalı mı)
- Yolcu sayısı ve kayak ekipmanı miktarı
- Havalimanından transferse uçuş numarası

Genel şehirlerarası transfer mantığı için [şehirlerarası VIP transfer rehberi](/blog/sehirlerarasi-vip-transfer-rehberi) yazımıza bakabilirsiniz. Net süre ve araç önerisi için [rezervasyon ve fiyat formunu](/iletisim) kullanabilirsiniz.`;

const faqs = [
  ["İstanbul'a en yakın kayak merkezi hangisi?", "Kartepe, Kocaeli ilinde yer alır ve İstanbul'a yaklaşık 140 km, yaklaşık 1 saat mesafededir — günübirlik kayak turları için en pratik seçenektir."],
  ["Uludağ'a nasıl gidilir?", "Uludağ İstanbul'a yaklaşık 190 km mesafededir. Doğrudan kara yoluyla dağa çıkılabilir veya Bursa'daki teleferik istasyonuna kadar transferle gidilip oradan teleferikle yaklaşık 30 dakikada kayak merkezine ulaşılabilir."],
  ["Erciyes veya Palandöken gibi uzak kayak merkezlerine nasıl ulaşılır?", "Bu merkezlere genellikle önce uçakla gidilir, ardından havalimanından kayak merkezine veya otele kısa bir VIP transferle ulaşılır — kara yoluyla gitmek günün büyük kısmını alacağından tercih edilmez."],
  ["Kayak ekipmanı için hangi araç uygun?", "1-2 kişilik gruplar için standart bagaja ek kayak ekipmanı genellikle Mercedes Vito'ya sığar. 3 kişiyi aşan gruplarda veya herkesin kendi ekipmanı olduğunda Mercedes Sprinter'ın geniş bagaj hacmi gereklidir."],
  ["Kartepe'ye günübirlik gidip aynı gün dönmek mümkün mü?", "Evet, Kartepe'nin İstanbul'a yaklaşık 1 saat mesafede olması, sabah gidip akşam dönmeyi pratik hâle getiriyor."],
  ["Kar yağışlı günlerde transfer süresi değişir mi?", "Evet, kar yağışı yoğun günlerde dağ yollarındaki sürüş koşulları değişebileceğinden yolculuk süresi normalden uzun sürebilir."],
  ["Hafta sonu için ne kadar önceden rezervasyon yapmalıyım?", "Kayak sezonu hafta sonlarında ve yarıyıl tatili döneminde araç bulunabilirliği için birkaç gün öncesinden rezervasyon önerilir."],
];

function parsePrivateDir(dir) {
  const cleaned = dir.replace(/^gs:\/\//, '').replace(/\/$/, '');
  if (cleaned.startsWith('/')) return { bucket: process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID?.trim() ?? '', prefix: cleaned.replace(/^\/+/, '') };
  const slash = cleaned.indexOf('/');
  return slash < 0 ? { bucket: cleaned, prefix: '' } : { bucket: cleaned.slice(0, slash), prefix: cleaned.slice(slash + 1) };
}

function imageUrl(spec) {
  return `/api/storage/objects/ai-images/blog/${slug}/${spec.fileName.replace(/\.jpg$/i, '.webp')}`;
}

async function invalidateCache() {
  const domain = process.env.REPLIT_DEV_DOMAIN?.trim();
  const secret = process.env.AUTH_SECRET;
  if (!domain || !secret) throw new Error('Cache invalidation configuration missing');
  const requestBody = JSON.stringify({ slugs: [slug] });
  const signature = createHmac('sha256', secret).update(`blog-cache-revalidation:v1.${requestBody}`).digest('base64url');
  const response = await fetch(`https://${domain}/admin/api/cron/blog-cache-revalidation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-blog-cache-revalidation-signature': signature },
    body: requestBody,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Cache invalidation failed (${response.status})`);
}

async function saveText() {
  const result = await sql.begin(async tx => {
    const [before] = await tx`SELECT id, slug, status, published_at FROM content WHERE slug=${slug} AND content_type='BLOG_POST' FOR UPDATE`;
    if (!before) throw new Error('Blog not found');
    await tx`UPDATE content SET
      title='Kayak Turlarında VIP Transfer Rehberi',
      seo_title='Kayak Turlarında VIP Transfer: Kartepe, Uludağ ve Ötesi',
      seo_description='Kartepe, Uludağ ve daha uzak kayak merkezlerine VIP transfer nasıl planlanır, ekipman taşıma ve araç seçimi nasıl olmalı — kayak sezonu rehberi burada.',
      excerpt='Kayak merkezlerine VIP transfer planlaması: yakın (Kartepe, Uludağ) ve uzak (uçak+transfer) seçenekler.',
      category='Şehirlerarası Transfer',
      tags=${sql.json(['kayak turu transfer', 'kartepe transfer', 'uludağ kayak transfer', 'kayak ekipmanı taşıma'])},
      author='Hevra Turizm Transfer Ekibi',
      read_time_minutes=7,
      body=${body},
      internal_links=${sql.json([
        { label: 'Bursa/Uludağ/İnegöl/Kartepe transfer rehberi', href: '/blog/istanbul-bursa-uludag-inegol-kartepe-transfer' },
        { label: 'şehirlerarası VIP transfer rehberi', href: '/blog/sehirlerarasi-vip-transfer-rehberi' },
        { label: 'rezervasyon ve fiyat formu', href: '/iletisim' },
      ])},
      updated_at=now()
      WHERE id=${before.id}`;
    await tx`DELETE FROM faqs WHERE content_id=${before.id}`;
    for (const [index, [question, answer]] of faqs.entries()) {
      await tx`INSERT INTO faqs (content_id, question, answer, translations, sort_order)
        VALUES (${before.id}, ${question}, ${answer}, '{}'::jsonb, ${index})`;
    }
    const [after] = await tx`SELECT slug,status,published_at,updated_at,length(body) AS body_chars FROM content WHERE id=${before.id}`;
    if (after.slug !== before.slug || after.status !== before.status || after.published_at?.toISOString() !== before.published_at?.toISOString()) {
      throw new Error('Protected publication fields changed');
    }
    return { ...after, faqCount: faqs.length };
  });
  await invalidateCache();
  console.log(JSON.stringify({ phase: 'text-saved', ...result }, null, 2));
}

async function upload(bytes, objectName) {
  const configured = process.env.PRIVATE_OBJECT_DIR?.trim();
  if (!configured) throw new Error('PRIVATE_OBJECT_DIR not configured');
  const { bucket, prefix } = parsePrivateDir(configured);
  if (!bucket) throw new Error('Object storage bucket missing');
  const sign = await fetch(`${sidecar}/object-storage/signed-object-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket_name: bucket, object_name: [prefix, objectName].filter(Boolean).join('/'), method: 'PUT', expires_at: new Date(Date.now() + 900_000).toISOString() }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!sign.ok) throw new Error(`Storage signing failed (${sign.status})`);
  const signed = await sign.json();
  const response = await fetch(signed.signed_url, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/webp', 'Content-Length': String(bytes.byteLength) },
    body: bytes,
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Storage upload failed (${response.status})`);
}

async function generateImages() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const images = [];
  for (const spec of specs) {
    if (!spec.prompt.startsWith(guard) || !spec.prompt.endsWith(`${guard}.`)) throw new Error(`Prompt guard missing: ${spec.key}`);
    const response = await ai.images.generate({ model, prompt: spec.prompt, n: 1, size: '1536x1024', output_format: 'jpeg' });
    const encoded = response.data?.[0]?.b64_json;
    if (!encoded) throw new Error(`No image data: ${spec.key}`);
    const source = Buffer.from(encoded, 'base64');
    await mkdir(generatedDir, { recursive: true });
    await writeFile(new URL(spec.fileName, generatedDir), source);
    const webp = await sharp(source, { failOn: 'error', limitInputPixels: 40_000_000 })
      .rotate().resize({ width: 1600, height: 900, fit: 'cover', position: 'centre', withoutEnlargement: true })
      .webp({ quality: 82, effort: 5, smartSubsample: true }).toBuffer();
    await upload(webp, `ai-images/blog/${slug}/${spec.fileName.replace(/\.jpg$/i, '.webp')}`);
    images.push({ key: spec.key, url: imageUrl(spec), bytes: webp.byteLength });
  }
  console.log(JSON.stringify({ phase: 'generated', model, images }, null, 2));
}

async function placeAndQueue() {
  const byKey = Object.fromEntries(specs.map(spec => [spec.key, { ...spec, url: imageUrl(spec) }]));
  const result = await sql.begin(async tx => {
    const [before] = await tx`SELECT id,slug,status,published_at,body FROM content WHERE slug=${slug} AND content_type='BLOG_POST' FOR UPDATE`;
    if (!before) throw new Error('Blog not found');
    if ((before.body.match(/\[\[IMAGE:inline-1\]\]/g) ?? []).length !== 1 || (before.body.match(/\[\[IMAGE:inline-2\]\]/g) ?? []).length !== 1) {
      throw new Error('Image placeholders missing or duplicated');
    }
    const placedBody = before.body
      .replace('[[IMAGE:inline-1]]', `![${byKey.inline1.alt}](${byKey.inline1.url})`)
      .replace('[[IMAGE:inline-2]]', `![${byKey.inline2.alt}](${byKey.inline2.url})`);
    await tx`UPDATE content SET body=${placedBody},hero_image=${byKey.hero.url},hero_image_alt=${byKey.hero.alt},og_image=${byKey.hero.url},updated_at=now() WHERE id=${before.id}`;
    const [activeJob] = await tx`SELECT id FROM translation_jobs WHERE entity_type='content' AND entity_id=${before.id} AND status IN ('QUEUED','RUNNING','PARTIAL') LIMIT 1`;
    if (activeJob) throw new Error('An active translation job already exists');
    const [job] = await tx`INSERT INTO translation_jobs (entity_type,entity_id,status,force,total_tasks,completed_tasks,failed_tasks)
      VALUES ('content',${before.id},'RUNNING',false,8,0,0) RETURNING id`;
    await tx`INSERT INTO translation_job_tasks (job_id,target_language_code,status,attempts)
      SELECT ${job.id},code,'QUEUED',0 FROM unnest(${['en','de','ru','ar','es','fr','it','nl']}::text[]) AS code`;
    const [after] = await tx`SELECT slug,status,published_at,updated_at,hero_image,hero_image_alt,og_image,body FROM content WHERE id=${before.id}`;
    if (after.slug !== before.slug || after.status !== before.status || after.published_at?.toISOString() !== before.published_at?.toISOString()) {
      throw new Error('Protected publication fields changed');
    }
    const tasks = await tx`SELECT target_language_code,status FROM translation_job_tasks WHERE job_id=${job.id} ORDER BY target_language_code`;
    return { jobId: job.id, ...after, tasks };
  });
  await invalidateCache();
  console.log(JSON.stringify({ phase: 'placed-and-queued', model, ...result }, null, 2));
}

try {
  if (process.argv.includes('--text')) await saveText();
  else if (process.argv.includes('--generate')) await generateImages();
  else if (process.argv.includes('--place')) await placeAndQueue();
  else throw new Error('Use --text, --generate, or --place');
} finally {
  await sql.end();
}