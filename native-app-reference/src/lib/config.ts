/**
 * Runtime configuration — shared byte-identical between the customer and
 * partner apps (guarded by `scripts/check-app-sync.mjs`).
 *
 * API base URL resolution order:
 *   1. EXPO_PUBLIC_API_URL   — set per eas.json build profile (dev/preview/prod)
 *   2. expo.extra.apiUrl     — app.json escape hatch
 *   3. production default    — the live Render backend
 *
 * The web app's equivalent is `frontend/config.js` (window.CONFIG.API_BASE).
 */
import Constants from 'expo-constants';

const PROD_API_URL = 'https://servi-preauth.onrender.com';

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export function apiBaseUrl(): string {
  const env = process.env.EXPO_PUBLIC_API_URL;
  if (env) return stripTrailingSlash(env);
  const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };
  if (extra.apiUrl) return stripTrailingSlash(extra.apiUrl);
  return PROD_API_URL;
}

/** Web origin for pages we hand off to the browser (payment links, terms…). */
export function webBaseUrl(): string {
  const env = process.env.EXPO_PUBLIC_WEB_URL;
  if (env) return stripTrailingSlash(env);
  const extra = (Constants.expoConfig?.extra ?? {}) as { webUrl?: string };
  if (extra.webUrl) return stripTrailingSlash(extra.webUrl);
  return 'https://servi-preauth.pages.dev';
}
