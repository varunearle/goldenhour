import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CardTitle, Icon, OutcomeChip, PageHeader, PriorityChip, longDate, pct, when } from '../components/ui';
import { downloadCsv } from '../lib/csv';
import { loadBirmingham, type BCollision } from '../lib/data';
import { decode, levelLabel, priority, probability, type Inputs, type Priority } from '../lib/model';
import { useStore, type CallStatus } from '../lib/store';

/** Short description of the answers that differ from the usual case. */
export function summary(i: Inputs): string {
  const parts: string[] = [];
  if (i.pedestrian === 'yes') parts.push('pedestrian hit');
  if (i.motorcycle === 'yes') parts.push('motorcycle');
  if (i.cycle === 'yes') parts.push('bicycle');
  if (i.hgv === 'yes') parts.push('goods vehicle');
  if (i.bus === 'yes') parts.push('bus');
  if (i.overturned === 'yes') parts.push('overturned');
  if (i.offroad === 'yes') parts.push('left the road');
  parts.push(`${levelLabel('speed', i.speed)}`);
  if (i.light !== 'daylight') parts.push(levelLabel('light', i.light).toLowerCase());
  parts.push(`${levelLabel('casualties', i.casualties)} hurt`);
  return parts.join(' · ');
}

const STATUS_LABEL: Record<CallStatus, string> = { waiting: 'Waiting', dispatched: 'Dispatched', closed: 'Closed' };

