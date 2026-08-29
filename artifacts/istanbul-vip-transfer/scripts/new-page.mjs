/**
 * Scaffold a static WebPage and wire every registry used by the localized
 * catch-all route.
 *
 * Usage:
 *   pnpm new:page <slug>
 *   pnpm new:page <slug> --title "Turkish title" --description "SEO description"
 *
 * The command is intentionally deterministic and does not require an API key.
 * It creates draft metadata for every public language so check:page-meta can
 * run immediately. `generate:page-meta` recognizes the draft marker and
 * replaces those values with AI translations.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.NEW_PAGE_ROOT
  ? path.resolve(process.env.NEW_PAGE_ROOT)
  : fileURLToPath(new URL('..', import.meta.url));
const REGISTRY_PATH = path.join(ROOT, 'lib', 'page-registry.ts');
const STATIC_SLUGS_PATH = path.join(ROOT, 'lib', 'static-page-slugs.ts');
const ROUTE_PATH = path.join(ROOT, 'app', '[lang]', '[...slug]', 'page.tsx');
const PAGE_META_PATH = path.join(ROOT, 'lib', 'page-meta.json');
const APP_PATH = path.join(ROOT, 'app');

const TARGET_LANGS = {
  en: {
    titleSuffix: ' | VIP Transfer Istanbul',
    description: (label) =>
      `Learn more about ${label} and premium VIP transfer services in Istanbul.`,
  },
  de: {
    titleSuffix: ' | VIP Transfer Istanbul',
    description: (label) =>
      `Erfahren Sie mehr über ${label} und Premium-VIP-Transfers in Istanbul.`,
  },
  ru: {
    titleSuffix: ' | VIP Transfer Istanbul',
    description: (label) =>
      `Узнайте больше о разделе «${label}» и премиальных VIP-трансферах в Стамбуле.`,
  },
  ar: {
    titleSuffix: ' | VIP Transfer Istanbul',
    description: (label) =>
      `تعرّف على ${label} وخدمات النقل المميزة لكبار الشخصيات في إسطنبول.`,
  },
  es: {
    titleSuffix: ' | VIP Transfer Istanbul',
    description: (label) =>
      `Descubre ${label} y los servicios premium de traslado VIP en Estambul.`,
  },
  fr: {
    titleSuffix: ' | VIP Transfer Istanbul',
    description: (label) =>
      `Découvrez ${label} et les services premium de transfert VIP à Istanbul.`,
  },
  it: {
    titleSuffix: ' | VIP Transfer Istanbul',
    description: (label) =>
      `Scopri ${label} e i servizi premium di trasferimento VIP a Istanbul.`,
  },
  nl: {
    titleSuffix: ' | VIP Transfer Istanbul',
    description: (label) =>
      `Lees meer over ${label} en premium VIP-transferdiensten in Istanbul.`,
  },
};

function usage(message) {
  if (message) console.error(`\n✗ ${message}`);
  console.error('\nUsage: pnpm new:page <slug> [--title "..."] [--description "..."]');
  console.error('Slug must be a lowercase URL segment such as "corporate-transfers".');
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const slug = args.shift();
  if (!slug || slug.startsWith('-')) usage('A slug is required.');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    usage(`Invalid slug "${slug}". Use lowercase letters, numbers, and hyphens only.`);
  }

  const options = {};
  while (args.length > 0) {
    const flag = args.shift();
    if (flag !== '--title' && flag !== '--description') {
      usage(`Unknown option "${flag}".`);
    }
    const value = args.shift();
    if (!value || value.startsWith('--')) usage(`${flag} requires a value.`);
    options[flag.slice(2)] = value;
  }
  return { slug, options };
}

function humanizeSlug(slug) {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function componentName(slug) {
  const slugName = slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
  return `Static${slugName}Page`;
}

function quote(value) {
  return JSON.stringify(value);
}

function escapeJsxText(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;');
}

function sourceHash(title, description) {
  return crypto
    .createHash('sha256')
    .update(`${title}\n${description}`)
    .digest('hex')
    .slice(0, 16);
}

function draftMeta(label, title, description) {
  return {
    tr: { title, description },
    ...Object.fromEntries(
      Object.entries(TARGET_LANGS).map(([lang, copy]) => [
        lang,
        {
          title: `${label}${copy.titleSuffix}`,
          description: copy.description(label),
        },
      ]),
    ),
    _sourceHash: sourceHash(title, description),
    _scaffolded: true,
  };
}

function componentSource(name, label, description) {
  const jsxLabel = escapeJsxText(label);
  const jsxDescription = escapeJsxText(description);
  const commentLabel = label.replace(/\*\//g, '* /');
  return `/**
 * Static page scaffold for "${commentLabel}".
 *
 * Replace this draft content with the page's final sections and localized
 * copy. The localized catch-all route reuses this component for every locale.
 */
