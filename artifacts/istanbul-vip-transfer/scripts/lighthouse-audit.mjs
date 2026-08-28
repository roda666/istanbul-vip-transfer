import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import net from 'node:net';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { getPublicLanguage } from '../lib/i18n/active-locales.ts';

const BASE_URL = process.env.LIGHTHOUSE_BASE_URL ?? 'http://127.0.0.1:3100';
const RUNS_PER_PAGE = 3;
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];
const PAGES = [
  { path: '/', label: 'Ana sayfa' },
  { path: '/hizmetler', label: 'Hizmetler' },
  { path: '/istanbul-havalimani-transfer', label: 'Tek hizmet' },
  { path: '/araclar', label: 'Araç filosu' },
  { path: '/blog/istanbul-havalimani-transfer-rehberi', label: 'Blog makalesi' },
];
const METRICS = [
  ['first-contentful-paint', 'FCP', 'ms'],
  ['largest-contentful-paint', 'LCP', 'ms'],
  ['total-blocking-time', 'TBT', 'ms'],
  ['cumulative-layout-shift', 'CLS', 'unitless'],
  ['speed-index', 'Speed Index', 'ms'],
  ['interactive', 'TTI', 'ms'],
  ['server-response-time', 'TTFB', 'ms'],
];

function median(values) {
  const finite = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!finite.length) return null;
  const middle = Math.floor(finite.length / 2);
  return finite.length % 2 ? finite[middle] : (finite[middle - 1] + finite[middle]) / 2;
}

function round(value, digits = 1) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function classify(metricId, value, score) {
  if (!Number.isFinite(value)) return 'unavailable';
  const thresholds = {
    'first-contentful-paint': [1800, 3000],
    'largest-contentful-paint': [2500, 4000],
    'total-blocking-time': [200, 600],
    'cumulative-layout-shift': [0.1, 0.25],
    'speed-index': [3400, 5800],
    interactive: [3800, 7300],
    'server-response-time': [800, 1800],
  }[metricId];
  if (thresholds) {
    if (value <= thresholds[0]) return 'good';
    if (value <= thresholds[1]) return 'average';
    return 'poor';
  }
  if (score >= 0.9) return 'good';
  if (score >= 0.5) return 'average';
  return 'poor';
}

function formatMetric(metricId, value) {
  if (!Number.isFinite(value)) return null;
  if (metricId === 'cumulative-layout-shift') return round(value, 3);
  return Math.round(value);
}

function metricFromLhr(lhr, id) {
  const audit = lhr.audits[id];
  return {
    value: formatMetric(id, audit?.numericValue),
    score: audit?.score ?? null,
    displayValue: audit?.displayValue ?? null,
  };
}

function medianMetrics(runs) {
  return Object.fromEntries(METRICS.map(([id, label, unit]) => {
    const values = runs.map((run) => run.metrics[id]?.value);
    const value = median(values);
    const score = median(runs.map((run) => run.metrics[id]?.score));
    return [id, {
      label,
      unit,
      value,
      score: round(score, 3),
      classification: classify(id, value, score),
    }];
  }));
}

function medianCategories(runs) {
  return Object.fromEntries(CATEGORIES.map((id) => [
    id,
    round(median(runs.map((run) => (runs && run.categories[id] !== null ? run.categories[id] : null))), 1),
  ]));
}

function nodeDescription(node) {
  if (!node) return 'LCP node not reported';
  return node.snippet || node.selector || node.path?.join(' > ') || 'LCP node reported without snippet';
}

function normalizeUrl(value, pageUrl) {
  try {
    return new URL(value, pageUrl).href;
  } catch {
    return value ?? null;
  }
}

