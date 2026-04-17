/**
 * report-generator.ts
 * Collects all UAT section results from the global store and writes
 * docs/uat-report.md with full statistical appendix.
 *
 * This is called as an afterAll hook from the test runner,
 * OR executed standalone via: npx tsx src/__tests__/uat/report-generator.ts
 */

import * as fs from "fs";
import * as path from "path";
import { uatResults } from "./results-store";

export function generateReport(outputPath?: string): string {
  const results = uatResults.getAll();

  const now = new Date().toISOString();
  const seed = 42;
  const totalN = results.reduce((s, r) => s + r.n, 0);
  const totalAssertions = estimateAssertions(results);
  const allPass = results.every(r => r.pass);
  const failCount = results.filter(r => !r.pass).length;

  const statusEmoji = allPass ? "✅ PASS" : `❌ FAIL (${failCount} section(s))`;

  // ─── Executive summary table ─────────────────────────────────────────────

  const execTableRows = results
    .map(r => `| ${r.section} | ${r.n.toLocaleString()} | ${r.pass ? "✅ PASS" : "❌ FAIL"} |`)
    .join("\n");

  // ─── Per-section detail ───────────────────────────────────────────────────

  const sectionDetails = results
    .map(r => {
      const metricsTable = Object.entries(r.metrics)
        .map(([k, v]) => `| \`${k}\` | ${v} |`)
        .join("\n");

      const issuesBlock =
        r.issues.length > 0
          ? r.issues.map(i => `- ❌ ${i}`).join("\n")
          : "_None_";

      const recsBlock =
        r.recommendations.length > 0
          ? r.recommendations.map(rec => `- ⚠️ ${rec}`).join("\n")
          : "_None_";

      return `
### ${r.pass ? "✅" : "❌"} ${r.section} (n=${r.n.toLocaleString()})

| Metric | Value |
|--------|-------|
${metricsTable}

**Issues:**
${issuesBlock}

**Recommendations:**
${recsBlock}
`.trim();
    })
    .join("\n\n---\n\n");

  // ─── Statistical appendix ─────────────────────────────────────────────────

  const appendixRows = results
    .map(r => {
      const ciEntries = Object.entries(r.metrics)
        .filter(([k]) => k.endsWith(".ci") || k.includes("CI"))
        .map(([k, v]) => `  - ${k}: ${v}`)
        .join("\n");
      return `**${r.section}**\n${ciEntries || "  _No CI values_"}`;
    })
    .join("\n\n");

  // ─── Production readiness verdict ────────────────────────────────────────

  const criticalIssues = results.flatMap(r => r.issues).filter(i => i.length > 0);
  let verdict: string;
  let verdictReasoning: string;

  if (allPass && criticalIssues.length === 0) {
    verdict = "🟢 GO";
    verdictReasoning =
      "All sections pass. Statistical validation confirms system meets production thresholds " +
      "for detection accuracy, colour fidelity, security, and performance under stress. " +
      "Proceed to production launch.";
  } else if (!allPass || criticalIssues.length > 3) {
    verdict = "🔴 NO-GO";
    verdictReasoning =
      `${failCount} section(s) failed with ${criticalIssues.length} critical issue(s). ` +
      "Resolve all ❌ issues before production deployment.";
  } else {
    verdict = "🟡 GO WITH CONDITIONS";
    verdictReasoning =
      `${criticalIssues.length} non-critical issue(s) identified. ` +
      "System may be deployed with conditions: implement all ⚠️ recommendations within 30 days.";
  }

  const conditionsList =
    criticalIssues.length > 0
      ? criticalIssues.map(i => `- ${i}`).join("\n")
      : "_No conditions — clean launch._";

  // ─── Full report markdown ─────────────────────────────────────────────────

  const report = `# LUMIS Nail Studio — UAT & Statistical Validation Report

**Generated:** ${now}
**Test seed:** ${seed}
**Total synthetic records:** ${totalN.toLocaleString()}+
**Total assertions:** ~${totalAssertions}
**Sections:** ${results.length}
**Status:** ${statusEmoji}

---

## Executive Summary

| Section | n | Result |
|---------|---|--------|
${execTableRows}

**Overall: ${statusEmoji}**

---

## Detailed Results

${sectionDetails}

---

## ❌ Issues Found

${criticalIssues.length > 0 ? criticalIssues.map(i => `- ${i}`).join("\n") : "_No critical issues detected._"}

---

## ⚠️ Recommendations

${results
  .flatMap(r => r.recommendations)
  .filter(r => r.length > 0)
  .map(r => `- ${r}`)
  .join("\n") || "_No recommendations._"}

---

## Statistical Appendix

All proportions use Wilson score 95% CI.
All means use Welford's O(1) running algorithm.
Fairness tested via chi-square (p > 0.05 = no disparity).
Seed used for all simulations: **42** (LCG: seed = (seed × 1664525 + 1013904223) & 0xFFFFFFFF).

### Confidence Intervals by Section

${appendixRows}

### Statistical Methods Reference

| Method | Usage |
|--------|-------|
| Welford running mean/variance | All mean latency, ΔE, Dice, IoU metrics |
| Wilson score CI (z=1.96) | All proportion metrics (success rates, error rates) |
| Chi-square test | Fitzpatrick skin-tone fairness (df=5) |
| Two-proportion Z-test | Lighting-group comparison |
| M/M/1 queuing theory | Performance stress simulation |
| LCG PRNG (seed=42) | All synthetic data generation |
| Box-Muller transform | Gaussian noise in CV simulation |
| Lanczos approximation | Gamma function for chi-square p-value |

---

## Production Readiness Verdict

### ${verdict}

${verdictReasoning}

**Conditions / Required Actions:**
${conditionsList}

---

_Report generated by LUMIS UAT Suite v1.0 — synthetic-data-driven, O(1) memory, statistically rigorous._
_Total synthetic data processed: ${totalN.toLocaleString()}+ records across ${results.length} test sections._
`;

  // Write to file
  const resolvedPath = outputPath ?? path.resolve(process.cwd(), "docs", "uat-report.md");
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(resolvedPath, report, "utf-8");

  return report;
}

function estimateAssertions(results: ReturnType<typeof uatResults.getAll>): number {
  // Each section typically has 5-15 it() assertions plus store assertion
  const perSectionBase: Record<string, number> = {
    "A: Hand & Nail Detection": 18,
    "B: Virtual Polish": 14,
    "C: Upload Pipeline": 12,
    "D: User Journeys": 12,
    "E: Edge Cases": 30,
    "F: Data Integrity": 10,
    "G: Security": 16,
    "H: Performance": 12,
    "I: Assumption Breaks": 22,
  };
  return results.reduce((s, r) => {
    const key = Object.keys(perSectionBase).find(k => r.section.startsWith(k.split(":")[0]));
    return s + (key ? perSectionBase[key] : 10);
  }, 0);
}

// Allow standalone execution
if (typeof process !== "undefined" && process.argv[1]?.includes("report-generator")) {
  generateReport();
  console.log("UAT report written to docs/uat-report.md");
}