export default function ${name}() {
  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto max-w-4xl px-5 py-20 md:px-8">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
          İstanbul VIP Transfer
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
          ${jsxLabel}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          ${jsxDescription}
        </p>
        {/* TODO: Replace this scaffold with the final page content. */}
      </section>
    </main>
  );
}
`;
}

function updateRegistry(source, slug, title, description) {
  const marker = '\n};\n\n/** Ordered list of all registered page slugs. */';
  if (!source.includes(marker)) throw new Error('Could not find PAGE_REGISTRY insertion point.');
  const entry = [
    `  ${quote(slug)}: {`,
    `    schemaType: 'WebPage',`,
    '    tr: {',
    `      title: ${quote(title)},`,
    `      description: ${quote(description)},`,
    '    },',
    '  },',
  ].join('\n');
  return source.replace(marker, `\n${entry}${marker}`);
}

function updateStaticSlugs(source, slug) {
  const marker = '\n];';
  if (!source.includes(marker)) throw new Error('Could not find STATIC_PAGE_SLUGS insertion point.');
  return source.replace(marker, `\n  ${quote(slug)},${marker}`);
}

function updateRoute(source, slug, name) {
  const importMarker = "import IletisimPage      from '@/app/iletisim/page';";
  if (!source.includes(importMarker)) throw new Error('Could not find route import insertion point.');
  const importLine = `import ${name.padEnd(18)} from '@/app/${slug}/page';`;
  const withImport = source.replace(importMarker, `${importMarker}\n${importLine}`);

  const mapMarker = "  'iletisim':   IletisimPage,\n};";
  if (!withImport.includes(mapMarker)) throw new Error('Could not find STATIC_PAGE_MAP insertion point.');
  return withImport.replace(
    mapMarker,
    `${mapMarker.replace('\n};', `\n  ${quote(slug)}: ${name},\n};`)}`,
  );
}

function writeAtomically(files) {
  const originals = new Map();
  const created = new Set();
  try {
    for (const [filePath, content] of files) {
      if (fs.existsSync(filePath)) originals.set(filePath, fs.readFileSync(filePath, 'utf8'));
      else created.add(filePath);
      const tempPath = `${filePath}.new-page-${process.pid}`;
      fs.writeFileSync(tempPath, content, 'utf8');
      fs.renameSync(tempPath, filePath);
    }
  } catch (error) {
    for (const [filePath, content] of originals) fs.writeFileSync(filePath, content, 'utf8');
    for (const filePath of created) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    throw error;
  }
}

function main() {
  const { slug, options } = parseArgs();
  const label = humanizeSlug(slug);
  const title = options.title ?? `${label} | İstanbul VIP Transfer`;
  const description =
    options.description ??
    `${label} hakkında İstanbul VIP Transfer hizmetleri ve çözümleri hakkında bilgi alın.`;
  const name = componentName(slug);
  const componentPath = path.join(APP_PATH, slug, 'page.tsx');

  const registry = fs.readFileSync(REGISTRY_PATH, 'utf8');
  const staticSlugs = fs.readFileSync(STATIC_SLUGS_PATH, 'utf8');
  const route = fs.readFileSync(ROUTE_PATH, 'utf8');
  const pageMeta = JSON.parse(fs.readFileSync(PAGE_META_PATH, 'utf8'));

  if (Object.prototype.hasOwnProperty.call(pageMeta, slug) ||
      new RegExp(`['"]${slug}['"]\\s*:`).test(registry) ||
      new RegExp(`['"]${slug}['"]`).test(staticSlugs) ||
      fs.existsSync(componentPath)) {
    usage(`A page with slug "${slug}" already exists.`);
  }

  pageMeta[slug] = draftMeta(label, title, description);

  const generatedFiles = [
    [componentPath, componentSource(name, label, description)],
    [REGISTRY_PATH, updateRegistry(registry, slug, title, description)],
    [STATIC_SLUGS_PATH, updateStaticSlugs(staticSlugs, slug)],
    [ROUTE_PATH, updateRoute(route, slug, name)],
    [PAGE_META_PATH, `${JSON.stringify(pageMeta, null, 2)}\n`],
  ];
  const componentDirectory = path.dirname(componentPath);
  const componentDirectoryExisted = fs.existsSync(componentDirectory);
  fs.mkdirSync(componentDirectory, { recursive: true });
  try {
    writeAtomically(generatedFiles);
  } catch (error) {
    if (!componentDirectoryExisted && fs.existsSync(componentDirectory)) {
      fs.rmdirSync(componentDirectory);
    }
    throw error;
  }

  console.log(`✓ Scaffolded static page "${slug}"`);
  console.log(`  Component: app/${slug}/page.tsx`);
  console.log('  Registry, localized route map, static slug list, and draft metadata updated.');
  console.log('  Run "pnpm generate:page-meta" to replace draft metadata with translations.');
}

try {
  main();
} catch (error) {
  console.error(`\n✗ Could not scaffold page: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}