---
name: next/font migration
description: Google Fonts CSS @import removed; fonts loaded via next/font/google with CSS variable approach.
---

## Rule
Never add Google Fonts via CSS `@import` or `<link>` tags. Always use `next/font/google`.

**Why:** CSS @import causes render-blocking requests, FOIT (flash of invisible text), and layout shift. next/font self-hosts fonts at build time, eliminating the external request entirely.

## How to apply
- Fonts are declared in `app/layout.tsx` as module-level constants (Playfair_Display, Inter).
- Each font gets a CSS variable: `--font-playfair` and `--font-inter`.
- The `<html>` tag receives `className={playfairDisplay.variable + ' ' + inter.variable}`.
- `globals.css` uses `var(--font-playfair)` and `var(--font-inter)` via `--app-font-serif` / `--app-font-sans` custom properties.
- No preconnect links needed (next/font handles self-hosting).

## Adding a new font
1. Import from `next/font/google` in `app/layout.tsx`
2. Declare with `variable: '--font-yourname'`
3. Add the variable class to `<html>` tag
4. Reference `var(--font-yourname)` in `globals.css`
