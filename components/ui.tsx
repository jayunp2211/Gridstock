import { CATEGORIES, CONDITIONS, label } from '@/lib/labels';

type SpecSource = {
  voltage_v: number; amps?: number; amps_min?: number; kaic?: number | null; kaic_min?: number | null;
  enclosure?: string | null; condition?: string; quantity?: number; standard?: string | null;
};

export function Specs({ x, extra }: { x: SpecSource; extra?: [string, string][] }) {
  const amps = x.amps ?? x.amps_min;
  const kaic = x.kaic ?? x.kaic_min;
  const min = x.amps_min != null;
  const items: [string, string][] = [
    ['V', x.voltage_v.toLocaleString('en-US')],
    [min ? 'A min' : 'A', (amps ?? 0).toLocaleString('en-US')],
  ];
  if (kaic) items.push([min ? 'kAIC min' : 'kAIC', String(kaic)]);
  if (x.enclosure) items.push(['Encl', x.enclosure]);
  if (x.standard) items.push(['Std', x.standard]);
  if (x.quantity != null) items.push(['Qty', String(x.quantity)]);
  if (x.condition) items.push(['Cond', label(CONDITIONS, x.condition)]);
  if (extra) items.push(...extra);
  return (
    <div className="specs">
      {items.map(([k, v]) => <span key={k} className="spec"><b>{k}</b>{v}</span>)}
    </div>
  );
}

export function Score({ value }: { value: number }) {
  const tone = value >= 80 ? '' : value >= 60 ? 'mid' : 'lo';
  return (
    <div className="score-wrap">
      <div className={`score ${tone}`} style={{ ['--p' as string]: value }} role="img" aria-label={`Fit score ${value} out of 100`}>
        <span>{value}</span><small>fit</small>
      </div>
    </div>
  );
}

export function Status({ value }: { value: string }) {
  const live = ['active', 'open'].includes(value);
  return <span className={`pill dot ${live ? 'good' : ''}`}>{value.replace(/_/g, ' ')}</span>;
}

export const cat = (v: string) => label(CATEGORIES, v);

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <rect width="28" height="28" rx="7" fill="#f2a900" />
      <path d="M7 9.5h14M7 14h14M7 18.5h14M11 6v16M17 6v16" stroke="#1a1400" strokeWidth="1.6" strokeLinecap="round" opacity=".35" />
      <path d="M15.6 5.5 9.5 15h4.2l-1.3 7.5 6.1-9.5h-4.2z" fill="#1a1400" />
    </svg>
  );
}
