# LUMIS Nail Studio — Fairness & Robustness Report

**Version:** 1.0.0  
**Sprint:** 2  
**Last updated:** 2026-04-17  
**Author:** AI Assurance Review (automated + human governance)

---

## 1. Scope

This document covers the fairness and robustness evaluation of the LUMIS nail virtual try-on pipeline across:
- Fitzpatrick skin tone scale (Groups I-II, III-IV, V-VI)
- Lighting conditions (low-light, overexposed, mixed)
- Hand geometry variations (short/long nails, angled fingers, partial occlusion)
- Camera quality variations

---

## 2. Fairness Thresholds (Governance Commitments)

The following inter-group deltas must not be exceeded. Any CI run that violates these thresholds constitutes a **fairness regression** and blocks release.

| Metric | Max Allowed Delta Between Any Two Groups | Rationale |
|--------|------------------------------------------|-----------|
| Mean IoU | ≤ 0.06 (6 percentage points) | Overlay coverage must not differ by skin tone |
| Pass Rate | ≤ 0.10 (10 percentage points) | Overall quality gate must be equitable |
| Mean Cuticle Error | ≤ 1.5 px | Nail placement accuracy must be consistent |
| Min Group IoU floor | ≥ 0.78 per group | No group may fall below degraded-mode threshold |

---

## 3. Methodology

### 3.1 Current Test Approach (Sprint 2 baseline)

Tests use **synthetic reference data** with known ground-truth masks and landmarks generated programmatically. Each Fitzpatrick group is simulated with group-specific quality parameters derived from published MediaPipe evaluation benchmarks:

| Fitzpatrick Group | Simulated Mask Quality | Landmark Drift | Notes |
|-------------------|----------------------|----------------|-------|
| I-II (very fair) | 0.97 | 0.8 px | Best case — high contrast |
| III-IV (medium) | 0.95 | 1.0 px | Moderate contrast |
| V-VI (dark) | 0.93 | 1.2 px | Lower contrast — known MediaPipe gap |

**Limitation:** Synthetic data cannot fully represent real-world variance in skin appearance, vein visibility, nail translucency, or lighting interaction across diverse users.

### 3.2 Planned Real-Image Testing (Sprint 3 / Post-Launch)

Real-image fairness testing requires:
- A consented, representative hand image dataset spanning all Fitzpatrick groups
- POPIA/GDPR compliant data collection (explicit consent for research use)
- Copyright clearance or use of a permissive dataset (e.g., 11k Hands dataset)
- Structured evaluation with human-annotated ground-truth masks

**Status: NO EVIDENCE FOUND** — real-image dataset not yet sourced. This is a **HIGH** governance gap.

---

## 4. Sprint 2 Test Results

**Test file:** `src/__tests__/fairness/fitzpatrick-fairness.test.ts`  
**Test run:** 2026-04-17 | **Result:** 18/18 PASS

### 4.1 Per-Group Metrics (Synthetic Baseline)

| Fitzpatrick Group | Mean IoU | Pass Rate | Mean Cuticle Error | Mean ΔE |
|-------------------|----------|-----------|-------------------|---------|
| I-II | ~0.955 | 100% | ~1.2 px | ~2.5 |
| III-IV | ~0.940 | 100% | ~1.5 px | ~2.7 |
| V-VI | ~0.920 | 95% | ~1.8 px | ~3.1 |

### 4.2 Inter-Group Deltas

| Metric | Max Delta | Threshold | Status |
|--------|-----------|-----------|--------|
| IoU delta | ~0.035 | ≤ 0.060 | ✅ PASS |
| Pass rate delta | ~0.050 | ≤ 0.100 | ✅ PASS |
| Cuticle error delta | ~0.6 px | ≤ 1.5 px | ✅ PASS |
| All groups ≥ IoU floor | ✅ | ≥ 0.78 | ✅ PASS |

**Overall fairness verdict: PASS (synthetic baseline)**

---

## 5. Known Biases and Limitations

### 5.1 MediaPipe HandLandmarker — Documented Skin Tone Gap

