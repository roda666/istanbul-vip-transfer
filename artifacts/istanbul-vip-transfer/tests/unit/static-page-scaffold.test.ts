import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  localizedStaticPath,
  resolveLocalizedStaticSlugFromSet,
} from '../../lib/localized-service-path';

const PACKAGE_ROOT = path.resolve(__dirname, '../..');
const SCRIPT_PATH = path.join(PACKAGE_ROOT, 'scripts', 'new-page.mjs');

let fixtureRoot: string;

function writeFixture(relativePath: string, content: string) {
  const filePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function createFixture({ brokenRoute = false } = {}) {
  writeFixture(
    'lib/page-registry.ts',
    `export const PAGE_REGISTRY = {
  "existing": {
    schemaType: 'WebPage',
    tr: { title: "Existing", description: "Existing page" },
  },
};

/** Ordered list of all registered page slugs. */
export const PAGE_SLUGS = Object.keys(PAGE_REGISTRY);
`,
  );
  writeFixture(
    'lib/static-page-slugs.ts',
    `export const STATIC_PAGE_SLUGS: readonly string[] = [
  "existing",
];
`,
  );
  writeFixture('lib/page-meta.json', '{}\n');
  writeFixture(
    'app/[lang]/[...slug]/page.tsx',
    `${brokenRoute ? '// missing required import marker' : "import IletisimPage      from '@/app/iletisim/page';"}

const STATIC_PAGE_MAP: Record<string, React.ComponentType> = {
  'iletisim':   IletisimPage,
};
`,
  );
}

function runScaffold(slug: string) {
  return spawnSync(process.execPath, [SCRIPT_PATH, slug], {
    cwd: PACKAGE_ROOT,
    env: { ...process.env, NEW_PAGE_ROOT: fixtureRoot },
    encoding: 'utf8',
  });
}

describe('new static page scaffold', () => {
  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'new-page-test-'));
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  it('creates complete wiring and localized routes for a numeric-leading slug', () => {
    createFixture();

    const result = runScaffold('2025-transfers');

    expect(result.status, result.stderr).toBe(0);
    const component = fs.readFileSync(
      path.join(fixtureRoot, 'app/2025-transfers/page.tsx'),
      'utf8',
    );
    const registry = fs.readFileSync(path.join(fixtureRoot, 'lib/page-registry.ts'), 'utf8');
    const staticSlugs = fs.readFileSync(
      path.join(fixtureRoot, 'lib/static-page-slugs.ts'),
      'utf8',
    );
    const route = fs.readFileSync(
      path.join(fixtureRoot, 'app/[lang]/[...slug]/page.tsx'),
      'utf8',
    );
    const metadata = JSON.parse(
      fs.readFileSync(path.join(fixtureRoot, 'lib/page-meta.json'), 'utf8'),
    );

    expect(component).toContain('function Static2025TransfersPage()');
    expect(registry).toContain('"2025-transfers":');
    expect(staticSlugs).toContain('"2025-transfers",');
    expect(route).toContain("import Static2025TransfersPage from '@/app/2025-transfers/page';");
    expect(route).toContain('"2025-transfers": Static2025TransfersPage,');
    expect(metadata['2025-transfers']._scaffolded).toBe(true);
    expect(Object.keys(metadata['2025-transfers'])).toEqual(
      expect.arrayContaining(['tr', 'en', 'de', 'ru', 'ar', 'es', 'fr', 'it', 'nl']),
    );

    const generatedSlugs = new Set(
      [...staticSlugs.matchAll(/["']([a-z0-9-]+)["'],/g)].map((match) => match[1]),
    );
    expect(localizedStaticPath('2025-transfers', 'tr')).toBe('/2025-transfers');
    expect(localizedStaticPath('2025-transfers', 'en')).toBe('/en/2025-transfers');
    expect(resolveLocalizedStaticSlugFromSet('2025-transfers', 'tr', generatedSlugs))
      .toBe('2025-transfers');
    expect(resolveLocalizedStaticSlugFromSet('2025-transfers', 'en', generatedSlugs))
      .toBe('2025-transfers');

    expect(() =>
      execFileSync(
        process.execPath,
        [
          '-e',
          `const ts=require('typescript');const fs=require('fs');const source=fs.readFileSync(process.argv[1],'utf8');const result=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.Preserve},reportDiagnostics:true});if((result.diagnostics||[]).some((d)=>d.category===ts.DiagnosticCategory.Error))process.exit(1);`,
          path.join(fixtureRoot, 'app/2025-transfers/page.tsx'),
        ],
        { cwd: PACKAGE_ROOT },
      ),
    ).not.toThrow();
  });

  it('leaves no partial changes when a required route anchor is missing', () => {
    createFixture({ brokenRoute: true });
    const trackedFiles = [
      'lib/page-registry.ts',
      'lib/static-page-slugs.ts',
      'lib/page-meta.json',
      'app/[lang]/[...slug]/page.tsx',
    ];
    const before = new Map(
      trackedFiles.map((file) => [file, fs.readFileSync(path.join(fixtureRoot, file), 'utf8')]),
    );

    const result = runScaffold('rollback-test');

    expect(result.status).not.toBe(0);
    for (const file of trackedFiles) {
      expect(fs.readFileSync(path.join(fixtureRoot, file), 'utf8')).toBe(before.get(file));
    }
    expect(fs.existsSync(path.join(fixtureRoot, 'app/rollback-test'))).toBe(false);
  });
});