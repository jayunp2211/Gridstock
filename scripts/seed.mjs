// Demo data. All companies and people are fictional.
import pg from 'pg';
import { matchListing, MIN_SCORE } from '../lib/match.ts';

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
await c.query('truncate notifications, deal_messages, deals, matches, requests, listings, users cascade');

const users = [
  ['ops@gridstock.test', 'Ops Team', 'Gridstock', 'admin', true],
  ['dana@northfield.test', 'Dana Ruiz', 'Northfield Digital (paused 60 MW campus)', 'seller', true],
  ['sam@keystone-epc.test', 'Sam Okafor', 'Keystone Electrical EPC', 'seller', true],
  ['lee@prairie.test', 'Lee Haddad', 'Prairie Compute', 'seller', false],
  ['alex@vectorcloud.test', 'Alex Chen', 'Vector Cloud (neocloud)', 'buyer', true],
  ['jo@ridgeline.test', 'Jo Patel', 'Ridgeline Colo', 'buyer', true],
  ['max@boltmodular.test', 'Max Romero', 'Bolt Modular DC', 'buyer', false],
];
const id = {};
for (const [email, name, company, role, verified] of users) {
  const r = await c.query('insert into users (email,name,company,role,verified) values ($1,$2,$3,$4,$5) returning id', [email, name, company, role, verified]);
  id[email.split('@')[0]] = r.rows[0].id;
}

const listings = [
  ['dana', 'switchgear', 'Eaton', 'Magnum DS', 480, 4000, 65, 'NEMA 1', 'UL 1558', 'new_crated', 4, 'TX', '2026-12-01', 3200000, 'OEM warranty to 2028-03, transfer requested', 'Four lineups from a paused 60 MW campus. Climate-controlled warehouse in Temple, TX. Submittals and factory test reports on hand.'],
  ['dana', 'switchboard', 'Eaton', 'Pow-R-Line', 480, 3000, 65, 'NEMA 1', 'UL 891', 'new_crated', 6, 'TX', '2026-12-01', 1100000, 'OEM warranty to 2028-03', null],
  ['sam', 'switchgear', 'Schneider', 'Masterclad', 480, 5000, 100, 'NEMA 1', 'UL 1558', 'delivered_not_energized', 2, 'VA', '2027-01-10', 1900000, 'Warranty starts at energization', 'Delivered to a site whose tenant lease fell through. Stored indoors, never energized.'],
  ['sam', 'breaker', 'ABB', 'Emax 2 E4.2', 480, 4000, 66, null, 'UL 1066', 'new_crated', 12, 'VA', '2026-11-25', 420000, null, 'Spare main breakers from a cancelled phase 2.'],
  ['lee', 'switchgear', 'Siemens', 'WL', 480, 4000, 50, 'NEMA 3R', 'UL 1558', 'used', 1, 'IA', '2026-12-15', 240000, 'No warranty', 'Removed from a crypto site conversion, 3 years in service.'],
  ['lee', 'cdu', 'Vertiv', 'XDU1350', 480, 60, null, null, null, 'new_crated', 8, 'IA', '2027-02-01', 640000, 'Full OEM warranty', '1.35 MW liquid-to-liquid CDUs from a cancelled GPU hall.'],
];
const lid = [];
for (const [u, ...v] of listings) {
  const r = await c.query(
    `insert into listings (seller_id, category, oem, model, voltage_v, amps, kaic, enclosure, standard, condition, quantity, location_state, available_date, asking_price, warranty_status, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning *`, [id[u], ...v]);
  lid.push(r.rows[0]);
}

const requests = [
  ['alex', 'switchgear', 480, 4000, 65, 'NEMA 1', ['Eaton', 'Schneider', 'ABB'], ['new_crated', 'delivered_not_energized'], 2, 'TX', '2027-02-15', 1800000, 'Phase 1 of a 40 MW GPU site in Abilene. Utility energization booked for March.'],
  ['jo', 'switchgear', 480, 4000, 65, 'NEMA 1', [], ['new_crated', 'delivered_not_energized', 'used'], 1, 'GA', '2027-01-20', 900000, 'Expansion hall, 12 MW.'],
  ['jo', 'breaker', 480, 4000, 65, null, ['ABB', 'Eaton'], ['new_crated'], 6, 'NC', '2026-12-20', 300000, null],
  ['max', 'cdu', 480, 50, null, null, [], ['new_crated'], 4, 'OH', '2027-03-01', null, 'Modular liquid-cooled pods.'],
];
const rid = [];
for (const [u, ...v] of requests) {
  const r = await c.query(
    `insert into requests (buyer_id, category, voltage_v, amps_min, kaic_min, enclosure, acceptable_oems, conditions_ok, quantity, site_state, need_by, budget_max, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *`, [id[u], ...v]);
  rid.push(r.rows[0]);
}

const iso = d => (d instanceof Date ? d.toISOString().slice(0, 10) : d);
let n = 0;
for (const r of rid) for (const l of lid) {
  if (r.category !== l.category) continue;
  const m = matchListing({ ...r, need_by: iso(r.need_by) }, { ...l, available_date: iso(l.available_date) });
  if (!m.ok || m.score < MIN_SCORE) continue;
  await c.query('insert into matches (request_id, listing_id, score, gaps) values ($1,$2,$3,$4)', [r.id, l.id, m.score, JSON.stringify(m.gaps)]);
  await c.query('insert into notifications (user_id, body, link) values ($1,$2,$3)', [r.buyer_id, `New match (${m.score}/100): ${l.oem} ${l.category}, ${l.voltage_v} V ${l.amps} A`, `/requests/${r.id}`]);
  n++;
}
console.log(`seeded ${users.length} users, ${lid.length} listings, ${rid.length} requests, ${n} matches`);
await c.end();
