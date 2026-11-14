// Sample accounts and gear for the demo. Every company and person here is fictional, and every
// address ends in .test (a reserved domain), which is how the rest of the app tells sample
// accounts from real ones. Dates are set relative to today so the demo never looks stale.
import { ratings } from './labels.ts';
import { matchListing, MIN_SCORE } from './match.ts';

export type Run = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

const USERS: [email: string, name: string, company: string, role: string, verified: boolean][] = [
  ['ops@gridstock.test', 'Ops Team', 'Gridstock', 'admin', true],
  ['dana@northfield.test', 'Dana Ruiz', 'Northfield Digital (paused 60 MW campus)', 'seller', true],
  ['sam@keystone-epc.test', 'Sam Okafor', 'Keystone Electrical EPC', 'seller', true],
  ['lee@prairie.test', 'Lee Haddad', 'Prairie Compute', 'seller', false],
  ['alex@vectorcloud.test', 'Alex Chen', 'Vector Cloud (neocloud)', 'buyer', true],
  ['jo@ridgeline.test', 'Jo Patel', 'Ridgeline Colo', 'buyer', true],
  ['max@boltmodular.test', 'Max Romero', 'Bolt Modular DC', 'buyer', false],
];

const inDays = (n: number, from: Date) => new Date(from.getTime() + n * 86_400_000).toISOString().slice(0, 10);

type SampleListing = {
  seller: string; category: string; oem: string; model: string; voltage_v: number; secondary_v: number | null;
  amps: number | null; capacity: number | null; kaic: number | null; enclosure: string | null; standard: string | null;
  configuration: string | null; condition: string; quantity: number; location_state: string; available_date: string;
  asking_price: number; warranty_status: string | null; notes: string | null;
};
type SampleRequest = {
  buyer: string; category: string; voltage_v: number; secondary_v: number | null; amps_min: number | null; capacity_min: number | null;
  kaic_min: number | null; enclosure: string | null; acceptable_oems: string[]; conditions_ok: string[]; quantity: number;
  site_state: string; need_by: string; budget_max: number | null; notes: string | null;
};
// Every rating a row does not carry is null, so each sample only spells out what its kind of equipment has.
const BLANK_LISTING = { secondary_v: null, amps: null, capacity: null, kaic: null, enclosure: null, standard: null, configuration: null, warranty_status: null, notes: null };
const BLANK_REQUEST = { secondary_v: null, amps_min: null, capacity_min: null, kaic_min: null, enclosure: null, acceptable_oems: [], budget_max: null, notes: null };

