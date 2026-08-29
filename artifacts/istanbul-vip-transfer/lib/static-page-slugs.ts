/**
 * static-page-slugs.ts
 *
 * Single source of truth for every WebPage slug that has a React component
 * wired up in app/[lang]/[...slug]/page.tsx (STATIC_PAGE_MAP).
 *
 * This file has NO React, Next.js, or browser dependencies so it can be
 * imported by both the Next.js app and standalone Node/tsx scripts.
 *
 * HOW TO KEEP THIS IN SYNC
 * ─────────────────────────
 * Run `pnpm new:page <slug>` to add a static page. It updates this list and
 * the component route map together with PAGE_REGISTRY.
 *
 * The prebuild step (`check:page-meta`) will fail the build if this list
 * does not match the WebPage slugs in PAGE_REGISTRY, catching a forgotten
 * update before a blank page ships.
 */
export const STATIC_PAGE_SLUGS: readonly string[] = [
  'hizmetler',
  'araclar',
  'hakkimizda',
  'iletisim',
];
