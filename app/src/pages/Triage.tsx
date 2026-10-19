import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, CardTitle, Icon, PageHeader, PriorityChip, PRIORITY_TEXT, f3, pct } from '../components/ui';
import { loadTestset, similar, type Similar, type TestRow } from '../lib/data';
import {
  MODEL, PRIORITY_NAME, VARIABLES, contributions, hourBand, levelLabel, logit, priority, referenceInputs, sigmoid,
  variable, type Inputs,
} from '../lib/model';
import { LOCATION_MAX, useStore } from '../lib/store';

const SECTIONS: { title: string; vars: string[] }[] = [
  { title: 'Road', vars: ['speed', 'road', 'junction', 'area'] },
  { title: 'Conditions', vars: ['light', 'weather', 'wind', 'surface'] },
  { title: 'What the caller reports', vars: ['vehicles', 'casualties', 'pedestrian', 'motorcycle', 'cycle', 'hgv', 'bus', 'overturned', 'offroad'] },
];

const pad = (n: number) => String(n).padStart(2, '0');
const listJoin = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
function nowParts() {
  const d = new Date();
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}
/** Weekend from a yyyy-mm-dd string, read as a calendar date (no time zone shift). */
function isWeekend(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 || day === 6;
}

function Choice({ v, value, onChange }: { v: string; value: string; onChange: (x: string) => void }) {
  const def = variable(v);
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-[13px] font-semibold">{def.label}</legend>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={def.label}>
        {def.levels.map((l) => (
          <button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={value === l.id}
            onClick={() => onChange(l.id)}
            className={`rounded border px-2.5 py-1.5 text-[13px] ${value === l.id ? 'border-navy bg-navy text-white' : 'border-line2 bg-card text-ink hover:border-navy/60'}`}
          >
            {l.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function Triage() {
  const { logCall } = useStore();
  const start = nowParts();
  const [date, setDate] = useState(start.date);
  const [time, setTime] = useState(start.time);
  const [location, setLocation] = useState('');
  const [answers, setAnswers] = useState<Inputs>(referenceInputs);
  const [rows, setRows] = useState<TestRow[] | null>(null);
  const [logged, setLogged] = useState<string | null>(null);

  useEffect(() => { loadTestset().then(setRows); }, []);

  const validTime = /^\d{2}:\d{2}$/.test(time);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const inputs: Inputs = useMemo(() => ({
    ...answers,
    hour: validTime ? hourBand(Number(time.slice(0, 2))) : answers.hour,
    weekend: validDate && isWeekend(date) ? 'yes' : 'no',
  }), [answers, time, date, validTime, validDate]);

  const z = logit(inputs);
  const p = sigmoid(z);
  const pr = priority(p);
  const ratio = p / MODEL.base_rate_train;
  const factors = contributions(inputs);
  const sim: Similar | null = useMemo(() => (rows ? similar(rows, inputs) : null), [rows, inputs]);
  const maxBeta = Math.max(1, ...factors.map((f) => Math.abs(f.beta)));

  const set = (v: string, x: string) => { setAnswers((a) => ({ ...a, [v]: x })); setLogged(null); };
  const reset = () => {
    const n = nowParts();
    setDate(n.date); setTime(n.time); setLocation(''); setAnswers(referenceInputs()); setLogged(null);
  };
  const submit = () => {
    if (!validTime || !validDate) return;
    const c = logCall(location, inputs);
    setLogged(c.id);
  };

  return (
    <>
      <PageHeader eyebrow="Call handler" title="New call" sub="Record what the caller reports. The estimate updates with every answer." />
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="card p-5">
            <CardTitle>Call</CardTitle>
            <div className="grid gap-4 sm:grid-cols-[1fr_150px_120px]">
              <div>
                <label htmlFor="loc" className="mb-1 block text-[13px] font-semibold">Location (as described by the caller)</label>
                <input id="loc" className="input" value={location} maxLength={LOCATION_MAX} placeholder="Road name or landmark"
                  onChange={(e) => { setLocation(e.target.value); setLogged(null); }} />
              </div>
              <div>
                <label htmlFor="date" className="mb-1 block text-[13px] font-semibold">Date</label>
                <input id="date" type="date" className="input" value={date} required onChange={(e) => { setDate(e.target.value); setLogged(null); }} />
              </div>
              <div>
                <label htmlFor="time" className="mb-1 block text-[13px] font-semibold">Time</label>
                <input id="time" type="time" className="input" value={time} required onChange={(e) => { setTime(e.target.value); setLogged(null); }} />
              </div>
            </div>
            <p className="mt-3 text-[12px] text-muted">
              Used by the model as: <span className="font-medium text-ink">{levelLabel('hour', inputs.hour)}</span>,{' '}
              <span className="font-medium text-ink">{levelLabel('weekend', inputs.weekend)}</span>.
              {!validTime || !validDate ? <span className="text-p1"> Enter a valid date and time.</span> : null}
            </p>
          </section>

          {SECTIONS.map((s) => (
            <section key={s.title} className="card p-5">
              <CardTitle>{s.title}</CardTitle>
              <div className="grid gap-5 md:grid-cols-2">
                {s.vars.map((v) => <Choice key={v} v={v} value={answers[v]} onChange={(x) => set(v, x)} />)}
              </div>
            </section>
          ))}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          <section className="card overflow-hidden">
            <div className="border-b border-line bg-sunk/60 px-5 py-3">
              <div className="eyebrow">Estimate</div>
              <div className="text-[13px] text-muted">Chance someone is killed or seriously injured</div>
            </div>
            <div className="p-5">
              <div className="flex items-baseline justify-between gap-3">
                <span className={`num text-[40px] font-medium leading-none ${PRIORITY_TEXT[pr]}`}>{pct(p)}</span>
                <PriorityChip p={pr} />
              </div>
              <p className="mt-2 text-[13px] text-muted">
                {ratio >= 1 ? `${ratio.toFixed(1)} times` : `${ratio.toFixed(2)} times`} the average call ({pct(MODEL.base_rate_train)}).
              </p>
              <div className="mt-4">
                <Bar value={p} max={0.8} color={pr === 1 ? 'bg-p1' : pr === 2 ? 'bg-p2' : 'bg-p3'} />
                <div className="relative mt-1 h-4 text-[11px] text-muted">
                  <span className="num absolute -translate-x-1/2" style={{ left: `${(MODEL.thresholds.p2 / 0.8) * 100}%` }}>P2 {pct(MODEL.thresholds.p2, 0)}</span>
                  <span className="num absolute -translate-x-1/2" style={{ left: `${(MODEL.thresholds.p1 / 0.8) * 100}%` }}>P1 {pct(MODEL.thresholds.p1, 0)}</span>
                </div>
              </div>
              <div className="mt-5 flex flex-col gap-2">
                <button type="button" className="btn-primary" onClick={submit} disabled={!validTime || !validDate}>
                  Log call as P{pr} {PRIORITY_NAME[pr]}
                </button>
                {logged && (
                  <p className="text-[13px] text-p3" role="status">
                    Logged as {logged}. <Link to="/queue" className="underline underline-offset-4">Open the queue</Link> or{' '}
                    <button type="button" className="underline underline-offset-4" onClick={reset}>start a new call</button>.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="card p-5">
            <CardTitle right={<span className="text-[12px] text-muted">Odds vs. reference</span>}>Why</CardTitle>
            {factors.length === 0 ? (
              <p className="text-muted">Every answer is at its reference level, so the estimate is the model's baseline.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {factors.slice(0, 7).map((f) => (
                  <li key={f.var}>
                    <div className="flex justify-between gap-2 text-[13px]">
                      <span><span className="text-muted">{variable(f.var).label}:</span> {levelLabel(f.var, f.level)}</span>
                      <span className={`num shrink-0 ${f.beta > 0 ? 'text-p1' : 'text-p3'}`}>×{f.or.toFixed(2)}</span>
                    </div>
                    <div className="mt-1 flex h-1.5">
                      <div className="flex w-1/2 justify-end">{f.beta < 0 && <div className="h-full rounded-l-sm bg-p3" style={{ width: `${(Math.abs(f.beta) / maxBeta) * 100}%` }} />}</div>
                      <div className="w-px bg-line2" />
                      <div className="w-1/2">{f.beta > 0 && <div className="h-full rounded-r-sm bg-p1" style={{ width: `${(f.beta / maxBeta) * 100}%` }} />}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {factors.length > 7 && <p className="mt-2 text-[12px] text-muted">and {factors.length - 7} smaller factors.</p>}
            <p className="mt-3 text-[12px] text-muted">×2.00 means the answer doubles the odds compared with the reference answer (the first option in each question).</p>
          </section>

          <section className="card p-5">
            <CardTitle>Real collisions like this</CardTitle>
            {!sim ? <p className="text-muted">Loading October to December 2015 collisions…</p> : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="num text-[24px] font-medium">{pct(sim.n ? sim.ksi / sim.n : 0)}</span>
                  <span className="text-[13px] text-muted">were fatal or serious</span>
                </div>
                <p className="mt-2 leading-6">
                  <span className="num font-medium">{sim.ksi}</span> of <span className="num font-medium">{sim.n.toLocaleString('en-IN')}</span> collisions
                  in Great Britain, October to December 2015{sim.fatal > 0 ? <>, including <span className="num font-medium">{sim.fatal}</span> fatal</> : null}.
                </p>
                <p className="mt-2 text-[12px] leading-5 text-muted">
                  Matched on {listJoin(sim.matchedOn.map((v) => variable(v).label.toLowerCase()))}. These months were not used to train the model.
                </p>
              </>
            )}
          </section>

          <details className="card p-5">
            <summary className="flex items-center justify-between font-bold">Calculation <Icon name="arrow" className="h-4 w-4 text-muted" /></summary>
            <div className="num mt-3 space-y-1 text-[12px] leading-5">
              <div className="flex justify-between"><span className="text-muted">intercept</span><span>{f3(MODEL.intercept)}</span></div>
              {VARIABLES.map((v) => {
                const f = factors.find((x) => x.var === v.id);
                return f ? <div key={v.id} className="flex justify-between"><span className="text-muted">{v.id}={f.level}</span><span>{f.beta >= 0 ? '+' : '−'}{f3(Math.abs(f.beta))}</span></div> : null;
              })}
              <div className="flex justify-between border-t border-line pt-1 font-medium"><span>z</span><span>{f3(z)}</span></div>
              <div className="flex justify-between font-medium"><span>p = 1 / (1 + e^−z)</span><span>{p.toFixed(4)}</span></div>
            </div>
          </details>
        </aside>
      </div>
    </>
  );
}