/** Asking prices are for the whole quantity listed. */
export function sampleListings(today = new Date()): SampleListing[] {
  const d = (n: number) => inDays(n, today);
  return [
    { ...BLANK_LISTING, seller: 'dana', category: 'switchgear', oem: 'Eaton', model: 'Magnum DS', voltage_v: 480, amps: 4000, kaic: 65, enclosure: 'NEMA 1', standard: 'UL 1558',
      configuration: 'Per lineup: 4,000 A main, 4,000 A tie, eight feeders from 800 to 1,600 A. Drawout breakers with electronic trip units.',
      condition: 'new_crated', quantity: 4, location_state: 'TX', available_date: d(14), asking_price: 3_200_000,
      warranty_status: 'OEM warranty, transfer to a new owner requested',
      notes: 'Four lineups from a paused 60 MW campus. Climate-controlled warehouse in Temple, TX. Submittals and factory test reports on hand.' },
    { ...BLANK_LISTING, seller: 'dana', category: 'switchboard', oem: 'Eaton', model: 'Pow-R-Line', voltage_v: 480, amps: 3000, kaic: 65, enclosure: 'NEMA 1', standard: 'UL 891',
      configuration: 'Per board: 3,000 A main, twelve molded-case feeders from 250 to 800 A.',
      condition: 'new_crated', quantity: 6, location_state: 'TX', available_date: d(14), asking_price: 1_100_000,
      warranty_status: 'OEM warranty, transfer to a new owner requested' },
    { ...BLANK_LISTING, seller: 'sam', category: 'switchgear', oem: 'Schneider Electric', model: 'Power-Zone 4', voltage_v: 480, amps: 5000, kaic: 100, enclosure: 'NEMA 1', standard: 'UL 1558',
      configuration: 'Per lineup: 5,000 A main, 5,000 A tie, six 2,000 A feeders. Drawout breakers.',
      condition: 'delivered_not_energized', quantity: 2, location_state: 'VA', available_date: d(55), asking_price: 1_900_000,
      warranty_status: 'Warranty starts at energization',
      notes: 'Delivered to a site whose tenant lease fell through. Stored indoors, never energized.' },
    { ...BLANK_LISTING, seller: 'sam', category: 'breaker', oem: 'ABB', model: 'Emax 2 E4.2', voltage_v: 480, amps: 4000, kaic: 85, standard: 'UL 1066',
      configuration: 'Drawout, electronic trip units, cradles included.',
      condition: 'new_crated', quantity: 12, location_state: 'VA', available_date: d(7), asking_price: 420_000,
      notes: 'Spare main breakers from a cancelled phase 2.' },
    { ...BLANK_LISTING, seller: 'sam', category: 'transformer', oem: 'Eaton', model: 'Cooper Power pad-mount', voltage_v: 13_800, secondary_v: 480, capacity: 2500, standard: 'IEEE C57.12.34',
      configuration: 'Delta primary, 480Y/277 V secondary, 5.75% impedance, taps at 2.5% steps, loop feed, less-flammable fluid.',
      condition: 'new_crated', quantity: 3, location_state: 'VA', available_date: d(21), asking_price: 450_000,
      warranty_status: 'OEM warranty, 18 months from shipment',
      notes: 'Ordered for a second phase that was cancelled. On pallets under cover. Factory test reports on hand.' },
    { ...BLANK_LISTING, seller: 'lee', category: 'switchgear', oem: 'Siemens', model: 'WL', voltage_v: 480, amps: 3200, kaic: 50, enclosure: 'NEMA 3R', standard: 'UL 1558',
      configuration: 'One lineup: 3,200 A main and five feeders from 800 to 1,600 A.',
      condition: 'used', quantity: 1, location_state: 'IA', available_date: d(30), asking_price: 240_000,
      warranty_status: 'No warranty', notes: 'Removed from a crypto site conversion, 3 years in service.' },
    { ...BLANK_LISTING, seller: 'lee', category: 'cdu', oem: 'Vertiv', model: 'Liebert XDU1350', voltage_v: 480, capacity: 1350,
      configuration: 'Liquid to liquid, redundant pumps.',
      condition: 'new_crated', quantity: 8, location_state: 'IA', available_date: d(75), asking_price: 640_000,
      warranty_status: 'OEM warranty, 24 months from shipment', notes: 'From a cancelled GPU hall.' },
  ];
}

/** Budgets are for the whole quantity needed. */
export function sampleRequests(today = new Date()): SampleRequest[] {
  const d = (n: number) => inDays(n, today);
  return [
    { ...BLANK_REQUEST, buyer: 'alex', category: 'switchgear', voltage_v: 480, amps_min: 4000, kaic_min: 65, enclosure: 'NEMA 1', acceptable_oems: ['Eaton', 'Schneider Electric', 'ABB'],
      conditions_ok: ['new_crated', 'delivered_not_energized'], quantity: 2, site_state: 'TX', need_by: d(90), budget_max: 1_800_000,
      notes: 'Phase 1 of a 40 MW GPU site in Abilene. Utility energization is booked.' },
    { ...BLANK_REQUEST, buyer: 'jo', category: 'switchgear', voltage_v: 480, amps_min: 3000, kaic_min: 65, enclosure: 'NEMA 1',
      conditions_ok: ['new_crated', 'delivered_not_energized', 'used'], quantity: 1, site_state: 'GA', need_by: d(50), budget_max: 900_000,
      notes: 'Expansion hall, 12 MW.' },
    { ...BLANK_REQUEST, buyer: 'jo', category: 'breaker', voltage_v: 480, amps_min: 4000, kaic_min: 65, acceptable_oems: ['ABB', 'Eaton'],
      conditions_ok: ['new_crated'], quantity: 6, site_state: 'NC', need_by: d(35), budget_max: 300_000 },
    // The utility delivers at 13.2 kV and the sample transformers are wound for 13.8 kV: close enough to reach on the taps.
    { ...BLANK_REQUEST, buyer: 'jo', category: 'transformer', voltage_v: 13_200, secondary_v: 480, capacity_min: 2500,
      conditions_ok: ['new_crated', 'delivered_not_energized'], quantity: 2, site_state: 'NC', need_by: d(70), budget_max: 320_000,
      notes: 'Two units for a 5 MW hall. The utility delivers at 13.2 kV.' },
    { ...BLANK_REQUEST, buyer: 'max', category: 'cdu', voltage_v: 480, capacity_min: 1000,
      conditions_ok: ['new_crated'], quantity: 4, site_state: 'OH', need_by: d(105), notes: 'Modular liquid-cooled pods.' },
  ];
}

