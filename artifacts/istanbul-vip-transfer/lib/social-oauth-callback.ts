import { NextResponse } from 'next/server';
import { getPublicOrigin } from '@/lib/social-public-url';

type SocialOAuthCallbackPayload = {
  provider: 'meta' | 'x' | 'google_business';
  success: boolean;
  message?: string;
  error?: string;
};

function serializeForScript(value: unknown) {
  return (JSON.stringify(value) ?? 'null')
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function socialOAuthCallbackResponse(
  req: Request,
  payload: SocialOAuthCallbackPayload,
  fallbackUrl: string,
) {
  const origin = getPublicOrigin(req);
  const isSuccess = payload.success;
  const title = isSuccess ? 'Bağlantı tamamlandı' : 'Bağlantı tamamlanamadı';
  const bodyMessage = isSuccess ? 'Bağlantı tamamlandı. Bu pencere kapanıyor…' : 'Bağlantı tamamlanamadı. Bu pencere kapanıyor…';
  const html = `<!doctype html>
<html lang="tr">
  <head><meta charset="utf-8"><title>${title}</title></head>
  <body>
    <p>${bodyMessage}</p>
    <script>
      (() => {
        const payload = ${serializeForScript(payload)};
        const targetOrigin = ${serializeForScript(origin)};
        const fallbackUrl = ${serializeForScript(fallbackUrl)};
        const hasOpener = Boolean(window.opener && !window.opener.closed);

        if (hasOpener) {
          try {
            window.opener.postMessage(payload, targetOrigin);
          } catch {}
          window.close();
        }

        window.setTimeout(() => {
          if (!hasOpener || !window.closed) window.location.replace(fallbackUrl);
        }, 350);
      })();
    </script>
  </body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}