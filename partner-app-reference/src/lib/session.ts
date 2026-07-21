/**
 * Session-token persistence — shared byte-identical between the customer and
 * partner apps (guarded by `scripts/check-app-sync.mjs`).
 *
 * The stored value is the SERVI 24h HS256 session JWT (issued by
 * `POST /api/auth/firebase` on the customer side, `POST /api/provider/auth/firebase`
 * on the partner side). On device it lives in the Keychain / Keystore via
 * expo-secure-store; on web (preview builds only) it falls back to localStorage,
 * matching what the web app already does with the same token.
 */
import { Platform } from 'react-native';

type SecureStoreModule = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

let secureStore: SecureStoreModule | null = null;
if (Platform.OS !== 'web') {
  // Lazy so web bundles never touch the native module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  secureStore = require('expo-secure-store') as SecureStoreModule;
}

export type SessionStore = {
  get: () => Promise<string | null>;
  set: (token: string) => Promise<void>;
  clear: () => Promise<void>;
};

export function createSessionStore(key: string): SessionStore {
  if (secureStore) {
    const store = secureStore;
    return {
      get: () => store.getItemAsync(key),
      set: (token) => store.setItemAsync(key, token),
      clear: () => store.deleteItemAsync(key),
    };
  }
  // Web fallback (preview/demo surface).
  return {
    get: async () => {
      try {
        return globalThis.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    set: async (token) => {
      try {
        globalThis.localStorage?.setItem(key, token);
      } catch {
        /* private mode — session lives for the tab only */
      }
    },
    clear: async () => {
      try {
        globalThis.localStorage?.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}
