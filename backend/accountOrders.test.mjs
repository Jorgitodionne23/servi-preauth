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

test('account order statuses separate requests, booked, and authorized presentation', async () => {
  const accountSource = await readFile(new URL('../frontend/account.html', import.meta.url), 'utf8');

  assert.match(accountSource, /stScheduled: 'Booked'/);
  assert.match(accountSource, /case 'Scheduled':\s+return \{ label: t\.stScheduled,\s+cls: 'is-booked'/);
  assert.match(accountSource, /return \{ label: t\.stRequested,\s+cls: 'is-request'/);
  assert.match(accountSource, /\.order-status\.is-authorized \{ background: rgba\(31, 122, 58, 0\.13\); color: #1f7a3a; \}/);
  assert.match(accountSource, /data-bucket="requests"/);
  assert.match(accountSource, /function orderListBucket\(item\)/);
});
