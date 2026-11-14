// Units. A listing can hold several identical units and a request can need several.
// A deal covers some of them. Once its offer is accepted those units are spoken for:
// reserved while the deal completes, sold when it closes. The rest of the listing stays
// open to other buyers, and the rest of the need stays open to other sellers.
export type Run = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

/** Stages in which a deal's units are spoken for. */
const HELD = `('inspection','escrow','closed')`;
/** Stages in which they are reserved but the deal has not closed yet. */
const PENDING = `('inspection','escrow')`;

// Deals opened before units were recorded cover what the buyer needs, up to what was listed.
const DEAL_UNITS = `coalesce(d_.quantity, least(r_.quantity, l_.quantity))`;
const DEALS = `deals d_ join matches m_ on m_.id = d_.match_id join requests r_ on r_.id = m_.request_id join listings l_ on l_.id = m_.listing_id`;

/** SQL for the units of listing `l` that accepted deals have taken. */
export const taken = (l = 'l') =>
  `(select coalesce(sum(${DEAL_UNITS}), 0)::int from ${DEALS} where m_.listing_id = ${l}.id and d_.stage in ${HELD})`;
/** SQL for the units of listing `l` in deals that have closed. The rest of what is taken is reserved while a deal completes. */
export const sold = (l = 'l') =>
  `(select coalesce(sum(${DEAL_UNITS}), 0)::int from ${DEALS} where m_.listing_id = ${l}.id and d_.stage = 'closed')`;
/** SQL for the units of request `r` that accepted deals already cover. */
export const filled = (r = 'r') =>
  `(select coalesce(sum(${DEAL_UNITS}), 0)::int from ${DEALS} where m_.request_id = ${r}.id and d_.stage in ${HELD})`;
/** SQL for whether listing `l` (by 'listing_id') or request `r` (by 'request_id') has a deal that is accepted and not yet closed. */
const pending = (by: 'listing_id' | 'request_id', row: string) =>
  `exists (select 1 from deals d_ join matches m_ on m_.id = d_.match_id where m_.${by} = ${row}.id and d_.stage in ${PENDING})`;

/** Units a deal covers, for a row that carries the deal's own count and both totals. */
export const dealUnits = (d: { quantity: number | null; need_qty: number; have_qty: number }) =>
  d.quantity ?? Math.min(d.need_qty, d.have_qty);

/**
 * What a listing's status should be, given how many units nobody has taken and whether a deal is still completing.
 * A withdrawn listing stays withdrawn: that is the seller's own choice.
 */
export function listingStatus(current: string, open: number, hasPending: boolean): string {
  if (current === 'withdrawn') return current;
  if (open > 0) return 'active';
  return hasPending ? 'under_offer' : 'sold';
}

/**
 * What a request's status should be. While part of the need is uncovered it stays open, unless the buyer closed it.
 * Once deals cover all of it, it is in a deal until they close.
 */
export function requestStatus(current: string, open: number, hasPending: boolean): string {
  if (open > 0) return current === 'closed' ? 'closed' : 'open';
  return hasPending ? 'in_deal' : 'closed';
}

/** Bring a listing's and a request's status in line with the deals on them. Call it after any change to a deal's stage. */
export async function settleUnits(run: Run, listingId: string | null, requestId: string | null) {
  if (listingId) {
    const [l] = await run(
      `select l.status, l.quantity - ${taken('l')} as open, ${pending('listing_id', 'l')} as pending from listings l where l.id = $1`, [listingId]);
    if (l) {
      const to = listingStatus(String(l.status), Number(l.open), Boolean(l.pending));
      if (to !== l.status) await run(`update listings set status = $2 where id = $1`, [listingId, to]);
    }
  }
  if (requestId) {
    const [r] = await run(
      `select r.status, r.quantity - ${filled('r')} as open, ${pending('request_id', 'r')} as pending from requests r where r.id = $1`, [requestId]);
    if (r) {
      const to = requestStatus(String(r.status), Number(r.open), Boolean(r.pending));
      if (to !== r.status) await run(`update requests set status = $2 where id = $1`, [requestId, to]);
    }
  }
}