function Logged() {
  const { data, setStatus } = useStore();
  const [showClosed, setShowClosed] = useState(false);
  const rows = useMemo(() => data.calls
    .map((c) => ({ c, p: probability(c.inputs) }))
    .filter((r) => showClosed || r.c.status !== 'closed')
    .sort((a, b) => {
      const s = (x: CallStatus) => (x === 'waiting' ? 0 : x === 'dispatched' ? 1 : 2);
      return s(a.c.status) - s(b.c.status) || priority(a.p) - priority(b.p) || b.p - a.p || a.c.at - b.c.at;
    }), [data.calls, showClosed]);

  const exportCsv = () => downloadCsv('golden-hour-calls.csv',
    ['call', 'logged', 'location', 'priority', 'risk', 'status', 'details'],
    data.calls.map((c) => {
      const p = probability(c.inputs);
      return [c.id, new Date(c.at).toISOString(), c.location, `P${priority(p)}`, Number(p.toFixed(4)), c.status, summary(c.inputs)];
    }));

  return (
    <section className="card p-5">
      <CardTitle right={
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[13px] text-muted">
            <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> Show closed
          </label>
          <button type="button" className="btn-quiet px-3! py-1! text-[13px]" onClick={exportCsv} disabled={!data.calls.length}>
            <Icon name="download" className="h-4 w-4" /> CSV
          </button>
        </div>
      }>Logged calls</CardTitle>
      {rows.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-muted">{data.calls.length ? 'All calls are closed.' : 'No calls logged yet.'}</p>
          <Link to="/triage" className="btn-primary mt-4">Take a new call</Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
                <th className="px-2 py-2 font-medium">Priority</th>
                <th className="px-2 py-2 text-right font-medium">Risk</th>
                <th className="px-2 py-2 font-medium">Logged</th>
                <th className="px-2 py-2 font-medium">Location and details</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ c, p }) => (
                <tr key={c.id} className={c.status === 'closed' ? 'text-muted' : ''}>
                  <td className="px-2 py-2.5"><PriorityChip p={priority(p)} /></td>
                  <td className="num px-2 py-2.5 text-right">{pct(p)}</td>
                  <td className="num whitespace-nowrap px-2 py-2.5 text-muted">{when(c.at)}</td>
                  <td className="px-2 py-2.5">
                    <div className="font-medium">{c.location || <span className="text-muted">No location given</span>}</div>
                    <div className="text-[12px] text-muted">{summary(c.inputs)}</div>
                  </td>
                  <td className="px-2 py-2.5">{STATUS_LABEL[c.status]}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right">
                    {c.status === 'waiting' && <button type="button" className="btn-primary px-3! py-1! text-[12px]" onClick={() => setStatus(c.id, 'dispatched')}>Dispatch</button>}
                    {c.status === 'dispatched' && <button type="button" className="btn-quiet px-3! py-1! text-[12px]" onClick={() => setStatus(c.id, 'closed')}>Close</button>}
                    {c.status === 'closed' && <button type="button" className="text-[12px] text-muted underline underline-offset-4" onClick={() => setStatus(c.id, 'waiting')}>Reopen</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Replay() {
  const [all, setAll] = useState<BCollision[] | null>(null);
  const [day, setDay] = useState('');
  useEffect(() => {
    loadBirmingham().then((b) => {
      const test = b.collisions.filter((c) => c.date >= '2015-10-01');
      setAll(test);
      const counts = new Map<string, number>();
      test.forEach((c) => counts.set(c.date, (counts.get(c.date) ?? 0) + 1));
      setDay([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]);
    });
  }, []);

  const days = useMemo(() => {
    if (!all) return [];
    const m = new Map<string, number>();
    all.forEach((c) => m.set(c.date, (m.get(c.date) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [all]);

  const calls = useMemo(() => (all ?? [])
    .filter((c) => c.date === day)
    .map((c) => {
      const inputs = decode(c.x);
      const p = probability(inputs);
      return { c, inputs, p, pr: priority(p), outcome: (c.sev === 1 ? 2 : c.sev === 2 ? 1 : 0) as 0 | 1 | 2 };
    })
    .sort((a, b) => a.c.time.localeCompare(b.c.time)), [all, day]);

  const byBand = ([1, 2, 3] as Priority[]).map((b) => {
    const r = calls.filter((x) => x.pr === b);
    return { b, n: r.length, ksi: r.filter((x) => x.outcome > 0).length };
  });
  const ksiTotal = calls.filter((x) => x.outcome > 0).length;

  if (!all) return <section className="card p-5"><p className="text-muted">Loading Birmingham collisions…</p></section>;
  return (
    <section className="card p-5">
      <CardTitle right={
        <label className="flex items-center gap-2 text-[13px]">
          <span className="text-muted">Day</span>
          <select className="input w-auto! py-1!" value={day} onChange={(e) => setDay(e.target.value)}>
            {days.map(([d, n]) => <option key={d} value={d}>{d} ({n})</option>)}
          </select>
        </label>
      }>Replay a real day in Birmingham</CardTitle>
      <p className="mb-4 max-w-3xl text-[13px] text-muted">
        Every injury collision police recorded in Birmingham on {longDate(day)}, in time order, with the priority the model gives from
        what a caller could report. The recorded outcome on the right was not known at the time of the call. October to December 2015 was
        not used to train the model.
      </p>
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {byBand.map(({ b, n, ksi }) => (
          <div key={b} className="rounded border border-line bg-sunk/50 p-3">
            <PriorityChip p={b} />
            <div className="num mt-2 text-[20px] font-medium">{n} <span className="text-[13px] text-muted">{n === 1 ? 'call' : 'calls'}</span></div>
            <div className="text-[12px] text-muted">{ksi} fatal or serious</div>
          </div>
        ))}
        <div className="rounded border border-line bg-sunk/50 p-3">
          <span className="eyebrow">Total</span>
          <div className="num mt-2 text-[20px] font-medium">{calls.length} <span className="text-[13px] text-muted">{calls.length === 1 ? 'call' : 'calls'}</span></div>
          <div className="text-[12px] text-muted">{ksiTotal} fatal or serious</div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
              <th className="px-2 py-2 font-medium">Time</th>
              <th className="px-2 py-2 font-medium">Priority</th>
              <th className="px-2 py-2 text-right font-medium">Risk</th>
              <th className="px-2 py-2 font-medium">Road and details</th>
              <th className="px-2 py-2 font-medium">Recorded outcome</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {calls.map(({ c, inputs, p, pr, outcome }) => (
              <tr key={c.id}>
                <td className="num px-2 py-2.5">{c.time}</td>
                <td className="px-2 py-2.5"><PriorityChip p={pr} /></td>
                <td className="num px-2 py-2.5 text-right">{pct(p)}</td>
                <td className="px-2 py-2.5">
                  <div className="font-medium">{c.road}</div>
                  <div className="text-[12px] text-muted">{summary(inputs)}</div>
                </td>
                <td className="px-2 py-2.5"><OutcomeChip outcome={outcome} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-muted">Source: STATS19 2015, Birmingham local authority. Collision references are omitted.</p>
    </section>
  );
}

export default function Queue() {
  const [tab, setTab] = useState<'logged' | 'replay'>('logged');
  return (
    <>
      <PageHeader eyebrow="Call handler" title="Call queue" sub="Highest priority first. Risk is recalculated from the recorded answers." />
      <div className="mb-5 flex gap-1 border-b border-line" role="tablist">
        {([['logged', 'Logged calls'], ['replay', 'Replay a real day']] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-3 py-2 font-semibold ${tab === id ? 'border-navy text-navy' : 'border-transparent text-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'logged' ? <Logged /> : <Replay />}
    </>
  );
}
