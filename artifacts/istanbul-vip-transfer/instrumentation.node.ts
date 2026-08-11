/**
 * Node.js-only instrumentation — loaded only when NEXT_RUNTIME === 'nodejs'.
 * Webpack excludes this from the edge/client-fallback bundle because the
 * import is guarded by a runtime check in instrumentation.ts.
 */
import { startServiceHealthScheduler } from '@/lib/service-health-scheduler';

startServiceHealthScheduler();
