# LUMIS Nail Studio — Remediation Roadmap v1.0

**Produced:** 2026-04-17  
**Linked audit:** `docs/audit-pack.md` (Section I)  
**Owner:** Engineering Lead + Product Lead  
**Review cadence:** Weekly sprint check-in until P0/P1 cleared; monthly thereafter

---

## Overview

This roadmap translates the governance gaps identified in the Sprint 3 audit into concrete engineering tasks, ordered by risk priority. Each item references its source gap ID, the expected evidence of completion, and a suggested sprint assignment.

---

## Priority Tiers

| Tier | Definition | Gate |
|------|------------|------|
| **P0** | Blocking — no user traffic before resolved | Pre-launch mandatory |
| **P1** | Blocking — no marketing/public launch before resolved | Launch gate |
| **P2** | Required within 30 days of first user | Post-launch SLA |
| **P3** | Required within 90 days of first user | Quarterly SLA |

---

## P0 — Pre-Launch Blockers

### P0-1 · Integrate Sentry Error Monitoring
**Gap:** G-03  
**Severity:** High  
**Impact:** Production failures go undetected; no incident response signal  
**Difficulty:** Low  

**Implementation steps:**
1. Install `@sentry/nextjs` — `npm install @sentry/nextjs`
2. Run `npx @sentry/wizard@latest -i nextjs` to scaffold `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
3. Set env vars: `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`
4. In `src/lib/monitoring.ts` — uncomment the Sentry block in `_sendToBackend()`:
   ```typescript
   import * as Sentry from "@sentry/nextjs";
   if (event.level === "error") {
     Sentry.captureMessage(event.message, {
       level: "error",
       tags: { domain: event.domain },
       extra: event.data,
     });
   }
   ```
5. Configure alert rules: error rate > 1% over 5 min → PagerDuty/Slack
6. Add performance tracing to `trackTryOnOutcome()` and `trackApiEvent()`
7. Add `SENTRY_DSN` to CI environment and verify source maps upload in GitHub Actions

**Evidence of completion:** Sentry dashboard shows live events from staging; CI source-map upload step green; `monitoring.ts` Sentry block active (not commented)

---

### P0-2 · Video Upload Size Limit
**Gap:** G-07  
**Severity:** High  
**Impact:** Unbounded file uploads → DoS, storage exhaustion, memory overflow in WASM processor  
**Difficulty:** Low  

**Implementation steps:**
1. In the video processor API route (`src/app/api/video-processor/route.ts` or equivalent):
   ```typescript
   export const config = { api: { bodyParser: { sizeLimit: "25mb" } } };
   // — OR in App Router:
   const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // 25 MB
   const contentLength = Number(req.headers.get("content-length") ?? "0");
   if (contentLength > MAX_VIDEO_BYTES) {
     return NextResponse.json({ error: "File too large. Maximum 25 MB." }, { status: 413 });
   }
   ```
2. Validate MIME type: accept only `video/mp4`, `video/webm`, `video/quicktime`
3. Add kill-switch guard: `isFeatureEnabled("try_on_video")` before processing
4. Update client-side file picker: `accept="video/mp4,video/webm"` + `maxSize` prop in dropzone
5. Add test: POST with 26 MB body → expect 413

**Evidence of completion:** Integration test `POST /api/video-processor` with oversized payload returns 413; MIME rejection test passes; CI green

---

## P1 — Launch Gate Items

### P1-1 · Creator Verification Frontend
**Gap:** G-04  
**Severity:** High  
**Impact:** Creators can list products without identity verification — marketplace trust risk  
**Difficulty:** Medium  

**DB schema:** Ready (`creator_verifications` table — Sprint 3 migration)  
**API needed:** `POST /api/creator/verification` (submit), `GET /api/creator/verification` (status)

**Implementation steps:**
1. Create `src/app/api/creator/verification/route.ts`:
   - `GET`: fetch own row from `creator_verifications` by `auth.uid()`
   - `POST`: insert/upsert with `status: "pending"`, validate required fields, write `admin_audit_log` entry
2. Create page `src/app/creator/verify/page.tsx`:
   - Multi-step form: Business info → Document upload → Confirmation
   - Fields: `business_name`, `business_type`, `country`, `portfolio_url`, `instagram_handle`
   - Document upload (id_document, business_reg): Supabase Storage signed upload
   - Status display: pending/under_review/approved/rejected with human-readable messaging
3. Guard creator dashboard routes: if `verification.status !== "approved"` → redirect to `/creator/verify`
4. Admin review UI in `/admin/verifications`:
   - List pending verifications with document links
   - Approve/reject buttons → PATCH status, write `admin_audit_log`
5. Email notification on status change (Supabase Edge Function or Resend)

**Evidence of completion:** Creator can submit verification form; admin can approve/reject; approved creator can access dashboard; rejected creator sees reason; audit log populated

---

### P1-2 · Real-Image Fitzpatrick Fairness Dataset
**Gap:** G-01  
**Severity:** High  
**Impact:** Fairness claims unverifiable with real data; POPIA/GDPR bias accountability gap  
**Difficulty:** High  

**Implementation steps:**
1. **Dataset sourcing options (Legal must approve):**
   - Option A: License `11k Hands` dataset (subset with Fitzpatrick annotations) — CC BY 4.0
   - Option B: Consult with Diversity in Faces dataset (IBM Research) — requires agreement
   - Option C: Commission 200-sample diverse hand photography under internal consent protocol
2. **Consent & legal:** Obtain written consent or verified open licence; document in `docs/fairness.md`
3. **Annotation:** Annotate Fitzpatrick scale (I-II, III-IV, V-VI) per image; nail region ground-truth masks
4. **Test integration:** Extend `src/__tests__/fairness/fitzpatrick-fairness.test.ts`:
   - Load real images from `test-fixtures/fitzpatrick/`
   - Run through nail segmentation pipeline (headless TF.js)
   - Compute `computeFairnessMetrics()` on real-image suite
   - Assert same `FAIRNESS_THRESHOLDS` pass
5. **Reporting:** Update `docs/fairness.md` Sprint results table with real-image results

**Evidence of completion:** CI test suite includes real-image run; `docs/fairness.md` updated with real-image results table; Legal sign-off on dataset licence recorded

---

### P1-3 · Upstash Redis Rate Limiting (Multi-Instance)
**Gap:** G-06  
**Severity:** Medium  
**Impact:** Current in-memory rate limiter does not share state across serverless function instances; easy bypass  
**Difficulty:** Medium  

**Implementation steps:**
1. Provision Upstash Redis database (free tier sufficient for MVP launch)
2. Install `@upstash/ratelimit` + `@upstash/redis`: `npm install @upstash/ratelimit @upstash/redis`
3. Set env vars: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
4. Rewrite `src/lib/rate-limit.ts` using sliding window algorithm:
   ```typescript
   import { Ratelimit } from "@upstash/ratelimit";
   import { Redis } from "@upstash/redis";
   
   const redis = new Redis({
     url: process.env.UPSTASH_REDIS_REST_URL!,
     token: process.env.UPSTASH_REDIS_REST_TOKEN!,
   });
   
   export const limiters = {
     general:   new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, "60s") }),
     sensitive: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "60s") }),
     adToken:   new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "60s") }),
     referral:  new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "60s") }),
   };
   ```
5. Keep in-memory fallback for local dev when env vars absent
6. Update CI to inject mock Upstash credentials for rate-limit tests

**Evidence of completion:** Staging load test (2 concurrent instances) shows rate limiting enforced across both; rate-limit tests pass with Upstash mock

---

### P1-4 · MiDaS Model in Deployment Artefact
**Gap:** G-05  
**Severity:** Medium  
**Impact:** 3D parallax feature silently falls back to 2D — documented but not resolved  
**Difficulty:** Low  

**Implementation steps:**
1. Download `midas-small.onnx` from `https://github.com/isl-org/MiDaS/releases` (or mirror in repo LFS)
2. Place at `public/models/midas-small.onnx`
3. Update `MODELS.md` checksums table with SHA-256
4. Verify CI `model-health` job fetches and validates the ONNX file
5. Test `depth_parallax` kill-switch: if feature disabled → skip ONNX load entirely