Published research (Schumann et al., 2023 — "Consensus on skin colour description") and internal evaluation of MediaPipe Tasks Vision indicate:
- Landmark detection confidence tends to be 2–4% lower for Fitzpatrick V-VI under standard indoor lighting
- The gap widens under low-contrast conditions (overexposed backgrounds, bright ambient light)
- The LUMIS EMA smoother (α=0.35) partially compensates by smoothing jitter, but does not correct detection failures

**Mitigation in place:**
- `destroyHandLandmarker()` on unmount prevents stale model state
- HandSmoother rejects outlier frames (jitter > 1.5px) to reduce cascade errors
- Fallback: if landmark detection fails entirely, the renderer shows a "position your hand" UI — it does NOT silently render a misaligned overlay

**Mitigation gap:**
- No adaptive confidence threshold per skin tone group
- No dynamic exposure compensation instruction in the UI

### 5.2 Shade Calibration — Fitzpatrick Range Field Exists but is Unpopulated

The `shade_definitions` table includes a `fitzpatrick_range` column for colour calibration per skin tone. At Sprint 2:
- The column exists in the schema (**PARTIAL**)
- No calibrated shade data exists for specific Fitzpatrick ranges (**GAP**)
- All users receive the same PBR rendering regardless of skin tone

**Impact:** Nail overlays may appear less accurate on darker skin tones because the contrast between the overlay and the skin surface is not modelled. This is a **visual fairness gap** even if landmark detection is equitable.

### 5.3 Lighting Estimator Limitations

The `lighting-estimator.ts` uses a pixel luminance centroid approach. Known edge cases:
- Overexposed images (all pixels near 255) → estimator returns incorrect light direction
- Ring-lit hands (common in nail content creation) → estimator underestimates key light intensity
- No UV/infrared correction for different skin tones under fluorescent lighting

---

## 6. Scenario Coverage Matrix

| Scenario | Tested | Method | Result |
|----------|--------|--------|--------|
| Fair skin (Fitzpatrick I-II) | ✅ | Synthetic | PASS |
| Medium skin (Fitzpatrick III-IV) | ✅ | Synthetic | PASS |
| Dark skin (Fitzpatrick V-VI) | ✅ | Synthetic | PASS |
| Short nails | ✅ | Geometric fixture | PASS |
| Long nails | ✅ | Geometric fixture | PASS |
| Angled fingers (30°) | ✅ | Landmark drift simulation | PASS |
| Partial occlusion (50%) | ⚠️ | Not in Sprint 2 | NOT TESTED |
| Low-light (< 50 lux) | ⚠️ | Not in Sprint 2 | NOT TESTED |
| Overexposed | ⚠️ | Not in Sprint 2 | NOT TESTED |
| Cluttered background | ⚠️ | Not in Sprint 2 | NOT TESTED |
| Real hand images — any group | ❌ | No dataset sourced | NO EVIDENCE |

---

## 7. Remediation Plan

| Gap | Priority | Sprint | Owner |
|-----|----------|--------|-------|
| Source real-image dataset with Fitzpatrick coverage | High | Sprint 3 | Product + Legal |
| Populate `fitzpatrick_range` calibration in `shade_definitions` | High | Sprint 3 | Engineering |
| Add dynamic exposure guidance UI (dark tone tip) | Medium | Sprint 3 | UX |
| Adaptive confidence threshold per skin tone | Medium | Post-launch | ML Engineering |
| Low-light and occlusion test cases | Medium | Sprint 3 | QA |

---

## 8. Governance Conclusion

**Sprint 2 fairness status: CONDITIONAL PASS**

The synthetic baseline demonstrates that the pipeline does not have catastrophic fairness gaps. However:
1. Real-image testing is absent — this must be completed before launch
2. Shade calibration per Fitzpatrick range is absent — dark-tone rendering quality is unverified
3. Low-light and occlusion scenarios are untested

The app must not be launched with claims of "works for all skin tones" without evidence from real-image evaluation. The privacy policy and try-on UI should clearly state that results vary by lighting and skin tone until calibration is complete.
