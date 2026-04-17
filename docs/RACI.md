# RACI Matrix — LUMIS Nail Studio
## Responsibility, Accountability, Consulted, Informed

**Version:** 1.0.0 | **Date:** 12 April 2026

### Role Definitions

| Abbreviation | Meaning |
|-------------|---------|
| **R** | **Responsible** — does the work |
| **A** | **Accountable** — owns the outcome; final decision-maker |
| **C** | **Consulted** — provides input before action |
| **I** | **Informed** — notified of outcome |

### Assumed Roles

| Role | Description |
|------|-------------|
| **Engineering Lead** | Senior developer owning technical decisions; owns CI/CD pipeline |
| **Frontend Developer** | Implements React/Next.js features; writes Dim 1 & 2 tests |
| **QA Engineer** | Owns test strategy, Playwright E2E suite, axe-core a11y |
| **Privacy Officer / DPO** | Owns GDPR/POPIA compliance; reviews consent changes |
| **DevSecOps** | Owns security scanning, Trivy, Gitleaks, npm audit |
| **Product Owner** | Defines acceptance criteria; signs off UAT |
| **MLOps Engineer** | Owns MediaPipe version, model manifest, CDN pinning |

---

## RACI Table

### A. AR Rendering & Accuracy

| Activity | Eng Lead | Frontend Dev | QA Engineer | Privacy Officer | DevSecOps | Product Owner | MLOps |
|----------|----------|-------------|-------------|-----------------|-----------|---------------|-------|
| Calibrate NW_SCALE + per-finger multipliers | C | **R/A** | C | — | — | I | C |
| Write Dim 1 unit tests (nail-renderer.test.ts) | C | **R** | **A** | — | — | I | — |
| Validate 96.1% precision target | C | R | **R/A** | — | — | **C** | — |
| Add new nail shapes / finishes | C | **R** | C | — | — | **A** | — |
| Stage 2 segmentation model training | **A** | C | C | — | — | I | **R** |
| Update model.manifest.json | **A** | R | I | — | I | I | **R** |

### B. Camera & MediaPipe Integration

| Activity | Eng Lead | Frontend Dev | QA Engineer | Privacy Officer | DevSecOps | Product Owner | MLOps |
|----------|----------|-------------|-------------|-----------------|-----------|---------------|-------|
| Update MediaPipe version | **A** | R | C | I | **C** | I | **R** |
| Pin CDN version in mediapipe.ts | **A** | R | I | — | C | — | **R** |
| CI model-health CDN check | C | — | I | — | **R/A** | — | C |
| Version drift detection in CI | C | — | — | — | **R/A** | — | **C** |
| CameraView rAF loop changes | **A** | **R** | C | I | — | I | C |

### C. Testing

| Activity | Eng Lead | Frontend Dev | QA Engineer | Privacy Officer | DevSecOps | Product Owner | MLOps |
|----------|----------|-------------|-------------|-----------------|-----------|---------------|-------|
| Dimension 1 — Unit tests (vitest, geometry) | C | **R/A** | C | — | — | — | — |
| Dimension 2 — Integration tests (vitest, context) | C | **R** | **A** | — | — | — | — |
| Dimension 3 — System tests (Playwright) | C | C | **R/A** | — | — | I | — |
| Dimension 4 — UAT acceptance (Playwright) | I | C | **R** | C | — | **A** | — |
| Coverage thresholds (≥80%) | **A** | R | **R** | — | — | — | — |
| axe-core a11y scans | C | C | **R/A** | — | — | I | — |
| Test suite maintenance | **A** | R | **R** | — | — | — | — |
| CI test job (runs before build) | **R/A** | C | C | — | C | — | — |

### D. GDPR / POPIA Compliance

| Activity | Eng Lead | Frontend Dev | QA Engineer | Privacy Officer | DevSecOps | Product Owner | MLOps |
|----------|----------|-------------|-------------|-----------------|-----------|---------------|-------|
| ConsentBanner implementation | C | **R** | C | **A** | — | C | — |
| consent.ts lifecycle logic | C | **R** | **C** | **A** | — | I | — |
| Privacy policy page (/privacy) | C | R | — | **R/A** | — | C | — |
| DPIA authoring + review | C | C | — | **R/A** | C | C | — |
| Policy version increment | **C** | R | I | **A** | — | C | — |
| Right-to-erasure implementation | C | **R** | C | **A** | — | I | — |
| localStorage consent gate | **A** | **R** | C | **C** | — | — | — |
| 30-day retention enforcement | C | **R** | **C** | **A** | — | — | — |
| GDPR compliance CI gate | C | — | I | **A** | **R** | I | — |

### E. Security & DevSecOps