function lcpDetails(lhr, pageUrl) {
  const insight = lhr.audits['lcp-breakdown-insight'];
  const node = insight?.details?.items?.find((item) => item.type === 'node');
  const description = nodeDescription(node);
  const selector = node?.selector;
  const image = (lhr.artifacts?.ImageElements ?? []).find((candidate) => {
    return selector && candidate.node?.selector === selector;
  });
  const normalizedImageUrl = image?.src ? normalizeUrl(image.src, pageUrl) : null;
  const links = lhr.artifacts?.LinkElements ?? [];
  const preloaded = Boolean(normalizedImageUrl && links.some((link) =>
    link.rel === 'preload' &&
    link.as === 'image' &&
    normalizeUrl(link.href, pageUrl) === normalizedImageUrl
  ));
  const priority = image?.fetchPriority === 'high' ||
    /fetchpriority=["']high["']|priority=["']high["']/i.test(node?.snippet ?? '');
  return {
    element: description,
    imageUrl: normalizedImageUrl,
    isImage: Boolean(image || normalizedImageUrl || /<img\b|background-image/i.test(description)),
    priority: image ? image.fetchPriority || 'auto' : (priority ? 'high' : 'not-applicable'),
    preload: normalizedImageUrl ? preloaded : 'not-applicable',
  };
}

function jsRequests(lhr) {
  const items = lhr.audits['network-requests']?.details?.items ?? [];
  return items
    .filter((item) => item.resourceType === 'Script' || item.resourceType === 'script')
    .map((item) => ({
      url: item.url,
      transferBytes: item.transferSize ?? 0,
      resourceBytes: item.resourceSize ?? item.transferSize ?? 0,
    }))
    .sort((a, b) => b.transferBytes - a.transferBytes)
    .slice(0, 10);
}

function walkTreemap(nodes, output = []) {
  for (const node of nodes ?? []) {
    output.push(node);
    walkTreemap(node.children, output);
  }
  return output;
}

function packageUsage(lhr) {
  const roots = lhr.audits['script-treemap-data']?.details?.nodes ?? [];
  const names = ['framer-motion', 'lucide-react', 'react-hook-form'];
  const totalBytes = roots.reduce((sum, node) => sum + (node.resourceBytes ?? 0), 0);
  const sumPackage = (tree, name) => (tree ?? []).reduce((sum, node) => {
    if (typeof node.name === 'string' && node.name.includes(name)) {
      return sum + (node.resourceBytes ?? 0);
    }
    return sum + sumPackage(node.children, name);
  }, 0);
  return Object.fromEntries(names.map((name) => {
    const bytes = sumPackage(roots, name);
    return [name, bytes > 0
      ? { bytes, sharePercent: totalBytes ? round((bytes / totalBytes) * 100, 2) : null }
      : {
          bytes: null,
          sharePercent: null,
          reason: 'Production source maps do not expose package names in Lighthouse treemap data.',
        }];
  }));
}

function opportunities(lhr, page) {
  const results = [];
  for (const [id, audit] of Object.entries(lhr.audits)) {
    const details = audit?.details;
    const ms = details?.overallSavingsMs;
    const bytes = details?.overallSavingsBytes;
    if ((!Number.isFinite(ms) || ms <= 0) && (!Number.isFinite(bytes) || bytes <= 0)) continue;
    results.push({
      page: page.label,
      path: page.path,
      audit: id,
      title: audit.title,
      savingsMs: Number.isFinite(ms) ? Math.round(ms) : 0,
      savingsKB: Number.isFinite(bytes) ? round(bytes / 1024, 1) : 0,
      reason: audit.description,
    });
  }
  return results;
}

function cdpFrame(opcode, payload) {
  const data = Buffer.from(payload);
  const mask = crypto.randomBytes(4);
  const masked = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) masked[i] = data[i] ^ mask[i % 4];
  let header;
  if (data.length < 126) {
    header = Buffer.from([0x80 | opcode, 0x80 | data.length]);
  } else if (data.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(data.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(data.length), 2);
  }
  return Buffer.concat([header, mask, masked]);
}

class CdpConnection {
  constructor(target) {
    this.target = target;
    this.buffer = Buffer.alloc(0);
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    const parsed = new URL(this.target.webSocketDebuggerUrl);
    this.socket = net.createConnection({ host: parsed.hostname, port: Number(parsed.port) });
    await new Promise((resolve, reject) => {
      this.socket.once('connect', resolve);
      this.socket.once('error', reject);
    });
    const key = crypto.randomBytes(16).toString('base64');
    this.socket.write(
      `GET ${parsed.pathname}${parsed.search} HTTP/1.1\r\n` +
      `Host: ${parsed.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
      `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
    );
    await new Promise((resolve, reject) => {
      const onData = (chunk) => {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        const end = this.buffer.indexOf('\r\n\r\n');
        if (end < 0) return;
        const status = this.buffer.subarray(0, end).toString();
        if (!status.includes('101')) {
          reject(new Error(`CDP websocket handshake failed: ${status}`));
          return;
        }
        this.buffer = this.buffer.subarray(end + 4);
        this.socket.off('data', onData);
        this.socket.on('data', (data) => this.onData(data));
        if (this.buffer.length) this.onData(Buffer.alloc(0));
        resolve();
      };
      this.socket.on('data', onData);
      this.socket.once('error', reject);
    });
  }

