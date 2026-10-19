import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MODEL, VARIABLES, auc, contributions, decode, hourBand, isValidInputs, priority, probability, referenceInputs, type Inputs } from './model';
import { similar, type TestRow } from './data';
import { csvCell, toCsv } from './csv';
import { cleanText, sanitize } from './store';

const testset = JSON.parse(readFileSync(new URL('../data/testset.json', import.meta.url), 'utf8')) as { variables: string[]; rows: string[] };
const rows: TestRow[] = testset.rows.map((r) => ({ codes: r.slice(0, -1), outcome: Number(r.at(-1)) as 0 | 1 | 2 }));
const birmingham = JSON.parse(readFileSync(new URL('../data/birmingham.json', import.meta.url), 'utf8'));

describe('model matches the Python training run', () => {
  it('uses the same variables in the same order as the data files', () => {
    expect(testset.variables).toEqual(VARIABLES.map((v) => v.id));
    expect(birmingham.variables).toEqual(VARIABLES.map((v) => v.id));
  });

  it('reproduces the Python probabilities to 1e-9', () => {
    expect(MODEL.check.length).toBeGreaterThan(300);
    for (const c of MODEL.check) expect(Math.abs(probability(decode(rows[c.row].codes)) - c.p)).toBeLessThan(1e-9);
  });

  it('reproduces the test AUC and the priority bands', () => {
    const scores = rows.map((r) => probability(decode(r.codes)));
    const labels: number[] = rows.map((r) => (r.outcome >= 1 ? 1 : 0));
    expect(rows.length).toBe(MODEL.data.test.collisions);
    expect(labels.reduce((a, b) => a + b, 0)).toBe(MODEL.data.test.ksi);
    expect(auc(scores, labels).toFixed(3)).toBe(MODEL.evaluation.logistic.auc.toFixed(3));
    for (const band of MODEL.evaluation.bands) {
      const inBand = scores.map((s, i) => [s, i] as const).filter(([s]) => priority(s) === band.band);
      expect(inBand.length).toBe(band.calls);
      expect(inBand.filter(([, i]) => labels[i] === 1).length).toBe(band.ksi);
    }
  });

  it('computes AUC correctly on a hand example, including ties', () => {
    expect(auc([0.1, 0.4, 0.35, 0.8], [0, 0, 1, 1])).toBeCloseTo(0.75, 12);
    expect(auc([0.5, 0.5, 0.5, 0.5], [0, 1, 0, 1])).toBeCloseTo(0.5, 12);
  });

  it('gives the intercept-only estimate when every answer is at its reference level', () => {
    const p = probability(referenceInputs());
    expect(p).toBeCloseTo(1 / (1 + Math.exp(-MODEL.intercept)), 12);
    expect(contributions(referenceInputs())).toEqual([]);
  });

  it('a pedestrian being hit raises the estimate by exactly its coefficient in log-odds', () => {
    const base = referenceInputs();
    const ped = { ...base, pedestrian: 'yes' };
    const lo = (p: number) => Math.log(p / (1 - p));
    const beta = MODEL.coefficients.find((c) => c.var === 'pedestrian' && c.level === 'yes')!.beta;
    expect(lo(probability(ped)) - lo(probability(base))).toBeCloseTo(beta, 10);
  });

  it('uses the same hour bands as the Python feature code', () => {
    expect([0, 5, 6, 9, 10, 15, 16, 19, 20, 23].map(hourBand)).toEqual(
      ['night', 'night', 'morning', 'morning', 'day', 'day', 'evening', 'evening', 'late', 'late']);
  });
});

describe('similar real collisions', () => {
  it('counts matches exactly and relaxes until at least 40 match', () => {
    const inputs: Inputs = { ...referenceInputs(), pedestrian: 'yes', speed: '30', light: 'dark_lit' };
    const s = similar(rows, inputs);
    expect(s.n).toBeGreaterThanOrEqual(40);
    const pos = s.matchedOn.map((v) => VARIABLES.findIndex((x) => x.id === v));
    const manual = rows.filter((r) => pos.every((p, i) => decode(r.codes)[s.matchedOn[i]] === inputs[s.matchedOn[i]] && p >= 0));
    expect(s.n).toBe(manual.length);
    expect(s.ksi).toBe(manual.filter((r) => r.outcome >= 1).length);
  });
});

describe('Birmingham data', () => {
  it('has valid coded rows and consistent totals', () => {
    for (const c of birmingham.collisions) expect(isValidInputs(decode(c.x))).toBe(true);
    expect(birmingham.collisions.length).toBe(birmingham.collisions_used);
    expect(birmingham.collisions.filter((c: { sev: number }) => c.sev <= 2).length).toBe(birmingham.ksi);
  });
  it('learned standby points beat even and random placement on the test months', () => {
    for (const o of birmingham.standby.options) {
      expect(o.test.kmeans.mean_km).toBeLessThan(o.test.even.mean_km);
      expect(o.test.kmeans.mean_km).toBeLessThan(o.test.random.mean_km);
    }
  });
});

describe('input safety', () => {
  it('neutralises spreadsheet formulas and escapes quotes', () => {
    expect(csvCell('=HYPERLINK("http://x","y")')).toBe(`"'=HYPERLINK(""http://x"",""y"")"`);
    expect(csvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`);
    expect(csvCell('+44 7700')).toBe(`"'+44 7700"`);
    expect(csvCell('A38 near Aston')).toBe('"A38 near Aston"');
    expect(toCsv(['a'], [['x']])).toBe('a\r\n"x"');
  });
  it('cleans free text', () => {
    expect(cleanText('  A38\u0000\n near   Aston ', 80)).toBe('A38 near Aston');
    expect(cleanText('x'.repeat(200), 80).length).toBe(80);
    expect(cleanText(42, 80)).toBe('');
  });
  it('rejects malformed saved data and keeps only valid calls', () => {
    expect(sanitize(null)).toBeNull();
    expect(sanitize({ version: 2, calls: [] })).toBeNull();
    const good = { id: 'C-1', at: 1, location: 'A38', inputs: referenceInputs(), status: 'waiting' };
    const d = sanitize({
      version: 1,
      calls: [good, { ...good, id: 'bad id!' }, { ...good, id: 'C-2', status: 'admin' }, { ...good, id: 'C-3', inputs: { ...referenceInputs(), speed: '999' } }, null],
      handlerName: '<b>x</b>'.repeat(30),
      plannerName: '',
    })!;
    expect(d.calls.map((c) => c.id)).toEqual(['C-1']);
    expect(d.handlerName.length).toBe(60);
    expect(d.plannerName).toBe('Planner');
  });
});