**Evidence of completion:** `public/models/midas-small.onnx` present in Docker image; `MODELS.md` checksum verified in CI; `model-health` job green

---

## P2 — 30-Day Post-Launch

### P2-1 · Fitzpatrick Shade Calibration
**Gap:** G-02  
**Severity:** High  
**Impact:** Nail colour rendering accuracy degrades for darker skin tones without tone-aware correction  
**Difficulty:** High  

**Implementation steps:**
1. Define `ShadeCalibration` interface in `src/lib/eval-metrics.ts`:
   ```typescript
   export interface ShadeCalibration {
     fitzpatrickRange: FitzpatrickRange;
     brightnessOffset: number;  // -1.0 to +1.0
     saturationScale:  number;  // 0.8 to 1.2
     warmthBias:       number;  // colour temperature offset in Kelvin
   }
   ```
2. Collect calibration data: render same nail colour on real Fitzpatrick I-II, III-IV, V-VI reference hands; measure ΔE (CIELAB colour difference)
3. Define calibration LUT per Fitzpatrick range
4. Apply in `PBRNailRenderer` before compositing: adjust `brightness`, `saturation`, `warmth` uniforms
5. Add calibration test: verify ΔE < 3.0 post-calibration for each range

**Evidence of completion:** `docs/fairness.md` updated with ΔE before/after table; calibration values committed; fairness test suite passes with calibration applied

