import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import {
  getAdminApiPermission,
  getAdminPagePermission,
  isCronAdminApi,
  isPublicAdminApi,
} from '../lib/auth/authorization';

function collectFiles(dir: string, filename: 'route.ts' | 'page.tsx'): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const file = join(dir, entry);
    return statSync(file).isDirectory()
      ? collectFiles(file, filename)
      : entry === filename ? [file] : [];
  });
}

function appPath(root: string, file: string): string {
  const segments = relative(root, file).split(sep).slice(0, -1);
  return `/${segments.map((segment) => segment.replace(/^\[.+\]$/, 'resource')).join('/')}`;
}

function exportedHttpMethods(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const methods = new Set<string>();
  const pattern = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b|export\s+const\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*=/g;
  for (const match of source.matchAll(pattern)) methods.add(match[1] ?? match[2]);
  return [...methods];
}

const appRoot = join(process.cwd(), 'app');
const unmapped: string[] = [];

for (const file of collectFiles(join(appRoot, 'admin/api'), 'route.ts')) {
  const pathname = appPath(appRoot, file);
  const methods = exportedHttpMethods(file);
  if (!methods.length) {
    unmapped.push(`API route has no detectable HTTP method export: ${pathname}`);
    continue;
  }

  for (const method of methods) {
    const classified = isPublicAdminApi(pathname)
      || isCronAdminApi(pathname)
      || Boolean(getAdminApiPermission(pathname, method));
    if (!classified) unmapped.push(`Unmapped admin API route method: ${method} ${pathname}`);
  }
}

for (const file of collectFiles(join(appRoot, 'admin/(protected)'), 'page.tsx')) {
  const pathname = appPath(appRoot, file).replace('/admin/(protected)', '/admin');
  if (!getAdminPagePermission(pathname)) {
    unmapped.push(`Unmapped protected admin page: ${pathname}`);
  }
}

assert.deepEqual(
  unmapped,
  [],
  `Every protected admin page and admin API method must have an explicit permission, public exception, or cron exception.\n${unmapped.join('\n')}`,
);

console.log('admin route permission-map inventory passed');