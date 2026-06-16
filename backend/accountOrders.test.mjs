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

test('account-launched payment links return success CTA to My orders', async () => {
  const [accountSource, paySource, bookSource, successSource] = await Promise.all([
    readFile(new URL('../frontend/account.html', import.meta.url), 'utf8'),
    readFile(new URL('../frontend/pay.html', import.meta.url), 'utf8'),
    readFile(new URL('../frontend/book.html', import.meta.url), 'utf8'),
    readFile(new URL('../frontend/success.html', import.meta.url), 'utf8'),
  ]);

  assert.match(accountSource, /['"]&from=account['"]/);
  assert.match(paySource, /qs\.get\('from'\) === 'account'/);
  assert.match(paySource, /fromAccount \? '&from=account' : ''/);
  assert.match(bookSource, /params\.get\('from'\) === 'account'/);
  assert.match(bookSource, /fromAccount \? '&from=account' : ''/);
  assert.match(successSource, /qs\.get\('from'\) === 'account'/);
  assert.match(successSource, /primaryActionEl\.href = '\/account\.html\?section=orders'/);
});
