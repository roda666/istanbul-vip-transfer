import { NextResponse } from 'next/server';

type SocialOAuthCallbackPayload = {
  provider: 'meta' | 'x';
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
  const origin = new URL(req.url).origin;
  const html = `<!doctype html>
<html lang="tr">
  <head><meta charset="utf-8"><title>Bağlantı tamamlandı</title></head>
  <body>
    <p>Bağlantı tamamlandı. Bu pencere kapanıyor…</p>
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