import { test } from 'node:test';
import assert from 'node:assert/strict';
import { earnings, feeOn, monthName } from './earnings.ts';

test('the fee on a deal is the rate times the price, in whole dollars', () => {
  assert.equal(feeOn(1_600_000, '5.00'), 80_000);
  assert.equal(feeOn(420_333, 5), 21_017);
  assert.equal(feeOn(100_000, '3.50'), 3_500);
});

test('with no closed deal every total is zero', () => {
  const e = earnings([], '2026-11');
  assert.deepEqual(e.month, { fees: 0, deals: 0, value: 0 });
  assert.deepEqual(e.year, { fees: 0, deals: 0, value: 0 });
  assert.deepEqual(e.all, { fees: 0, deals: 0, value: 0 });
  assert.deepEqual(e.byMonth, []);
});

test('a deal counts in its own month, in its own year and in all time', () => {
  const e = earnings([
    { month: '2026-11', price: 1_600_000, fee_pct: '5.00' },
    { month: '2026-11', price: 400_000, fee_pct: '5.00' },
    { month: '2026-03', price: 1_000_000, fee_pct: '4.00' },
    { month: '2025-12', price: 200_000, fee_pct: '5.00' },
    { month: '2025-11', price: 300_000, fee_pct: '5.00' },
  ], '2026-11');
  assert.deepEqual(e.month, { fees: 100_000, deals: 2, value: 2_000_000 });
  assert.deepEqual(e.year, { fees: 140_000, deals: 3, value: 3_000_000 });
  assert.deepEqual(e.all, { fees: 165_000, deals: 5, value: 3_500_000 });
});

test('the same month of another year is not this month', () => {
  const e = earnings([{ month: '2025-11', price: 300_000, fee_pct: 5 }], '2026-11');
  assert.equal(e.month.deals, 0);
  assert.equal(e.year.deals, 0);
  assert.equal(e.all.fees, 15_000);
});

test('months are listed newest first, one line each', () => {
  const e = earnings([
    { month: '2025-12', price: 200_000, fee_pct: 5 },
    { month: '2026-11', price: 400_000, fee_pct: 5 },
    { month: '2026-03', price: 100_000, fee_pct: 5 },
    { month: '2026-11', price: 600_000, fee_pct: 5 },
  ], '2026-11');
  assert.deepEqual(e.byMonth.map(m => m.month), ['2026-11', '2026-03', '2025-12']);
  assert.deepEqual(e.byMonth[0], { month: '2026-11', fees: 50_000, deals: 2, value: 1_000_000 });
});

test('a month is named in words', () => {
  assert.equal(monthName('2026-11'), 'November 2026');
  assert.equal(monthName('2026-01'), 'January 2026');
});
