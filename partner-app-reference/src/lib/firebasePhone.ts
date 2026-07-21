/**
 * Firebase phone authentication — shared byte-identical between the customer
 * and partner apps (guarded by `scripts/check-app-sync.mjs`).
 *
 * Wraps @react-native-firebase/auth behind a lazy require so the app still
 * boots in environments where the native module is absent (Expo Go, web
 * preview). There the functions throw `firebase_unavailable`, which the auth
 * screens surface as "sign-in requires the installed app".
 *
 * Flow (identical to the web app's, minus reCAPTCHA — native builds verify via
 * silent APNs / Play Integrity):
 *   sendPhoneCode(+52…) → PhoneConfirmation → confirmCode(code) → Firebase ID
 *   token → the app posts it to its session-issuance route
 *   (`/api/auth/firebase` or `/api/provider/auth/firebase`).
 */

export type PhoneConfirmation = {
  confirm: (code: string) => Promise<{ idToken: string; uid: string }>;
};

let cachedModule: any | undefined;

function loadAuthModule(): any | null {
  if (cachedModule !== undefined) return cachedModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedModule = require('@react-native-firebase/auth');
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

export function isFirebaseAuthAvailable(): boolean {
  return loadAuthModule() !== null;
}

function requireAuth(): { mod: any; auth: any } {
  const mod = loadAuthModule();
  if (!mod) {
    const err = new Error('firebase_unavailable');
    err.name = 'FirebaseUnavailableError';
    throw err;
  }
  const auth = mod.getAuth ? mod.getAuth() : mod.default();
  return { mod, auth };
}

/** Send the OTP SMS. `phoneE164` must be +52… normalized. */
export async function sendPhoneCode(phoneE164: string): Promise<PhoneConfirmation> {
  const { mod, auth } = requireAuth();
  const confirmation = mod.signInWithPhoneNumber
    ? await mod.signInWithPhoneNumber(auth, phoneE164)
    : await auth.signInWithPhoneNumber(phoneE164);
  return {
    confirm: async (code: string) => {
      const credential = await confirmation.confirm(code);
      const user = credential?.user ?? auth.currentUser;
      if (!user) throw new Error('confirmation_failed');
      const idToken = await user.getIdToken();
      return { idToken, uid: user.uid };
    },
  };
}

/** Fresh ID token for the currently signed-in Firebase user (re-auth flows). */
export async function currentIdToken(forceRefresh = false): Promise<string | null> {
  const { auth } = requireAuth();
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

export async function firebaseSignOut(): Promise<void> {
  const mod = loadAuthModule();
  if (!mod) return;
  const auth = mod.getAuth ? mod.getAuth() : mod.default();
  if (mod.signOut) await mod.signOut(auth);
  else await auth.signOut();
}
