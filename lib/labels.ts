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

export const label = (pairs: [string, string][], v: string) => pairs.find(p => p[0] === v)?.[1] ?? v;
export const money = (n: number | null | undefined) => (n == null ? '—' : '$' + Number(n).toLocaleString('en-US'));
/** 480 V, 13.8 kV */
export const volts = (v: number) => (v >= 1000 ? `${Number((v / 1000).toFixed(2))} kV` : `${v} V`);
export const units = (n: number) => `${n} ${n === 1 ? 'unit' : 'units'}`;

/** What to tell someone when the server refuses a form field. Keyed by a code, so the page never echoes text from the URL. */
const FIELD_ERRORS: Record<string, string> = {
  category: 'Choose a category from the list.',
  oem: 'Enter the manufacturer, in 40 characters or fewer.',
  voltage: 'Enter the voltage in volts, for example 480, or 13800 for 13.8 kV.',
  amps: 'Enter the rated current in amps, between 1 and 20,000.',
  kaic: 'Enter the interrupting rating in kA, between 1 and 250, or leave it blank.',
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
