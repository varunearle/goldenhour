import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { isValidInputs, type Inputs } from './model';

export type Role = 'handler' | 'planner';
export type CallStatus = 'waiting' | 'dispatched' | 'closed';

export interface Call {
  id: string;
  at: number;             // epoch ms when logged
  location: string;       // free text from the call handler
  inputs: Inputs;         // answers; the risk is always recomputed from these, never stored
  status: CallStatus;
}

interface Persisted {
  version: 1;
  calls: Call[];
  handlerName: string;
  plannerName: string;
}

const KEY = 'goldenhour:v1';
const SESSION_KEY = 'goldenhour:session';
export const LOCATION_MAX = 80;
export const NAME_MAX = 60;
export const CALLS_MAX = 500;
const STATUSES: CallStatus[] = ['waiting', 'dispatched', 'closed'];

/** Trims, removes control characters and caps length. React escapes the rest when rendering. */
export function cleanText(x: unknown, max: number): string {
  if (typeof x !== 'string') return '';
  return x.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function validCall(c: unknown): c is Call {
  const x = c as Call;
  return !!x && typeof x.id === 'string' && /^[A-Za-z0-9-]{1,40}$/.test(x.id) && Number.isFinite(x.at)
    && typeof x.location === 'string' && isValidInputs(x.inputs) && STATUSES.includes(x.status);
}

export function sanitize(d: unknown): Persisted | null {
  const x = d as Partial<Persisted> | null;
  if (!x || x.version !== 1 || !Array.isArray(x.calls)) return null;
  return {
    version: 1,
    calls: x.calls.filter(validCall).slice(-CALLS_MAX).map((c) => ({ ...c, location: cleanText(c.location, LOCATION_MAX) })),
    handlerName: cleanText(x.handlerName, NAME_MAX) || 'Call handler',
    plannerName: cleanText(x.plannerName, NAME_MAX) || 'Planner',
  };
}

const fresh = (): Persisted => ({ version: 1, calls: [], handlerName: 'Call handler', plannerName: 'Planner' });

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    const d = raw ? sanitize(JSON.parse(raw)) : null;
    if (d) return d;
  } catch { /* storage unavailable or unreadable: start fresh */ }
  return fresh();
}

function loadSession(): Role | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null');
    return s && (s.role === 'handler' || s.role === 'planner') ? s.role : null;
  } catch {
    return null;
  }
}

interface Store {
  data: Persisted;
  role: Role | null;
  signIn: (r: Role) => void;
  signOut: () => void;
  logCall: (location: string, inputs: Inputs) => Call;
  setStatus: (id: string, s: CallStatus) => void;
  setNames: (handler: string, planner: string) => void;
  clearCalls: () => void;
  resetAll: () => void;
}

const Ctx = createContext<Store | null>(null);

function newId() {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.floor(Math.random() * 36 ** 3).toString(36).toUpperCase().padStart(3, '0');
  return `C-${t}-${r}`;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Persisted>(load);
  const [role, setRole] = useState<Role | null>(loadSession);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ }
  }, [data]);
  useEffect(() => {
    try {
      if (role) sessionStorage.setItem(SESSION_KEY, JSON.stringify({ role }));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch { /* ignore */ }
  }, [role]);

  const store: Store = {
    data,
    role,
    signIn: setRole,
    signOut: () => setRole(null),
    logCall: (location, inputs) => {
      if (!isValidInputs(inputs)) throw new Error('Invalid call details');
      const call: Call = { id: newId(), at: Date.now(), location: cleanText(location, LOCATION_MAX), inputs: { ...inputs }, status: 'waiting' };
      setData((d) => ({ ...d, calls: [...d.calls, call].slice(-CALLS_MAX) }));
      return call;
    },
    setStatus: (id, s) => setData((d) => ({ ...d, calls: d.calls.map((c) => (c.id === id ? { ...c, status: s } : c)) })),
    setNames: (handler, planner) => setData((d) => ({
      ...d,
      handlerName: cleanText(handler, NAME_MAX) || 'Call handler',
      plannerName: cleanText(planner, NAME_MAX) || 'Planner',
    })),
    clearCalls: () => setData((d) => ({ ...d, calls: [] })),
    resetAll: () => setData(fresh()),
  };
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
}
