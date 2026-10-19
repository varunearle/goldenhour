// End-to-end run through every screen in a real browser, under the production security headers.
// Needs Playwright:  npm i -D playwright && npx playwright install chromium
// Usage (with `npm run preview` running):  node verify/e2e.mjs http://localhost:4173 screenshots
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
const require = createRequire(process.env.PLAYWRIGHT_FROM ?? import.meta.url);
const { chromium } = require('playwright');

const BASE = process.argv[2] ?? 'http://localhost:4173';
const OUT = process.argv[3] ?? 'screenshots';
mkdirSync(OUT, { recursive: true });
const model = JSON.parse(readFileSync(new URL('../src/data/model.json', import.meta.url), 'utf8'));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: Number(process.env.DSF ?? 1), acceptDownloads: true });
const page = await ctx.newPage();
await page.addInitScript(() => {
  document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP blocked ${e.violatedDirective}: ${e.blockedURI}`));
});
const errors = [];
const external = [];
let dialogs = 0;
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(String(e)));
page.on('request', (r) => { const u = new URL(r.url()); if (u.protocol.startsWith('http') && !['localhost', '127.0.0.1'].includes(u.hostname)) external.push(r.url()); });
page.on('dialog', async (d) => { if (d.type() === 'alert') dialogs++; await d.accept(); });

let fails = 0;
const check = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
const shot = async (n) => {
  const text = await page.evaluate(() => document.body.innerText);
  const dash = text.match(/.{0,30}[—–].{0,30}/);
  check(!dash, `${n}: no em or en dashes${dash ? `: "${dash[0]}"` : ''}`);
  await page.screenshot({ path: `${OUT}/${n}.png`, fullPage: true });
};
const pctText = (p) => `${(p * 100).toFixed(1)}%`;

// ---------------------------------------------------------------- sign in
await page.goto(BASE);
await shot('01-signin');
await page.fill('#email', 'nobody@x.com');
await page.fill('#password', 'nope');
await page.getByRole('button', { name: 'Sign in' }).click();
check((await page.getByRole('alert').count()) === 1, 'wrong credentials are rejected');
await page.getByRole('button', { name: /Use the demo call handler account/ }).click();
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL('**/triage');

// ---------------------------------------------------------------- triage
await page.fill('#date', '2026-10-19');
await page.fill('#time', '14:30');
const reference = 1 / (1 + Math.exp(-model.intercept));
await page.getByText(pctText(reference), { exact: true }).waitFor({ timeout: 5000 });
check(true, `all reference answers on a Monday afternoon give the intercept-only estimate ${pctText(reference)}`);
const beta = (v, l) => model.coefficients.find((c) => c.var === v && c.level === l).beta;
await page.getByRole('radiogroup', { name: 'Pedestrian hit' }).getByRole('radio', { name: 'Yes' }).click();
await page.getByRole('radiogroup', { name: 'Light' }).getByRole('radio', { name: 'Dark, no lights or lights off' }).click();
await page.getByRole('radiogroup', { name: 'Speed limit' }).getByRole('radio', { name: '60 mph' }).click();
const z = model.intercept + beta('pedestrian', 'yes') + beta('light', 'dark_unlit') + beta('speed', '60');
const p = 1 / (1 + Math.exp(-z));
check((await page.getByText(pctText(p), { exact: true }).count()) >= 1, `pedestrian + dark unlit + 60 mph shows ${pctText(p)} (computed independently)`);
await page.getByText(/^Matched on /).waitFor({ timeout: 15000 });
check(true, 'similar real collisions are shown');
await page.fill('#loc', '<img src=x onerror=alert(1)> =HYPERLINK("http://example.com")');
await page.getByRole('button', { name: /Log call as P/ }).click();
await page.getByRole('status').waitFor();
await shot('02-triage');

// ---------------------------------------------------------------- queue
await page.goto(`${BASE}/queue`);
check((await page.locator('img[src="x"]').count()) === 0 && dialogs === 0, 'HTML typed into the location is shown as text, never run');
check((await page.getByText('<img src=x onerror=alert(1)>', { exact: false }).count()) >= 1, 'the location text is displayed as typed');
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV' }).click()]);
const csv = readFileSync(await dl.path(), 'utf8');
check(/"'<img|"<img/.test(csv) && !/,=HYPERLINK/.test(csv), 'CSV export quotes the location');
await page.getByRole('button', { name: 'Dispatch' }).first().click();
check((await page.getByText('Dispatched').count()) >= 1, 'a call can be dispatched');
await shot('03-queue');
await page.getByRole('tab', { name: 'Replay a real day' }).click();
await page.getByText(/Every injury collision police recorded in Birmingham/).waitFor({ timeout: 15000 });
const replayRows = await page.locator('table tbody tr').count();
check(replayRows > 5, `replay shows a real day (${replayRows} collisions)`);
await shot('04-replay');

// ---------------------------------------------------------------- model page
await page.goto(`${BASE}/model`);
await page.getByRole('button', { name: 'Recompute on test set' }).click();
await page.getByText('AUC in this browser').waitFor({ timeout: 30000 });
const aucText = await page.getByText('AUC in this browser').locator('..').innerText();
check(aucText.includes(model.evaluation.logistic.auc.toFixed(3)), `browser AUC matches Python (${model.evaluation.logistic.auc})`);
await shot('05-model');
await page.goto(`${BASE}/settings`);
await shot('06-settings');

// ---------------------------------------------------------------- planner
await page.getByRole('button', { name: 'Sign out' }).click();
await page.getByRole('tab', { name: 'Planner' }).click();
await page.getByRole('button', { name: /Use the demo planner account/ }).click();
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL('**/map');
await page.getByText('Collision hotspots').waitFor({ timeout: 15000 });
check((await page.locator('svg circle').count()) > 2900, 'map draws every Birmingham collision');
await page.locator('#k').fill('7');
check((await page.locator('svg rect').count()) >= 7, 'moving the slider to 7 shows 7 standby points');
await page.getByRole('button', { name: /A38\(M\) \/ M6/ }).click();
check((await page.getByText(/Hotspot 6: A38\(M\) \/ M6/).count()) === 1, 'selecting a hotspot shows its details');
await shot('07-map');
await page.goto(`${BASE}/queue`);
await page.waitForURL('**/map', { timeout: 5000 }).catch(() => {});
check(page.url().endsWith('/map'), `planner cannot open the call queue (sent to ${new URL(page.url()).pathname})`);

// ---------------------------------------------------------------- tampering and legal pages
await page.evaluate(() => {
  localStorage.setItem('goldenhour:v1', '{"version":1,"calls":[{"id":"x","inputs":"junk"}],"handlerName":5}');
  sessionStorage.setItem('goldenhour:session', '{"role":"admin"}');
});
await page.goto(`${BASE}/map`);
await page.waitForURL(`${BASE}/`, { timeout: 5000 }).catch(() => {});
check(page.url() === `${BASE}/`, 'an unknown role in storage is rejected');
for (const [path, h] of [['/privacy', 'Privacy policy'], ['/terms', 'Terms and conditions']]) {
  await page.goto(`${BASE}${path}`);
  check(await page.getByRole('heading', { level: 1, name: h }).isVisible(), `${path} renders`);
  await shot(path.slice(1));
}
await page.goto(BASE);
await page.getByRole('button', { name: /Use the demo call handler account/ }).click();
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL('**/triage');
check(true, 'app works after storage was tampered with');

// ---------------------------------------------------------------- phone width
await page.setViewportSize({ width: 390, height: 844 });
for (const path of ['/triage', '/queue', '/model']) {
  await page.goto(`${BASE}${path}`);
  await page.waitForTimeout(300);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth);
  check(wide <= 390, `${path} fits a phone screen (page width ${wide}px)`);
}
await shot('08-triage-mobile');

check(external.length === 0, `no requests to other sites${external.length ? ': ' + external.slice(0, 3).join(', ') : ''}`);
check(errors.length === 0, `no console errors or warnings${errors.length ? ':\n  ' + errors.slice(0, 8).join('\n  ') : ''}`);
await browser.close();
console.log(fails ? `${fails} check(s) failed` : 'all checks passed');
process.exit(fails ? 1 : 0);
