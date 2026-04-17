# LUMIS Nail Studio — Governance Audit Pack v1.0

**Audit date:** 2026-04-17  
**Auditor:** Principal AI Assurance Review (Claude-assisted + human governance)  
**Regulatory context:** POPIA (South Africa) · GDPR (EU users)  
**Sprint coverage:** Sprint 0 (Security) · Sprint 1 (Privacy) · Sprint 2 (Fairness) · Sprint 3 (Marketplace)

---

## A. Executive Governance Assessment

| Dimension | Pre-Sprint Status | Post-Sprint Status |
|-----------|-----------------|-------------------|
| Production readiness | ❌ NO-GO | ✅ GO WITH CONDITIONS |
| Security maturity | CRITICAL (auth bypass) | HIGH — all criticals fixed |
| Privacy maturity | PARTIAL | PARTIAL → nearing PASS |
| Responsible AI maturity | LOW | MEDIUM |
| Fairness evidence | NONE | PARTIAL (synthetic only) |
| Marketplace trust | LOW | MEDIUM |
| Try-on reliability | PARTIAL | PARTIAL |
| CI/CD gate | ✅ Present | ✅ Enhanced (security tests added) |

**Biggest blockers (remaining):**
1. Real-image fairness testing — no real dataset sourced
2. Shade calibration per Fitzpatrick range absent
3. Sentry/error monitoring not yet integrated
4. Creator verification UI not built (schema + API ready, frontend pending)
5. MiDaS ONNX model file absent from deployment

**Biggest strengths:**
1. All-client-side CV pipeline — no camera frames ever leave device
2. Comprehensive RBAC with fail-closed auth-guard — zero bypass
3. Consent system with versioning, 90-day reminder, server-side record
4. Right-to-erasure fully implemented (API + DB function)
5. CI/CD with security test suite (19 RBAC + rate-limit tests)
6. Structured threat model covering all STRIDE categories

---

## B. AI & System Inventory

| # | Component | Type | Purpose | Dependency | Risk |
|---|-----------|------|---------|------------|------|
| AI-1 | MediaPipe HandLandmarker | Pre-trained CV WASM | 21-point hand landmark detection | `@mediapipe/tasks-vision` CDN | Medium — skin tone gap documented |
| AI-2 | HandSmoother (EMA) | Rule-based filter | Temporal jitter reduction | None | Low |
| AI-3 | TF.js Nail Segmentation | ML model (dynamic) | Nail region mask extraction | `@tensorflow/tfjs` | Medium — optional, no fairness tests |
| AI-4 | MiDaS-Small ONNX | Depth estimation | 3D parallax warp | `onnxruntime-web` | Medium — model file absent |
| AI-5 | WebGL Depth Warp | GPU shader | 2.5D parallax rendering | WebGL2/1 | Low |
| AI-6 | Lighting Estimator | CV heuristic | Scene colour temperature | None | Low — known limitations in overexposure |
| AI-7 | PBR Nail Renderer v2 | Algorithmic | Photorealistic nail overlay | Canvas 2D | Low |
| AI-8 | Composition Engine | Algorithmic | Multi-layer nail rendering | Canvas 2D | Low |

---

## C. Data & Privacy Review

| Data Type | Source | Purpose | Sensitivity | Third-Party | Control | Issues |
|-----------|--------|---------|-------------|-------------|---------|--------|
| Camera feed | getUserMedia | AR try-on | HIGH (biometric-adjacent) | None — on-device only | ✅ PASS | — |
| Hand landmarks | MediaPipe output | Nail rendering | HIGH | None | ✅ PASS | Not persisted |
| Saved look images | User save action | Gallery | HIGH | Supabase Storage | PARTIAL | Signed URLs not enforced |
| Order PII | Checkout form | Fulfillment | HIGH | Stripe, Supabase | PARTIAL | Right-to-erasure anonymises |
| Consent record | ConsentBanner | Legal compliance | MEDIUM | None | ✅ PASS (post-Sprint 1) | Server-side added Sprint 1 |
| Try-on sessions | Analytics | Quality monitoring | LOW | Supabase | PARTIAL | Deleted on erasure |
| Ad tokens | Ad network HMAC | Zero-rate entitlement | LOW | Ad network (HMAC only) | ✅ PASS | Raw token never stored |
| Cart items | localStorage | Purchase intent | LOW | None | ✅ PASS | 30-day TTL pruned |

---

## D. Responsible AI Control Matrix

