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
export const label = (pairs: [string, string][], v: string) => pairs.find(p => p[0] === v)?.[1] ?? v;
export const money = (n: number | null | undefined) => (n == null ? '—' : '$' + Number(n).toLocaleString('en-US'));
export const date = (d: string | Date | null) => (d == null ? '—' : new Date(d).toISOString().slice(0, 10));
export function specLine(x: { voltage_v: number; amps?: number; amps_min?: number; kaic?: number | null; kaic_min?: number | null; enclosure?: string | null }) {
  const amps = x.amps ?? x.amps_min;
  const kaic = x.kaic ?? x.kaic_min;
  return [`${x.voltage_v} V`, `${amps} A${x.amps_min != null ? ' min' : ''}`, kaic ? `${kaic} kAIC` : null, x.enclosure].filter(Boolean).join(' · ');
}
