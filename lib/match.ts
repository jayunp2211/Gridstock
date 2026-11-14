// Spec matching between a buyer request and a seller listing.
// Pure function: hard requirements filter out a listing entirely;
// soft mismatches lower the score and are reported as gaps.
//
// The score is a first screen on nameplate data, not an engineering review. It never sees
// price or budget: both stay private until the two sides have signed the NDA.
import { volts } from './labels.ts';

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

const REGION_LABEL: Record<string, string> = {
  northeast: 'Northeast', southeast: 'Southeast', midwest: 'Midwest', south: 'South Central', west: 'West',
};
/** Coarse region for public display, so a listing never reveals its state. */
export const regionOf = (state: string) => {
  const s = state.toUpperCase();
  return Object.hasOwn(REGIONS, s) ? REGION_LABEL[REGIONS[s]] : 'United States';
};

const day = (d: string) => Date.parse(d.slice(0, 10) + 'T00:00:00Z') / 86_400_000;
const norm = (s: string) => s.trim().toLowerCase();
const tight = (s: string) => norm(s).replace(/[\s.-]/g, '');

// Motor and packaged-equipment nameplates quote the utilization voltage (460 V) of a nominal system (480 V).
const UTILIZATION: Record<number, number> = { 200: 208, 220: 240, 230: 240, 440: 480, 460: 480, 550: 600, 575: 600 };
const nominal = (v: number) => UTILIZATION[v] ?? v;

// Medium-voltage gear is sold by class (15 kV) and applied on a system voltage inside it (12.47 or 13.8 kV).
const MV_CLASSES: [number, string][] = [[5_000, '5 kV'], [15_500, '15 kV'], [27_000, '27 kV'], [38_000, '38 kV']];
export function voltageClass(v: number): string {
  if (v <= 1_000) return 'low voltage';
  for (const [max, name] of MV_CLASSES) if (v <= max) return `${name} class`;
  return 'high voltage';
}

// The same maker under the names people actually type.
const OEM_FAMILY: Record<string, string> = {
  schneider: 'schneider electric', 'square d': 'schneider electric', squared: 'schneider electric',
  'cutler-hammer': 'eaton', 'cutler hammer': 'eaton',
  liebert: 'vertiv', ge: 'ge vernova', 'general electric': 'ge vernova', hitachi: 'hitachi energy',
  mitsubishi: 'mitsubishi electric',
};
const maker = (s: string) => (Object.hasOwn(OEM_FAMILY, norm(s)) ? OEM_FAMILY[norm(s)] : norm(s));

export function matchListing(req: Request, lst: Listing): MatchResult {
  let score = 100;
  const gaps: Gap[] = [];
  const pen = (n: number, text: string, severity: Gap['severity'] = 'warn') => {
    score -= n;
    gaps.push({ severity, text });
  };

  // Hard requirements
  if (norm(req.category) !== norm(lst.category)) return { ok: false, reason: 'different category' };

  const need = nominal(req.voltage_v), rated = nominal(lst.voltage_v);
  if (need !== rated) {
    const cls = voltageClass(need);
    const wrong = { ok: false as const, reason: `${volts(lst.voltage_v)} equipment, need ${volts(req.voltage_v)}` };
    if (cls !== voltageClass(rated) || cls === 'high voltage') return wrong;
    if (cls === 'low voltage') {
      if (rated < need) return wrong;
      pen(10, `Rated ${volts(lst.voltage_v)}, your system is ${volts(req.voltage_v)}; confirm control power, metering and trip settings`);
    } else {
      gaps.push({ severity: 'info', text: `Listed at ${volts(lst.voltage_v)}, you asked for ${volts(req.voltage_v)}; both are ${cls}, so confirm the rated maximum voltage` });
    }
  }

  if (lst.amps < req.amps_min) return { ok: false, reason: `${lst.amps} A is below ${req.amps_min} A` };
  if (req.conditions_ok.length && !req.conditions_ok.includes(lst.condition))
    return { ok: false, reason: `condition ${lst.condition} not accepted` };

  // Interrupting rating
  if (req.kaic_min != null) {
    if (lst.kaic == null) pen(10, 'Interrupting rating not stated; confirm kAIC from nameplate');
    else if (lst.kaic < req.kaic_min) pen(30, `Rated ${lst.kaic} kA, need ${req.kaic_min} kA; breaker swap or re-rating needed`);
  }

  // Schedule
  const slack = day(req.need_by) - day(lst.available_date);
  if (slack < 0) pen(Math.min(40, 15 + Math.round(-slack / 7) * 3), `Available ${-slack} ${-slack === 1 ? 'day' : 'days'} after the need-by date`);
  else gaps.push({ severity: 'info', text: `Available ${slack} ${slack === 1 ? 'day' : 'days'} before the need-by date` });

  // Quantity
  if (lst.quantity < req.quantity) pen(20, `Only ${lst.quantity} of ${req.quantity} units`);

  // OEM preference
  if (req.acceptable_oems.length && !req.acceptable_oems.map(maker).includes(maker(lst.oem)))
    pen(15, `${lst.oem} is not on the acceptable OEM list`);

  // Enclosure
  if (req.enclosure && lst.enclosure && tight(req.enclosure) !== tight(lst.enclosure))
    pen(10, `Enclosure ${lst.enclosure}, need ${req.enclosure}`);
  else if (req.enclosure && !lst.enclosure) pen(5, 'Enclosure type not stated');

  // Oversize
  if (lst.amps > req.amps_min * 1.5) pen(5, `${lst.amps} A is well above the ${req.amps_min} A needed`, 'info');

  // Freight distance
  if (lst.location_state !== req.site_state) {
    if (REGIONS[lst.location_state] && REGIONS[lst.location_state] === REGIONS[req.site_state])
      gaps.push({ severity: 'info', text: `Ships in-region from ${lst.location_state}` });
    else pen(5, `Cross-country freight from ${lst.location_state}`, 'info');
  } else gaps.push({ severity: 'info', text: `Same state (${lst.location_state})` });

  return { ok: true, score: Math.max(0, score), gaps };
}
