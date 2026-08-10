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
 * When you add a new WebPage entry to PAGE_REGISTRY:
 *   1. Create the component (e.g. app/yeni-sayfa/page.tsx).
 *   2. Add the slug to STATIC_PAGE_SLUGS (this file).
 *   3. Import the component and add it to STATIC_PAGE_MAP in
 *      app/[lang]/[...slug]/page.tsx.
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
