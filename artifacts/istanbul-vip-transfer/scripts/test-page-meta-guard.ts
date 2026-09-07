/**
 * Regression test for check-page-meta.ts.
 *
 * The guard reads the checked-in page-meta.json at a fixed path, so this test
 * temporarily replaces that file with a copy containing one stale hash. The
 * original file is restored even when the child process or an assertion fails.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, "..");
const PAGE_META_PATH = path.join(PACKAGE_ROOT, "lib", "page-meta.json");

const originalPageMeta = fs.readFileSync(PAGE_META_PATH, "utf8");
const tempRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "page-meta-guard-test-"),
);
const backupPath = path.join(tempRoot, "page-meta.json");
fs.writeFileSync(backupPath, originalPageMeta, "utf8");

try {
  const pageMeta = JSON.parse(originalPageMeta) as Record<
    string,
    Record<string, unknown>
  >;
  const [slug] = Object.keys(pageMeta);

  if (!slug) {
    throw new Error(
      "page-meta.json has no slug to use for the stale-hash test",
    );
  }

  pageMeta[slug]._sourceHash = "deliberately-wrong";
  fs.writeFileSync(
    PAGE_META_PATH,
    `${JSON.stringify(pageMeta, null, 2)}\n`,
    "utf8",
  );

  const result = spawnSync(
    "pnpm",
    ["exec", "tsx", "scripts/check-page-meta.ts"],
    {
      cwd: PACKAGE_ROOT,
      env: process.env,
      encoding: "utf8",
    },
  );

  if (result.error) {
    throw new Error(
      `failed to run check-page-meta.ts: ${result.error.message}`,
    );
  }

  if (result.status !== 1) {
    throw new Error(
      `expected check-page-meta.ts to exit with code 1, got ${String(result.status)}\n` +
        `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }

  if (!result.stderr.includes("[stale-hash]")) {
    throw new Error(
      `expected stderr to contain "[stale-hash]"\nactual stderr:\n${result.stderr}`,
    );
  }

  console.log(`✓  page-meta guard rejects a stale hash for "${slug}"`);
} finally {
  fs.copyFileSync(backupPath, PAGE_META_PATH);
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