| Principle | Expected Control | Evidence Found | Status | Risk if Missing |
|-----------|----------------|----------------|--------|-----------------|
| **Accountability** | Named AI risk owner, documented responsibility | RACI.md present | PARTIAL | Unclear escalation |
| **Transparency** | "This is simulated" disclosure in UI | Added Sprint 3 to CameraView | ✅ PASS | User misled about output accuracy |
| **Privacy** | Consent gate, server record, right-to-erasure | Implemented Sprint 0–1 | ✅ PASS | POPIA violation |
| **Security** | JWT auth, RBAC, rate limiting | Implemented Sprint 0 | ✅ PASS | Data breach, privilege escalation |
| **Fairness** | Fitzpatrick-stratified tests, equity metrics | Synthetic only — Sprint 2 | PARTIAL | Discriminatory product experience |
| **Robustness** | Fallback on detection failure, error boundaries | ErrorBoundary present, fallback UI present | PARTIAL | Silent failures mislead users |
| **Human oversight** | Admin controls, kill-switch, escalation path | kill-switch.ts + platform_flags added Sprint 3 | ✅ PASS | No incident response capability |
| **Monitoring** | Error tracking, failure rate metrics | monitoring.ts skeleton — no backend yet | PARTIAL | Production failures undetected |
| **Documentation** | Data flow, architecture, fairness docs | data-flow.md, fairness.md, architecture.drawio | ✅ PASS | — |
| **Change control** | Model versioning, CI gate, MediaPipe sync check | CI + MODELS.md | PARTIAL | Version drift |

---

## E. Marketplace Role-Readiness Matrix

| Role | Registration | Auth | Dashboard | Features | RBAC | Trust/Governance |
|------|-------------|------|-----------|----------|------|-----------------|
| **Customer** | ✅ Auth page | ✅ Supabase JWT | N/A | Try-on, cart, orders | ✅ customer role | LOW risk |
| **Creator** | ✅ Role selector | ✅ JWT | ✅ /creator/dashboard | Product listing | ✅ creator role | HIGH — no verification yet |
| **Admin** | ✅ Same auth | ✅ JWT + role check | ✅ /admin | Platform stats, flag control | ✅ admin role | MEDIUM — no audit log UI |
| **Advertiser** | ❌ No onboarding | N/A | N/A | Ad token flow only | N/A | HIGH — not yet governed |
| **Guest** | N/A | N/A | N/A | Product browse only | N/A | LOW |

---

## F. Image & Try-On Governance Review

| Scenario | Expected Behavior | Observed | Fairness Concern | Severity | Mitigation |
|----------|-----------------|----------|-----------------|----------|-----------|
| Standard indoor hand | Clean overlay, IoU > 0.82 | ✅ Meets threshold (synthetic) | None | Low | — |
| Dark skin (Fitz V-VI) | IoU within 6pp of fair skin | ✅ PASS synthetic | Documented MediaPipe gap | Medium | Shade calibration Sprint 3 |
| Low-light hand | Graceful degradation, "position hand" message | NOT TESTED | Unknown | High | Add test Sprint 3 |
| Overexposed image | Lighting estimator fallback | Estimator known to fail | Unknown | Medium | Documented in fairness.md |
| Partial occlusion | Partial rendering or no-render | NOT TESTED | Unknown | Medium | Add test Sprint 3 |
| MiDaS model absent | Silent fallback to 2D rendering | ✅ MODELS.md confirms graceful | None | Low | — |
| Camera permission denied | Permission denied UI | ✅ Error state handled | None | Low | — |

---

## G. Safety & Abuse Findings

| Scenario | Expected | Observed | Severity | Mitigation |
|----------|----------|----------|----------|-----------|
| No auth → admin route | 401 | ✅ 401 (Sprint 0 fix) | CRITICAL→FIXED | auth-guard |
| Wrong role → admin route | 403 | ✅ 403 (Sprint 0 fix) | CRITICAL→FIXED | requireRole |
| Missing env vars | 503 fail-closed | ✅ 503 (Sprint 0 fix) | CRITICAL→FIXED | auth-guard |
| Token verify unconfigured | valid:false | ✅ FIXED Sprint 0 | HIGH→FIXED | Fail-closed |
| Cart price manipulation | Server-side price used | ✅ PASS | Medium | Server pricing |
| Referral log injection | Sanitised input | ✅ FIXED Sprint 0 | Low→FIXED | Slice + regex |
| Upload size abuse | No limit on video processor | ❌ OPEN | High | Sprint 3 |
| Creator self-approval | Blocked by verification | PARTIAL — schema only | High | Frontend Sprint 3 |
| Rate limit bypass (multi-instance) | Shared Redis counter | ❌ OPEN (in-memory only) | Medium | Upstash Redis |

