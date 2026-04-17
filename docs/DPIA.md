# Data Protection Impact Assessment (DPIA)
## LUMIS Nail Studio — Virtual Nail Try-On Application

**Document version:** 1.0.0
**Date:** 12 April 2026
**Owner:** LUMIS Couture Ltd — privacy@lumis.studio
**Regulatory framework:** GDPR Article 35 / POPIA Section 4 (high-risk processing)
**Review cycle:** 12 months or upon material system change

---

## 1. Purpose and Scope

This DPIA evaluates the privacy risks of processing personal data within the LUMIS Nail Studio web application, a browser-based augmented reality (AR) nail colour try-on tool.

**Processing activities assessed:**
1. Real-time camera feed processing (hand landmark detection)
2. Cart data persistence (product IDs + timestamps in localStorage)
3. Consent lifecycle management (consent record in localStorage)

**Out of scope:**
- Server-side data processing (none exists — architecture is fully client-side)
- Marketing communications (no email collection)
- Third-party analytics (none deployed)

---

## 2. Processing Description

### 2.1 Camera Processing

| Attribute | Detail |
|-----------|--------|
| Data type | Raw video frames from device camera |
| Processing purpose | Real-time hand landmark detection for nail overlay placement |
| Processor | MediaPipe HandLandmarker (Google open-source, WebAssembly, CPU delegate) |
| Processing location | **On-device only** — browser WASM sandbox |
| Data outputs | 21 (x,y,z) normalised landmark coordinates per detected hand per frame |
| Retention | Zero — frames processed in memory; no frame or landmark stored |
| Transmission | None — zero network egress of camera data |
| Consent required | Yes — GDPR Art. 6(1)(a) / POPIA §11(1)(a) |

### 2.2 Cart / localStorage

