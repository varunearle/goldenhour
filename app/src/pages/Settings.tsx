import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CardTitle, Icon, PageHeader } from '../components/ui';
import { downloadCsv } from '../lib/csv';
import { priority, probability } from '../lib/model';
import { NAME_MAX, useStore } from '../lib/store';
import { summary } from './Queue';

export default function Settings() {
  const { data, role, setNames, clearCalls, resetAll } = useStore();
  const [handler, setHandler] = useState(data.handlerName);
  const [planner, setPlanner] = useState(data.plannerName);
  const [saved, setSaved] = useState(false);

  const save = () => { setNames(handler, planner); setSaved(true); setTimeout(() => setSaved(false), 2000); };
  const exportCalls = () => downloadCsv('golden-hour-calls.csv', ['call', 'logged', 'location', 'priority', 'risk', 'status', 'details'],
    data.calls.map((c) => {
      const p = probability(c.inputs);
      return [c.id, new Date(c.at).toISOString(), c.location, `P${priority(p)}`, Number(p.toFixed(4)), c.status, summary(c.inputs)];
    }));
  const confirmThen = (msg: string, fn: () => void) => () => { if (window.confirm(msg)) fn(); };

  return (
    <>
      <PageHeader title="Settings" sub={`Signed in as the ${role === 'planner' ? 'planner' : 'call handler'} account`} />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <CardTitle>Names shown in the app</CardTitle>
          <div className="space-y-4">
            <div>
              <label htmlFor="hn" className="mb-1 block text-[13px] font-semibold">Call handler</label>
              <input id="hn" className="input" value={handler} maxLength={NAME_MAX} onChange={(e) => setHandler(e.target.value)} />
            </div>
            <div>
              <label htmlFor="pn" className="mb-1 block text-[13px] font-semibold">Planner</label>
              <input id="pn" className="input" value={planner} maxLength={NAME_MAX} onChange={(e) => setPlanner(e.target.value)} />
            </div>
            <div className="flex items-center gap-3">
              <button type="button" className="btn-primary" onClick={save}>Save</button>
              {saved && <span className="flex items-center gap-1 text-[13px] text-p3"><Icon name="check" className="h-4 w-4" />Saved</span>}
            </div>
          </div>
        </section>
        <section className="card p-5">
          <CardTitle>Data</CardTitle>
          <p className="mb-4 text-[13px] text-muted">
            Logged calls are stored only in this browser. Nothing is sent to a server. See the{' '}
            <Link to="/privacy" className="text-navy underline underline-offset-4">privacy policy</Link>.
            There are <span className="num text-ink">{data.calls.length}</span> logged calls.
          </p>
          <div className="divide-y divide-line">
            <div className="flex items-center justify-between gap-4 py-3">
              <div><div className="font-semibold">Export calls</div><div className="text-[12px] text-muted">Every logged call as a CSV file.</div></div>
              <button type="button" className="btn-quiet py-1.5!" onClick={exportCalls} disabled={!data.calls.length}><Icon name="download" className="h-4 w-4" />Export</button>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <div><div className="font-semibold">Clear calls</div><div className="text-[12px] text-muted">Deletes every logged call.</div></div>
              <button type="button" className="btn-quiet py-1.5!" onClick={confirmThen('Delete every logged call?', clearCalls)} disabled={!data.calls.length}>Clear</button>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <div><div className="font-semibold">Reset everything</div><div className="text-[12px] text-muted">Deletes calls and restores the default names.</div></div>
              <button type="button" className="btn-quiet py-1.5! text-p1!" onClick={confirmThen('Delete all calls and reset names?', resetAll)}>Reset all</button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
