---
name: Reservation panel count vs raw DB count
description: Why the Talepler admin list total can be lower than a raw `select count(*) from reservation_requests`.
---

`app/admin/api/requests/route.ts` always applies `isNull(reservationRequests.archivedAt)` as a base condition, regardless of any other filter. Archived requests are hidden from the default list and its pagination total, but still exist in the table.

**Why:** archiving is a soft-delete used to declutter the list without losing the record.

**How to apply:** when reconciling "how many requests are there" between the DB and what the admin sees, always check `archived_at` first — don't assume a mismatch means duplicate/corrupt data. The sidebar unread badge (`/admin/api/requests/count`) is a third, even narrower number (status = NEW and unarchived only) — don't conflate the three counts when auditing.
