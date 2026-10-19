import { Fragment, useState, type ReactNode } from 'react';
import { CardTitle, PageHeader, PriorityChip, f3, intl, pct } from '../components/ui';
import { loadTestset } from '../lib/data';
import { MODEL, VARIABLES, auc, coefficient, decode, priority, probability, type Priority } from '../lib/model';

function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center gap-3 border-b border-line pb-2">
        <span className="num rounded-sm bg-navy px-1.5 py-0.5 text-[11px] text-white">{n}</span>
        <h2 className="text-[20px] font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

const ev = MODEL.evaluation;
const d = MODEL.data;

/** Odds ratios on a log scale from 0.25 to 8. */
const LO = Math.log(0.25);
const HI = Math.log(8);
const xpos = (or: number) => ((Math.log(Math.min(8, Math.max(0.25, or))) - LO) / (HI - LO)) * 100;

function Forest() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
            <th className="w-[38%] py-2 font-medium">Answer (compared with the reference)</th>
            <th className="w-[14%] py-2 text-right font-medium">Odds ratio</th>
            <th className="w-[16%] py-2 text-right font-medium">95% interval</th>
            <th className="py-2 pl-4 font-medium">
              <div className="relative h-4">
                {[0.25, 0.5, 1, 2, 4, 8].map((t) => (
                  <span key={t} className="num absolute -translate-x-1/2 text-[10px]" style={{ left: `${xpos(t)}%` }}>{t}</span>
                ))}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {VARIABLES.map((v) => (
            <Fragment key={v.id}>
              <tr className="border-t border-line">
                <td colSpan={4} className="pt-3 pb-1 font-semibold">
                  {v.label} <span className="font-normal text-muted">· reference: {v.levels[0].label}</span>
                </td>
              </tr>
              {v.levels.slice(1).map((l) => {
                const c = coefficient(v.id, l.id)!;
                const up = c.or > 1;
                return (
                  <tr key={`${v.id}-${l.id}`}>
                    <td className="py-1 pl-3 text-muted">{l.label}</td>
                    <td className={`num py-1 text-right ${c.or_low > 1 ? 'text-p1' : c.or_high < 1 ? 'text-p3' : ''}`}>{c.or.toFixed(2)}</td>
                    <td className="num py-1 text-right text-muted">{c.or_low.toFixed(2)} to {c.or_high.toFixed(2)}</td>
                    <td className="py-1 pl-4">
                      <div className="relative h-3">
                        <div className="absolute top-0 bottom-0 w-px bg-line2" style={{ left: `${xpos(1)}%` }} />
                        <div className={`absolute top-1/2 h-[2px] -translate-y-1/2 ${up ? 'bg-p1/60' : 'bg-p3/60'}`}
                          style={{ left: `${xpos(c.or_low)}%`, width: `${Math.max(0.5, xpos(c.or_high) - xpos(c.or_low))}%` }} />
                        <div className={`absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ${up ? 'bg-p1' : 'bg-p3'}`} style={{ left: `${xpos(c.or)}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Calibration() {
  const W = 360, H = 260, L = 48, B = 36, T = 12, R = 12;
  const max = 0.5;
  const x = (v: number) => L + (v / max) * (W - L - R);
  const y = (v: number) => H - B - (v / max) * (H - B - T);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Calibration: predicted against observed rate of fatal or serious collisions in ten groups">
      {[0, 0.1, 0.2, 0.3, 0.4, 0.5].map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#E3E6E8" />
          <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#59616A" fontFamily="JetBrains Mono, monospace">{(t * 100).toFixed(0)}%</text>
          <text x={x(t)} y={H - B + 16} textAnchor="middle" fontSize="10" fill="#59616A" fontFamily="JetBrains Mono, monospace">{(t * 100).toFixed(0)}%</text>
        </g>
      ))}
      <line x1={x(0)} y1={y(0)} x2={x(max)} y2={y(max)} stroke="#848C94" strokeDasharray="4 4" />
      <polyline fill="none" stroke="#173B5C" strokeWidth={2} points={ev.calibration.map((c) => `${x(c.predicted)},${y(c.observed)}`).join(' ')} />
      {ev.calibration.map((c, i) => <circle key={i} cx={x(c.predicted)} cy={y(c.observed)} r={4} fill="#173B5C" />)}
      <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" fontSize="11" fill="#15191E">Predicted</text>
      <text x={12} y={(T + H - B) / 2} textAnchor="middle" fontSize="11" fill="#15191E" transform={`rotate(-90 12 ${(T + H - B) / 2})`}>Observed</text>
    </svg>
  );
}

function Recompute() {
  const [state, setState] = useState<'idle' | 'running' | { auc: number; n: number; maxDiff: number; bands: { b: Priority; n: number; ksi: number }[] }>('idle');
  const run = async () => {
    setState('running');
    const rows = await loadTestset();
    await new Promise((r) => setTimeout(r, 20));
    const scores = rows.map((r) => probability(decode(r.codes)));
    const labels = rows.map((r) => (r.outcome >= 1 ? 1 : 0));
    const maxDiff = Math.max(...MODEL.check.map((c) => Math.abs(scores[c.row] - c.p)));
    const bands = ([1, 2, 3] as Priority[]).map((b) => {
      const idx = scores.map((s, i) => [s, i] as const).filter(([s]) => priority(s) === b);
      return { b, n: idx.length, ksi: idx.filter(([, i]) => labels[i] === 1).length };
    });
    setState({ auc: auc(scores, labels), n: rows.length, maxDiff, bands });
  };
  return (
    <div className="card p-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div className="max-w-2xl">
          <h3 className="font-bold">Check it in this browser</h3>
          <p className="mt-1 text-[13px] text-muted">
            Recomputes every test-set prediction with the coefficients this app uses, then the AUC and the priority bands. The result should match the
            numbers above, which came from the Python training script.
          </p>
        </div>
        <button type="button" className="btn-primary shrink-0" onClick={run} disabled={state === 'running'}>
          {state === 'running' ? 'Computing…' : 'Recompute on test set'}
        </button>
      </div>
      {typeof state === 'object' && (
        <div className="mt-4 grid gap-3 border-t border-line pt-4 text-[13px] md:grid-cols-3">
          <div><div className="text-muted">Collisions scored</div><div className="num text-[18px] font-medium">{intl(state.n)}</div></div>
          <div><div className="text-muted">AUC in this browser</div><div className="num text-[18px] font-medium">{f3(state.auc)} <span className="text-[13px] text-muted">(Python {f3(ev.logistic.auc)})</span></div></div>
          <div><div className="text-muted">Largest difference from Python's probabilities</div><div className="num text-[18px] font-medium">{state.maxDiff.toExponential(1)}</div></div>
          <div className="md:col-span-3">
            <div className="text-muted">Bands in this browser</div>
            <div className="num mt-1 flex flex-wrap gap-4">
              {state.bands.map((x) => <span key={x.b}>P{x.b}: {intl(x.n)} calls, {intl(x.ksi)} fatal or serious</span>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Model() {
  const rows: [string, { auc: number; ap: number; brier: number }, string][] = [
    ['Base rate (no model)', ev.base_rate, 'Every call gets the same risk'],
    ['Logistic regression (used here)', ev.logistic, 'Explainable; every coefficient shown below'],
    ['Gradient boosted trees', ev.gbm, 'Reference only; not explainable per factor'],
  ];
  return (
    <div className="pb-6">
      <PageHeader eyebrow="How it works" title="The severity model"
        sub="Predicts, from what a caller can report, the chance that a road collision has killed or seriously injured someone." />

      <Section n="01" title="What it predicts and how">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5 leading-6">
            <p>
              <span className="font-semibold">Target.</span> Whether a police-recorded injury collision was fatal or serious (KSI), which is when a
              fast ambulance matters most. Slight-injury collisions are the other class.
            </p>
            <p className="mt-3">
              <span className="font-semibold">Inputs.</span> {VARIABLES.length} answers a call handler can get from a caller: time and day, road and
              speed limit, light and weather, how many vehicles and people, and whether a pedestrian, motorcycle, bicycle, goods vehicle or bus was
              involved, or a vehicle overturned or left the road.
            </p>
            <p className="mt-3">
              <span className="font-semibold">Technique.</span> Logistic regression fitted by maximum likelihood on {intl(d.train.collisions)} collisions
              ({d.train.months}). Each answer adds a fixed amount to the log-odds, so every estimate can be explained answer by answer.
            </p>
          </div>
          <div className="card p-5">
            <div className="num rounded border border-line bg-sunk/60 p-4 text-[13px] leading-6">
              z = {f3(MODEL.intercept)} + β(answer 1) + β(answer 2) + …<br />
              P(fatal or serious) = 1 / (1 + e<sup>−z</sup>)
            </div>
            <p className="mt-3 text-[13px] text-muted">
              With every answer at its reference level the estimate is {pct(1 / (1 + Math.exp(-MODEL.intercept)))}. Priority bands use cut-offs set on the
              training months so that about 10% of calls are P1 and 25% are P2:
            </p>
            <div className="mt-3 flex flex-col gap-2 text-[13px]">
              <div className="flex items-center gap-3"><PriorityChip p={1} /><span className="num">risk ≥ {pct(MODEL.thresholds.p1)}</span></div>
              <div className="flex items-center gap-3"><PriorityChip p={2} /><span className="num">{pct(MODEL.thresholds.p2)} to {pct(MODEL.thresholds.p1)}</span></div>
              <div className="flex items-center gap-3"><PriorityChip p={3} /><span className="num">below {pct(MODEL.thresholds.p2)}</span></div>
            </div>
          </div>
        </div>
      </Section>

      <Section n="02" title="What makes a collision more likely to be serious">
        <div className="card p-5">
          <p className="mb-4 max-w-3xl text-[13px] text-muted">
            Odds ratios from the fitted model. Above 1 raises the odds of a fatal or serious outcome, below 1 lowers them, each compared with the
            reference answer and with all other answers held equal. Coloured values have a 95% interval that does not include 1.
          </p>
          <Forest />
        </div>
      </Section>

      <Section n="03" title="How well it works on months it never saw">
        <p className="mb-4 max-w-3xl leading-6">
          Tested on all {intl(d.test.collisions)} collisions of {d.test.months} ({intl(d.test.ksi)} fatal or serious), which were held back from training.
        </p>
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="card p-5">
            <CardTitle>Model comparison</CardTitle>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="py-2 font-medium">Model</th>
                  <th className="py-2 text-right font-medium">AUC</th>
                  <th className="py-2 text-right font-medium">Avg precision</th>
                  <th className="py-2 text-right font-medium">Brier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(([name, m, note], i) => (
                  <tr key={name} className={i === 1 ? 'font-semibold' : ''}>
                    <td className="py-2.5 pr-2">{name}<div className="text-[12px] font-normal text-muted">{note}</div></td>
                    <td className="num py-2.5 text-right">{f3(m.auc)}</td>
                    <td className="num py-2.5 text-right">{f3(m.ap)}</td>
                    <td className="num py-2.5 text-right">{m.brier.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[12px] text-muted">
              AUC: chance a random fatal or serious collision scores higher than a random slight one (0.5 is chance). Average precision rewards
              ranking serious collisions first. Brier: mean squared error of the probabilities (lower is better).
            </p>
            <div className="mt-4 rounded border border-line bg-sunk/60 p-4 text-[13px] leading-6">
              <span className="font-semibold">Against a simple rule.</span> Flagging every call on a 60 or 70 mph road, or involving a pedestrian or
              motorcycle, flags {pct(ev.rule.flagged_share)} of calls and catches {pct(ev.rule.share_ksi)} of fatal or serious collisions. Flagging the
              same share of calls by model risk catches <span className="font-semibold">{pct(ev.logistic_same_flag_rate.share_ksi)}</span>.
            </div>
          </div>
          <div className="card p-5">
            <CardTitle>Calibration</CardTitle>
            <Calibration />
            <p className="mt-2 text-[12px] text-muted">Ten equal groups of test calls by predicted risk. Points near the dashed line mean the stated risk matches what happened.</p>
          </div>
        </div>

        <div className="card mt-4 p-5">
          <CardTitle>Priority bands on the test months</CardTitle>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="py-2 font-medium">Band</th>
                <th className="py-2 text-right font-medium">Calls</th>
                <th className="py-2 text-right font-medium">Share of calls</th>
                <th className="py-2 text-right font-medium">Fatal or serious in band</th>
                <th className="py-2 text-right font-medium">Share of all fatal or serious</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ev.bands.map((b) => (
                <tr key={b.band}>
                  <td className="py-2.5"><PriorityChip p={b.band as Priority} /></td>
                  <td className="num py-2.5 text-right">{intl(b.calls)}</td>
                  <td className="num py-2.5 text-right">{pct(b.share_calls)}</td>
                  <td className="num py-2.5 text-right">{intl(b.ksi)} ({pct(b.ksi_rate)})</td>
                  <td className="num py-2.5 text-right">{pct(b.share_ksi)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[13px] text-muted">
            P1 calls were fatal or serious {(ev.bands[0].ksi_rate / (d.test.ksi / d.test.collisions)).toFixed(1)} times as often as the average test call.
            P1 and P2 together hold {pct(ev.bands[0].share_calls + ev.bands[1].share_calls)} of calls and {pct(ev.bands[0].share_ksi + ev.bands[1].share_ksi)} of
            fatal or serious collisions.
          </p>
        </div>
        <div className="mt-4"><Recompute /></div>
      </Section>

      <Section n="04" title="Data">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5 text-[13px] leading-6">
            <p><span className="font-semibold">Source.</span> {d.source}. Every injury collision on a public road in Great Britain that police recorded in 2015, with its vehicles and casualties.</p>
            <p className="mt-2"><span className="font-semibold">Checked against the official totals.</span> The files contain {intl(d.collisions)} collisions,{' '}
              {intl(d.killed)} people killed, {intl(d.serious)} seriously injured and {intl(d.casualties)} casualties in all, the figures the Department for Transport
              published for 2015.</p>
            <p className="mt-2"><span className="font-semibold">Prepared.</span> {d.dropped_no_time} collisions without a recorded time were left out, leaving{' '}
              {intl(d.used)}. Codes were translated with the official data guide. Training: {d.train.months}; test: {d.test.months}.</p>
            <p className="mt-2"><span className="font-semibold">Licence.</span> Contains public sector information licensed under the {d.licence}.</p>
          </div>
          <div className="card p-5 text-[13px]">
            <div className="mb-2 font-semibold">SHA-256 of the files used</div>
            <dl className="num space-y-2 text-[11px] break-all text-muted">
              {Object.entries(d.sha256).map(([f, h]) => <div key={f}><dt className="font-medium text-ink">{f}</dt><dd>{h}</dd></div>)}
            </dl>
            <p className="mt-3 text-[12px] text-muted">Fit: {MODEL.fit.method}, {MODEL.fit.parameters} parameters, McFadden pseudo R² {MODEL.fit.pseudo_r2}.</p>
          </div>
        </div>
      </Section>

      <Section n="05" title="Limitations">
        <ul className="card list-disc space-y-2 p-5 pl-9 leading-6 marker:text-faint">
          <li>Only collisions where someone was injured and police recorded it are in the data, so the model cannot tell a damage-only crash from an injury crash.</li>
          <li>Callers can be wrong or unsure; the model takes their answers as given.</li>
          <li>
            Each answer adds its effect independently, so rare dangerous combinations are underestimated. For a pedestrian hit on a 60 mph road in the
            dark the model gives about one in four, while a much larger share of the matching real collisions were fatal or serious. This is why the call
            screen also shows similar real collisions.
          </li>
          <li>Even in P1, {pct(1 - ev.bands[0].ksi_rate, 0)} of test calls were not fatal or serious. The model ranks calls; it does not diagnose.</li>
          <li>Trained on Great Britain in 2015. Roads, vehicles and reporting differ in India and have changed since, so it would need retraining on local data before real use.</li>
          <li>It supports a trained call handler and never replaces their judgement or the clinical triage protocol.</li>
        </ul>
        <p className="mt-4 text-[12px] leading-5 text-muted">
          References: Department for Transport, Road Safety Data (STATS19), 2015, and Reported Road Casualties Great Britain: Annual Report 2015.
          D. W. Hosmer, S. Lemeshow and R. X. Sturdivant, Applied Logistic Regression, 3rd ed., Wiley, 2013.
        </p>
      </Section>
    </div>
  );
}
