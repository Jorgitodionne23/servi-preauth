/**
 * The customer app's single API client instance. Per-app (NOT in the
 * check-app-sync guarded set) — the partner app has its own with the
 * provider-scoped refresh route and storage key.
 */
import { createApiClient } from './api';
import { apiBaseUrl } from './config';

type SessionExpiredListener = () => void;
const listeners = new Set<SessionExpiredListener>();

export function onSessionExpired(fn: SessionExpiredListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const api = createApiClient({
  baseUrl: apiBaseUrl(),
  refreshPath: '/api/auth/refresh',
  sessionKey: 'servi.session',
  onSessionExpired: () => listeners.forEach((fn) => fn()),
});
