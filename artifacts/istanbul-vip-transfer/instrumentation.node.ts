/**
 * Node.js-only instrumentation — loaded only when NEXT_RUNTIME === 'nodejs'.
 * Webpack excludes this from the edge/client-fallback bundle because the
 * import is guarded by a runtime check in instrumentation.ts.
 */
import { startServiceHealthScheduler } from '@/lib/service-health-scheduler';
import { startPasswordResetTokenCleanup } from '@/lib/auth/password-reset-token-cleanup';
import { startGoogleBusinessReviewScheduler } from '@/lib/google-business-review-scheduler';
import { startBlogHealthScheduler } from '@/lib/blog-health-scheduler';

startServiceHealthScheduler();
startPasswordResetTokenCleanup();
startGoogleBusinessReviewScheduler();
startBlogHealthScheduler();
