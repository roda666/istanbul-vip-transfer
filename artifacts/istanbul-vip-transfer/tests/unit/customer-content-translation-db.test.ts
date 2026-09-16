// Vitest is intentionally configured to collect tests/unit/**/*.test.ts only.
// Keep the DB workflow implementation grouped under tests/integration while
// exposing it through this collected entry point.
import '../integration/customer-content-translation.db.test';