| Activity | Eng Lead | Frontend Dev | QA Engineer | Privacy Officer | DevSecOps | Product Owner | MLOps |
|----------|----------|-------------|-------------|-----------------|-----------|---------------|-------|
| npm audit (HIGH+ blocking) | C | I | — | — | **R/A** | I | — |
| Gitleaks secret scan (blocking) | **A** | I | — | C | **R** | — | — |
| Trivy container scan (CRITICAL blocking) | **A** | — | — | — | **R** | I | — |
| HTTP security headers (CSP, HSTS, etc.) | **A** | R | C | C | **R** | — | — |
| Dependabot config + PR review | **A** | **R** | I | I | **R** | — | — |
| SRI hashes for MediaPipe CDN | **A** | R | C | I | **R** | — | **C** |
| Docker image hardening | **A** | — | — | — | **R** | — | — |

### F. CI/CD Pipeline

| Activity | Eng Lead | Frontend Dev | QA Engineer | Privacy Officer | DevSecOps | Product Owner | MLOps |
|----------|----------|-------------|-------------|-----------------|-----------|---------------|-------|
| Pipeline architecture | **R/A** | C | C | — | C | — | — |
| quality job (lint + tsc) | **A** | **R** | — | — | C | — | — |
| test job (vitest SIT) | **A** | **R** | **R** | — | — | — | — |
| build job + standalone verify | **R/A** | R | — | — | C | — | — |
| e2e-uat job (Playwright) | **A** | C | **R** | — | C | C | — |
| accessibility job (axe-core) | **A** | C | **R** | — | — | C | — |
| security job (audit + gitleaks) | **A** | — | — | C | **R** | — | — |
| model-health job | **A** | — | — | — | C | — | **R** |
| docker job (Trivy) | **A** | — | — | — | **R** | — | — |
| Artifact retention policy | **R/A** | — | — | — | C | — | — |

### G. Deployment & Operations

| Activity | Eng Lead | Frontend Dev | QA Engineer | Privacy Officer | DevSecOps | Product Owner | MLOps |
|----------|----------|-------------|-------------|-----------------|-----------|---------------|-------|
| Production deployment | **R/A** | C | I | I | C | **C** | — |
| Rollback decision | **A** | R | C | I | C | **C** | — |
| Incident response (P1 outage) | **R/A** | R | I | I | **R** | **I** | C |
| Monitoring / error boundary triage | **A** | **R** | C | — | C | I | — |
| Dependabot PR merge | **A** | **R** | C | I | C | — | — |
| CHANGELOG maintenance | **A** | **R** | I | I | I | I | I |

### H. Product & Feature Development

| Activity | Eng Lead | Frontend Dev | QA Engineer | Privacy Officer | DevSecOps | Product Owner | MLOps |
|----------|----------|-------------|-------------|-----------------|-----------|---------------|-------|
| New feature specification | C | C | C | **C** | — | **R/A** | C |
| GDPR impact assessment for new features | C | C | — | **R/A** | — | **C** | — |
| PR review (code quality) | **R/A** | R | C | — | C | — | — |
| PR review (Definition of Done checklist) | **A** | R | **R** | C | C | C | — |
| Product catalogue updates | I | **R** | C | — | — | **A** | — |
| Accessibility acceptance for new UI | C | R | **R/A** | — | — | C | — |
| Issue triage (bug + feature) | **A** | R | **R** | C | C | **C** | C |

---

## Key Principles

1. **Every activity has exactly one A** — accountability must not be shared.
2. **R without A = no clear owner** — the Engineering Lead is the escalation point for any row missing a dedicated A.
3. **Privacy Officer is C on all data processing changes** — no change to how personal data is collected, stored, or deleted may be merged without their sign-off.
4. **QA Engineer is A on Dimension 3 + 4** — system and acceptance tests are the QA team's accountability; developers write Dim 1 + 2 but QA owns the E2E gate.
5. **DevSecOps is R on all scanning** — security tooling ownership never splits across two roles.

---

## Escalation Matrix

| Situation | First contact | Escalation |
|-----------|-------------|------------|
| CI pipeline failure | Engineering Lead | Product Owner (if blocking release) |
| Security vulnerability (HIGH/CRITICAL) | DevSecOps | Engineering Lead → Product Owner |
| GDPR/POPIA compliance gap | Privacy Officer | Legal Counsel → Engineering Lead |
| Model CDN unavailable | MLOps Engineer | Engineering Lead |
| Production outage | Engineering Lead | Product Owner → all stakeholders |
| Accessibility regression | QA Engineer | Engineering Lead → Product Owner |
| User data erasure request | Privacy Officer | Engineering Lead (for technical execution) |
