---
name: CHAT_STAFF role and routing
description: New admin role restricted to /admin/sohbet only; enforced via ChatStaffGuard + login redirect.
---

## Rule
CHAT_STAFF users must only access `/admin/sohbet` and `/admin/hesabim`. All other admin routes redirect them back to `/admin/sohbet`.

**Why:** Sohbet personeli need dashboard access to the live chat panel but must not reach sensitive admin areas (reservations, analytics, settings, etc.).

## Implementation pattern
- Login API (`app/admin/api/login/route.ts`) returns `{ success: true, redirectTo: '/admin/sohbet' }` for CHAT_STAFF (other roles get `/admin/dashboard`).
- `_LoginForm.tsx` uses `data.redirectTo ?? '/admin/dashboard'` after successful login.
- `app/admin/_components/ChatStaffGuard.tsx` (client component) reads `role` prop from the protected layout and calls `router.replace('/admin/sohbet')` for CHAT_STAFF on any non-sohbet path.
- `app/admin/(protected)/layout.tsx` renders `<ChatStaffGuard role={session.role} />` before the sidebar.
- `AdminSidebar.tsx` uses `getVisibleItems(role)` — returns only `[sohbet, hesabim]` for CHAT_STAFF.

## Personel management
- `/admin/personel` (page + `_PersonelClient.tsx`) — only visible to SUPER_ADMIN/ADMIN; PERSONEL_ITEM is injected by `getVisibleItems()`.
- CRUD API: `GET/POST /admin/api/staff`, `PATCH/DELETE /admin/api/staff/[id]`.
- Password change for staff not yet implemented — see follow-up task #155.
