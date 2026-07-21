/**
 * The partner app's single API client instance. Per-app (NOT in the
 * check-app-sync guarded set) — the customer app has its own with the
 * customer-scoped refresh route and storage key.
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
  refreshPath: '/api/provider/auth/refresh',
  sessionKey: 'servi.partner.session',
  onSessionExpired: () => listeners.forEach((fn) => fn()),
});
