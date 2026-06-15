import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

test('account payable order statuses include New on both client and server', async () => {
  const [apiSource, accountSource] = await Promise.all([
    readFile(new URL('./index.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../frontend/account.html', import.meta.url), 'utf8'),
  ]);

  assert.match(apiSource, /PAYABLE_ONLINE_STATUSES = new Set\(\[[^\]]*'new'[^\]]*\]\)/);
  assert.match(accountSource, /PAYABLE_ORDER_STATUSES = new Set\(\[[^\]]*'New'[^\]]*\]\)/);
});