const SAMPLE = `(select id from users where email like '%.test')`;

/**
 * Put the sample data back to its starting state. Only rows owned by sample accounts are
 * touched, and the accounts keep their ids, so nobody who is signed in to the demo is signed out.
 * Run it inside a transaction.
 */
export async function seedDemo(run: Run) {
  const id: Record<string, string> = {};
  for (const [email, name, company, role, verified] of USERS) {
    const [u] = await run(
      `insert into users (email, name, company, role, verified) values ($1,$2,$3,$4,$5)
       on conflict (email) do update set name = excluded.name, company = excluded.company, role = excluded.role, verified = excluded.verified
       returning id`, [email, name, company, role, verified]);
    id[email.split('@')[0]] = String(u.id);
  }

  await run(`delete from notifications where user_id in ${SAMPLE}`);
  // Deal messages go with their deals.
  await run(`delete from deals where match_id in (select m.id from matches m join listings l on l.id = m.listing_id join requests r on r.id = m.request_id
               where l.seller_id in ${SAMPLE} or r.buyer_id in ${SAMPLE})`);
  await run(`delete from matches where listing_id in (select id from listings where seller_id in ${SAMPLE})
               or request_id in (select id from requests where buyer_id in ${SAMPLE})`);
  await run(`delete from listings where seller_id in ${SAMPLE}`);
  await run(`delete from requests where buyer_id in ${SAMPLE}`);

  const listings = [];
  for (const { seller, ...l } of sampleListings()) {
    const [row] = await run(
      `insert into listings (seller_id, category, oem, model, voltage_v, secondary_v, amps, capacity, kaic, enclosure, standard, configuration,
         condition, quantity, location_state, available_date, asking_price, warranty_status, notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) returning id`,
      [id[seller], l.category, l.oem, l.model, l.voltage_v, l.secondary_v, l.amps, l.capacity, l.kaic, l.enclosure, l.standard, l.configuration,
       l.condition, l.quantity, l.location_state, l.available_date, l.asking_price, l.warranty_status, l.notes]);
    listings.push({ ...l, id: String(row.id), seller_id: id[seller] });
  }
  const requests = [];
  for (const { buyer, ...r } of sampleRequests()) {
    const [row] = await run(
      `insert into requests (buyer_id, category, voltage_v, secondary_v, amps_min, capacity_min, kaic_min, enclosure, acceptable_oems, conditions_ok,
         quantity, site_state, need_by, budget_max, notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning id`,
      [id[buyer], r.category, r.voltage_v, r.secondary_v, r.amps_min, r.capacity_min, r.kaic_min, r.enclosure, r.acceptable_oems, r.conditions_ok,
       r.quantity, r.site_state, r.need_by, r.budget_max, r.notes]);
    requests.push({ ...r, id: String(row.id), buyer_id: id[buyer] });
  }

  let matches = 0;
  for (const r of requests) for (const l of listings) {
    const m = matchListing(r, l);
    if (!m.ok || m.score < MIN_SCORE) continue;
    await run(`insert into matches (request_id, listing_id, score, gaps) values ($1,$2,$3,$4)`, [r.id, l.id, m.score, JSON.stringify(m.gaps)]);
    await run(`insert into notifications (user_id, body, link) values ($1,$2,$3), ($4,$5,$6)`, [
      r.buyer_id, `New match (${m.score}/100): ${l.oem} ${l.model}, ${ratings(l).slice(0, 2).join(', ')}`, `/requests/${r.id}`,
      l.seller_id, `A buyer needs gear like yours (${m.score}/100 fit), for a site in ${r.site_state}`, `/listings/${l.id}`,
    ]);
    matches++;
  }
  return { users: USERS.length, listings: listings.length, requests: requests.length, matches };
}
