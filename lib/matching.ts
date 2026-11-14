import { q } from './db';
import { noun, ratings, type Rated } from './labels';
import { matchListing, MIN_SCORE, type Gap, type Listing, type Request } from './match';
import { filled, taken } from './units';

type Row = Record<string, unknown> & { id: string };
const asDate = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

/** Fit of one request and listing under the current rules, or null when the listing is ruled out. */
export function fitOf(reqRow: Record<string, unknown>, lstRow: Record<string, unknown>): { score: number; gaps: Gap[] } | null {
  const m = matchListing(
    { ...(reqRow as unknown as Request), need_by: asDate(reqRow.need_by) },
    { ...(lstRow as unknown as Listing), available_date: asDate(lstRow.available_date) },
  );
  return m.ok && m.score >= MIN_SCORE ? { score: m.score, gaps: m.gaps } : null;
}

async function save(reqRow: Row, lstRow: Row) {
  const m = fitOf(reqRow, lstRow);
  if (!m) return false;
  const [row] = await q<{ is_new: boolean }>(
    `insert into matches (request_id, listing_id, score, gaps) values ($1,$2,$3,$4)
     on conflict (request_id, listing_id) do update set score = excluded.score, gaps = excluded.gaps
     returning (xmax = 0) as is_new`,
    [reqRow.id, lstRow.id, m.score, JSON.stringify(m.gaps)],
  );
  if (row?.is_new) {
    const kind = noun(String(lstRow.category));
    await q(`insert into notifications (user_id, body, link) values ($1,$2,$3), ($4,$5,$6)`, [
      reqRow.buyer_id,
      `New match (${m.score}/100): ${lstRow.oem} ${kind}, ${ratings(lstRow as unknown as Rated).slice(0, 2).join(', ')}`,
      `/requests/${reqRow.id}`,
      lstRow.seller_id,
      `A buyer needs gear like yours (${m.score}/100 fit): ${kind} for a site in ${reqRow.site_state}`,
      `/listings/${lstRow.id}`,
    ]);
  }
  return true;
}

// Sample accounts (addresses ending in .test) and real ones are never matched with each other.
const DEMO = `(u.email like '%.test') as demo`;
// Matching counts only the units nobody has taken yet: what is left of a listing, and what is left of a need.
const open = (row: Row): Row => ({ ...row, quantity: Math.max(1, Number(row.open_units ?? row.quantity)) });

/**
 * Score one open request against every active listing in its category.
 * Runs when the request is posted and again whenever it is opened, so a rule change, a new
 * listing or a withdrawn one never leaves a stale fit on screen. Pairs that no longer qualify
 * are dropped unless a deal already hangs on them.
 */
export async function syncRequest(requestId: string) {
  const [req] = await q<Row>(
    `select r.*, ${DEMO}, r.quantity - ${filled('r')} as open_units from requests r join users u on u.id = r.buyer_id where r.id = $1 and r.status = 'open'`, [requestId]);
  if (!req) return 0;
  const lsts = await q<Row>(
    `select l.*, ${DEMO}, l.quantity - ${taken('l')} as open_units from listings l join users u on u.id = l.seller_id where l.status = 'active' and l.category = $1`, [req.category]);
  const kept: string[] = [];
  for (const l of lsts) if (l.demo === req.demo && (await save(open(req), open(l)))) kept.push(l.id);
  await q(
    `delete from matches m using listings l
      where m.request_id = $1 and l.id = m.listing_id and l.status = 'active' and not (m.listing_id = any($2::uuid[]))
        and not exists (select 1 from deals d where d.match_id = m.id)`, [req.id, kept]);
  return kept.length;
}

/** The same, from the seller's side: one active listing against every open request in its category. */
export async function syncListing(listingId: string) {
  const [lst] = await q<Row>(
    `select l.*, ${DEMO}, l.quantity - ${taken('l')} as open_units from listings l join users u on u.id = l.seller_id where l.id = $1 and l.status = 'active'`, [listingId]);
  if (!lst) return 0;
  const reqs = await q<Row>(
    `select r.*, ${DEMO}, r.quantity - ${filled('r')} as open_units from requests r join users u on u.id = r.buyer_id where r.status = 'open' and r.category = $1`, [lst.category]);
  const kept: string[] = [];
  for (const r of reqs) if (r.demo === lst.demo && (await save(open(r), open(lst)))) kept.push(r.id);
  await q(
    `delete from matches m using requests r
      where m.listing_id = $1 and r.id = m.request_id and r.status = 'open' and not (m.request_id = any($2::uuid[]))
        and not exists (select 1 from deals d where d.match_id = m.id)`, [lst.id, kept]);
  return kept.length;
}
