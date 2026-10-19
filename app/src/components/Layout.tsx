import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Icon } from './ui';

const HANDLER_NAV = [
  { to: '/triage', label: 'New call', icon: 'phone' },
  { to: '/queue', label: 'Call queue', icon: 'list' },
  { to: '/model', label: 'Model', icon: 'model' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];
const PLANNER_NAV = [
  { to: '/map', label: 'Hotspots and standby', icon: 'map' },
  { to: '/model', label: 'Model', icon: 'model' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

export default function Layout() {
  const { role, data, signOut } = useStore();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const planner = role === 'planner';
  const items = planner ? PLANNER_NAV : HANDLER_NAV;
  const name = planner ? data.plannerName : data.handlerName;
  const waiting = data.calls.filter((c) => c.status === 'waiting').length;

  const sidebar = (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="border-b border-white/10 px-5 py-5">
          <div className="text-[20px] font-bold leading-6 tracking-tight text-white">Golden Hour</div>
          <div className="mt-0.5 text-[12px] text-[#AFC0D0]">Road collision triage</div>
        </div>
        <nav className="flex flex-col gap-0.5 p-2">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `flex items-center gap-2.5 rounded px-3 py-2 ${isActive ? 'bg-white text-navy font-semibold' : 'text-[#D5DFE8] hover:bg-white/10'}`}
            >
              <Icon name={it.icon} />
              <span className="flex-1">{it.label}</span>
              {it.to === '/queue' && waiting > 0 && <span className="num rounded-sm bg-p1 px-1.5 text-[11px] font-medium text-white">{waiting}</span>}
            </NavLink>
          ))}
        </nav>
      </div>
      <div>
        <div className="flex gap-3 px-5 pb-3 text-[12px]">
          <NavLink to="/privacy" className="text-[#AFC0D0] hover:text-white">Privacy</NavLink>
          <NavLink to="/terms" className="text-[#AFC0D0] hover:text-white">Terms</NavLink>
        </div>
        <div className="flex items-center gap-3 border-t border-white/10 p-3">
          <div className="min-w-0 flex-1 pl-2">
            <div className="truncate font-semibold text-white">{name}</div>
            <div className="text-[12px] text-[#AFC0D0]">{planner ? 'Planner' : 'Call handler'}</div>
          </div>
          <button type="button" onClick={() => { signOut(); nav('/'); }} className="rounded p-1.5 text-[#D5DFE8] hover:bg-white/10" title="Sign out" aria-label="Sign out">
            <Icon name="out" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[224px] bg-navy lg:block">{sidebar}</aside>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-navy px-4 text-white lg:hidden">
        <span className="text-lg font-bold">Golden Hour</span>
        <button type="button" onClick={() => setOpen(!open)} className="rounded p-2 hover:bg-white/10" aria-label="Menu"><Icon name="menu" /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-ink/30" />
          <aside className="absolute inset-y-0 left-0 w-[250px] bg-navy" onClick={(e) => e.stopPropagation()}>{sidebar}</aside>
        </div>
      )}
      <main className="lg:pl-[224px]">
        <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
