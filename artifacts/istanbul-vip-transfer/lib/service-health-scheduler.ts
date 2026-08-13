/**
 * Service page health scheduler.
 *
 * Runs the health check on a configurable interval (default: every hour) and
 * sends an alert email to ADMIN_EMAIL when unhealthy slugs are found.
 *
 * Rate limiting: at most one email per slug per ALERT_COOLDOWN_MS (default 6 h).
 * The last-alert timestamp is stored in the `service_health_alerts` DB table so
 * it survives server restarts.
 *
 * Call `startServiceHealthScheduler()` once at server startup (instrumentation.ts).
 *
 * IMPORTANT: All server-only imports (db, email, service-page-health) are done
 * with dynamic `import()` INSIDE `runServiceHealthCheck()` so that webpack does
 * not statically bundle Node.js-only packages (postgres, nodemailer) into the
 * client-development-fallback bundle when it analyses instrumentation.ts.
 */
import 'server-only';

/** How often to run the check (ms). */
const CHECK_INTERVAL_MS = 60 * 60 * 1_000; // 1 hour

/** Minimum time between alert emails for the same slug (ms). */
const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1_000; // 6 hours

const ISSUE_LABELS: Record<string, string> = {
  missing_record:      'No database record found',
  inactive:            'Page is inactive (is_active = false)',
  not_published:       'Page is not published',
  body_missing:        'Body content is missing',
  body_invalid_schema: 'Body content has invalid schema',
};

// ── HTML email builder ────────────────────────────────────────────────────────