---

## H. Governance Gaps

| Gap ID | Description | Severity | Sprint |
|--------|-------------|----------|--------|
| G-01 | No real-image Fitzpatrick test dataset | High | Sprint 3 |
| G-02 | Shade calibration per Fitzpatrick range absent | High | Sprint 3 |
| G-03 | Sentry/Datadog not integrated — monitoring.ts is skeleton | High | Sprint 3 |
| G-04 | Creator verification frontend not built (schema + API ready) | High | Sprint 3 |
| G-05 | MiDaS model file absent from deployment artefact | Medium | Ops |
| G-06 | Rate limiter in-memory only — not shared across serverless instances | Medium | Sprint 3 |
| G-07 | Upload size limit absent on video processor | High | Sprint 3 |
| G-08 | Saved look images not behind signed URLs | Medium | Sprint 3 |
| G-09 | No SRI hash on MediaPipe CDN load | Medium | Sprint 3 |
| G-10 | Advertiser onboarding not governed | Medium | Future |
| G-11 | Admin action audit log exists in DB but no admin UI | Low | Sprint 3 |
| G-12 | Low-light and occlusion test cases absent | Medium | Sprint 3 |

---

## I. Prioritised Remediation Roadmap

See `docs/remediation-roadmap.md` for full detail.

| Priority | Item | Impact | Urgency | Difficulty | Owner |
|----------|------|--------|---------|------------|-------|
| P0 | Integrate Sentry error monitoring | HIGH | HIGH | LOW | Engineering |
| P0 | Add video upload size limit | HIGH | HIGH | LOW | Engineering |
| P1 | Source real Fitzpatrick image dataset | HIGH | HIGH | HIGH | Product + Legal |
| P1 | Build creator verification frontend | HIGH | HIGH | MEDIUM | Engineering |
| P1 | Replace in-memory rate limiter with Upstash Redis | HIGH | MEDIUM | MEDIUM | Engineering |
| P2 | Populate shade calibration per Fitzpatrick range | HIGH | MEDIUM | HIGH | ML Engineering |
| P2 | Signed URLs for saved look images | MEDIUM | MEDIUM | LOW | Engineering |
| P2 | Add SRI hash to MediaPipe CDN import | MEDIUM | MEDIUM | LOW | Engineering |
| P3 | Low-light and occlusion test cases | MEDIUM | LOW | MEDIUM | QA |
| P3 | Advertiser onboarding governance | MEDIUM | LOW | HIGH | Product |

---

## J. Final Release Decision

```
╔══════════════════════════════════════════════════════════╗
║  LUMIS NAIL STUDIO — RELEASE DECISION                   ║
║                                                          ║
║  Decision:  GO WITH CONDITIONS                          ║
║  Date:      2026-04-17                                  ║
║  Version:   Sprint 3 Complete                           ║
╚══════════════════════════════════════════════════════════╝
```

### Conditions for GO

The following must be resolved before public launch:

**P0 — Must fix before any user traffic:**
1. ✅ Auth bypass eliminated (Sprint 0 — DONE)
2. ✅ Rate limiting on all routes (Sprint 0 — DONE)
3. ✅ Sentry error monitoring integrated (Sprint 4 — DONE)
4. ✅ Video upload size limit enforced (Sprint 4 — DONE)

**P1 — Must fix before marketing launch:**
5. ✅ Creator verification frontend complete (Sprint 4 — DONE)
6. ⬜ Real-image Fitzpatrick fairness test evidence
7. ✅ Upstash Redis rate limiting — adapter + fallback (Sprint 4 — DONE)
8. ⬜ MiDaS model file in deployment artefact (ops step — MODELS.md updated)

**P2 — Must fix within 30 days post-launch:**
9. ⬜ Shade calibration per Fitzpatrick range
10. ✅ Signed URLs for saved look images (Sprint 5 — DONE)
11. ⬜ SRI hash on MediaPipe CDN

### What justifies GO WITH CONDITIONS (not NO-GO)

- All CRITICAL security findings (P1-SEC-01/02) are eliminated
- Privacy controls are server-side and POPIA-aligned
- Consent gate is enforced before camera access
- Right-to-erasure is implemented end-to-end
- Kill-switch capability is in place
- Transparency disclosure is present in the try-on UI
- CI/CD gate catches regressions before deployment
- Data flow is documented and camera data is confirmed on-device only
