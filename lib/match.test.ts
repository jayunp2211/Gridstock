import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchListing, voltageClass, type Listing, type Request } from './match.ts';

const req: Request = {
  category: 'switchgear', voltage_v: 480, amps_min: 4000, kaic_min: 65, enclosure: 'NEMA 1',
  acceptable_oems: ['Eaton', 'Schneider'], conditions_ok: ['new_crated', 'delivered_not_energized'],
  quantity: 2, site_state: 'TX', need_by: '2027-03-01',
};
const lst: Listing = {
  category: 'switchgear', oem: 'Eaton', voltage_v: 480, amps: 4000, kaic: 65, enclosure: 'NEMA 1',
  condition: 'new_crated', quantity: 2, location_state: 'TX', available_date: '2027-01-15',
};

test('perfect fit scores 100 with only info notes', () => {
  const r = matchListing(req, lst);
  assert.ok(r.ok);
  assert.equal(r.score, 100);
  assert.ok(r.gaps.every(g => g.severity === 'info'));
});

test('hard mismatches are excluded', () => {
  assert.equal(matchListing(req, { ...lst, voltage_v: 240 }).ok, false);
  assert.equal(matchListing(req, { ...lst, voltage_v: 4160 }).ok, false);
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

test('price never reaches the matcher, so a fit cannot leak it', () => {
  // A buyer could otherwise post requests at different budgets and read the asking price off the gaps.
  const withPrices = matchListing({ ...req, budget_max: 1 } as Request, { ...lst, asking_price: 9_000_000 } as Listing);
  assert.ok(withPrices.ok);
  assert.equal(withPrices.score, 100);
  assert.ok(withPrices.gaps.every(g => !/price|budget/i.test(g.text)));
});

test('voltage is matched by class, not by the exact number typed', () => {
  assert.equal(voltageClass(480), 'low voltage');
  assert.equal(voltageClass(13_800), '15 kV class');
  assert.equal(voltageClass(34_500), '38 kV class');

  // A 15 kV class lineup is what a 13.8 kV system needs: a match, with a note to confirm the nameplate.
  const mv = matchListing({ ...req, voltage_v: 13_800 }, { ...lst, voltage_v: 15_000 });
  assert.ok(mv.ok);
  assert.equal(mv.score, 100);
  assert.ok(mv.gaps.some(g => g.text.includes('15 kV class')));
  assert.equal(matchListing({ ...req, voltage_v: 13_800 }, { ...lst, voltage_v: 27_000 }).ok, false);

  // 600 V gear can serve a 480 V system, with checks. 480 V gear cannot serve a 600 V system.
  const lv = matchListing(req, { ...lst, voltage_v: 600 });
  assert.ok(lv.ok);
  assert.equal(lv.score, 90);
  assert.equal(matchListing({ ...req, voltage_v: 600 }, lst).ok, false);

  // A 460 V nameplate is the utilization voltage of a 480 V system: no gap at all.
  const util = matchListing(req, { ...lst, voltage_v: 460 });
  assert.ok(util.ok);
  assert.equal(util.score, 100);
});

test('maker names are compared by family, and enclosure spelling is forgiven', () => {
  const r = matchListing({ ...req, acceptable_oems: ['Square D'], enclosure: 'NEMA1' }, { ...lst, oem: 'Schneider Electric' });
  assert.ok(r.ok);
  assert.equal(r.score, 100);
});

test('a transformer is matched on kVA and on both voltages, and reaches a neighbouring primary only through its taps', () => {
  const need: Request = {
    category: 'transformer', voltage_v: 13_200, secondary_v: 480, capacity_min: 2500, amps_min: null, kaic_min: null, enclosure: null,
    acceptable_oems: [], conditions_ok: ['new_crated'], quantity: 2, site_state: 'NC', need_by: '2027-03-01',
  };
  const unit: Listing = {
    category: 'transformer', oem: 'Eaton', voltage_v: 13_800, secondary_v: 480, capacity: 2500, amps: null, kaic: null, enclosure: null,
    condition: 'new_crated', quantity: 3, location_state: 'VA', available_date: '2027-01-15',
  };
  // 13.8 kV on a 13.2 kV system is 4.3% apart: inside the taps, flagged for a check.
  const near = matchListing(need, unit);
  assert.ok(near.ok);
  assert.equal(near.score, 90);
  assert.ok(near.gaps.some(g => g.severity === 'warn' && g.text.includes('tap')));
  const exact = matchListing({ ...need, voltage_v: 13_800 }, unit);
  assert.ok(exact.ok);
  assert.equal(exact.score, 100);

  // 12.47 kV is in the same 15 kV class, which is enough for switchgear and not for a transformer.
  assert.equal(matchListing({ ...need, voltage_v: 12_470 }, unit).ok, false);
  // The secondary has to be the right one, and so does the size.
  assert.equal(matchListing({ ...need, secondary_v: 208 }, unit).ok, false);
  assert.equal(matchListing(need, { ...unit, capacity: 2000 }).ok, false);

  const vague = matchListing(need, { ...unit, voltage_v: 13_200, secondary_v: null, capacity: null });
  assert.ok(vague.ok);
  assert.equal(vague.score, 80);
  const big = matchListing(need, { ...unit, voltage_v: 13_200, capacity: 5000 });
  assert.ok(big.ok);
  assert.equal(big.score, 95);
  assert.ok(big.gaps.some(g => g.text.includes('5,000 kVA')));
});

test('cooling and UPS are sized by capacity and need their own supply voltage', () => {
  const need: Request = {
    category: 'cdu', voltage_v: 480, capacity_min: 1000, amps_min: null, kaic_min: null, enclosure: null,
    acceptable_oems: [], conditions_ok: ['new_crated'], quantity: 4, site_state: 'OH', need_by: '2027-03-01',
  };
  const unit: Listing = {
    category: 'cdu', oem: 'Vertiv', voltage_v: 480, capacity: 1350, amps: null, kaic: null, enclosure: null,
    condition: 'new_crated', quantity: 8, location_state: 'OH', available_date: '2027-01-15',
  };
  const r = matchListing(need, unit);
  assert.ok(r.ok);
  assert.equal(r.score, 100);
  assert.equal(matchListing(need, { ...unit, capacity: 800 }).ok, false);
  // 600 V switchgear can serve a 480 V system. A 600 V pump skid cannot.
  assert.equal(matchListing(need, { ...unit, voltage_v: 600 }).ok, false);
  const util = matchListing(need, { ...unit, voltage_v: 460 });
  assert.ok(util.ok);
  assert.equal(util.score, 100);
  // Interrupting rating is not a property of this equipment, so asking for one changes nothing.
  const withKaic = matchListing({ ...need, kaic_min: 65 }, unit);
  assert.ok(withKaic.ok);
  assert.equal(withKaic.score, 100);
});

test('rows saved before capacity was recorded still match on what they have', () => {
  // The old form asked every category for amps. Such a request has no capacity to compare.
  const oldNeed: Request = {
    category: 'cdu', voltage_v: 480, amps_min: 50, kaic_min: null, enclosure: null,
    acceptable_oems: [], conditions_ok: ['new_crated'], quantity: 4, site_state: 'OH', need_by: '2027-03-01',
  };
  const oldUnit: Listing = {
    category: 'cdu', oem: 'Vertiv', voltage_v: 480, amps: 60, kaic: null, enclosure: null,
    condition: 'new_crated', quantity: 8, location_state: 'IA', available_date: '2027-01-15',
  };
  const r = matchListing(oldNeed, oldUnit);
  assert.ok(r.ok);
  assert.equal(r.score, 100);
  // A new listing, with a capacity and no current, still answers an old request.
  assert.equal(matchListing(oldNeed, { ...oldUnit, amps: null, capacity: 1350 }).ok, true);
});