  onData(chunk) {
    if (chunk.length) this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 2) {
      const first = this.buffer[0];
      const second = this.buffer[1];
      let offset = 2;
      let length = second & 0x7f;
      if (length === 126) {
        if (this.buffer.length < 4) return;
        length = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (this.buffer.length < 10) return;
        length = Number(this.buffer.readBigUInt64BE(2));
        offset = 10;
      }
      if (this.buffer.length < offset + length) return;
      const payload = this.buffer.subarray(offset, offset + length);
      this.buffer = this.buffer.subarray(offset + length);
      const opcode = first & 0x0f;
      if (opcode === 0x1) {
        const message = JSON.parse(payload.toString());
        if (message.id && this.pending.has(message.id)) {
          const { resolve, reject } = this.pending.get(message.id);
          this.pending.delete(message.id);
          if (message.error) reject(new Error(message.error.message));
          else resolve(message.result);
        }
      }
    }
  }

  command(method, params = {}) {
    const id = this.nextId++;
    this.socket.write(cdpFrame(0x1, JSON.stringify({ id, method, params })));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  close() {
    this.socket?.destroy();
  }
}

async function jsonFetch(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}

async function probeFonts(baseUrl) {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  let cdp;
  try {
    const targets = await jsonFetch(`http://127.0.0.1:${chrome.port}/json/list`);
    const target = targets.find((entry) => entry.type === 'page');
    if (!target) throw new Error('No Chrome page target available for font probe');
    cdp = new CdpConnection(target);
    await cdp.connect();
    await cdp.command('Page.enable');
    await cdp.command('Runtime.enable');
    await cdp.command('DOM.enable');
    await cdp.command('CSS.enable');
    const results = {};
    for (const locale of ['tr', 'ru', 'ar']) {
      const path = locale === 'tr' ? '/' : `/${locale}`;
      await cdp.command('Page.navigate', { url: `${baseUrl}${path}` });
      await cdp.command('Runtime.evaluate', {
        expression: 'new Promise(resolve => document.fonts.ready.then(() => setTimeout(resolve, 350)))',
        awaitPromise: true,
      });
      const evaluated = await cdp.command('Runtime.evaluate', {
        expression: `(() => ({
          locale: document.documentElement.lang,
          bodyFont: getComputedStyle(document.body).fontFamily,
          headingFont: document.querySelector('h1') ? getComputedStyle(document.querySelector('h1')).fontFamily : null,
          faces: [...document.fonts].map(font => ({
            family: font.family,
            weight: font.weight,
            style: font.style,
            status: font.status,
          })),
        }))()`,
        returnByValue: true,
      });
      const root = await cdp.command('DOM.getDocument');
      const heading = await cdp.command('DOM.querySelector', {
        nodeId: root.root.nodeId,
        selector: 'h1',
      });
      let platformFonts = [];
      if (heading.nodeId) {
        const platform = await cdp.command('CSS.getPlatformFontsForNode', { nodeId: heading.nodeId });
        platformFonts = platform.fonts ?? [];
      }
      results[locale] = {
        ...evaluated.result.value,
        headingPlatformFonts: platformFonts.map((font) => ({
          familyName: font.familyName,
          glyphCount: font.glyphCount,
          isCustomFont: font.isCustomFont,
        })),
      };
    }
    const trFaces = results.tr?.faces ?? [];
    const playfairFaces = trFaces.filter((font) => /Playfair/i.test(font.family));
    return {
      pages: results,
      playfairDefined: playfairFaces.length,
      playfairLoaded: playfairFaces.filter((font) => font.status === 'loaded').length,
      note: 'Platform font data comes from Chrome CSS.getPlatformFontsForNode; unloaded faces are defined but not fetched.',
    };
  } finally {
    cdp?.close();
    await chrome.kill();
  }
}

