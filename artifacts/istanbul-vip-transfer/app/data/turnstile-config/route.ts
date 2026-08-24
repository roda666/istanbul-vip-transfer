import { NextRequest, NextResponse } from 'next/server';
import { getPublicTurnstileConfig } from '@/lib/turnstile';
import type { FormGuardForm } from '@/lib/form-guard';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const form = request.nextUrl.searchParams.get('form');
  if (form !== 'contact' && form !== 'reservation') {
    return NextResponse.json({ error: 'Invalid form' }, { status: 400 });
  }
  const config = await getPublicTurnstileConfig(form as FormGuardForm);
  return NextResponse.json(config, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}