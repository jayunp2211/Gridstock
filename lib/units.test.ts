import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dealUnits, filled, listingStatus, requestStatus, settleUnits, sold, taken, type Run } from './units.ts';

test('a deal covers the units it names', () => {
  assert.equal(dealUnits({ quantity: 2, need_qty: 4, have_qty: 6 }), 2);
});

test('a deal opened before units were recorded covers what the buyer needs, up to what was listed', () => {
  assert.equal(dealUnits({ quantity: null, need_qty: 2, have_qty: 4 }), 2);
  assert.equal(dealUnits({ quantity: null, need_qty: 6, have_qty: 4 }), 4);
});

test('a listing stays active while any unit is open', () => {
  assert.equal(listingStatus('active', 2, true), 'active');
  assert.equal(listingStatus('under_offer', 1, false), 'active');
  assert.equal(listingStatus('sold', 1, false), 'active');
});

test('a listing with no open unit is under offer while a deal completes, and sold after', () => {
  assert.equal(listingStatus('active', 0, true), 'under_offer');
  assert.equal(listingStatus('under_offer', 0, false), 'sold');
  assert.equal(listingStatus('active', -1, false), 'sold');
});

test('a withdrawn listing stays withdrawn whatever its deals do', () => {
  assert.equal(listingStatus('withdrawn', 4, false), 'withdrawn');
  assert.equal(listingStatus('withdrawn', 0, true), 'withdrawn');
});

test('a request stays open while part of the need is uncovered, unless the buyer closed it', () => {
  assert.equal(requestStatus('open', 1, true), 'open');
  assert.equal(requestStatus('in_deal', 1, false), 'open');
  assert.equal(requestStatus('closed', 1, false), 'closed');
});

test('a request that deals cover in full is in a deal until they close', () => {
  assert.equal(requestStatus('open', 0, true), 'in_deal');
  assert.equal(requestStatus('in_deal', 0, false), 'closed');
});

test('units are counted from accepted deals only, on the row asked for', () => {
  for (const sql of [taken('x'), filled('y'), sold('z')]) assert.match(sql, /^\(select coalesce\(sum\(/);
  assert.match(taken('x'), /m_\.listing_id = x\.id and d_\.stage in \('inspection','escrow','closed'\)/);
  assert.match(filled('y'), /m_\.request_id = y\.id and d_\.stage in \('inspection','escrow','closed'\)/);
  assert.match(sold('z'), /m_\.listing_id = z\.id and d_\.stage = 'closed'/);
});

/** A stand-in for the database: answers the two status questions and records what is written. */
function fake(listing: Record<string, unknown> | null, request: Record<string, unknown> | null) {
  const writes: [string, unknown[]][] = [];
  const run: Run = async (text, params = []) => {
    if (text.startsWith('update')) {
      writes.push([text.includes('listings') ? 'listing' : 'request', params]);
      return [];
    }
    const row = text.includes('from listings l') ? listing : request;
    return row ? [row] : [];
  };
  return { run, writes };
}

test('settling moves a listing and a request to the status their deals call for', async () => {
  const { run, writes } = fake({ status: 'active', open: 0, pending: true }, { status: 'open', open: 0, pending: true });
  await settleUnits(run, 'L', 'R');
  assert.deepEqual(writes, [['listing', ['L', 'under_offer']], ['request', ['R', 'in_deal']]]);
});

test('settling writes nothing when the status is already right', async () => {
  const { run, writes } = fake({ status: 'active', open: 3, pending: true }, { status: 'open', open: 1, pending: true });
  await settleUnits(run, 'L', 'R');
  assert.deepEqual(writes, []);
});

test('settling frees a listing and a request when a deal falls through', async () => {
  const { run, writes } = fake({ status: 'under_offer', open: 2, pending: false }, { status: 'in_deal', open: 2, pending: false });
  await settleUnits(run, 'L', 'R');
  assert.deepEqual(writes, [['listing', ['L', 'active']], ['request', ['R', 'open']]]);
});

test('settling skips a side that is not given or no longer exists', async () => {
  const { run, writes } = fake(null, { status: 'open', open: 0, pending: false });
  await settleUnits(run, 'L', null);
  assert.deepEqual(writes, []);
});
