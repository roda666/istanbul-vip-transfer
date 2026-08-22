/**
 * Canonical recurring draft trigger. The legacy weekly endpoint reuses the
 * exact same handler for backwards-compatible external scheduler calls.
 */
import { NextRequest } from 'next/server';
import { POST as handleCadenceTrigger } from '../weekly-draft/route';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return handleCadenceTrigger(request);
}