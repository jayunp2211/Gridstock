'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { q, one, pool } from '@/lib/db';
import { requireUser, SESSION, type User } from '@/lib/auth';
import { syncListing, syncRequest } from '@/lib/matching';
import { seedDemo } from '@/lib/demo';
import { capacityUnit, CATEGORIES, CONDITIONS, STAGES, STATES, label, units } from '@/lib/labels';
import { NDA_VERSION, ndaAccepted } from '@/lib/nda';
import { dealUnits, filled, settleUnits, taken, type Run } from '@/lib/units';
import { FILE_KINDS } from '@/lib/files';
import { visitor } from '@/lib/deal-files';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const num = (f: FormData, k: string) => {
  const v = str(f, k).replace(/[$,\s]/g, '');
  return v === '' ? null : Number(v);
};
const list = (f: FormData, k: string) => str(f, k).split(',').map(s => s.trim()).filter(Boolean);
const UUID = /^[0-9a-f-]{36}$/;

// ---------- form checks ----------
// The browser enforces the same limits first. These are the backstop, and they name the field
// by a code so the page can explain it without echoing anything from the URL.
class Invalid extends Error {
  constructor(public field: string) { super(field); }
}
const need = (ok: boolean, field: string) => { if (!ok) throw new Invalid(field); };
const whole = (v: number | null, min: number, max: number) => v != null && Number.isInteger(v) && v >= min && v <= max;
const blankOr = (v: number | null, min: number, max: number) => v == null || whole(v, min, max);
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const short = (s: string, max: number) => s.length <= max;
const today = () => new Date().toISOString().slice(0, 10);
const has = (pairs: [string, string][], v: string) => pairs.some(p => p[0] === v);

async function notify(userId: string, body: string, link: string) {
  await q(`insert into notifications (user_id, body, link) values ($1,$2,$3)`, [userId, body, link]);
}
/** A line in the deal log from Gridstock itself, not from either party. */
async function logLine(dealId: string, body: string) {
  await q(`insert into deal_messages (deal_id, author_id, body) values ($1, null, $2)`, [dealId, body]);
}

// ---------- accounts ----------
export async function signIn(f: FormData) {
  const id = str(f, 'user_id');
  // Only sample accounts can be entered from the picker.
  const u = UUID.test(id) ? await one<{ role: string }>(`select role from users where id = $1 and email like '%.test'`, [id]) : null;
  if (!u) redirect('/login');
  (await cookies()).set('uid', id, SESSION);
  redirect(u.role === 'seller' ? '/listings' : u.role === 'buyer' ? '/requests' : '/admin');
}

/**
 * A real company asking to join. It is recorded as an unverified account and nothing more:
 * no session is created, because until email sign-in exists an address alone must not open an account.
 */
export async function requestAccess(f: FormData) {
  const role = str(f, 'role') === 'buyer' ? 'buyer' : 'seller';
  const name = str(f, 'name'), email = str(f, 'email').toLowerCase(), company = str(f, 'company'), note = str(f, 'note');
  if (str(f, 'website')) redirect('/login?requested=1'); // a field people never see; only scripts fill it
  const ok = name.length >= 2 && short(name, 80) && company.length >= 2 && short(company, 120) && short(note, 1000)
    && short(email, 200) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !email.endsWith('.test');
  if (!ok) redirect(`/login?role=${role}&error=access`);
  // A second request from the same address changes nothing: anyone can type someone else's address here.
  await q(`insert into users (email, name, company, role, note) values ($1,$2,$3,$4,$5) on conflict (email) do nothing`,
    [email, name, company, role, note || null]);
  redirect('/login?requested=1');
}

export async function signOut() {
  (await cookies()).delete('uid');
  redirect('/');
}

