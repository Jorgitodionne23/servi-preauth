/**
 * API client — shared byte-identical between the customer and partner apps
 * (guarded by `scripts/check-app-sync.mjs`).
 *
 * A thin typed fetch wrapper over the SERVI backend:
 *   - JSON in/out, `Authorization: Bearer <session JWT>` when signed in
 *   - the backend's error envelope ({ error, message }) surfaces as ApiError
 *   - refresh-on-401: one attempt against the app's refresh route (the backend
 *     accepts tokens up to 24h past expiry), then retry the original call once;
 *     a second 401 clears the session and notifies the app (hard logout)
 *   - request timeout so a dead network fails fast instead of hanging a screen
 *
 * Each app instantiates one client in `src/lib/client.ts` (NOT in the guarded
 * set) with its own refresh path + storage key.
 */
import { createSessionStore, type SessionStore } from './session';

export class ApiError extends Error {
  status: number;
  code: string;
  body: unknown;

  constructor(status: number, code: string, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

/** Network-level failure (offline, DNS, timeout) — distinct from a server 4xx/5xx. */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export type ApiClientOptions = {
  baseUrl: string;
  /** e.g. '/api/auth/refresh' or '/api/provider/auth/refresh' */
  refreshPath: string;
  /** SecureStore / localStorage key for the session JWT. */
  sessionKey: string;
  /** Called after a failed refresh — the app should drop to signed-out. */
  onSessionExpired?: () => void;
  timeoutMs?: number;
};

export type RequestOptions = {
  /** Skip the Authorization header (public routes). */
  anonymous?: boolean;
  /** Raw FormData body (uploads) — skips JSON serialization. */
  formData?: FormData;
  timeoutMs?: number;
};

export type ApiClient = {
  get: <T>(path: string, opts?: RequestOptions) => Promise<T>;
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) => Promise<T>;
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) => Promise<T>;
  del: <T>(path: string, opts?: RequestOptions) => Promise<T>;
  /** Persist a fresh session JWT (after sign-in). */
  setToken: (token: string) => Promise<void>;
  getToken: () => Promise<string | null>;
  clearToken: () => Promise<void>;
  store: SessionStore;
};

const DEFAULT_TIMEOUT_MS = 20_000;

export function createApiClient(options: ApiClientOptions): ApiClient {
  const store = createSessionStore(options.sessionKey);
  let cachedToken: string | null | undefined; // undefined = not loaded yet
  let refreshing: Promise<string | null> | null = null;

  async function getToken(): Promise<string | null> {
    if (cachedToken === undefined) cachedToken = await store.get();
    return cachedToken;
  }

  async function setToken(token: string): Promise<void> {
    cachedToken = token;
    await store.set(token);
  }

  async function clearToken(): Promise<void> {
    cachedToken = null;
    await store.clear();
  }

  async function rawFetch(
    path: string,
    method: string,
    body: unknown,
    token: string | null,
    opts: RequestOptions,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      opts.timeoutMs ?? options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (token && !opts.anonymous) headers.Authorization = `Bearer ${token}`;
      let payload: BodyInit | undefined;
      if (opts.formData) {
        payload = opts.formData;
      } else if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
      }
      return await fetch(`${options.baseUrl}${path}`, {
        method,
        headers,
        body: payload,
        signal: controller.signal,
      });
    } catch (err) {
      throw new NetworkError(err instanceof Error ? err.message : 'network_error');
    } finally {
      clearTimeout(timer);
    }
  }

  /** One refresh at a time; concurrent 401s share the same attempt. */
  function refreshToken(staleToken: string): Promise<string | null> {
    if (!refreshing) {
      refreshing = (async () => {
        try {
          const res = await rawFetch(options.refreshPath, 'POST', {}, staleToken, {});
          if (!res.ok) return null;
          const data = (await res.json()) as { token?: string };
          if (!data.token) return null;
          await setToken(data.token);
          return data.token;
        } catch {
          return null;
        } finally {
          refreshing = null;
        }
      })();
    }
    return refreshing;
  }

  async function parseError(res: Response): Promise<ApiError> {
    let body: unknown = null;
    let code = `http_${res.status}`;
    let message = res.statusText || `Request failed (${res.status})`;
    try {
      body = await res.json();
      const b = body as { error?: string; message?: string };
      if (b.error) code = b.error;
      if (b.message) message = b.message;
    } catch {
      /* non-JSON error body */
    }
    return new ApiError(res.status, code, message, body);
  }

  async function request<T>(
    method: string,
    path: string,
    body: unknown,
    opts: RequestOptions = {},
  ): Promise<T> {
    const token = opts.anonymous ? null : await getToken();
    let res = await rawFetch(path, method, body, token, opts);

    if (res.status === 401 && token && !opts.anonymous && path !== options.refreshPath) {
      const fresh = await refreshToken(token);
      if (fresh) {
        res = await rawFetch(path, method, body, fresh, opts);
      } else {
        await clearToken();
        options.onSessionExpired?.();
      }
    }

    if (!res.ok) throw await parseError(res);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  return {
    get: (path, opts) => request('GET', path, undefined, opts),
    post: (path, body, opts) => request('POST', path, body ?? {}, opts),
    patch: (path, body, opts) => request('PATCH', path, body ?? {}, opts),
    del: (path, opts) => request('DELETE', path, undefined, opts),
    setToken,
    getToken,
    clearToken,
    store,
  };
}
