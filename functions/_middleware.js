/**
 * Cloudflare Pages Middleware
 * Injects environment variables into config.js at the edge so secrets and
 * environment-specific values never live in source control.
 *
 * Required Cloudflare Pages environment variables (set in dashboard → Settings → Env vars):
 *   FIREBASE_API_KEY          — Firebase Web API key
 *   STRIPE_PUBLISHABLE_KEY    — Stripe live publishable key (pk_live_...)
 *   API_BASE                  — Backend URL (https://servi-preauth.onrender.com)
 *
 * Local dev: this middleware never runs. config.js falls back to test keys and
 * window.location.origin automatically — no manual .env changes needed.
 */
export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);

  // Only transform config.js
  if (!url.pathname.endsWith('/config.js')) {
    return next();
  }

  const response = await next();
  let body = await response.text();

  // Firebase Web API key (already existed)
  const firebaseApiKey = env.FIREBASE_API_KEY || '__FIREBASE_API_KEY__';
  body = body.replace(/__FIREBASE_API_KEY__/g, firebaseApiKey);

  // Stripe live publishable key — replaces the __STRIPE_PK__ placeholder
  const stripePk = env.STRIPE_PUBLISHABLE_KEY || '__STRIPE_PK__';
  body = body.replace(/__STRIPE_PK__/g, stripePk);

  // Backend API base URL — replaces the __API_BASE__ placeholder
  const apiBase = (env.API_BASE || '').replace(/\/+$/, '') || '__API_BASE__';
  body = body.replace(/__API_BASE__/g, apiBase);

  return new Response(body, {
    status: response.status,
    headers: {
      ...Object.fromEntries(response.headers),
      'content-type': 'application/javascript; charset=utf-8',
      // Prevent caching so key rotations and URL changes take effect immediately
      'cache-control': 'no-store',
    },
  });
}
