// Spec matching between a buyer request and a seller listing.
// Pure function: hard requirements filter out a listing entirely;
// soft mismatches lower the score and are reported as gaps.

export type Listing = {
  category: string;
  oem: string;
  voltage_v: number;
  amps: number;
  kaic: number | null;
  enclosure: string | null;
  condition: string;
  quantity: number;
  location_state: string;
  available_date: string; // YYYY-MM-DD
  asking_price: number | null;
};

export type Request = {
  category: string;
  voltage_v: number;
  amps_min: number;
  kaic_min: number | null;
  enclosure: string | null;
  acceptable_oems: string[];
  conditions_ok: string[];
  quantity: number;
  site_state: string;
  need_by: string; // YYYY-MM-DD
  budget_max: number | null;
};

export type Gap = { severity: 'warn' | 'info'; text: string };
export type MatchResult = { ok: false; reason: string } | { ok: true; score: number; gaps: Gap[] };

export const MIN_SCORE = 40;

const REGIONS: Record<string, string> = {};
const regionList: [string, string[]][] = [
  ['northeast', ['ME', 'NH', 'VT', 'MA', 'RI', 'CT', 'NY', 'NJ', 'PA']],
  ['southeast', ['DE', 'MD', 'DC', 'VA', 'WV', 'NC', 'SC', 'GA', 'FL', 'KY', 'TN', 'AL', 'MS']],
  ['midwest', ['OH', 'MI', 'IN', 'IL', 'WI', 'MN', 'IA', 'MO', 'ND', 'SD', 'NE', 'KS']],
  ['south', ['TX', 'OK', 'AR', 'LA']],
  ['west', ['MT', 'WY', 'CO', 'NM', 'AZ', 'UT', 'NV', 'ID', 'WA', 'OR', 'CA', 'AK', 'HI']],
];
for (const [region, states] of regionList) for (const s of states) REGIONS[s] = region;

const day = (d: string) => Date.parse(d.slice(0, 10) + 'T00:00:00Z') / 86_400_000;
const norm = (s: string) => s.trim().toLowerCase();

export function matchListing(req: Request, lst: Listing): MatchResult {
  // Hard requirements
  if (norm(req.category) !== norm(lst.category)) return { ok: false, reason: 'different category' };
  if (req.voltage_v !== lst.voltage_v) return { ok: false, reason: `voltage ${lst.voltage_v} V, need ${req.voltage_v} V` };
  if (lst.amps < req.amps_min) return { ok: false, reason: `${lst.amps} A is below ${req.amps_min} A` };
  if (req.conditions_ok.length && !req.conditions_ok.includes(lst.condition))
    return { ok: false, reason: `condition ${lst.condition} not accepted` };

  let score = 100;
  const gaps: Gap[] = [];
  const pen = (n: number, text: string, severity: Gap['severity'] = 'warn') => {
    score -= n;
    gaps.push({ severity, text });
  };

  // Interrupting rating
  if (req.kaic_min != null) {
    if (lst.kaic == null) pen(10, 'Interrupting rating not stated; confirm kAIC from nameplate');
    else if (lst.kaic < req.kaic_min) pen(30, `Rated ${lst.kaic} kA, need ${req.kaic_min} kA; breaker swap or re-rating needed`);
  }

  // Schedule
  const slack = day(req.need_by) - day(lst.available_date);
  if (slack < 0) pen(Math.min(40, 15 + Math.round(-slack / 7) * 3), `Available ${-slack} days after the need-by date`);
  else gaps.push({ severity: 'info', text: `Available ${slack} days before the need-by date` });

  // Quantity
  if (lst.quantity < req.quantity) pen(20, `Only ${lst.quantity} of ${req.quantity} units`);

  // OEM preference
  if (req.acceptable_oems.length && !req.acceptable_oems.map(norm).includes(norm(lst.oem)))
    pen(15, `${lst.oem} is not on the acceptable OEM list`);

  // Enclosure
  if (req.enclosure && lst.enclosure && norm(req.enclosure) !== norm(lst.enclosure))
    pen(10, `Enclosure ${lst.enclosure}, need ${req.enclosure}`);
  else if (req.enclosure && !lst.enclosure) pen(5, 'Enclosure type not stated');

  // Oversize
  if (lst.amps > req.amps_min * 1.5) pen(5, `${lst.amps} A is well above the ${req.amps_min} A needed`, 'info');

  // Budget
  if (req.budget_max != null && lst.asking_price != null && lst.asking_price > req.budget_max)
    // Amount withheld on purpose: asking price is private until both sides sign the NDA.
    pen(15, 'Asking price is above your budget ceiling');

  // Freight distance
  if (lst.location_state !== req.site_state) {
    if (REGIONS[lst.location_state] && REGIONS[lst.location_state] === REGIONS[req.site_state])
      gaps.push({ severity: 'info', text: `Ships in-region from ${lst.location_state}` });
    else pen(5, `Cross-country freight from ${lst.location_state}`, 'info');
  } else gaps.push({ severity: 'info', text: `Same state (${lst.location_state})` });

  return { ok: true, score: Math.max(0, score), gaps };
}
