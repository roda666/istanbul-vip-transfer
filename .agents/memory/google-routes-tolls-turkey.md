---
name: Google Routes tolls in Turkey
description: Real API behavior and safe architectural limits for Turkish toll-route detection.
---

Do not treat Google Routes `extraComputations: ["TOLLS"]` as a structured Turkish toll-point source. A real Istanbul Airport to İzmir request on 2026-09-10 returned routes whose descriptions/instructions named O-7, O-4 and O-5 and marked them “Paralı yol,” but both route- and leg-level `tollInfo` were absent. The official TollPass enum also had no Turkey/HGS/OGS entry. Navigation text identifies general roads only; it is not a stable toll-point ID and does not provide a closed-system entry/exit gate pair.

**Why:** Assuming that a successful `TOLLS` request means structured Turkey support would silently omit fees or map the wrong gate pair. Even in supported markets, `TollInfo` is an aggregate estimate object, not this project’s verified tariff identity.

**How to apply:** Keep Google distance/duration and optional road-name/polyline signals advisory. Resolve billable toll points and gate pairs through deterministic, admin-reviewed internal route/corridor templates, then calculate only from manually sourced, effective-dated tariffs. Never ingest Google’s estimated toll price.