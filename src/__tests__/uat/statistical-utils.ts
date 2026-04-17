/**
 * statistical-utils.ts
 * O(1)-memory statistical utilities for LUMIS UAT validation suite.
 * Seed: 42. All proportions use Wilson CI; all means use Welford running algorithm.
 */

// ─── Welford running mean/variance ───────────────────────────────────────────

export interface WelfordState {
  n: number;
  mean: number;
  M2: number;
}

export function welfordInit(): WelfordState {
  return { n: 0, mean: 0, M2: 0 };
}

export function welfordUpdate(state: WelfordState, x: number): WelfordState {
  const n = state.n + 1;
  const delta = x - state.mean;
  const mean = state.mean + delta / n;
  const delta2 = x - mean;
  const M2 = state.M2 + delta * delta2;
  return { n, mean, M2 };
}

export function welfordFinalize(state: WelfordState): {
  mean: number;
  variance: number;
  std: number;
  n: number;
} {
  if (state.n < 2) {
    return { mean: state.mean, variance: 0, std: 0, n: state.n };
  }
  const variance = state.M2 / (state.n - 1);
  return { mean: state.mean, variance, std: Math.sqrt(variance), n: state.n };
}

// ─── Wilson Score CI ─────────────────────────────────────────────────────────

export function wilsonCI(
  successes: number,
  n: number,
  z = 1.96
): { lower: number; upper: number } {
  if (n === 0) return { lower: 0, upper: 0 };
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / denom;
  return {
    lower: Math.max(0, centre - margin),
    upper: Math.min(1, centre + margin),
  };
}

// ─── Chi-square test ──────────────────────────────────────────────────────────

/** Approximates chi-square p-value via regularised incomplete gamma function (series expansion). */
function gammaSeries(a: number, x: number): number {
  const ITMAX = 200;
  const EPS = 3e-7;
  if (x <= 0) return 0;
  let ap = a;
  let del = 1 / a;
  let sum = del;
  for (let i = 0; i < ITMAX; i++) {
    ap += 1;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * EPS) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

function gammaContinuedFraction(a: number, x: number): number {
  const ITMAX = 200;
  const EPS = 3e-7;
  const FPMIN = 1e-300;
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= ITMAX; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

function logGamma(z: number): number {
  // Lanczos approximation
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  const zz = z - 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (zz + i);
  const t = zz + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (zz + 0.5) * Math.log(t) - t + Math.log(x);
}

function incompleteGamma(a: number, x: number): number {
  if (x < 0) return 0;
  if (x === 0) return 0;
  if (x < a + 1) return gammaSeries(a, x);
  return 1 - gammaContinuedFraction(a, x);
}

function chiSquarePValue(chi2: number, df: number): number {
  return 1 - incompleteGamma(df / 2, chi2 / 2);
}

export function chiSquareTest(
  observed: number[],
  expected: number[]
): { statistic: number; pValue: number; degreesOfFreedom: number } {
  let statistic = 0;
  for (let i = 0; i < observed.length; i++) {
    const e = expected[i];
    if (e > 0) {
      statistic += ((observed[i] - e) ** 2) / e;
    }
  }
  const degreesOfFreedom = observed.length - 1;
  const pValue = chiSquarePValue(statistic, degreesOfFreedom);
  return { statistic, pValue, degreesOfFreedom };
}

// ─── Two-proportion Z-test ────────────────────────────────────────────────────

export function twoProportionZ(
  p1: number,
  n1: number,
  p2: number,
  n2: number
): { z: number; pValue: number } {
  const p = (p1 * n1 + p2 * n2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (se === 0) return { z: 0, pValue: 1 };
  const z = (p1 - p2) / se;
  // Two-tailed p-value via standard normal approximation
  const pValue = 2 * (1 - standardNormalCDF(Math.abs(z)));
  return { z, pValue };
}

function standardNormalCDF(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function erf(x: number): number {
  // Abramowitz and Stegun approximation
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const poly =
    t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const result = 1 - poly * Math.exp(-x * x);
  return x >= 0 ? result : -result;
}

// ─── Bootstrap mean CI ────────────────────────────────────────────────────────

export function bootstrapMeanCI(
  samples: number[],
  iterations = 1000,
  z = 1.96
): { lower: number; upper: number; mean: number } {
  if (samples.length === 0) return { lower: 0, upper: 0, mean: 0 };

  const CHUNK = 200;
  let seed = 42;
  const lcg = (): number => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0xffffffff;
  };

  let wState = welfordInit();

  for (let iter = 0; iter < iterations; iter++) {
    // Process one bootstrap resample in chunks of max 200
    const n = Math.min(samples.length, CHUNK);
    let chunkSum = 0;
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(lcg() * samples.length);
      chunkSum += samples[idx];
    }
    const bootMean = chunkSum / n;
    wState = welfordUpdate(wState, bootMean);
  }

  const { mean, std } = welfordFinalize(wState);
  const se = std / Math.sqrt(iterations);
  return { lower: mean - z * se, upper: mean + z * se, mean };
}

// ─── Percentile ───────────────────────────────────────────────────────────────

export function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  const idx = (p / 100) * (sortedArr.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedArr[lo];
  return sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * (idx - lo);
}

// ─── Format CI ───────────────────────────────────────────────────────────────

export function formatCI(lower: number, upper: number, decimals = 1): string {
  const pct = (v: number) => (v * 100).toFixed(decimals);
  return `${pct(lower)}–${pct(upper)}%`;
}

// ─── Mean CI (Welford-based) ──────────────────────────────────────────────────

export function meanCI(
  state: WelfordState,
  z = 1.96
): { lower: number; upper: number } {
  const { mean, std, n } = welfordFinalize(state);
  if (n < 2) return { lower: mean, upper: mean };
  const se = std / Math.sqrt(n);
  return { lower: mean - z * se, upper: mean + z * se };
}
