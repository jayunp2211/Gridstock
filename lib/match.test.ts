import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchListing, type Listing, type Request } from './match.ts';

const req: Request = {
  category: 'switchgear', voltage_v: 480, amps_min: 4000, kaic_min: 65, enclosure: 'NEMA 1',
  acceptable_oems: ['Eaton', 'Schneider'], conditions_ok: ['new_crated', 'delivered_not_energized'],
  quantity: 2, site_state: 'TX', need_by: '2027-03-01', budget_max: 900000,
};
const lst: Listing = {
  category: 'switchgear', oem: 'Eaton', voltage_v: 480, amps: 4000, kaic: 65, enclosure: 'NEMA 1',
  condition: 'new_crated', quantity: 2, location_state: 'TX', available_date: '2027-01-15', asking_price: 800000,
};

test('perfect fit scores 100 with only info notes', () => {
  const r = matchListing(req, lst);
  assert.ok(r.ok);
  assert.equal(r.score, 100);
  assert.ok(r.gaps.every(g => g.severity === 'info'));
});

test('hard mismatches are excluded', () => {
  assert.equal(matchListing(req, { ...lst, voltage_v: 600 }).ok, false);
  assert.equal(matchListing(req, { ...lst, amps: 3000 }).ok, false);
  assert.equal(matchListing(req, { ...lst, category: 'ups' }).ok, false);
  assert.equal(matchListing(req, { ...lst, condition: 'used' }).ok, false);
});

test('soft gaps lower the score and are explained', () => {
  const r = matchListing(req, { ...lst, oem: 'Siemens', kaic: 50, location_state: 'NY' });
  assert.ok(r.ok);
  assert.equal(r.score, 100 - 15 - 30 - 5);
  assert.ok(r.gaps.some(g => g.text.includes('Siemens')));
  assert.ok(r.gaps.some(g => g.text.includes('50 kA')));
});

test('late availability is penalized by weeks late, capped', () => {
  const r = matchListing(req, { ...lst, available_date: '2027-03-15' });
  assert.ok(r.ok);
  assert.equal(r.score, 100 - (15 + 2 * 3));
  const far = matchListing(req, { ...lst, available_date: '2028-03-01' });
  assert.ok(far.ok);
  assert.equal(far.score, 60);
});
