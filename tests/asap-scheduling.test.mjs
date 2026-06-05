import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('all_bookings schema includes is_asap', async () => {
  const dbSource = await readFile(new URL('../backend/db.pg.mjs', import.meta.url), 'utf8');
  assert.match(dbSource, /is_asap BOOLEAN DEFAULT FALSE/);
  assert.match(dbSource, /ADD COLUMN IF NOT EXISTS is_asap BOOLEAN DEFAULT FALSE/);
});

test('create-payment-intent persists ASAP flag and inline scheduling clears it', async () => {
  const apiSource = await readFile(new URL('../backend/index.mjs', import.meta.url), 'utf8');
  assert.match(apiSource, /isAsap,\s*\n\s*is_asap/);
  assert.match(apiSource, /isAsapFlag && !serviceDateTime/);
  assert.match(apiSource, /updates\.is_asap = false/);
  assert.match(apiSource, /service_description, service_date, service_datetime, is_asap, service_address/);
});