| Attribute | Detail |
|-----------|--------|
| Data type | Product IDs (non-personal), quantity, addedAt timestamp |
| Processing purpose | Persist cart between browser sessions |
| Storage location | Browser localStorage (user's device only) |
| Retention | 30 days from `addedAt`; pruned at app startup |
| Transmission | None — never sent to any server |
| Consent required | Yes — gated by `hasConsent()` in `try-on-context.tsx` |

### 2.3 Consent Record

| Attribute | Detail |
|-----------|--------|
| Data type | Consent timestamp (ISO 8601), policy version, boolean flags |
| Processing purpose | Evidence of consent; version-gate for policy changes |
| Storage location | Browser localStorage (`lumis_consent_v1`) |
| Retention | Until withdrawn by user or policy version changes |
| Transmission | None |

---

## 3. Necessity and Proportionality

| Test | Assessment |
|------|-----------|
| **Specified purpose** | Camera used only for AR overlay — no other use, clearly disclosed |
| **Adequate** | Minimum data needed (landmarks only, not frames) |
| **Relevant** | Landmarks are required for nail position calculation |
| **Not excessive** | 21 points × 3 floats per frame; no persistent storage |
| **Accuracy** | In-memory only; no stale data possible |
| **Storage limitation** | Zero storage for camera data; 30-day expiry for cart |
| **Integrity / confidentiality** | Stays within browser sandbox; no server attack surface |

**Proportionality verdict:** Processing is proportionate. No less privacy-invasive alternative exists for on-device AR that achieves the same user-facing accuracy.

---

## 4. Biometric Data Clarification (GDPR Art. 9 / POPIA §26)

**Question:** Do MediaPipe hand landmarks constitute biometric data under GDPR Art. 9?

**Assessment:**

| Factor | Detail |
|--------|--------|
| Definition (GDPR Art. 4(14)) | Biometric data = "specific technical processing ... relating to the physical, physiological or behavioural characteristics of a natural person, which allow or confirm the unique identification of that natural person" |
| MediaPipe output | 21 normalised (x,y,z) landmark coordinates representing hand geometry |
| Uniquely identifying? | **No.** Hand geometry landmarks are not unique identifiers. Hand dimensions vary by person but are shared broadly across demographics. A landmark set cannot identify a specific individual. |
| Used for identification? | **No.** Landmarks are used solely for geometric nail placement calculation, then discarded. |
| Stored? | **No.** Landmarks exist only in memory during the current animation frame. |
| **Conclusion** | Landmark coordinates are **not biometric data** under GDPR Art. 9 / POPIA §26. No special-category processing is triggered. |

**Additional note:** The Privacy Policy at `/privacy` explicitly states this distinction to provide transparency under GDPR Art. 13.

---

## 5. Risk Assessment

### Risk Register

| # | Risk | Likelihood | Impact | Inherent Risk | Mitigation | Residual Risk |
|---|------|-----------|--------|--------------|------------|---------------|
| R1 | Camera feed intercepted by third-party script | Low | Critical | High | No third-party scripts loaded; strict CSP blocks inline scripts | Very Low |
| R2 | LocalStorage read by malicious extension | Low | Medium | Medium | Data is non-PII (product IDs + timestamps only) | Very Low |
| R3 | Consent bypass — user accesses app without consent | Very Low | Medium | Low | ConsentBanner blocks all interaction; `hasConsent()` gates localStorage writes | Negligible |
| R4 | Policy version change without user re-consent | Very Low | Medium | Low | `getConsent()` invalidates old version; banner re-shown automatically | Negligible |
| R5 | Browser crash exposes landmark data | Very Low | Low | Very Low | Landmarks in JS heap; OS doesn't persist browser memory across crashes | Negligible |
| R6 | User captured PNG stored server-side | N/A | High | N/A | No server upload exists; PNG is browser-to-device download only | N/A |
| R7 | CDN compromise (MediaPipe WASM) | Very Low | Critical | High | Version pinned (`0.10.34`); CI verifies version drift; Subresource Integrity can be added | Low |

### Risk R7 — CDN Integrity (Recommended Enhancement)

The MediaPipe WASM bundle is loaded from `cdn.jsdelivr.net`. While the version is pinned, Subresource Integrity (SRI) hashes are not yet applied to the `<script>` tag in `mediapipe.ts`. **Recommendation:** Add `integrity="sha384-..."` attribute to the script loader to cryptographically verify the bundle.

---

## 6. Data Subject Rights — Implementation Evidence

| Right | Regulation | Implementation | File | Test |
|-------|-----------|----------------|------|------|
| Right to be informed | GDPR Art. 13, POPIA §18 | `/privacy` page, consent banner disclosures | `privacy/page.tsx`, `ConsentBanner.tsx` | E2E UC-01 |
| Right of access | GDPR Art. 15, POPIA §23 | `getDataSummary()` API + Profile dashboard | `consent.ts`, `profile/page.tsx` | — |
| Right to erasure | GDPR Art. 17, POPIA §24 | `withdrawConsentAndEraseData()` removes all keys | `consent.ts`, `profile/page.tsx` | E2E UC-07 |
| Right to withdraw consent | GDPR Art. 7(3) | Profile → "Erase all my data" | `profile/page.tsx` | E2E UC-07 |
| Right not to be subject to automated decision-making | GDPR Art. 22 | No profiling or automated decisions exist | — | — |

---

## 7. Third-Party Processors

| Processor | Service | Data shared | Basis | Contract? |
|-----------|---------|------------|-------|-----------|
| Google (MediaPipe) | Hand landmark detection WASM | **None** — WASM runs client-side | N/A | N/A |
| Google Fonts | Font delivery | IP address (via CDN request) | Legitimate interest | Google standard DPA |
| Unsplash | Product imagery | IP address (via CDN request) | Legitimate interest | Unsplash ToS |
| Vercel / Netlify (deployment) | Hosting | IP address (access logs) | Legitimate interest | Provider DPA |

**No processor receives camera data, landmark data, or cart contents.**

---

## 8. DPO Consultation

A DPO appointment is recommended before public launch. Until one is appointed, queries should be directed to privacy@lumis.studio and escalated to the South African Information Regulator (inforeg.org.za) for POPIA matters or the relevant EU supervisory authority for GDPR matters.

---

## 9. Approval and Review

| Role | Name | Date | Sign-off |
|------|------|------|---------|
| Privacy Officer / DPO | TBD | — | Pending |
| Engineering Lead | TBD | — | Pending |
| Legal Counsel | TBD | — | Pending |

**Next review date:** 12 April 2027 (or upon any material system change)

---

## 10. Change Log

| Version | Date | Change |
|---------|------|--------|
| 1.0.0 | 2026-04-12 | Initial DPIA — covers camera processing, localStorage, consent lifecycle |
