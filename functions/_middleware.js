/**
 * Cloudflare Pages Middleware
 * Injects environment variables into static files at the edge,
 * replacing placeholder tokens so secrets never live in source control.
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

  // Replace placeholder with the real key from env var
  const firebaseApiKey = env.FIREBASE_API_KEY || '__FIREBASE_API_KEY__';
  body = body.replace(/__FIREBASE_API_KEY__/g, firebaseApiKey);

  return new Response(body, {
    status: response.status,
    headers: {
      ...Object.fromEntries(response.headers),
      'content-type': 'application/javascript; charset=utf-8',
      // Prevent caching of this file so key rotations take effect immediately
      'cache-control': 'no-store',
    },
  });
}