---

### P2-2 · Signed URLs for Saved Look Images
**Gap:** G-08  
**Severity:** Medium  
**Impact:** Saved look images publicly accessible if storage URL leaked  
**Difficulty:** Low  

**Implementation steps:**
1. In saved looks write path: store images in private Supabase Storage bucket (`lumis-private`)
2. In saved looks read path (`GET /api/saved-looks`):
   ```typescript
   const { data: signedUrl } = await supabase.storage
     .from("lumis-private")
     .createSignedUrl(look.storage_path, 3600); // 1-hour expiry
   ```
3. Never return raw storage paths to client — only signed URLs
4. Update RLS on `saved_looks` table to confirm path cannot be derived
5. Add test: un-authed GET to raw storage path returns 403; signed URL returns 200

**Evidence of completion:** API returns only signed URLs; raw storage path inaccessible without signature; PARTIAL → ✅ PASS in audit matrix

---

### P2-3 · SRI Hash on MediaPipe CDN Import
**Gap:** G-09  
**Severity:** Medium  
**Impact:** CDN compromise could inject malicious WASM/JS into camera processing pipeline  
**Difficulty:** Low  

**Implementation steps:**
1. Pin MediaPipe version: `@mediapipe/tasks-vision@0.10.x` (exact patch)
2. Download MediaPipe WASM + JS bundle; compute SHA-384:
   ```bash
   openssl dgst -sha384 -binary mediapipe.js | openssl base64 -A
   ```
3. In `next.config.ts`, add `integrity` attribute to script tags:
   ```typescript
   // Or use a custom Script component with integrity prop
   ```
4. Alternatively: vendor MediaPipe into `public/vendor/mediapipe/` — eliminates CDN dependency entirely (recommended)
5. Add CI step: verify MediaPipe bundle hash matches pinned value

**Evidence of completion:** MediaPipe loaded with SRI or from vendored path; CDN import without hash removed; `next.config.ts` updated

---

## P3 — 90-Day Post-Launch

### P3-1 · Low-Light and Occlusion Test Cases
**Gap:** G-12  
**Severity:** Medium  
**Impact:** Failure behaviour under degraded conditions unknown  
**Difficulty:** Medium  

