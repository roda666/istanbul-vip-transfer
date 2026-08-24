import { NextRequest, NextResponse } from 'next/server';
import { consumeNewsletterToken } from '@/lib/newsletter';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  const status = await consumeNewsletterToken(req.nextUrl.searchParams.get('token') ?? '', 'CONFIRM');
  return new NextResponse(`<!doctype html><html><body><h1>${status ? 'Bülten aboneliğiniz etkinleştirildi.' : 'Bu doğrulama bağlantısı geçersiz veya süresi dolmuş.'}</h1></body></html>`, {
    status: status ? 200 : 400, headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}