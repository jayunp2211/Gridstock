export const CATEGORIES: [string, string][] = [
  ['switchgear', 'LV/MV switchgear'],
  ['switchboard', 'Switchboard'],
  ['breaker', 'Circuit breaker'],
  ['transformer', 'Transformer'],
  ['ups', 'UPS'],
  ['cdu', 'Coolant distribution unit'],
  ['chiller', 'Chiller'],
];
export const CONDITIONS: [string, string][] = [
  ['new_crated', 'New, in crate'],
  ['delivered_not_energized', 'Delivered, never energized'],
  ['used', 'Used'],
];
export const STAGES = ['nda', 'documents', 'offer', 'inspection', 'escrow', 'closed'] as const;
export const STAGE_LABEL: Record<string, string> = {
  nda: 'NDA', documents: 'Documents', offer: 'Offer', inspection: 'Inspection', escrow: 'Escrow', closed: 'Closed', lost: 'Lost',
};
export const STATES: [string, string][] = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'], ['CO', 'Colorado'],
  ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'],
  ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'],
  ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'],
  ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'],
  ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'],
  ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'],
  ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
];
/** Manufacturers offered as suggestions on the forms. Any name can still be typed. */
export const OEMS = ['ABB', 'Eaton', 'GE Vernova', 'Hitachi Energy', 'Mitsubishi Electric', 'Powell', 'Schneider Electric', 'Siemens', 'Toshiba', 'Trane', 'Vertiv'];

// Switchgear, switchboards and breakers are sized by rated current. These are sized by capacity instead,
// each in its own unit, and the unit follows from the category.
const CAPACITY_UNIT: Record<string, string> = { transformer: 'kVA', ups: 'kVA', cdu: 'kW', chiller: 'tons' };
export const capacityUnit = (category: string | undefined) =>
  (category && Object.hasOwn(CAPACITY_UNIT, category) ? CAPACITY_UNIT[category] : null);

export const label = (pairs: [string, string][], v: string) => pairs.find(p => p[0] === v)?.[1] ?? v;
// The category as a word inside a sentence, where "LV/MV switchgear" lower-cased would read "lv/mv" and "UPS" would read "ups".
const NOUN: Record<string, string> = {
  switchgear: 'switchgear', switchboard: 'switchboard', breaker: 'circuit breaker', transformer: 'transformer',
  ups: 'UPS', cdu: 'coolant distribution unit', chiller: 'chiller',
};
export const noun = (category: string) => (Object.hasOwn(NOUN, category) ? NOUN[category] : category);
export const money = (n: number | null | undefined) => (n == null ? '—' : '$' + Number(n).toLocaleString('en-US'));
/** 480 V, 13.8 kV */
export const volts = (v: number) => (v >= 1000 ? `${Number((v / 1000).toFixed(2))} kV` : `${v} V`);
export const units = (n: number) => `${n} ${n === 1 ? 'unit' : 'units'}`;

export type Rated = {
  category?: string; voltage_v: number; secondary_v?: number | null;
  amps?: number | null; amps_min?: number | null; capacity?: number | null; capacity_min?: number | null;
  kaic?: number | null; kaic_min?: number | null;
};
const n = (v: number) => v.toLocaleString('en-US');
/**
 * The ratings that define a piece of gear, most important first: "480 V", "4,000 A", "65 kAIC" for switchgear,
 * "2,500 kVA", "13.8 kV to 480 V" for a transformer. A request's ratings are minimums and say so unless `plain`.
 */
export function ratings(x: Rated, plain = false): string[] {
  const isNeed = x.amps_min !== undefined || x.capacity_min !== undefined;
  const more = isNeed && !plain ? ' or more' : '';
  const amps = isNeed ? x.amps_min : x.amps;
  const unit = capacityUnit(x.category);
  if (unit) {
    const cap = isNeed ? x.capacity_min : x.capacity;
    const parts = cap != null ? [`${n(cap)} ${unit}${more}`] : [];
    parts.push(x.secondary_v ? `${volts(x.voltage_v)} to ${volts(x.secondary_v)}` : volts(x.voltage_v));
    // Rows entered before capacity was recorded still carry a current.
    if (cap == null && amps != null) parts.push(`${n(amps)} A${more}`);
    return parts;
  }
  const parts = [volts(x.voltage_v)];
  if (amps != null) parts.push(`${n(amps)} A${more}`);
  const kaic = isNeed ? x.kaic_min : x.kaic;
  if (kaic) parts.push(`${kaic} kAIC${more}`);
  return parts;
}

/** What to tell someone when the server refuses a form field. Keyed by a code, so the page never echoes text from the URL. */
const FIELD_ERRORS: Record<string, string> = {
  category: 'Choose a category from the list.',
  oem: 'Enter the manufacturer, in 40 characters or fewer.',
  voltage: 'Enter the voltage in volts, for example 480, or 13800 for 13.8 kV.',
  amps: 'Enter the rated current in amps, between 1 and 20,000.',
  kaic: 'Enter the interrupting rating in kA, between 1 and 250, or leave it blank.',
  capacity: 'Enter the capacity as a whole number, in the unit shown next to the field.',
  secondary: 'Enter the secondary voltage in volts, for example 480.',
  quantity: 'Quantity must be between 1 and 500.',
  state: 'Choose a state from the list.',
  date: 'Enter a valid date.',
  need_by: 'The need-by date cannot be in the past.',
  price: 'Enter the amount in whole dollars, or leave it blank.',
  condition: 'Choose a condition from the list.',
  conditions_ok: 'Choose at least one acceptable condition.',
  text: 'One of the text fields is too long.',
  access: 'Enter your name, a work email address and your company.',
};
export const fieldError = (code: string) => (Object.hasOwn(FIELD_ERRORS, code) ? FIELD_ERRORS[code] : 'Check the form and try again.');
