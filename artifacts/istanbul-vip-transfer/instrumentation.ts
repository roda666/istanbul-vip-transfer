/**
 * Next.js Instrumentation Hook
 *
 * Node.js-specific startup code lives in instrumentation.node.ts so that
 * webpack can exclude server packages (postgres, nodemailer) from the
 * edge / client-fallback bundles.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation.node');
  }
}