// ---------- listings and requests ----------
export async function createListing(f: FormData) {
  const u = await requireUser('seller');
  const v = {
    category: str(f, 'category'), oem: str(f, 'oem'), model: str(f, 'model'), voltage: num(f, 'voltage_v'), secondary: num(f, 'secondary_v'),
    amps: num(f, 'amps'), capacity: num(f, 'capacity'), kaic: num(f, 'kaic'), enclosure: str(f, 'enclosure'), standard: str(f, 'standard'),
    configuration: str(f, 'configuration'), condition: str(f, 'condition'),
    quantity: num(f, 'quantity') ?? 1, state: str(f, 'location_state').toUpperCase(), available: str(f, 'available_date'),
    price: num(f, 'asking_price'), warranty: str(f, 'warranty_status'), notes: str(f, 'notes'),
  };
  // Which ratings apply follows from the category. The ones that do not apply are not stored, whatever was sent.
  const sized = capacityUnit(v.category) != null, transformer = v.category === 'transformer';
  try {
    need(has(CATEGORIES, v.category), 'category');
    need(v.oem.length > 0 && short(v.oem, 40), 'oem');
    need(whole(v.voltage, 100, 800_000), 'voltage');
    if (transformer) need(whole(v.secondary, 100, 800_000), 'secondary');
    if (sized) need(whole(v.capacity, 1, 500_000), 'capacity');
    else {
      need(whole(v.amps, 1, 20_000), 'amps');
      need(blankOr(v.kaic, 1, 250), 'kaic');
    }
    need(has(CONDITIONS, v.condition), 'condition');
    need(whole(v.quantity, 1, 500), 'quantity');
    need(has(STATES, v.state), 'state');
    need(isDate(v.available), 'date');
    need(blankOr(v.price, 1, 2_000_000_000), 'price');
    need(short(v.model, 60) && short(v.enclosure, 30) && short(v.standard, 30) && short(v.warranty, 120) && short(v.notes, 2000)
      && short(v.configuration, 600), 'text');
  } catch (e) {
    if (e instanceof Invalid) redirect(`/listings/new?error=${e.field}`);
    throw e;
  }
  const row = await one<{ id: string }>(
    `insert into listings (seller_id, category, oem, model, voltage_v, secondary_v, amps, capacity, kaic, enclosure, standard, configuration,
       condition, quantity, location_state, available_date, asking_price, warranty_status, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) returning id`,
    [u.id, v.category, v.oem, v.model || null, v.voltage, transformer ? v.secondary : null, sized ? null : v.amps, sized ? v.capacity : null,
     sized ? null : v.kaic, v.enclosure || null, v.standard || null, v.configuration || null, v.condition,
     v.quantity, v.state, v.available, v.price, v.warranty || null, v.notes || null],
  );
  await syncListing(row!.id);
  redirect(`/listings/${row!.id}?created=1`);
}

export async function createRequest(f: FormData) {
  const u = await requireUser('buyer');
  const v = {
    category: str(f, 'category'), voltage: num(f, 'voltage_v'), secondary: num(f, 'secondary_v'), amps: num(f, 'amps_min'),
    capacity: num(f, 'capacity_min'), kaic: num(f, 'kaic_min'),
    enclosure: str(f, 'enclosure'), oems: list(f, 'acceptable_oems'), conditions: f.getAll('conditions_ok').map(String),
    quantity: num(f, 'quantity') ?? 1, state: str(f, 'site_state').toUpperCase(), needBy: str(f, 'need_by'),
    budget: num(f, 'budget_max'), notes: str(f, 'notes'),
  };
  const sized = capacityUnit(v.category) != null, transformer = v.category === 'transformer';
  try {
    need(has(CATEGORIES, v.category), 'category');
    need(whole(v.voltage, 100, 800_000), 'voltage');
    if (transformer) need(whole(v.secondary, 100, 800_000), 'secondary');
    if (sized) need(whole(v.capacity, 1, 500_000), 'capacity');
    else {
      need(whole(v.amps, 1, 20_000), 'amps');
      need(blankOr(v.kaic, 1, 250), 'kaic');
    }
    need(v.conditions.length > 0 && v.conditions.every(c => has(CONDITIONS, c)), 'conditions_ok');
    need(whole(v.quantity, 1, 500), 'quantity');
    need(has(STATES, v.state), 'state');
    need(isDate(v.needBy), 'date');
    need(v.needBy >= today(), 'need_by');
    need(blankOr(v.budget, 1, 2_000_000_000), 'price');
    need(short(v.enclosure, 30) && short(v.notes, 2000) && v.oems.length <= 12 && v.oems.every(o => short(o, 40)), 'text');
  } catch (e) {
    if (e instanceof Invalid) redirect(`/requests/new?error=${e.field}`);
    throw e;
  }
  const row = await one<{ id: string }>(
    `insert into requests (buyer_id, category, voltage_v, secondary_v, amps_min, capacity_min, kaic_min, enclosure, acceptable_oems, conditions_ok,
       quantity, site_state, need_by, budget_max, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning id`,
    [u.id, v.category, v.voltage, transformer ? v.secondary : null, sized ? null : v.amps, sized ? v.capacity : null, sized ? null : v.kaic,
     v.enclosure || null, v.oems, v.conditions, v.quantity, v.state, v.needBy, v.budget, v.notes || null],
  );
  await syncRequest(row!.id);
  redirect(`/requests/${row!.id}`);
}

