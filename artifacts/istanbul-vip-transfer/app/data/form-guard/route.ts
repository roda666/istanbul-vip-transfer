import { NextRequest, NextResponse } from 'next/server';
import { createFormGuardToken, FormGuardForm } from '@/lib/form-guard';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  const form = req.nextUrl.searchParams.get('form');
  if (form !== 'reservation' && form !== 'contact') {
    return NextResponse.json({ error: 'Invalid form' }, { status: 400 });
  }

  try {
    const token = createFormGuardToken(form as FormGuardForm);
    return NextResponse.json(
      { token },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch {
    return NextResponse.json({ error: 'Temporarily unavailable' }, { status: 503 });
  }
}