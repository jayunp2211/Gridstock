// What Gridstock has earned: the success fee on every deal that closed.
//
// The fee is a percentage of the agreed price, paid by the buyer and invoiced by hand, so these are
// fees that fell due. Nothing here knows whether an invoice was paid.

/** The time zone the founder keeps the books in. A month and a year start at midnight there. */
export const BOOKS_TZ = 'America/Toronto';

/** One closed deal: the month it closed in ('2026-11', in the books' time zone), its agreed price and its fee rate. */
export type Closing = { month: string; price: number; fee_pct: string | number };
export type Total = { fees: number; deals: number; value: number };
export type Earnings = { month: Total; year: Total; all: Total; byMonth: (Total & { month: string })[] };

/** The fee on one deal, in whole dollars, worked out the way the deal room shows it. */
export const feeOn = (price: number, pct: string | number) => Math.round((price * Number(pct)) / 100);

/**
 * Totals for the current month, the current year and all time, and one line for each month a deal closed in,
 * newest first. `thisMonth` is the current month as 'YYYY-MM' in the books' time zone.
 */
export function earnings(closings: Closing[], thisMonth: string): Earnings {
  const none = (): Total => ({ fees: 0, deals: 0, value: 0 });
  const out: Earnings = { month: none(), year: none(), all: none(), byMonth: [] };
  const months = new Map<string, Total>();
  const add = (t: Total, c: Closing) => { t.fees += feeOn(c.price, c.fee_pct); t.deals += 1; t.value += c.price; };
  for (const c of closings) {
    add(out.all, c);
    if (c.month.slice(0, 4) === thisMonth.slice(0, 4)) add(out.year, c);
    if (c.month === thisMonth) add(out.month, c);
    if (!months.has(c.month)) months.set(c.month, none());
    add(months.get(c.month)!, c);
  }
  out.byMonth = [...months].map(([month, t]) => ({ month, ...t })).sort((a, b) => b.month.localeCompare(a.month));
  return out;
}

/** 'November 2026' for '2026-11'. */
export const monthName = (ym: string) =>
  new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