/** Deals still being negotiated end when the gear or the need behind them is taken off the market. */
async function endOpenDeals(by: 'listing_id' | 'request_id', id: string, note: string) {
  const ended = await q<{ id: string; buyer_id: string; seller_id: string }>(
    `update deals d set stage = 'lost', updated_at = now() from matches m, requests r, listings l
      where m.id = d.match_id and r.id = m.request_id and l.id = m.listing_id and m.${by} = $1
        and d.stage in ('nda','documents','offer') and d.offer_accepted_at is null
      returning d.id, r.buyer_id, l.seller_id`, [id]);
  for (const d of ended) {
    await logLine(d.id, note);
    await notify(by === 'listing_id' ? d.buyer_id : d.seller_id, note, `/deals/${d.id}`);
  }
}

/**
 * Make a change that can alter how many units of a listing are taken, or how much of a request is covered.
 * The listing and the request are locked first and their statuses are brought in line before the lock is let go,
 * so two changes on the same listing never work from each other's stale counts and the same unit is never promised twice.
 * `change` must use the `tx` it is given and nothing else.
 */
async function withUnits<T>(listingId: string | null, requestId: string | null, change: (tx: Run) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('begin');
    const tx: Run = (text, params) => c.query(text, params).then(r => r.rows);
    // Always the listing before the request, so two of these can never wait on each other.
    if (listingId) await tx(`select id from listings where id = $1 for update`, [listingId]);
    if (requestId) await tx(`select id from requests where id = $1 for update`, [requestId]);
    const out = await change(tx);
    await settleUnits(tx, listingId, requestId);
    await c.query('commit');
    return out;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

export async function setListingStatus(f: FormData) {
  const u = await requireUser('seller');
  const id = str(f, 'listing_id'), to = str(f, 'to');
  const l = UUID.test(id) ? await one<{ status: string }>(`select status from listings where id = $1 and seller_id = $2`, [id, u.id]) : null;
  if (!l) return;
  if (to === 'withdrawn' && l.status === 'active') {
    const [done] = await withUnits(id, null, tx => tx(`update listings set status = 'withdrawn' where id = $1 and status = 'active' returning id`, [id]));
    if (done) await endOpenDeals('listing_id', id, 'The seller withdrew this listing, so the deal has ended.');
  } else if (to === 'active' && l.status === 'withdrawn') {
    // Units promised while it was listed before are still promised, so the status it returns to follows from its deals.
    await withUnits(id, null, tx => tx(`update listings set status = 'active' where id = $1 and status = 'withdrawn'`, [id]));
    await syncListing(id);
  }
  revalidatePath(`/listings/${id}`);
}

export async function setRequestStatus(f: FormData) {
  const u = await requireUser('buyer');
  const id = str(f, 'request_id'), to = str(f, 'to');
  const r = UUID.test(id) ? await one<{ status: string }>(`select status from requests where id = $1 and buyer_id = $2`, [id, u.id]) : null;
  if (!r) return;
  if (to === 'closed' && r.status === 'open') {
    const [done] = await withUnits(null, id, tx => tx(`update requests set status = 'closed' where id = $1 and status = 'open' returning id`, [id]));
    if (done) await endOpenDeals('request_id', id, 'The buyer closed this request, so the deal has ended.');
  } else if (to === 'open' && r.status === 'closed') {
    await withUnits(null, id, tx => tx(`update requests set status = 'open' where id = $1 and status = 'closed'`, [id]));
    await syncRequest(id);
  }
  revalidatePath(`/requests/${id}`);
}

// ---------- deals ----------
type DealRow = {
  id: string; stage: string; buyer_id: string; seller_id: string; listing_id: string; request_id: string;
  buyer_nda_at: string | null; seller_nda_at: string | null; nda_version: string | null;
  offer_price: number | null; offer_by: string | null; offer_accepted_at: string | null; fee_pct: string;
  quantity: number | null; need_qty: number; have_qty: number; open_units: number; open_need: number;
  inspector: string | null; inspection_result: string | null;
  escrow_agent: string | null; escrow_funded_at: string | null; escrow_confirmed_at: string | null; escrow_released_at: string | null;
};

async function dealFor(dealId: string, userId: string) {
  if (!UUID.test(dealId)) return null;
  return one<DealRow>(
    `select d.id, d.stage, d.buyer_nda_at, d.seller_nda_at, d.nda_version, d.offer_price, d.offer_by, d.offer_accepted_at, d.fee_pct, d.quantity,
            d.inspector, d.inspection_result, d.escrow_agent, d.escrow_funded_at, d.escrow_confirmed_at, d.escrow_released_at,
            r.buyer_id, l.seller_id, m.listing_id, m.request_id, r.quantity as need_qty, l.quantity as have_qty,
            l.quantity - ${taken('l')} as open_units, r.quantity - ${filled('r')} as open_need
       from deals d
       join matches m on m.id = d.match_id join requests r on r.id = m.request_id join listings l on l.id = m.listing_id
     where d.id = $1 and ($2 in (r.buyer_id, l.seller_id) or exists (select 1 from users where id = $2 and role = 'admin'))`,
    [dealId, userId],
  );
}

const usd = (n: number) => '$' + n.toLocaleString('en-US');
const side = (d: DealRow, u: User) => (u.id === d.buyer_id ? 'buyer' : 'seller');
const other = (d: DealRow, u: User) => (u.id === d.buyer_id ? d.seller_id : d.buyer_id);
const isParty = (d: DealRow, u: User) => u.id === d.buyer_id || u.id === d.seller_id;
/** The units a deal covers, in words. Prices are totals for that quantity. */
const lot = (d: DealRow) => units(dealUnits(d));
/** Offers can be made and answered only by the two parties, after the NDA, and until one is accepted. */
const negotiable = (d: DealRow) =>
  !!d.buyer_nda_at && !!d.seller_nda_at && !d.offer_accepted_at && ['documents', 'offer'].includes(d.stage);
/** The most units a deal still being negotiated could cover: what the buyer still needs, up to what the seller still has. */
const room = (d: DealRow) => Math.min(d.open_need, d.open_units);
async function tellOps(body: string, link: string) {
  await q(`insert into notifications (user_id, body, link) select id, $1, $2 from users where role = 'admin'`, [body, link]);
}

/** Either side can open a deal room on a match: a buyer asks for an intro, a seller proposes one. */
async function startDeal(f: FormData, by: 'buyer' | 'seller') {
  const u = await requireUser(by);
  const matchId = str(f, 'match_id');
  const m = UUID.test(matchId) ? await one<{ seller_id: string; buyer_id: string; listing_id: string; request_id: string; listing_status: string; request_status: string; deal_id: string | null; open_units: number; open_need: number }>(
    `select l.seller_id, r.buyer_id, m.listing_id, m.request_id, l.status as listing_status, r.status as request_status, d.id as deal_id,
            l.quantity - ${taken('l')} as open_units, r.quantity - ${filled('r')} as open_need
       from matches m join listings l on l.id = m.listing_id join requests r on r.id = m.request_id
       left join deals d on d.match_id = m.id where m.id = $1`, [matchId]) : null;
  if (!m || (by === 'buyer' ? m.buyer_id : m.seller_id) !== u.id) throw new Error('This match belongs to another account.');
  if (m.deal_id) redirect(`/deals/${m.deal_id}`);
  // The gear or the need may have been taken since the page was loaded. Send them back to see why.
  if (m.listing_status !== 'active' || m.request_status !== 'open')
    redirect(by === 'buyer' ? `/requests/${m.request_id}` : `/listings/${m.listing_id}`);
  // A deal covers as many units as the buyer still needs, up to what the seller still has. An offer can name fewer.
  const d = await one<{ id: string }>(
    `insert into deals (match_id, quantity) values ($1, $2) on conflict (match_id) do update set updated_at = now() returning id`,
    [matchId, Math.max(1, Math.min(m.open_need, m.open_units))]);
  await logLine(d!.id, by === 'buyer' ? 'The buyer asked for an introduction.' : 'The seller proposed an introduction.');
  if (by === 'buyer') await notify(m.seller_id, 'A buyer wants an intro on your listing', `/deals/${d!.id}`);
  else await notify(m.buyer_id, 'A seller is offering gear that fits your request', `/deals/${d!.id}`);
  redirect(`/deals/${d!.id}`);
}
export async function requestIntro(f: FormData) { await startDeal(f, 'buyer'); }
export async function proposeIntro(f: FormData) { await startDeal(f, 'seller'); }

export async function acceptNda(f: FormData) {
  const u = await requireUser();
  const d = await dealFor(str(f, 'deal_id'), u.id);
  if (!d) throw new Error('This deal belongs to another account.');
  if (!isParty(d, u) || d.stage !== 'nda') return;
  const [mine, theirs] = u.id === d.buyer_id ? (['buyer_nda_at', 'seller_nda_at'] as const) : (['seller_nda_at', 'buyer_nda_at'] as const);
  if (ndaAccepted(d[mine], d)) return;
  // Acceptance counts only if the box was ticked, and only for the version of the text that was on the page.
  // Both sides accept the same version: the one in force when the first of them accepted.
  const version = d.nda_version ?? NDA_VERSION;
  if (str(f, 'agree') !== 'yes' || str(f, 'version') !== version) redirect(`/deals/${d.id}?nda=confirm`);
  // The first acceptance of the text sets the version. If the other side had accepted before there was a
  // text, that acceptance is set aside here, so the record never says a side accepted words it was not shown.
  await q(
    `update deals set ${mine} = now(), ${theirs} = case when nda_version is null then null else ${theirs} end,
            nda_version = coalesce(nda_version, $2), updated_at = now()
      where id = $1 and stage = 'nda'`, [d.id, version]);
  const open = await one<{ id: string }>(
    `update deals set stage = 'documents' where id = $1 and stage = 'nda' and buyer_nda_at is not null and seller_nda_at is not null returning id`, [d.id]);
  if (open) {
    await logLine(d.id, `Both sides accepted the NDA, version ${version}. Names, asking price and seller notes are now visible to each other.`);
    await notify(other(d, u), 'Both sides have accepted the NDA. The deal room is open.', `/deals/${d.id}`);
  } else {
    await notify(other(d, u), `The ${side(d, u)} accepted the NDA and is waiting for you.`, `/deals/${d.id}`);
  }
  revalidatePath(`/deals/${d.id}`);
}

export async function postMessage(f: FormData) {
  const u = await requireUser();
  const d = await dealFor(str(f, 'deal_id'), u.id);
  const body = str(f, 'body').slice(0, 4000);
  if (!d || !body) return;
  const party = isParty(d, u);
  // The two sides talk only once both have signed and while the deal is alive. Operations can write at any stage.
  if (party && (!(d.buyer_nda_at && d.seller_nda_at) || d.stage === 'lost')) return;
  await q(`insert into deal_messages (deal_id, author_id, body) values ($1,$2,$3)`, [d.id, u.id, body]);
  for (const to of party ? [other(d, u)] : [d.buyer_id, d.seller_id]) await notify(to, 'New message in a deal room', `/deals/${d.id}`);
  revalidatePath(`/deals/${d.id}`);
}

/**
 * The side that added a document can take it back out at any time, also after the deal has ended.
 * In the demo, where every visitor shares the sample accounts, only the browser that added it can.
 */
export async function removeFile(f: FormData) {
  const u = await requireUser();
  const d = await dealFor(str(f, 'deal_id'), u.id);
  const id = str(f, 'file_id');
  if (!d || !isParty(d, u) || !UUID.test(id)) return;
  const gone = await one<{ kind: string }>(
    `delete from deal_files where id = $1 and deal_id = $2 and uploaded_by = $3 and (visitor is null or visitor = $4) returning kind`,
    [id, d.id, u.id, await visitor()]);
  // The file's own name stays out of the log, as it does when a document is added.
  if (gone) await logLine(d.id, `The ${side(d, u)} removed a document: ${label(FILE_KINDS, gone.kind).toLowerCase()}.`);
  revalidatePath(`/deals/${d.id}`);
}

export async function makeOffer(f: FormData) {
  const u = await requireUser();
  const d = await dealFor(str(f, 'deal_id'), u.id);
  const price = num(f, 'offer_price');
  if (!d || !isParty(d, u) || !negotiable(d)) return;
  if (!whole(price, 1, 2_000_000_000)) redirect(`/deals/${d.id}?offer=invalid`);
  // An offer is a price for a number of units. It cannot name more than the buyer still needs or the seller still has.
  const most = Math.max(1, room(d));
  const qty = num(f, 'quantity') ?? Math.min(dealUnits(d), most);
  if (!whole(qty, 1, most)) redirect(`/deals/${d.id}?offer=units`);
  await q(`update deals set offer_price = $2, offer_by = $3, quantity = $4, stage = 'offer', updated_at = now() where id = $1`, [d.id, price, u.id, qty]);
  await q(`insert into deal_messages (deal_id, author_id, body) values ($1,$2,$3)`, [d.id, u.id, `Offer: ${usd(price!)} for ${units(qty!)}`]);
  await notify(other(d, u), `The ${side(d, u)} offered ${usd(price!)} for ${units(qty!)}. Accept it or counter.`, `/deals/${d.id}`);
  redirect(`/deals/${d.id}`);
}

export async function acceptOffer(f: FormData) {
  const u = await requireUser();
  const d = await dealFor(str(f, 'deal_id'), u.id);
  if (!d || !isParty(d, u) || !negotiable(d)) return;
  // Only the side that received the offer can accept it, and only at the price they were shown.
  if (d.offer_price == null || !d.offer_by || d.offer_by === u.id) return;
  if (num(f, 'offer_price') !== d.offer_price) return;
  const qty = dealUnits(d);
  // Accepting reserves the units. It is refused if another deal has taken them since the offer was made.
  const outcome = await withUnits(d.listing_id, d.request_id, async tx => {
    const [left] = await tx(
      `select l.quantity - ${taken('l')} as open_units, r.quantity - ${filled('r')} as open_need from listings l, requests r where l.id = $1 and r.id = $2`,
      [d.listing_id, d.request_id]);
    if (qty > Number(left.open_units) || qty > Number(left.open_need)) return 'taken';
    // A new acceptance starts the inspection afresh. The firm that was named before stays.
    const [done] = await tx(
      `update deals set offer_accepted_at = now(), stage = 'inspection', quantity = $4, inspection_result = null, inspection_at = null, updated_at = now()
        where id = $1 and offer_price = $2 and offer_by = $3 and offer_accepted_at is null and stage in ('documents','offer') returning id`,
      [d.id, d.offer_price, d.offer_by, qty]);
    return done ? 'done' : 'stale';
  });
  if (outcome === 'taken') redirect(`/deals/${d.id}?offer=taken`);
  if (outcome !== 'done') return;

  await q(`insert into deal_messages (deal_id, author_id, body) values ($1,$2,$3)`,
    [d.id, u.id, `Accepted the offer of ${usd(d.offer_price)} for ${units(qty)}. Next step: the buyer arranges an independent inspection.`]);
  await notify(d.offer_by, `Your offer of ${usd(d.offer_price)} was accepted. Next step: independent inspection.`, `/deals/${d.id}`);
  await tellOps(`An offer of ${usd(d.offer_price)} was accepted. The buyer now arranges the inspection.`, `/deals/${d.id}`);

  // Other deals still being negotiated on the same listing have fewer units to work with now.
  const others = await q<{ id: string; buyer_id: string; seller_id: string; open_units: number }>(
    `select d.id, r.buyer_id, l.seller_id, l.quantity - ${taken('l')} as open_units
       from deals d join matches m on m.id = d.match_id join requests r on r.id = m.request_id join listings l on l.id = m.listing_id
      where m.listing_id = $1 and d.id <> $2 and d.stage in ('nda','documents','offer')`, [d.listing_id, d.id]);
  for (const o of others) {
    const note = o.open_units > 0
      ? `Another buyer's offer was accepted on this listing. ${units(o.open_units)} ${o.open_units === 1 ? 'is' : 'are'} still available.`
      : 'Another buyer\'s offer was accepted for the last of this listing. This deal can go ahead only if that one falls through.';
    await logLine(o.id, note);
    await notify(o.buyer_id, note, `/deals/${o.id}`);
  }
  revalidatePath(`/deals/${d.id}`);
}

/** Either side can walk away while the deal is still being negotiated. After an offer is accepted, only operations can end it. */
export async function leaveDeal(f: FormData) {
  const u = await requireUser();
  const d = await dealFor(str(f, 'deal_id'), u.id);
  if (!d || !isParty(d, u)) return;
  if (d.offer_accepted_at || !['nda', 'documents', 'offer'].includes(d.stage)) return;
  const reason = str(f, 'reason').slice(0, 300);
  await q(`update deals set stage = 'lost', updated_at = now() where id = $1`, [d.id]);
  await logLine(d.id, `The ${side(d, u)} left this deal.${reason ? ` Reason given: ${reason}` : ''}`);
  await notify(other(d, u), `The ${side(d, u)} left a deal.`, `/deals/${d.id}`);
  revalidatePath(`/deals/${d.id}`);
}

// ---------- inspection ----------
// The buyer carries the risk of the equipment, so the buyer chooses the firm and decides what the result means.
// Gridstock records each step. It does not inspect anything itself.

/** The buyer names the independent firm that will inspect the equipment, and the planned date. */
export async function appointInspector(f: FormData) {
  const u = await requireUser();
  const d = await dealFor(str(f, 'deal_id'), u.id);
  if (!d || u.id !== d.buyer_id || d.stage !== 'inspection') return;
  const firm = str(f, 'inspector'), on = str(f, 'inspection_on');
  if (firm.length < 2 || !short(firm, 120) || (on !== '' && !isDate(on))) redirect(`/deals/${d.id}?step=inspector#steps`);
  await q(`update deals set inspector = $2, inspection_on = $3, updated_at = now() where id = $1`, [d.id, firm, on || null]);
  const when = on && new Date(`${on}T00:00:00Z`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  await logLine(d.id, `The buyer appointed ${firm} to inspect the equipment${when ? `, planned for ${when}` : ''}.`);
  await notify(d.seller_id, 'The buyer appointed an inspector. Arrange access to the equipment.', `/deals/${d.id}`);
  revalidatePath(`/deals/${d.id}`);
}

/**
 * The buyer records what came of the inspection. Accepting the equipment, or waiving the inspection, moves the deal
 * to escrow. Reporting that it did not pass sets the agreed price aside and frees the units, so the two sides can
 * agree a new price or part ways.
 */
export async function recordInspection(f: FormData) {
  const u = await requireUser();
  const d = await dealFor(str(f, 'deal_id'), u.id);
  if (!d || u.id !== d.buyer_id || d.stage !== 'inspection') return;
  const result = str(f, 'result'), note = str(f, 'note').slice(0, 300);
  if (!['passed', 'waived', 'failed'].includes(result)) return;
  // "Passed" has to say who did the inspecting.
  if (result === 'passed' && !d.inspector) redirect(`/deals/${d.id}?step=who#steps`);
  if (result === 'failed') {
    const [done] = await withUnits(d.listing_id, d.request_id, tx => tx(
      `update deals set inspection_result = 'failed', inspection_at = now(), stage = 'offer', offer_accepted_at = null,
              offer_price = null, offer_by = null, updated_at = now() where id = $1 and stage = 'inspection' returning id`, [d.id]));
    if (!done) return;
    await logLine(d.id, `The buyer reported that the equipment did not pass inspection.${note ? ` Reason given: ${note}` : ''} The agreed price is set aside. Either side can make a new offer or leave.`);
    await notify(d.seller_id, 'The buyer reported that the equipment did not pass inspection. The price is open again.', `/deals/${d.id}`);
  } else {
    const [done] = await withUnits(d.listing_id, d.request_id, tx => tx(
      `update deals set inspection_result = $2, inspection_at = now(), stage = 'escrow', updated_at = now() where id = $1 and stage = 'inspection' returning id`,
      [d.id, result]));
    if (!done) return;
    await logLine(d.id, result === 'passed'
      ? `The buyer accepted the equipment after inspection by ${d.inspector}. Next step: the buyer deposits the price with an escrow agent.`
      : `The buyer waived the inspection.${note ? ` Reason given: ${note}` : ''} Next step: the buyer deposits the price with an escrow agent.`);
    await notify(d.seller_id, result === 'passed' ? 'The buyer accepted the equipment after inspection. Next step: escrow.' : 'The buyer waived the inspection. Next step: escrow.', `/deals/${d.id}`);
  }
  revalidatePath(`/deals/${d.id}`);
}

// ---------- escrow ----------
// The money sits with a licensed escrow agent that the two sides choose. Gridstock never holds or moves it.
// Each step below is one side's own statement, and the page tells the other side to check it with the agent.

/** The buyer says which agent holds the purchase price. */
export async function fundEscrow(f: FormData) {
  const u = await requireUser();
  const d = await dealFor(str(f, 'deal_id'), u.id);
  if (!d || u.id !== d.buyer_id || d.stage !== 'escrow' || d.escrow_funded_at) return;
  const agent = str(f, 'escrow_agent');
  if (agent.length < 2 || !short(agent, 120)) redirect(`/deals/${d.id}?step=agent#steps`);
  const done = await one(`update deals set escrow_agent = $2, escrow_funded_at = now(), updated_at = now()
                           where id = $1 and stage = 'escrow' and escrow_funded_at is null returning id`, [d.id, agent]);
  if (!done) return;
  await logLine(d.id, `The buyer reported the price as deposited with ${agent}. The seller should confirm that with the agent before shipping.`);
  await notify(d.seller_id, 'The buyer reported the price as deposited in escrow. Confirm it with the agent before you ship.', `/deals/${d.id}`);
  revalidatePath(`/deals/${d.id}`);
}

/** The seller confirms, after checking with the agent, that the money is held. */
export async function confirmEscrow(f: FormData) {
  const u = await requireUser();
  const d = await dealFor(str(f, 'deal_id'), u.id);
  if (!d || u.id !== d.seller_id || d.stage !== 'escrow' || !d.escrow_funded_at || d.escrow_confirmed_at) return;
  const done = await one(`update deals set escrow_confirmed_at = now(), updated_at = now()
                           where id = $1 and stage = 'escrow' and escrow_funded_at is not null and escrow_confirmed_at is null returning id`, [d.id]);
  if (!done) return;
  await logLine(d.id, `The seller confirmed with ${d.escrow_agent} that the funds are held. The equipment can ship.`);
  await notify(d.buyer_id, 'The seller confirmed that the funds are held in escrow. The equipment can ship.', `/deals/${d.id}`);
  revalidatePath(`/deals/${d.id}`);
}

/** The buyer confirms delivery and that the agent has been told to release the money. That closes the deal. */
export async function releaseEscrow(f: FormData) {
  const u = await requireUser();
  const d = await dealFor(str(f, 'deal_id'), u.id);
  if (!d || u.id !== d.buyer_id || d.stage !== 'escrow' || !d.escrow_confirmed_at || d.escrow_released_at) return;
  const [done] = await withUnits(d.listing_id, d.request_id, tx => tx(
    `update deals set escrow_released_at = now(), stage = 'closed', updated_at = now()
      where id = $1 and stage = 'escrow' and escrow_confirmed_at is not null and escrow_released_at is null returning id`, [d.id]));
  if (!done) return;
  await logLine(d.id, 'The buyer confirmed delivery and released the funds. The deal is closed.');
  await notify(d.seller_id, 'The buyer confirmed delivery and released the funds. The deal is closed.', `/deals/${d.id}`);
  if (d.offer_price != null) {
    const fee = Math.round((d.offer_price * Number(d.fee_pct)) / 100);
    await tellOps(`A deal closed at ${usd(d.offer_price)}. The buyer owes a fee of ${usd(fee)}.`, `/deals/${d.id}`);
  }
  revalidatePath(`/deals/${d.id}`);
}

// ---------- operations ----------
export async function setStage(f: FormData) {
  const u = await requireUser('admin');
  const stage = str(f, 'stage');
  if (![...STAGES, 'lost'].includes(stage as (typeof STAGES)[number])) return;
  const d = await dealFor(str(f, 'deal_id'), u.id);
  if (!d) return;
  // Moving a deal back reopens whatever came after that point: the acceptance, the inspection result, the escrow record.
  await withUnits(d.listing_id, d.request_id, tx => tx(`update deals set stage = $2, updated_at = now(),
             offer_accepted_at = case when $2 in ('nda','documents','offer') then null else offer_accepted_at end,
             inspection_result = case when $2 in ('nda','documents','offer','inspection') then null else inspection_result end,
             inspection_at = case when $2 in ('nda','documents','offer','inspection') then null else inspection_at end,
             escrow_funded_at = case when $2 in ('nda','documents','offer','inspection') then null else escrow_funded_at end,
             escrow_confirmed_at = case when $2 in ('nda','documents','offer','inspection') then null else escrow_confirmed_at end,
             escrow_released_at = case when $2 = 'closed' then escrow_released_at else null end
           where id = $1`, [d.id, stage]));
  // The listing and the request follow from the deals on them: units are reserved from inspection on, and sold at closing.
  await q(`insert into deal_messages (deal_id, author_id, body) values ($1,$2,$3)`, [d.id, u.id, `Stage moved to ${stage}`]);
  revalidatePath(`/deals/${d.id}`);
}

export async function verifyUser(f: FormData) {
  await requireUser('admin');
  // The demo's operations account is open to anyone, so it can only act on sample accounts.
  await q(`update users set verified = true where id = $1 and email like '%.test'`, [str(f, 'user_id')]);
  revalidatePath('/admin');
}

/** Put the sample companies, gear and requests back to their starting state. Real accounts are untouched. */
export async function resetDemo() {
  await requireUser('admin');
  const c = await pool.connect();
  try {
    await c.query('begin');
    await seedDemo((text, params) => c.query(text, params).then(r => r.rows));
    await c.query('commit');
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    c.release();
  }
  redirect('/admin?reset=1');
}

// ---------- contact ----------
/** A message from the about page. It is stored and nothing else happens: no account, no session, no reply from the site. */
export async function sendContact(f: FormData) {
  if (str(f, 'website')) redirect('/about?sent=1#contact'); // a field people never see; only scripts fill it
  const name = str(f, 'name'), email = str(f, 'email').toLowerCase(), company = str(f, 'company'), body = str(f, 'body');
  const ok = name.length >= 2 && short(name, 80) && short(company, 120) && body.length >= 10 && short(body, 4000)
    && short(email, 200) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!ok) redirect('/about?error=contact#contact');
  // The form is open to the whole internet, so it stops taking messages for a while if they arrive faster than people write.
  const recent = await one<{ n: number }>(`select count(*)::int as n from contact_messages where created_at > now() - interval '1 hour'`);
  if ((recent?.n ?? 0) >= 30) redirect('/about?error=busy#contact');
  await q(`insert into contact_messages (name, email, company, body) values ($1,$2,$3,$4)`, [name, email, company || null, body]);
  redirect('/about?sent=1#contact');
}
