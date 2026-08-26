---
name: toll_tariffs exclusion constraint must key on gate names too
description: The day/night no-overlap exclusion constraints on toll_tariffs originally didn't include entry/exit gate name, which silently blocked a second GATE_PAIR tariff row for the same point+class.
---

`toll_tariffs_active_window_no_overlap_day`/`_night` (added in migrations 0060/0062) keyed only on
`(toll_point_id, vehicle_class, active window)`. That's correct for a FLAT point (at most one active tariff
per point+class+timeband) but wrong for a GATE_PAIR point, which legitimately needs many simultaneously-active
rows per point+class — one per distinct entry/exit gate pair. Inserting a second gate pair's tariff failed with
a Postgres exclusion-constraint violation (`23P01`), even though the rows were not real duplicates.

**Fix (migration 0067):** fold `COALESCE(entry_gate_name, '')`/`COALESCE(exit_gate_name, '')` into the
exclusion key, same COALESCE-to-sentinel technique already used for `valid_from`/`valid_until`. FLAT points
(gate names always NULL/NULL) still collapse to one sentinel pair per point+class, so their original
one-active-row guarantee is unchanged; GATE_PAIR points now get a distinct sentinel per gate pair, so distinct
pairs no longer collide while duplicate rows for the *same* pair still correctly conflict.

**Why:** naive `WITH =` on a nullable column in a Postgres EXCLUDE constraint treats two NULLs as
non-matching (comparison is NULL/unknown, not TRUE), which is exactly backwards from what dedup needs — you
must coalesce nullable exclusion-key columns to a sentinel, not compare them raw.

**How to apply:** before writing multiple tariff rows for the same GATE_PAIR point+vehicle-class (different
entry/exit pairs), verify this migration has been applied; if a similar exclusion-constraint violation appears
on any other table with a nullable "which sub-entity does this row scope to" column, look for the same
missing-COALESCE root cause before assuming the new rows are genuine duplicates.
