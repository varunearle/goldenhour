// The collision severity model exported by model/train.py, applied in the browser.
// Logistic regression: P(fatal or serious) = 1 / (1 + exp(-(intercept + sum of active coefficients))).
import raw from '../data/model.json';

export interface Level { id: string; label: string }
export interface Variable { id: string; label: string; levels: Level[] }
export interface Coefficient {
  var: string; level: string; beta: number; or: number; or_low: number; or_high: number; p: number;
}
export interface Band {
  band: number; calls: number; share_calls: number; ksi: number; ksi_rate: number; share_ksi: number;
}

export const MODEL = raw as unknown as {
  variables: Variable[];
  intercept: number;
  coefficients: Coefficient[];
  thresholds: { p1: number; p2: number };
  base_rate_train: number;
  data: {
    source: string; licence: string; collisions: number; used: number; dropped_no_time: number;
    killed: number; serious: number; casualties: number; fatal_collisions: number; serious_collisions: number;
    train: { collisions: number; ksi: number; months: string };
    test: { collisions: number; ksi: number; months: string };
    sha256: Record<string, string>;
  };
  evaluation: {
    base_rate: { auc: number; ap: number; brier: number };
    logistic: { auc: number; ap: number; brier: number };
    gbm: { auc: number; ap: number; brier: number };
    rule: { flagged_share: number; share_ksi: number; ksi_rate_flagged: number };
    logistic_same_flag_rate: { flagged_share: number; share_ksi: number; ksi_rate_flagged: number };
    bands: Band[];
    calibration: { predicted: number; observed: number; n: number }[];
  };
  fit: { method: string; parameters: number; converged: boolean; log_likelihood: number; pseudo_r2: number };
  check: { row: number; p: number }[];
};

export const VARIABLES = MODEL.variables;
export type VarId = string;
export type Inputs = Record<VarId, string>;

const COEF = new Map(MODEL.coefficients.map((c) => [`${c.var}=${c.level}`, c]));
export const coefficient = (v: VarId, level: string) => COEF.get(`${v}=${level}`);
export const variable = (v: VarId) => VARIABLES.find((x) => x.id === v)!;
export const levelLabel = (v: VarId, level: string) => variable(v).levels.find((l) => l.id === level)?.label ?? level;

/** Every variable at its reference level (the first level). */
export const referenceInputs = (): Inputs => Object.fromEntries(VARIABLES.map((v) => [v.id, v.levels[0].id]));

export function isValidInputs(x: unknown): x is Inputs {
  if (!x || typeof x !== 'object') return false;
  return VARIABLES.every((v) => v.levels.some((l) => l.id === (x as Inputs)[v.id]));
}

export function logit(inputs: Inputs): number {
  let z = MODEL.intercept;
  for (const v of VARIABLES) {
    const c = coefficient(v.id, inputs[v.id]);
    if (c) z += c.beta;
  }
  return z;
}

export const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
export const probability = (inputs: Inputs) => sigmoid(logit(inputs));

export type Priority = 1 | 2 | 3;
export function priority(p: number): Priority {
  if (p >= MODEL.thresholds.p1) return 1;
  if (p >= MODEL.thresholds.p2) return 2;
  return 3;
}
export const PRIORITY_NAME: Record<Priority, string> = { 1: 'Immediate', 2: 'Urgent', 3: 'Routine' };

export interface Contribution { var: VarId; level: string; beta: number; or: number }
/** Factors that differ from the reference level, strongest effect first. */
export function contributions(inputs: Inputs): Contribution[] {
  return VARIABLES.flatMap((v) => {
    const c = coefficient(v.id, inputs[v.id]);
    return c ? [{ var: v.id, level: c.level, beta: c.beta, or: c.or }] : [];
  }).sort((a, b) => Math.abs(b.beta) - Math.abs(a.beta));
}

// ---------------------------------------------------------------- coded rows (test set and Birmingham)
/** A coded row has one digit per variable (index of its level), in VARIABLES order. */
export function decode(codes: string): Inputs {
  const out: Inputs = {};
  VARIABLES.forEach((v, i) => {
    out[v.id] = v.levels[Number(codes[i])].id;
  });
  return out;
}

export function hourBand(hour: number): string {
  if (hour < 6) return 'night';
  if (hour < 10) return 'morning';
  if (hour < 16) return 'day';
  if (hour < 20) return 'evening';
  return 'late';
}

/** Area under the ROC curve (Mann-Whitney U, ties counted as half). */
export function auc(scores: number[], labels: number[]): number {
  const idx = scores.map((_, i) => i).sort((a, b) => scores[a] - scores[b]);
  let rankSumPos = 0;
  let pos = 0;
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && scores[idx[j + 1]] === scores[idx[i]]) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) {
      if (labels[idx[k]] === 1) {
        rankSumPos += avgRank;
        pos++;
      }
    }
    i = j + 1;
  }
  const neg = labels.length - pos;
  return (rankSumPos - (pos * (pos + 1)) / 2) / (pos * neg);
}
