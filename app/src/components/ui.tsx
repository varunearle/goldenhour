import type { ReactNode } from 'react';
import { PRIORITY_NAME, type Priority } from '../lib/model';

export const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
export const f2 = (x: number) => x.toFixed(2);
export const f3 = (x: number) => x.toFixed(3);
export const intl = (x: number) => x.toLocaleString('en-IN');

const dtf = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
export const when = (ms: number) => dtf.format(new Date(ms));
export const longDate = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

export const PRIORITY_TEXT: Record<Priority, string> = { 1: 'text-p1', 2: 'text-p2-text', 3: 'text-p3' };
export const PRIORITY_BG: Record<Priority, string> = { 1: 'bg-p1', 2: 'bg-p2', 3: 'bg-p3' };
const PRIORITY_CHIP: Record<Priority, string> = {
  1: 'border-p1/50 bg-p1-soft text-p1',
  2: 'border-p2/50 bg-p2-soft text-p2-text',
  3: 'border-p3/50 bg-p3-soft text-p3',
};

export function PriorityChip({ p, short }: { p: Priority; short?: boolean }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-sm border px-1.5 py-px font-mono text-[11px] font-medium leading-4 ${PRIORITY_CHIP[p]}`}>
      P{p}{short ? '' : ` ${PRIORITY_NAME[p]}`}
    </span>
  );
}

export const OUTCOME_LABEL = ['Slight', 'Serious', 'Fatal'] as const;
export function OutcomeChip({ outcome }: { outcome: 0 | 1 | 2 }) {
  const cls = outcome === 0 ? 'border-line2 bg-sunk text-muted' : 'border-p1/50 bg-p1-soft text-p1';
  return <span className={`inline-flex whitespace-nowrap rounded-sm border px-1.5 py-px font-mono text-[11px] leading-4 ${cls}`}>{OUTCOME_LABEL[outcome]}</span>;
}

export function PageHeader({ eyebrow, title, sub, right }: { eyebrow?: string; title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-line pb-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h1 className="text-[26px] font-bold leading-8 tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function CardTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-line pb-3">
      <h2 className="text-[16px] font-bold">{children}</h2>
      {right}
    </div>
  );
}

/** Horizontal bar with an optional reference mark. */
export function Bar({ value, max = 1, color = 'bg-navy', mark }: { value: number; max?: number; color?: string; mark?: number }) {
  const w = Math.max(0, Math.min(1, value / max)) * 100;
  return (
    <div className="relative h-2 w-full rounded-sm bg-sunk">
      <div className={`h-full rounded-sm ${color}`} style={{ width: `${w}%` }} />
      {mark !== undefined && <div className="absolute -top-1 -bottom-1 w-px bg-ink/60" style={{ left: `${(mark / max) * 100}%` }} />}
    </div>
  );
}

// ---------------------------------------------------------------- icons (1.6px stroke)
const paths: Record<string, ReactNode> = {
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h1M4 12h1M4 18h1" /></>,
  map: <><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></>,
  model: <><path d="M4 20V4" /><path d="M4 20h16" /><path d="M7 16l4-5 3 3 5-7" /></>,
  settings: <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>,
  out: <><path d="M14 4h5v16h-5" /><path d="M10 8l-4 4 4 4M6 12h10" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  cross: <path d="M6 6l12 12M18 6L6 18" />,
  download: <><path d="M12 4v11M7 10l5 5 5-5" /><path d="M5 20h14" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  play: <path d="M7 5v14l11-7z" />,
};
export function Icon({ name, className = 'h-[18px] w-[18px]' }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {paths[name]}
    </svg>
  );
}