**Implementation steps:**
1. Extend `src/__tests__/fairness/fitzpatrick-fairness.test.ts` with scenario suite:
   - Low-light: apply brightness 0.2 filter to test images; assert graceful degradation message
   - Overexposed: brightness 2.5; assert lighting estimator fallback
   - Partial occlusion: mask 30% of hand region; assert partial rendering or no-render
   - Camera permission denied: mock `getUserMedia` rejection; assert permission-denied UI state
2. Define "graceful degradation" SLA: `success=false` + error message visible within 500ms

**Evidence of completion:** 4 new test scenarios in CI; all pass; `docs/fairness.md` scenario coverage matrix updated

---

### P3-2 · Advertiser Onboarding Governance
**Gap:** G-10  
**Severity:** Medium  
**Impact:** No governed path for advertisers; ad token flow not covered by identity verification  
**Difficulty:** High  

**Implementation steps:**
1. Design advertiser role onboarding flow (separate from creator verification)
2. Create `advertiser_accounts` table with billing contact, HMAC key rotation policy
3. Rate limit ad token claim at advertiser level (not just user level)
4. Legal: draft advertiser terms of service referencing POPIA/GDPR data processing
5. Admin UI: advertiser account management

**Evidence of completion:** Advertiser onboarding spec approved by Legal; schema migration in place; basic admin controls implemented

---

### P3-3 · Admin Audit Log UI
**Gap:** G-11  
**Severity:** Low  
**Impact:** Audit log exists in DB but not surfaced to admins  
**Difficulty:** Low  

**Implementation steps:**
1. Add `/admin/audit-log` page
2. Paginated table: timestamp, admin_user, action, target_type, target_id, details JSON expand
3. Filter by: action type, date range, target type
4. Export: CSV download for compliance reporting

**Evidence of completion:** `/admin/audit-log` renders real data from `admin_audit_log` table; pagination and filter working

---

## Completion Tracking

| Gap ID | Item | Owner | Sprint | Status |
|--------|------|-------|--------|--------|
| G-03 | Sentry integration | Engineering | Sprint 4 | ✅ Done — `sentry.client.config.ts`, `sentry.server.config.ts`, `monitoring.ts` activated |
| G-07 | Video upload size limit | Engineering | Sprint 4 | ✅ Done — `/api/video-processor` route with 25 MB cap + MIME validation |
| G-04 | Creator verification frontend | Engineering | Sprint 4 | ✅ Done — `/creator/verify` page, `/api/creator/verification` GET/POST/PATCH, admin queue |
| G-01 | Real-image Fitzpatrick dataset | Product + Legal | Sprint 4/5 | ⬜ Open — requires dataset licensing decision |
| G-06 | Upstash Redis rate limiting | Engineering | Sprint 4 | ✅ Done — `rateLimitAsync()` + Upstash adapter, in-memory fallback |
| G-05 | MiDaS model in deployment | Ops | Sprint 4 | ⬜ Open (ops step) — `MODELS.md` updated with download + CI verify steps |
| G-02 | Shade calibration | ML Engineering | Sprint 5 | ⬜ Open — awaiting real dataset |
| G-08 | Signed URLs for saved looks | Engineering | Sprint 5 | ✅ Done — `saved-looks.ts` uses `createSignedUrl`, `/api/saved-looks` returns signed URLs only |
| G-09 | SRI hash on MediaPipe | Engineering | Sprint 5 | ⬜ Open — CDN vendoring planned |
| G-12 | Low-light + occlusion tests | QA | Sprint 5 | ✅ Done — 14 new scenario tests in `fitzpatrick-fairness.test.ts` |
| G-10 | Advertiser onboarding | Product | Sprint 6+ | ⬜ Open |
| G-11 | Admin audit log UI | Engineering | Sprint 5 | ✅ Done — audit-log tab in admin page + `/api/admin/audit-log` with CSV export |

---

## Review Sign-Off

| Reviewer | Role | Date | Decision |
|----------|------|------|----------|
| _pending_ | Engineering Lead | — | — |
| _pending_ | Product Lead | — | — |
| _pending_ | Legal / Compliance | — | — |
| _pending_ | AI Risk Owner (RACI.md) | — | — |
