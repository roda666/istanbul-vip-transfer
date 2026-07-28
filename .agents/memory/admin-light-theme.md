---
name: Admin light theme migration
description: Color tokens and component patterns for the light admin panel theme (completed migration from dark #0A0A0A theme).
---

## Color tokens

| Token | Value | Usage |
|-------|-------|-------|
| Page bg | `#F3F6FA` | admin layout outer div |
| Card/surface | `#FFFFFF` | section cards, tables, forms |
| Secondary bg | `#EAF0F6` | login page background |
| Sidebar | `#132A44` | AdminSidebar bg |
| Sidebar secondary | `#1B3858` | sidebar user card bg |
| Main text | `#172B3A` | headings, input text, primary labels |
| Secondary text | `#52697A` | form labels (uppercase), section headings |
| Muted text | `#718596` | descriptions, placeholders, table headers |
| Very muted | `#A0B0BC` | monospace IDs, counters |
| Border | `#D8E1E9` | all card/input/table borders |
| Row divider | `#EDF2F7` | table row borders |
| Primary blue | `#2563EB` | primary buttons, edit action bg (`#EFF6FF`/`#2563EB`) |
| Gold | `#C99A32` | branding (was `#C9A84C`), sidebar active items |
| Success | `#168C5B` | approve button bg, success banners (`#F0FDF4`) |
| Error | `#D64545` | destructive button text, error banners (`#FEF2F2`/`#FECACA`) |
| Warning | `#D97706` | warning banners (`#FFFBEB`/`#FDE68A`) |

## Button system

| Variant | Background | Text | Border |
|---------|-----------|------|--------|
| Primary (Save/New) | `#2563EB` | `#FFFFFF` | none |
| Approve | `#168C5B` | `#FFFFFF` | none |
| Publish | `#2563EB` | `#FFFFFF` | none |
| Gold/Brand | `#C99A32` | `#172B3A` | none |
| Destructive/Archive | `#FEF2F2` | `#D64545` | `1px solid #FECACA` |
| Cancel/Ghost | `#FFFFFF` | `#52697A` | `1px solid #D8E1E9` |

## Status badge colors (light pills)

| Status | Background | Text |
|--------|-----------|------|
| DRAFT | `#F1F5F9` | `#64748B` |
| RESEARCH | `#EFF6FF` | `#2563EB` |
| REVIEW | `#FFFBEB` | `#D97706` |
| APPROVED | `#F0FDF4` | `#168C5B` |
| SCHEDULED | `#F5F3FF` | `#7C3AED` |
| PUBLISHED | `#ECFDF5` | `#059669` |
| ARCHIVED | `#F8FAFC` | `#64748B` |

## Files changed

All admin components and pages migrated. Key shared:
- `app/admin/(protected)/layout.tsx` — outer bg
- `app/admin/_components/AdminSidebar.tsx` — navy sidebar `#132A44`
- `app/admin/_components/AdminPageHeader.tsx` — light border, navy title
- `app/admin/_components/ContentList.tsx` — white table, blue edit btn
- `app/admin/_components/ContentForm.tsx` — white cards, light inputs
- `app/admin/_components/StatusBadge.tsx` — reads from `lib/workflow.ts` STATUS_COLORS
- `lib/workflow.ts` — STATUS_COLORS updated to light pills

## VehicleForm sub-components

The `_VehicleForm.tsx` uses local `BG2` and `BORDER` constants.
- `BG2 = '#FFFFFF'` (was `#1a1a1a`)
- `BORDER = '#D8E1E9'` (was `rgba(201,168,76,0.15)`)
- ActionButton `primary` → blue `#2563EB` (was gold/black)

**Why:** The file was too large (1007 lines) to fully rewrite efficiently; targeted token replacements were used instead.

## ConfirmDialog pattern

All ConfirmDialogs now use:
- Backdrop: `rgba(23,43,58,0.5)` with `backdropFilter: blur(4px)`
- Card: `#FFFFFF` bg, `1px solid #D8E1E9` border, navy heading, muted body text
