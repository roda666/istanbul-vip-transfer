/**
 * On-demand, public-sitemap-only competitor gap analysis.
 * This intentionally never follows arbitrary URLs: every network target is
 * HTTPS, belongs to the configured public domain, and is DNS-checked first.
 */
import 'server-only';
import { NextResponse } from 'next/server';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { and, eq } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { competitorSites, content } from '@/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_SITEMAPS = 4;
const MAX_URLS_PER_DOMAIN = 24;
const MAX_BODY_BYTES = 900_000;
const TIMEOUT_MS = 7_000;

function privateAddress(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const value = address.toLowerCase();
  return value === '::1' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb') || value.startsWith('::ffff:127.') || value.startsWith('::ffff:10.') || value.startsWith('::ffff:192.168.');
}

function normalize(value: string) {
  return value.toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function topicFromUrl(url: string) {
  const pathname = new URL(url).pathname.replace(/\/+$/, '');
  const last = pathname.split('/').filter(Boolean).at(-1) ?? '';
  return decodeURIComponent(last).replace(/[-_]+/g, ' ').replace(/\.(html?|php)$/i, '').trim();
}

function belongsToDomain(hostname: string, domain: string) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

async function assertSafeUrl(raw: string, domain: string) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('Geçersiz kaynak URL’si.'); }
  if (url.protocol !== 'https:' || url.username || url.password || !belongsToDomain(url.hostname.toLowerCase(), domain)) {
    throw new Error('Kaynak URL yalnızca yapılandırılmış alan adında HTTPS olmalıdır.');
  }
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => privateAddress(address))) {
    throw new Error('Kaynak alan adı herkese açık bir IP adresine çözülmüyor.');
  }
  return url;
}

async function limitedText(response: Response) {
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) throw new Error('Kaynak yanıtı izin verilen boyutu aşıyor.');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new Error('Kaynak yanıtı izin verilen boyutu aşıyor.'); }
    chunks.push(value);
  }
  const joined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(joined);
}

async function fetchPublic(raw: string, domain: string) {
  const url = await assertSafeUrl(raw, domain);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'manual', headers: { Accept: 'application/xml,text/xml,text/html;q=0.9' } });
    if (response.status >= 300 && response.status < 400) throw new Error('Yönlendiren kaynak URL’sine güvenlik nedeniyle gidilmedi.');
    if (!response.ok) throw new Error(`Kaynak HTTP ${response.status} yanıtı verdi.`);
    return { response, text: await limitedText(response) };
  } finally { clearTimeout(timeout); }
}

function locs(xml: string) {
  return [...xml.matchAll(/<loc\b[^>]*>\s*<!\[CDATA\[(.*?)\]\]>\s*<\/loc>|<loc\b[^>]*>\s*([^<]+?)\s*<\/loc>/gi)]
    .map(match => (match[1] ?? match[2] ?? '').trim()).filter(Boolean);
}

function likelyArticle(url: string) {
  const path = new URL(url).pathname.toLowerCase().replace(/\/+$/, '');
  if (!path || path === '/' || /\.(xml|jpg|jpeg|png|webp|pdf)$/i.test(path)) return false;
  return !/(^|\/)(tag|etiket|category|kategori|author|yazar|page|wp-admin|feed)(\/|$)/.test(path);
}

function titleFromHtml(html: string) {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 240) : null;
}

export async function POST() {
  let session;
  try {
    session = await requireAdminSession();
    if (!['SUPER_ADMIN', 'ADMIN', 'EDITOR'].includes(session.role)) throw new Error('forbidden');
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === 'forbidden' ? 'Forbidden' : 'Unauthorized' }, { status: error instanceof Error && error.message === 'forbidden' ? 403 : 401 });
  }

  try {
    const [competitors, ownPosts] = await Promise.all([
      db.select().from(competitorSites).where(eq(competitorSites.active, true)),
      db.select({ title: content.title, slug: content.slug }).from(content).where(and(eq(content.contentType, 'BLOG_POST'), eq(content.status, 'PUBLISHED'), eq(content.isActive, true))),
    ]);
    const ownTopics = new Set(ownPosts.flatMap(post => [normalize(post.title), normalize(post.slug)]).filter(Boolean));
    const domains: Array<{ domain: string; label: string; status: 'ok' | 'unavailable'; sourceUrl?: string; scanned: number; error?: string }> = [];
    const gaps: Array<{ domain: string; label: string; sourceUrl: string; url: string; topic: string }> = [];

    for (const competitor of competitors) {
      const candidates = [`https://${competitor.domain}/sitemap.xml`, `https://${competitor.domain}/sitemap_index.xml`];
      try {
        let sourceUrl = '';
        let urls: string[] = [];
        for (const candidate of candidates) {
          try {
            const fetched = await fetchPublic(candidate, competitor.domain);
            const found = locs(fetched.text);
            if (found.length) { sourceUrl = candidate; urls = found; break; }
          } catch { /* Try the next conventional sitemap location. */ }
        }
        if (!sourceUrl) throw new Error('Herkese açık sitemap.xml veya sitemap_index.xml alınamadı.');
        // Sitemap indexes reference more sitemaps; inspect a strictly capped subset.
        if (urls.some(item => /\.xml(?:\?|$)/i.test(item))) {
          const nested = urls.filter(item => /\.xml(?:\?|$)/i.test(item)).slice(0, MAX_SITEMAPS);
          urls = [];
          for (const sitemap of nested) {
            try { urls.push(...locs((await fetchPublic(sitemap, competitor.domain)).text)); } catch { /* source remains attributable */ }
          }
        }
        const articleUrls = [...new Set(urls)].filter(url => {
          try { return likelyArticle(url) && belongsToDomain(new URL(url).hostname.toLowerCase(), competitor.domain); } catch { return false; }
        }).slice(0, MAX_URLS_PER_DOMAIN);
        let scanned = 0;
        for (const url of articleUrls) {
          let topic = topicFromUrl(url);
          try {
            const fetched = await fetchPublic(url, competitor.domain);
            topic = titleFromHtml(fetched.text) ?? topic;
          } catch { continue; }
          scanned++;
          const normalized = normalize(topic);
          if (normalized && !ownTopics.has(normalized)) gaps.push({ domain: competitor.domain, label: competitor.label, sourceUrl, url, topic });
        }
        domains.push({ domain: competitor.domain, label: competitor.label, status: 'ok', sourceUrl, scanned });
      } catch (error) {
        domains.push({ domain: competitor.domain, label: competitor.label, status: 'unavailable', scanned: 0, error: error instanceof Error ? error.message : 'Kaynak taranamadı.' });
      }
    }
    return NextResponse.json({ domains, gaps, ownPublishedPostCount: ownPosts.length, note: 'Konular, rakibin herkese açık sitemap kaynağındaki URL’lerden ve erişilebilen sayfa başlıklarından alınır. Eşleşme yalnızca yayımlanmış blog başlığı/slug normalizasyonuyla yapılır.' });
  } catch {
    return NextResponse.json({ error: 'Rakip konu analizi başlatılamadı. Lütfen tekrar deneyin.' }, { status: 503 });
  }
}