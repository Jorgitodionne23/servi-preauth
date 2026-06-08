// Preflight for `npm run test:e2e`. Verifies the Firebase Auth Emulator and the
// local SERVI backend are both reachable before Playwright fires off 22 tests
// that would otherwise all fail with ERR_CONNECTION_REFUSED.
//
// To start the prerequisites:
//   Terminal A:  npm run emulators:auth        (Firebase Auth Emulator on :9099)
//   Terminal B:  npm run start:auth-emulator   (backend on :4242 wired to emulator)
//   Terminal C:  npm run test:e2e              (this preflight + Playwright)

const BACKEND = process.env.AUTH_E2E_BASE_URL || 'http://localhost:4242';
const EMULATOR = process.env.AUTH_EMULATOR_BASE || 'http://127.0.0.1:9099';

async function check(label, url, hint) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    // We don't care about the response — any HTTP response means the port is
    // up. AbortError or fetch TypeError means it's not.
    await fetch(url, { signal: controller.signal });
    console.log(`✅ ${label} reachable at ${url}`);
    return true;
  } catch (err) {
    const reason = err?.name === 'AbortError' ? 'timeout' : (err?.message || String(err));
    console.error(`❌ ${label} NOT reachable at ${url}  (${reason})`);
    console.error(`   ${hint}`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

const ok = (await Promise.all([
  check('Firebase Auth Emulator', `${EMULATOR}/`, 'Run in another terminal: npm run emulators:auth'),
  check('SERVI backend',           BACKEND,        'Run in another terminal: npm run start:auth-emulator'),
])).every(Boolean);

if (!ok) {
  console.error('');
  console.error('Preflight failed — fix the above before running Playwright.');
  process.exit(1);
}

console.log('Preflight OK — handing off to Playwright.\n');
