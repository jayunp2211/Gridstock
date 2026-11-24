import { Fragment } from 'react';
import { CATEGORIES, CONDITIONS, label, ratings, units, type Rated } from '@/lib/labels';
import type { Gap } from '@/lib/match';

type SpecSource = Rated & { enclosure?: string | null; condition?: string; quantity?: number; standard?: string | null };

/** Ratings as one line, spaced like a nameplate: 480 V  4,000 A  65 kAIC  NEMA 1, or 2,500 kVA  13.8 kV to 480 V for a transformer. */
/** A plain space sits between the parts so a screen reader or a copied line keeps them apart. */
/** `plain` drops the "or more" qualifier where a column header already says the rating is a minimum. */
export function Spec({ x, full, plain }: { x: SpecSource; full?: boolean; plain?: boolean }) {
  const parts = ratings(x, plain);
  if (x.enclosure) parts.push(x.enclosure);
  if (full && x.standard) parts.push(x.standard);
  if (full && x.condition) parts.push(label(CONDITIONS, x.condition));
  if (full && x.quantity != null) parts.push(units(x.quantity));
  return <div className="spec num" style={{ whiteSpace: 'normal' }}>{parts.map((p, i) => <Fragment key={p}>{i > 0 && ' '}<span>{p}</span></Fragment>)}</div>;
}

export function Fit({ value }: { value: number }) {
  return <div className="fit" aria-label={`Fit ${value} out of 100`}>{value}<small>fit out of 100</small></div>;
}

const STATE: Record<string, string> = {
  active: 'Listed', under_offer: 'Under offer', sold: 'Sold', withdrawn: 'Withdrawn', open: 'Open', in_deal: 'In a deal', closed: 'Closed',
};
export function State({ value }: { value: string }) {
  return <span className={`state ${['active', 'open'].includes(value) ? 'live' : ''}`}>{STATE[value] ?? value}</span>;
}

export function Checks({ gaps }: { gaps: Gap[] }) {
  return (
    <ul className="checks">
      {gaps.map((g, i) => (
        <li key={i} className={g.severity === 'warn' ? 'gap' : 'note'}>
          {g.severity === 'warn' ? (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M8 2.2 14.6 13.6H1.4z" strokeLinejoin="round" /><path d="M8 6.6v3.2M8 11.4v.4" strokeLinecap="square" /></svg>
          ) : (
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M5 5h6v6H5z" /></svg>
          )}
          <span>{g.text}</span>
        </li>
      ))}
    </ul>
  );
}

export function Arrow() {
  return <svg className="arrow" viewBox="0 0 18 12" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M0 6h16M11 1l5 5-5 5" /></svg>;
}

export const cat = (v: string) => label(CATEGORIES, v);
export const month = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
export const day = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
