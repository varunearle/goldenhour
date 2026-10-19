import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MODEL } from '../lib/model';
import { useStore, type Role } from '../lib/store';
import { intl, pct } from '../components/ui';

const ACCOUNTS: Record<Role, { email: string; password: string; label: string }> = {
  handler: { email: 'handler@goldenhour.demo', password: 'goldenhour', label: 'Call handler' },
  planner: { email: 'planner@goldenhour.demo', password: 'goldenhour', label: 'Planner' },
};

export default function SignIn() {
  const { signIn } = useStore();
  const nav = useNavigate();
  const [role, setRole] = useState<Role>('handler');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const d = MODEL.data;
  const p1 = MODEL.evaluation.bands[0];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const acc = ACCOUNTS[role];
    if (email.trim().toLowerCase() !== acc.email || password !== acc.password) {
      setError(`That email and password don't match the ${acc.label.toLowerCase()} account.`);
      return;
    }
    signIn(role);
    nav(role === 'planner' ? '/map' : '/triage');
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 md:p-8">
      <div className="card grid w-full max-w-[1000px] overflow-hidden md:grid-cols-[46fr_54fr]">
        <section className="flex flex-col justify-between gap-8 bg-navy p-8 text-white md:p-11">
          <div>
            <div className="text-[28px] font-bold leading-8 tracking-tight">Golden Hour</div>
            <p className="mt-2 text-[16px] leading-6 text-[#D5DFE8]">
              Road collision triage for emergency call handlers, and ambulance standby planning from where serious collisions happen.
            </p>
          </div>
          <div className="border-t border-white/15 pt-6">
            <div className="text-[12px] text-[#AFC0D0]">Great Britain, 2015</div>
            <dl className="mt-2 grid grid-cols-2 gap-x-6">
              <div>
                <dd className="num text-[26px] font-medium">{intl(d.killed)}</dd>
                <dt className="text-[13px] text-[#D5DFE8]">people killed on roads</dt>
              </div>
              <div>
                <dd className="num text-[26px] font-medium">{intl(d.serious)}</dd>
                <dt className="text-[13px] text-[#D5DFE8]">seriously injured</dt>
              </div>
            </dl>
            <div className="mt-6 text-[12px] text-[#AFC0D0]">This model, on October to December 2015</div>
            <dl className="mt-2 grid grid-cols-2 gap-x-6">
              <div>
                <dd className="num text-[26px] font-medium">{pct(p1.share_calls, 0)}</dd>
                <dt className="text-[13px] text-[#D5DFE8]">of calls placed in priority 1</dt>
              </div>
              <div>
                <dd className="num text-[26px] font-medium">{pct(p1.ksi_rate, 0)}</dd>
                <dt className="text-[13px] text-[#D5DFE8]">of those were fatal or serious, against {pct(d.test.ksi / d.test.collisions, 0)} overall</dt>
              </div>
            </dl>
          </div>
          <p className="text-[12px] leading-5 text-[#AFC0D0]">
            Source: STATS19 road safety data 2015, Department for Transport. Contains public sector information licensed under the Open Government Licence v3.0.
          </p>
        </section>

        <section className="flex flex-col justify-center p-8 md:p-11">
          <div className="mx-auto w-full max-w-sm">
            <h1 className="text-[22px] font-bold">Sign in</h1>
            <p className="mt-1 text-muted">Choose your role.</p>
            <div className="mt-6 mb-5 flex rounded border border-line2 bg-sunk p-0.5" role="tablist">
              {(Object.keys(ACCOUNTS) as Role[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  role="tab"
                  aria-selected={role === r}
                  onClick={() => { setRole(r); setError(''); setEmail(''); setPassword(''); }}
                  className={`flex-1 rounded-sm py-1.5 font-semibold ${role === r ? 'bg-navy text-white' : 'text-muted hover:text-ink'}`}
                >
                  {ACCOUNTS[r].label}
                </button>
              ))}
            </div>
            <form onSubmit={submit} className="space-y-4" noValidate={false}>
              <div>
                <label htmlFor="email" className="mb-1 block text-[13px] font-medium">Email</label>
                <input id="email" type="email" className="input" placeholder={ACCOUNTS[role].email} value={email} maxLength={120}
                  onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
              </div>
              <div>
                <label htmlFor="password" className="mb-1 block text-[13px] font-medium">Password</label>
                <input id="password" type="password" className="input" value={password} maxLength={120}
                  onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
              </div>
              {error && <p className="text-[13px] text-p1" role="alert">{error}</p>}
              <button type="submit" className="btn-primary w-full">Sign in</button>
            </form>
            <div className="mt-6 border-t border-line pt-5 text-center">
              <button type="button" className="text-navy underline underline-offset-4 hover:text-navy-dark"
                onClick={() => { setEmail(ACCOUNTS[role].email); setPassword(ACCOUNTS[role].password); setError(''); }}>
                Use the demo {ACCOUNTS[role].label.toLowerCase()} account
              </button>
              <p className="mt-3 text-[12px] text-muted">A teaching demonstration. Not for real emergencies: in India call 112.</p>
              <p className="mt-4 flex justify-center gap-4 text-[12px]">
                <Link to="/privacy" className="text-muted underline underline-offset-4 hover:text-ink">Privacy policy</Link>
                <Link to="/terms" className="text-muted underline underline-offset-4 hover:text-ink">Terms and conditions</Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