async function measureLayoutPhases() {
  const languageSamples = [];
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    await getPublicLanguage('tr');
    languageSamples.push(performance.now() - start);
  }
  return {
    getPublicLanguageMs: round(median(languageSamples), 1),
    getPublicChromeMs: null,
    getBookingFormBootstrapMs: null,
    addedBySerializationMs: null,
    reason:
      'getPublicChrome and getBookingFormBootstrap are wrapped in Next unstable_cache and cannot be invoked outside a live Next request context. Separating their durations requires application instrumentation, which this measurement task explicitly forbids.',
    method: '3 read-only direct samples for getPublicLanguage; no application instrumentation.',
  };
}

async function main() {
  if (process.env.LIGHTHOUSE_AUDIT !== '1') {
    throw new Error('Run with LIGHTHOUSE_AUDIT=1 so local production HTTP is not upgraded to HTTPS.');
  }
  const health = await fetch(`${BASE_URL}/`);
  if (!health.ok) throw new Error(`Production server is not healthy: HTTP ${health.status}`);

  const chrome = await chromeLauncher.launch({
    chromeFlags: [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--ignore-certificate-errors',
    ],
  });
  const allOpportunities = [];
  const pages = [];
  const errors = [];
  try {
    for (const page of PAGES) {
      const url = new URL(page.path, BASE_URL).toString();
      const runs = [];
      for (let run = 1; run <= RUNS_PER_PAGE; run++) {
        try {
          const result = await lighthouse(url, {
            port: chrome.port,
            logLevel: 'error',
            output: 'json',
            onlyCategories: CATEGORIES,
            formFactor: 'mobile',
            throttlingMethod: 'simulate',
          });
          if (!result?.lhr) throw new Error('Lighthouse returned no report');
          const lhr = result.lhr;
          const runData = {
            run,
            categories: Object.fromEntries(CATEGORIES.map((id) => [
              id,
              lhr.categories[id]?.score == null ? null : lhr.categories[id].score * 100,
            ])),
            metrics: Object.fromEntries(METRICS.map(([id]) => [id, metricFromLhr(lhr, id)])),
          };
          runs.push(runData);
          allOpportunities.push(...opportunities(lhr, page));
          if (run === 2) {
            page._representative = {
              lhr,
              lcp: lcpDetails(lhr, url),
              js: jsRequests(lhr),
              packages: packageUsage(lhr),
            };
          }
        } catch (error) {
          errors.push({ page: page.path, run, error: String(error) });
        }
      }
      if (runs.length !== RUNS_PER_PAGE) {
        throw new Error(`${page.path}: only ${runs.length}/${RUNS_PER_PAGE} Lighthouse runs completed`);
      }
      pages.push({
        path: page.path,
        label: page.label,
        categories: medianCategories(runs),
        metrics: medianMetrics(runs),
        lcp: page._representative.lcp,
        javascript: page._representative.js,
        packages: page._representative.packages,
        runs,
      });
      delete page._representative;
    }
  } finally {
    await chrome.kill();
  }

  const layout = await measureLayoutPhases();
  let fonts;
  try {
    fonts = await probeFonts(BASE_URL);
  } catch (error) {
    fonts = { error: String(error) };
  }

  const opportunityGroups = new Map();
  for (const item of allOpportunities) {
    const key = `${item.path}:${item.audit}`;
    const group = opportunityGroups.get(key) ?? { item, savingsMs: [], savingsKB: [] };
    group.savingsMs.push(item.savingsMs);
    group.savingsKB.push(item.savingsKB);
    opportunityGroups.set(key, group);
  }
  const medianOpportunities = [...opportunityGroups.values()].map((group) => ({
    ...group.item,
    savingsMs: Math.round(median(group.savingsMs) ?? 0),
    savingsKB: round(median(group.savingsKB) ?? 0, 1),
  }));
  medianOpportunities.sort((a, b) =>
    (b.savingsMs - a.savingsMs) || (b.savingsKB - a.savingsKB)
  );
  const packagePages = Object.fromEntries(['framer-motion', 'lucide-react', 'react-hook-form'].map((name) => [
    name,
    pages.filter((page) => Number(page.packages[name].bytes) > 0).map((page) => page.path),
  ]));

  console.log(JSON.stringify({
    audit: {
      baseUrl: BASE_URL,
      mode: 'mobile emulation + Lighthouse simulated throttling',
      runsPerPage: RUNS_PER_PAGE,
      categories: CATEGORIES,
      pages: PAGES.map(({ path, label }) => ({ path, label })),
    },
    pages,
    top15Opportunities: medianOpportunities.slice(0, 15),
    packagePages,
    fonts,
    layout,
    errors,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});