/** Escape characters that have special meaning in HTML to prevent injection. */
function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildAlertEmail(items: Array<{ slug: string; title: string | null; issues: string[] }>) {
  const rows = items
    .map(item => {
      const safeTitle = esc(item.title ?? item.slug);
      const safeSlug  = esc(item.slug);
      const issueList = item.issues
        .map(code => `<li>${esc(ISSUE_LABELS[code] ?? code)}</li>`)
        .join('');
      return `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;font-weight:600;color:#1E293B;">
            ${safeTitle}
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:12px;">
            /${safeSlug}
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;">
            <ul style="margin:0;padding-left:18px;color:#B45309;">${issueList}</ul>
          </td>
        </tr>`;
    })
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:Inter,Arial,sans-serif;background:#F8FAFC;padding:32px;">
      <div style="max-width:680px;margin:auto;background:#fff;border-radius:12px;
                  border:1px solid #E2E8F0;overflow:hidden;">
        <div style="background:#FFF7ED;border-bottom:2px solid #FBBF24;padding:20px 28px;">
          <h1 style="margin:0;font-size:18px;color:#92400E;">
            ⚠️ Service Page Health Alert
          </h1>
          <p style="margin:6px 0 0;font-size:13px;color:#B45309;">
            ${items.length} service page${items.length > 1 ? 's' : ''} require${items.length === 1 ? 's' : ''} attention.
          </p>
        </div>
        <div style="padding:24px 28px;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:#F8FAFC;">
                <th style="text-align:left;padding:10px 14px;border-bottom:2px solid #E2E8F0;
                           font-size:11px;color:#6B7280;text-transform:uppercase;">Title</th>
                <th style="text-align:left;padding:10px 14px;border-bottom:2px solid #E2E8F0;
                           font-size:11px;color:#6B7280;text-transform:uppercase;">Slug</th>
                <th style="text-align:left;padding:10px 14px;border-bottom:2px solid #E2E8F0;
                           font-size:11px;color:#6B7280;text-transform:uppercase;">Issues</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin:20px 0 0;font-size:12px;color:#64748B;">
            These pages may be serving 404 errors or blank pages to real visitors.
            Please log in to the admin panel and restore the affected pages.
          </p>
        </div>
        <div style="padding:16px 28px;background:#F8FAFC;border-top:1px solid #E2E8F0;
                    font-size:11px;color:#94A3B8;">
          Istanbul VIP Transfer — Automated Health Monitor ·
          Checked at ${new Date().toUTCString()}
        </div>
      </div>
    </body>
    </html>`;

  const text = [
    'SERVICE PAGE HEALTH ALERT',
    `${items.length} service page(s) require attention:`,
    '',
    ...items.map(item => [
      `• ${item.title ?? item.slug} (/${item.slug})`,
      ...item.issues.map((c: string) => `  - ${ISSUE_LABELS[c] ?? c}`),
    ].join('\n')),
    '',
    'Please log in to the admin panel to restore the affected pages.',
    `Checked at ${new Date().toUTCString()}`,
  ].join('\n');

  return { html, text };
}

// ── Core check function ───────────────────────────────────────────────────────

/**
 * Runs one health check cycle:
 * 1. Queries the database for all SERVICE rows.
 * 2. Computes health issues via the pure `computeServiceHealthIssues` function.
 * 3. Saves a run record to `service_health_runs`.
 * 4. For each unhealthy slug, sends an alert email — unless one was sent within
 *    the last ALERT_COOLDOWN_MS milliseconds (rate-limited per slug).
 *
 * All heavy imports (db, email, health logic) are dynamic so webpack does not
 * attempt to bundle Node.js-only code into the client-fallback bundle.
 */
export async function runServiceHealthCheck(): Promise<void> {
  try {
    // Dynamic imports — keeps postgres, nodemailer, crypto out of the static
    // module graph that webpack analyses for the client-development-fallback.
    const [
      { db },
      { content, serviceHealthRuns, serviceHealthAlerts },
      { eq, inArray },
      { computeServiceHealthIssues, getRegisteredServiceSlugs },
      { sendEmail },
    ] = await Promise.all([
      import('@/db'),
      import('@/db/schema'),
      import('drizzle-orm'),
      import('@/lib/service-page-health'),
      import('@/lib/email'),
    ]);

    // 1. Fetch all SERVICE rows
    const rawRows = await db.select().from(content).where(eq(content.contentType, 'SERVICE'));

    type Row = typeof rawRows[number] & { isActive: boolean };
    const dbRows = (rawRows as Row[]).map(r => ({
      id:       r.id,
      slug:     r.slug,
      title:    r.title,
      status:   r.status,
      isActive: r.isActive,
      body:     r.body ?? null,
    }));

    const registeredSlugs = getRegisteredServiceSlugs();
    const unhealthy       = computeServiceHealthIssues(registeredSlugs, dbRows);

    // 2. Persist this run
    await db.insert(serviceHealthRuns).values({
      unhealthyCount: unhealthy.length,
      result:         unhealthy as unknown as Record<string, unknown>[],
    });

    if (unhealthy.length === 0) {
      console.info('[health-check] All service pages healthy ✓');
      return;
    }

    console.warn('[health-check]', unhealthy.length, 'unhealthy service page(s):', unhealthy.map(i => i.slug));

    // 3. Rate-limit: look up last alert per slug
    const slugs          = unhealthy.map(i => i.slug);
    const existingAlerts = slugs.length > 0
      ? await db.select().from(serviceHealthAlerts).where(inArray(serviceHealthAlerts.slug, slugs))
      : [];

    const lastAlertMap = new Map<string, Date>(
      existingAlerts.map(a => [a.slug, new Date(a.lastAlertAt)]),
    );

    const now     = Date.now();
    const toAlert = unhealthy.filter(item => {
      const last = lastAlertMap.get(item.slug);
      return !last || (now - last.getTime()) >= ALERT_COOLDOWN_MS;
    });

    if (toAlert.length === 0) {
      console.info('[health-check] All unhealthy slugs are within cooldown — no email sent.');
      return;
    }

    // 4. Send alert email — only advance cooldown if delivery is confirmed.
    // getAdminNotifyEmails() checks DB email_settings first, falls back to ADMIN_EMAIL env.
    const { getAdminNotifyEmails } = await import('@/lib/email');
    const adminEmails = await getAdminNotifyEmails();
    if (adminEmails.length === 0) {
      // No recipient configured: log but do NOT record cooldown so the next
      // run will attempt again once email addresses are configured.
      console.warn('[health-check] No admin notification emails configured — skipping email. Cooldown NOT recorded.');
      return;
    }

    const { html, text } = buildAlertEmail(toAlert);
    const delivered = await sendEmail({
      to:      adminEmails.join(', '),
      subject: `⚠️ ${toAlert.length} Service Page${toAlert.length > 1 ? 's' : ''} Offline — Action Required`,
      html,
      text,
    });

    if (!delivered) {
      // Transport error or SMTP not configured: the admin was NOT notified.
      // Do NOT advance cooldown so the next run will retry immediately.
      console.warn('[health-check] Email not delivered — cooldown NOT recorded; will retry next run.');
      return;
    }

    // 5. Upsert alert timestamps ONLY after confirmed delivery.
    for (const item of toAlert) {
      await db
        .insert(serviceHealthAlerts)
        .values({ slug: item.slug, lastAlertAt: new Date(), issues: item.issues })
        .onConflictDoUpdate({
          target: serviceHealthAlerts.slug,
          set:    { lastAlertAt: new Date(), issues: item.issues },
        });
    }
  } catch (err) {
    console.error('[health-check] Error during service health check:', err);
  }
}

// ── Scheduler ────────────────────────────────────────────────────────────────

let _schedulerStarted = false;

/**
 * Starts the background health-check interval. Safe to call multiple times —
 * subsequent calls are no-ops. Intended to be called once from
 * `instrumentation.ts` on server startup.
 */
export function startServiceHealthScheduler(): void {
  if (_schedulerStarted) return;
  _schedulerStarted = true;

  console.info(
    `[health-scheduler] Starting — interval ${CHECK_INTERVAL_MS / 60_000} min, cooldown ${ALERT_COOLDOWN_MS / 3_600_000} h`,
  );

  // Run once shortly after startup, then on the interval
  setTimeout(() => {
    void runServiceHealthCheck();
  }, 30_000); // 30 s after boot — gives DB time to warm up

  setInterval(() => {
    void runServiceHealthCheck();
  }, CHECK_INTERVAL_MS);
}
