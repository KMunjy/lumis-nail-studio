/**
 * results-store.ts
 * Shared mutable store for UAT section results.
 * Each test file writes its summary here; report-generator reads it.
 */

export interface SectionResult {
  section: string;
  n: number;
  pass: boolean;
  metrics: Record<string, number | string>;
  issues: string[];
  recommendations: string[];
}

class ResultsStore {
  private results: SectionResult[] = [];

  add(result: SectionResult): void {
    this.results.push(result);
  }

  getAll(): SectionResult[] {
    return [...this.results];
  }

  clear(): void {
    this.results = [];
  }
}

export const uatResults = new ResultsStore();
