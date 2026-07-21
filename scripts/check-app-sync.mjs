#!/usr/bin/env node
/**
 * check-app-sync — guards the files that MUST stay byte-identical between the
 * two Expo prototypes (native-app-reference = customer, partner-app-reference =
 * specialist). They share a design system and, deliberately, several data
 * modules; drift between them is a silent bug that makes the "one product"
 * claim false. This is the cheap alternative to a shared package / metro
 * watchFolders (see INTEROP.md "Files that must stay byte-identical").
 *
 * Run from either app folder via `npm run check:sync`, or directly:
 *   node scripts/check-app-sync.mjs
 * Exits 0 when every shared file matches, 1 (with a report) on the first drift.
 *
 * Zero dependencies — node:crypto + node:fs only.
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CUSTOMER = resolve(ROOT, 'native-app-reference');
const PARTNER = resolve(ROOT, 'partner-app-reference');

// Files required to be identical in BOTH apps. Some are ported over the course
// of the customer-app uplift; a not-yet-present file on both sides is skipped
// with a warning rather than failing, so the script is usable mid-migration.
const UI = [
  'Badge', 'BottomSheet', 'Button', 'Card', 'Chip', 'Icon', 'InfoCard', 'Input',
  'LangToggle', 'Pressable', 'Rows', 'Screen', 'SegmentedControl', 'ServiLogo',
  'States', 'Text',
].map((n) => `src/components/ui/${n}.tsx`);

const SHARED = [
  'src/theme/tokens.ts',
  'src/theme/typography.ts',
  'src/i18n/I18nContext.tsx',
  'src/data/pricing.ts', // ported during the uplift
  'src/data/time.ts', // ported during the uplift
  // Production networking layer (src/lib/client.ts is deliberately per-app).
  'src/lib/config.ts',
  'src/lib/session.ts',
  'src/lib/api.ts',
  'src/lib/firebasePhone.ts',
  ...UI,
];

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

let drift = 0;
let skipped = 0;
const report = [];

for (const rel of SHARED) {
  const a = resolve(CUSTOMER, rel);
  const b = resolve(PARTNER, rel);
  const hasA = existsSync(a);
  const hasB = existsSync(b);

  if (!hasA && !hasB) {
    skipped++;
    report.push(`  ○ skip   ${rel} (absent in both — not ported yet)`);
    continue;
  }
  if (hasA !== hasB) {
    drift++;
    report.push(`  ✗ ONE-SIDED ${rel} — present in ${hasA ? 'customer' : 'partner'} only`);
    continue;
  }
  const ha = sha(a);
  const hb = sha(b);
  if (ha === hb) {
    report.push(`  ✓ match  ${rel}`);
  } else {
    drift++;
    report.push(
      `  ✗ DRIFT  ${rel}\n      customer ${ha.slice(0, 16)}…\n      partner  ${hb.slice(0, 16)}…`,
    );
  }
}

console.log('check-app-sync — files that must be byte-identical across both prototypes\n');
console.log(report.join('\n'));
console.log('');

if (drift > 0) {
  console.error(
    `✗ ${drift} file(s) drifted. Copy the intended source over the other so they match, then re-run.`,
  );
  process.exit(1);
}
console.log(`✓ all shared files identical${skipped ? ` (${skipped} not yet ported, skipped)` : ''}.`);
process.exit(0);
