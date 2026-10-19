import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CardTitle, PageHeader, intl, pct } from '../components/ui';
import { loadBirmingham, type Birmingham, type Coverage } from '../lib/data';

type Method = 'kmeans' | 'even';

function Toggle({ label, on, set, swatch }: { label: string; on: boolean; set: (b: boolean) => void; swatch: ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-[13px]">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
      {swatch}
      {label}
    </label>
  );
}

export default function MapView() {
  const [b, setB] = useState<Birmingham | null>(null);
  const [k, setK] = useState(5);
  const [method, setMethod] = useState<Method>('kmeans');
  const [showAll, setShowAll] = useState(true);
  const [showKsi, setShowKsi] = useState(true);
  const [showHot, setShowHot] = useState(true);
  const [showStandby, setShowStandby] = useState(true);
  const [showRings, setShowRings] = useState(true);
  const [focus, setFocus] = useState<number | null>(null);

  useEffect(() => { loadBirmingham().then(setB); }, []);

  const option = b?.standby.options.find((o) => o.k === k);
  const view = useMemo(() => {
    if (!b) return null;
    const pad = 800;
    const x0 = b.bounds.e_min - pad;
    const y1 = b.bounds.n_max + pad;
    const w = b.bounds.e_max - b.bounds.e_min + pad * 2;
    const h = b.bounds.n_max - b.bounds.n_min + pad * 2;
    return { x: (e: number) => e - x0, y: (n: number) => y1 - n, w, h };
  }, [b]);

  if (!b || !view || !option) {
    return (<><PageHeader eyebrow="Planner" title="Hotspots and ambulance standby" /><p className="text-muted">Loading Birmingham collisions…</p></>);
  }

  const points = method === 'kmeans' ? option.points : option.even_points;
  const hull = b.hull.map(([e, n]) => `${view.x(e)},${view.y(n)}`).join(' ');
  const hotFocus = focus ? b.dbscan.hotspots.find((h) => h.rank === focus) : null;
  const rows: [string, Coverage][] = [
    ['Learned from past serious collisions (K-Means)', option.test.kmeans],
    ['Evenly spread across the area', option.test.even],
    ['Random past collision sites (average of 1,000)', option.test.random],
  ];

  return (
    <>
      <PageHeader
        eyebrow="Planner"
        title="Hotspots and ambulance standby"
        sub={`Birmingham, 2015: ${intl(b.collisions_used)} injury collisions, ${b.ksi} fatal or serious (${b.fatal} fatal).`}
      />
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_360px]">
        <section className="card min-w-0 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <Toggle label="All collisions" on={showAll} set={setShowAll} swatch={<span className="h-2 w-2 rounded-full bg-[#9AA3AB]" />} />
            <Toggle label="Fatal or serious" on={showKsi} set={setShowKsi} swatch={<span className="h-2.5 w-2.5 rounded-full bg-p1" />} />
            <Toggle label="Hotspots" on={showHot} set={setShowHot} swatch={<span className="h-3 w-3 rounded-full border-2 border-p2" />} />
            <Toggle label="Standby points" on={showStandby} set={setShowStandby} swatch={<span className="h-2.5 w-2.5 bg-navy" />} />
            <Toggle label="3 km rings" on={showRings} set={setShowRings} swatch={<span className="h-3 w-3 rounded-full border border-dashed border-navy" />} />
          </div>
          <div className="overflow-hidden rounded border border-line bg-[#F8F9F7]">
            <svg viewBox={`0 0 ${view.w} ${view.h}`} className="block h-auto w-full" role="img"
              aria-label={`Map of ${b.collisions_used} collisions in Birmingham in 2015 with ${b.dbscan.hotspots.length} hotspots and ${k} standby points`}>
              <polygon points={hull} fill="#EEF1EE" stroke="#C6CCD0" strokeWidth={60} strokeDasharray="300 200" />
              {showAll && b.collisions.map((c) => c.sev === 3 && (
                <circle key={c.id} cx={view.x(c.e)} cy={view.y(c.n)} r={55} fill="#9AA3AB" fillOpacity={0.55} />
              ))}
              {showKsi && b.collisions.map((c) => c.sev < 3 && (
                <circle key={c.id} cx={view.x(c.e)} cy={view.y(c.n)} r={c.sev === 1 ? 140 : 95} fill="#B42318" fillOpacity={0.85}
                  stroke={c.sev === 1 ? '#15191E' : 'none'} strokeWidth={40} />
              ))}
              {showHot && b.dbscan.hotspots.map((h) => (
                <g key={h.rank} onClick={() => setFocus(h.rank === focus ? null : h.rank)} style={{ cursor: 'pointer' }}>
                  <circle cx={view.x(h.e)} cy={view.y(h.n)} r={Math.max(h.radius_m, 180) + 60} fill={h.rank === focus ? '#B45309' : 'none'}
                    fillOpacity={0.15} stroke="#B45309" strokeWidth={h.rank === focus ? 110 : 70} />
                  {h.rank <= 6 && (
                    <text x={view.x(h.e) + Math.max(h.radius_m, 180) + 160} y={view.y(h.n) + 150} fontSize={460} fontWeight={700} fill="#8F4106"
                      fontFamily="JetBrains Mono, monospace">{h.rank}</text>
                  )}
                </g>
              ))}
              {showStandby && showRings && points.map((p, i) => (
                <circle key={`r${i}`} cx={view.x(p.e)} cy={view.y(p.n)} r={3000} fill="#173B5C" fillOpacity={0.05} stroke="#173B5C" strokeWidth={50} strokeDasharray="250 180" />
              ))}
              {showStandby && points.map((p, i) => (
                <g key={`s${i}`}>
                  <rect x={view.x(p.e) - 330} y={view.y(p.n) - 330} width={660} height={660} fill={method === 'kmeans' ? '#173B5C' : '#FCFCFB'} stroke="#173B5C" strokeWidth={90} />
                  <text x={view.x(p.e)} y={view.y(p.n) + 170} fontSize={470} fontWeight={700} textAnchor="middle" fill={method === 'kmeans' ? '#FFFFFF' : '#173B5C'}
                    fontFamily="JetBrains Mono, monospace">{i + 1}</text>
                </g>
              ))}
              <g transform={`translate(${view.w - 3200}, ${view.h - 900})`}>
                <rect x={-200} y={-600} width={3000} height={1100} fill="#FCFCFB" fillOpacity={0.9} />
                <line x1={0} y1={0} x2={2000} y2={0} stroke="#15191E" strokeWidth={70} />
                <line x1={0} y1={-200} x2={0} y2={200} stroke="#15191E" strokeWidth={70} />
                <line x1={2000} y1={-200} x2={2000} y2={200} stroke="#15191E" strokeWidth={70} />
                <text x={2200} y={150} fontSize={420} fill="#15191E" fontFamily="JetBrains Mono, monospace">2 km</text>
              </g>
            </svg>
          </div>
          <p className="mt-2 text-[12px] text-muted">
            Points are drawn at their recorded British National Grid coordinates; the shaded outline is the area where collisions were recorded, not the city boundary.
            {b.excluded_bad_coordinates.length > 0 && ` ${b.excluded_bad_coordinates.length} collisions with coordinates outside the city were left out.`}
          </p>
        </section>

        <aside className="flex flex-col gap-4">
          <section className="card p-5">
            <CardTitle>Ambulance standby points</CardTitle>
            <label htmlFor="k" className="flex items-center justify-between text-[13px] font-semibold">
              Number of points <span className="num text-[16px]">{k}</span>
            </label>
            <input id="k" type="range" min={3} max={8} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} className="mt-2 w-full accent-[#173B5C]" />
            <div className="mt-3 flex rounded border border-line2 bg-sunk p-0.5 text-[13px]" role="tablist">
              {([['kmeans', 'Learned (K-Means)'], ['even', 'Evenly spread']] as const).map(([m, l]) => (
                <button key={m} type="button" role="tab" aria-selected={method === m} onClick={() => setMethod(m)}
                  className={`flex-1 rounded-sm py-1 font-semibold ${method === m ? 'bg-navy text-white' : 'text-muted'}`}>{l}</button>
              ))}
            </div>
            <p className="mt-3 text-[13px] leading-5 text-muted">
              Points learned from the {b.standby.train_ksi} fatal or serious collisions of January to September, then tested on the {b.standby.test_ksi} of
              October to December. Distances are straight-line.
            </p>
            <table className="mt-3 w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="py-1.5 font-medium">Placement</th>
                  <th className="whitespace-nowrap py-1.5 pl-2 text-right font-medium">Mean km</th>
                  <th className="whitespace-nowrap py-1.5 pl-2 text-right font-medium">Within 3 km</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(([name, c], i) => (
                  <tr key={name} className={i === 0 ? 'font-semibold' : ''}>
                    <td className="py-2 pr-2">{name}</td>
                    <td className="num py-2 pl-2 text-right">{c.mean_km.toFixed(2)}</td>
                    <td className="num py-2 pl-2 text-right">{pct(c.within_3km, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="card p-5">
            <CardTitle right={<span className="num text-[12px] text-muted">{b.dbscan.hotspots.length} found</span>}>Collision hotspots</CardTitle>
            <p className="-mt-1 mb-3 text-[12px] leading-5 text-muted">
              DBSCAN: at least {b.dbscan.min_samples} collisions, each within {b.dbscan.eps_m} m of others in the group. {b.dbscan.collisions_in_hotspots} of{' '}
              {intl(b.collisions_used)} collisions ({pct(b.dbscan.collisions_in_hotspots / b.collisions_used)}) fall in these small areas.
            </p>
            <ol className="flex max-h-[320px] flex-col divide-y divide-line overflow-y-auto">
              {b.dbscan.hotspots.map((h) => (
                <li key={h.rank}>
                  <button type="button" onClick={() => setFocus(h.rank === focus ? null : h.rank)}
                    className={`flex w-full items-start gap-3 px-1 py-2 text-left ${h.rank === focus ? 'bg-p2-soft' : 'hover:bg-sunk'}`}>
                    <span className="num w-5 shrink-0 text-right font-medium text-p2-text">{h.rank}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{h.roads}</span>
                      <span className="block text-[12px] text-muted">{h.collisions} collisions · {h.ksi} fatal or serious{h.fatal ? ` (${h.fatal} fatal)` : ''} · {h.pedestrian} with pedestrians</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            {hotFocus && (
              <p className="mt-3 rounded bg-sunk p-3 text-[12px] leading-5">
                Hotspot {hotFocus.rank}: {hotFocus.roads}. {hotFocus.collisions} injury collisions within about {hotFocus.radius_m} m;{' '}
                {hotFocus.night_or_dark} happened in darkness. Grid reference E {hotFocus.e}, N {hotFocus.n}.
              </p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
