// Larger real-data files, loaded on demand so the first page stays small.
import { VARIABLES, decode, probability, type Inputs } from './model';

export interface TestRow { codes: string; outcome: 0 | 1 | 2 } // 0 slight, 1 serious, 2 fatal

let testCache: Promise<TestRow[]> | null = null;
export function loadTestset(): Promise<TestRow[]> {
  testCache ??= import('../data/testset.json').then((m) =>
    (m.default.rows as string[]).map((r) => ({ codes: r.slice(0, -1), outcome: Number(r.at(-1)) as 0 | 1 | 2 })),
  );
  return testCache;
}

export interface Hotspot {
  rank: number; roads: string; e: number; n: number; radius_m: number; collisions: number;
  ksi: number; fatal: number; pedestrian: number; night_or_dark: number;
}
export interface Coverage { mean_km: number; median_km: number; within_2km: number; within_3km: number }
export interface StandbyOption {
  k: number;
  points: { e: number; n: number; train_ksi: number }[];
  even_points: { e: number; n: number }[];
  test: { kmeans: Coverage; even: Coverage; random: Coverage };
}
export interface BCollision {
  id: string; e: number; n: number; date: string; time: string; sev: 1 | 2 | 3; hot: number; road: string; x: string;
}
export interface Birmingham {
  district: string; year: number; collisions_in_district: number; excluded_bad_coordinates: string[];
  collisions_used: number; ksi: number; fatal: number;
  bounds: { e_min: number; e_max: number; n_min: number; n_max: number };
  hull: [number, number][];
  dbscan: { eps_m: number; min_samples: number; hotspots: Hotspot[]; collisions_in_hotspots: number };
  standby: { train_ksi: number; test_ksi: number; options: StandbyOption[] };
  collisions: BCollision[];
}

let bCache: Promise<Birmingham> | null = null;
export function loadBirmingham(): Promise<Birmingham> {
  bCache ??= import('../data/birmingham.json').then((m) => m.default as unknown as Birmingham);
  return bCache;
}

// ---------------------------------------------------------------- similar real collisions
const MATCH_ORDER = ['pedestrian', 'motorcycle', 'cycle', 'speed', 'casualties', 'light', 'vehicles', 'area'];
const MIN_MATCHES = 40;

export interface Similar { n: number; ksi: number; fatal: number; matchedOn: string[] }

/**
 * Real October to December 2015 collisions that share the most important answers with this call.
 * Starts from all eight answers and drops the least important until at least 40 collisions match.
 */
export function similar(rows: TestRow[], inputs: Inputs): Similar {
  // Position of each variable in a coded row, and the digit this call has for it.
  const want = MATCH_ORDER.map((v) => {
    const pos = VARIABLES.findIndex((x) => x.id === v);
    const digit = String(VARIABLES[pos].levels.findIndex((l) => l.id === inputs[v]));
    return { v, pos, digit };
  });
  for (let keep = want.length; keep >= 1; keep--) {
    const use = want.slice(0, keep);
    let n = 0;
    let ksi = 0;
    let fatal = 0;
    for (const r of rows) {
      if (use.every((w) => r.codes[w.pos] === w.digit)) {
        n++;
        if (r.outcome >= 1) ksi++;
        if (r.outcome === 2) fatal++;
      }
    }
    if (n >= MIN_MATCHES || keep === 1) return { n, ksi, fatal, matchedOn: use.map((w) => w.v) };
  }
  return { n: 0, ksi: 0, fatal: 0, matchedOn: [] };
}

/** Predicted probability for a coded row. */
export const rowProbability = (codes: string) => probability(decode(codes));
