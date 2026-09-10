---
name: Structural reference translation sync
description: Boundary between immediate multilingual reference-data updates and approval-gated editorial translations.
---

Short structural/reference data shown publicly, including location labels and supported vehicle fields, synchronizes changed Turkish source fields across EN, DE, RU, AR, ES, FR, IT and NL immediately. A changed source field replaces its corresponding locale values; unrelated fields remain intact. Numeric coordinates and capacities are shared values and do not need translation.

**Why:** Missing-only translation preserves stale locale values after an admin changes a source label. Reference data is low risk and must stay consistent immediately, unlike editorial content.

**How to apply:** Use the structural synchronization helper in protected create/update APIs for reference entities. Keep blog bodies, SEO copy and FAQs on their existing draft, approval and publication lifecycle; never route them through immediate structural synchronization.