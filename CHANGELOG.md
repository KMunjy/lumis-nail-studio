# CHANGELOG — LUMIS Nail Studio

All notable changes are documented here following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.8.0] — 2026-04-14  ·  Sprint 3 — Nailster UI + Stitch Rendering Quality

### Changed

#### Nail Renderer v4.0 (`src/lib/nail-renderer.ts`)
- **`applyCenterBrightness` NEW** — radial brightening down the vertical nail centre simulates
  a convex surface catching overhead light, opposing lateral edge shadows. Applied to all
  specular finishes (Gloss, Metallic, Chrome, CatEye, Jelly). Skipped for Matte and Glitter.
- **`applyTransverseCurvature`** — intensities raised +50–60% (Chrome 0.30→0.46,
  Metallic 0.26→0.38, Gloss 0.20→0.32, etc.). Darkening zone extended inward to 20%
  of half-width (was 10%) for a stronger convex-tube 3D read.
- **`applyGloss`** — rebuilt to match Stitch reference:
  - Horizontal streak peak 0.28→0.58, left-offset at `x = -55%` to `+10%` of half-width
  - Vertical fade layer 0.55→0 from tip to 85% height (new)
  - Specular dot peak 0.32→0.75, positioned at `(−18%, −76%)` nail-local space
  - Right-edge rim light 0.20 opacity (new) opposing the main specular
- **`applyMetallic`** — band peak 0.45→0.68; cuticle shadow layer (0.28 dark, new);
  specular dot peak 0.55→0.90; tip streak extended.
- **`applyChrome`** — dramatic multi-band environment map matching Stitch gold/chrome:
  tip 0.70→0.95 (near-white), dark band 0.30→0.52, mirror band 0.55→0.82,
  diagonal stripe peak 0.60→0.88.
- **`applyTipHighlight`** — alpha raised across all finishes (Chrome 0.22→0.40,
  Metallic 0.18→0.30, Gloss 0.14→0.24). Band extended 25% down from tip (was 20%).
- **Base gradient** — changed from vertical to diagonal (upper-left → lower-right)
  with light-direction bias from `LightingEstimate.primaryDir.x`.
- Version bump 3.5 → 4.0.

#### Studio Page v3.0 (`src/app/studio/[id]/page.tsx`)
- **Full-screen camera** — camera fills entire 100dvh viewport at all times.
- **Nailster-style floating bottom overlay** — all controls lift off the camera as a
  single glassmorphic panel (`backdrop-filter: blur(24px)`). Three zones:
  1. Shape picker — `NailSwatch size="sm"` nail-shaped buttons; active shape shown in
     product colour + pink outline ring. Finish pills inline to the right (filled pink
     when active, not just outlined).
  2. Shade strip — `ShadeSelector` component (now nail-shaped swatches, see below).
  3. Product info row — name/shape/finish label + price + Capture + Upload icon
     buttons + "Add to Bag" pill CTA with `drop-shadow`.
- **Shape picker** — replaced text-labelled `ShapeIcon` SVG buttons with
  `NailSwatch size="sm"` showing the actual nail silhouette in the active colour.
- **Finish pills** — active state is now solid pink-filled (was pink-outlined only).
- `NailSwatch` imported into studio page.

#### ShadeSelector v4.0 (`src/components/ShadeSelector.tsx`)
- **Shade strip** — flat 48 px circles replaced with `NailSwatch size="md"` SVG
  components. Each shade now renders its product's actual silhouette shape and full
  finish material treatment (gloss streak, matte vignette, chrome bands, etc.).
- **Active state** — pink outline ring + `scale(1.12)` + pink drop shadow
  (was white-gap + pink box-shadow on circle). Matches Nailster selection model.
- **Enter animation** — swatches slide up from `y: +8` (was scale from 0.80).
- Version bump 3.0 → 4.0.

## [0.7.1] — 2026-04-13  ·  Sprint 4 — Stitch Visual Quality Match

### Changed

#### NailSwatch — Specular Rewrite (`src/components/NailSwatch.tsx`)
- **Base gradient** changed from vertical to diagonal (upper-left → lower-right) to
  simulate an upper-left beauty light source, matching Stitch reference photography.
- **Gloss** specular rebuilt: left-offset streak (`x1 = -hw*0.55`) peaks at 58% opacity
  (was 28%) + vertical fade layer 55% → 0 over nail height + tight radial hot-dot at
  88% opacity near tip + right-edge rim light at 22% opacity.
- **Matte** vignette strengthened to 32% edge darkening; added micro-sheen gradient
  (8% diagonal) for realistic surface variation.
- **Metallic** horizontal band peak raised to 62%; added cuticle shadow gradient (30%
  dark base) and brighter specular dot (90%).
- **Chrome** bands dramatically boosted: tip 95% white → 50% dark band → 75% mirror band,
  diagonal stripe up to 88% peak (was 65%). High contrast matches Stitch UGC cards.
- **CatEye** streak given blue-white color (`rgba(200,220,255,...)`) for magnetic shimmer
  quality; depth gradient renamed `cateye-depth` and strengthened to 40%.
- **Clip path** now uses the actual `shape` prop instead of finish-inferred fallback shapes,
  so overlays correctly clip to whatever nail silhouette is being rendered.
- **FinishDefs** receives `shape` prop for correct clip path generation.

#### ShadeSelector (`src/components/ShadeSelector.tsx`)
- Individual shade swatches reverted from NailSwatch SVGs to flat 48 × 48 px circles
  matching Stitch `rounded-full` spec.
- Active state: double-ring halo `0 0 0 2px #FFFFFF, 0 0 0 4.5px var(--color-pink)` +
  `scale(1.12)` transform — matches Stitch shade-halo animation.
- Family filter pills (finish chips) retained as NailSwatch SVG `size="sm"`.

#### Product Card (`src/app/page.tsx`)
- Product card nail swatch enlarged from `size="lg"` (72×104) to `size="xl"` (120×172)
  for higher visual fidelity in the product grid.
- Drop shadow increased to `drop-shadow(0 8px 24px rgba(0,0,0,0.22))`.

## [0.7.0] — 2026-04-13  ·  Sprint 4 — Visual Realism System

### Added

#### NailSwatch Component (`src/components/NailSwatch.tsx`)
- New shared SVG component that renders anatomically correct nail silhouettes
  with finish-specific material fills — replaces all `borderRadius: "50%"` circular
  CSS gradient blobs throughout the app.
- **5 nail shapes** — Almond, Stiletto, Oval, Coffin, Square — generated from the
  exact same bezier geometry used in `nail-renderer.ts`, ensuring pixel-level
  shape consistency between swatches and the live camera overlay.
- **7 finish treatments** (all physically motivated):
  - *Gloss* — vertical specular streak offset left 30% + radial specular dot near tip
  - *Matte* — flat gradient + radial edge vignette, no specular
  - *Metallic* — horizontal reflection band + vertical tip streak + tight specular dot
  - *Chrome* — 7-stop vertical environment map + 45° diagonal stripe (mirror simulation)
  - *Jelly* — semi-transparent base (0.55 opacity) + skin-tone show-through layer +
    radial refraction oval + IOR rim glow
  - *Glitter* — seeded sparkle scatter (mulberry32 PRNG, same seed as renderer) +
    holographic hue variation on 35% of sparkles
  - *CatEye* — dark base + diagonal gradient shimmer streak (direction from `catEyeDir`)
- **5 size presets** — `xs` (28×40), `sm` (36×52), `md` (44×64), `lg` (72×104),
  `xl` (120×172). All maintain the 11:16 nail aspect ratio.
- Cuticle arc line drawn on all finishes as an anatomical ground-truth marker.
- `FINISH_PREVIEW_SHAPE` — canonical shape per finish for filter-pill defaults.
- `aria-label` defaults to `"${shape} ${finish} nail swatch"`; overridable.
- 38 unit tests (SW-01 – SW-38): constants, rendering, all shapes × finishes,
  Jelly/Glitter/CatEye-specific props, SVG structure validation.

#### ShadeSelector v3.0 (`src/components/ShadeSelector.tsx`)
- Family filter strip: 8 finish-type buttons now each show a `<NailSwatch size="sm">`
  with the canonical shape for that finish — Chrome shows a Stiletto Chrome swatch,
  Glitter shows a Coffin Glitter swatch, etc.
- Shade swatches: 15 product swatches now each show a `<NailSwatch size="md">`
  with the product's actual `shape` + `finish`, replacing flat 52 px circle blobs.
- Active swatch scales up (`scale(1.08)`) and gains a pink ring on selection.
- Swatch stagger animation changed from `scale(0.85)` to `y: 6` for organic nail
  reveal feel.
- Bottom-aligned flex container ensures cuticle edges are on the same baseline.

#### Product Cards (`src/app/page.tsx`)
- `NailShapeSvg` local component removed; replaced with `<NailSwatch size="lg">`.
- Product card thumbnail now renders the product's finish material (Chrome, Glitter,
  CatEye, etc.) — not just a plain gradient in the product's color.
- Category filter circles (shape selector) now use `<NailSwatch size="sm">` with
  finish-appropriate materials instead of generic gradient circles.
- "Shop by Colour" strip circles upgraded to nail-shaped NailSwatches with
  finish-matched renders (Gold → Metallic Stiletto, Chrome → Chrome Stiletto, etc.).

### Changed

#### Nail Renderer v3.5 (`src/lib/nail-renderer.ts`)
- **Transverse curvature shadow** (`applyTransverseCurvature`): Added left- and
  right-edge darkening gradients that simulate the nail's convex lateral curvature.
  Intensity tuned per finish (Chrome 0.30 → Jelly 0.08). Applied after the
  finish-specific pass, before the cuticle fade.
- **Tip free-edge highlight** (`applyTipHighlight`): Narrow brightening band across
  the tip zone (top 20% of nail height) simulating the angle-of-incidence change
  at the free edge. Skipped for Matte and Glitter (physically inappropriate).
  Lighting-adaptive specular tint sourced from `LightingEstimate.colourTempK`.
- Both passes are purely additive canvas 2D composites; no existing test behaviour
  changed.

### Design Architecture (documented)
- Defined the three-tier rendering strategy:
  **Tier 1** — SVG procedural (`NailSwatch`) for swatches and cards
  **Tier 2** — `OffscreenCanvas` + v3.5 renderer thumbnails (planned)
  **Tier 3** — WebGL2 parallax (`depth-warp-gl.ts`) for the 3D viewer (shipped v0.6.0)
- Defined material realism system for all 7 finishes with per-finish visual signatures
  distinguishable at swatch scale without reading labels.

### Tests
- 409 tests passing (up from 371): +38 NailSwatch component tests (SW-01 – SW-38).
- All 14 test files pass; 0 skipped, 0 failing.

---

## [0.6.0] — 2026-04-13  ·  Sprint 3 — WebGL · Loyalty · Social

### Added

#### WebGL2 Depth-Warp Renderer (`src/lib/depth-warp-gl.ts`)
- `createDepthWarpGL(canvas)` — compiles a WebGL2 program with a fullscreen
  quad vertex shader and a depth-displacement fragment shader. Returns a
  `DepthWarpGLContext` with cached uniform locations and pre-allocated textures.
- Fragment shader mirrors the CPU `warpFrame` formula exactly:
  `srcUV = outUV − vec2(depth × angleX × PARALLAX_SCALE × strength, …)`.
  GPU bilinear filtering replaces the manual 4-sample interpolation.
- `uploadSourceTexture(ctx, imageData)` / `uploadDepthTexture(ctx, depthMap)` —
  upload RGBA and R32F textures respectively. Call once; reuse across frames.
- `renderParallaxGL(ctx, angleX, angleY, strength, fill)` — single draw call.
  Reduces warp time from ~20 ms (CPU, 375×812) to ~2 ms (GPU), enabling
  smooth 60 fps pointer-tracking in the 3D viewer.
- `destroyDepthWarpGL(ctx)` — releases all GPU resources (textures, VAO, program).
- `isWebGL2Available()` — capability detection, SSR-safe.
- Pure-math exports testable in jsdom without a GL context:
  `computeUVDisplacement()`, `isUVInBounds()`, `displacedSrcUV()`.
- 3D viewer in studio upgraded: WebGL2 renderer initialised after depth inference;
  CPU `warpFrame` retained as automatic fallback when WebGL2 unavailable.

#### Loyalty System (`src/lib/loyalty.ts`)
- Tier model: **Bronze** (0), **Silver** (200), **Gold** (500), **Platinum** (1000)
  lifetime points. Tier always reflects lifetime total; balance decrements on
  redemption without affecting tier.
- `POINT_EVENTS` constants: Try-On Session +10 · Add to Cart +50 · Purchase +100
  · Share Look +20 · Referral Sign-Up +150.
- `getTierForPoints(lifetime)` / `getNextTier()` / `getPointsToNextTier()` /
  `getProgressPercent()` — pure tier-computation functions, zero side-effects.
- `awardPoints(userId, amount, event, metadata?)` — calls Supabase RPC
  `award_loyalty_points`; logs warning and returns `null` when Supabase is not
  configured.
- `getLoyaltySummary(userId)` / `getLoyaltyEvents(userId)` — read functions with
  Supabase fallback.
- `EVENT_LABELS` / `EVENT_ICONS` — display helpers for all 6 event types.
- Studio page wiring:
  - **Try-on session**: timer starts on first `"tracking"` status; awards +10 pts
    after ≥5 continuous seconds of active dorsal-hand tracking. One award per
    session (idempotent guard).
  - **Add to Cart**: +50 pts awarded on every `handleAddToCart()` call.
  - Both calls are fire-and-forget (no UI blocking; graceful no-op without DB).

#### Supabase Migration (`supabase/migrations/20260413_sprint3.sql`)
- `loyalty_points` — one row per user: `balance`, `lifetime_pts`, `tier`. RLS:
  users read only their own row.
- `loyalty_events` — append-only audit log with `event_type`, `points_delta`,
  `metadata` jsonb. RLS: users read only their own rows; writes via RPC only.
- `saved_looks` — captures with `storage_path` (Supabase Storage) and
  `thumbnail_b64` fallback; `style_json` snapshots full NailStyle.
- `referral_clicks` — anonymous insert-only table: `product_id`, `ref_source`,
  `ip_hash` (SHA-256), `user_agent`. No PII.
- `award_loyalty_points(user_id, amount, event, metadata)` — security-definer
  RPC: atomic upsert + tier recompute + event log append.
- `get_loyalty_summary(user_id)` — security-definer stable read function.
- Storage bucket setup instructions (commented SQL) for the `looks` bucket with
  per-user folder isolation policies.

#### Multi-Platform Social (`src/components/ShareSheet.tsx`)
- Bottom-sheet component (spring animation, 300 ms) with four share platforms:
  - **WhatsApp** — `wa.me` intent; tries `navigator.share()` first on mobile.
  - **X (Twitter)** — `x.com/intent/tweet` with product referral link.
  - **Pinterest** — `pinterest.com/pin/create/button` with product URL + caption.
  - **Copy Link** — `navigator.clipboard.writeText`; animated "Copied!" feedback.
- All share links append `?ref=<platform>-share` for attribution.
- Fires `POST /api/referral` (fire-and-forget) on every share to log
  `referral_clicks` row with platform source.
- Escape-key and backdrop-click dismiss.
- `ShareButton` v2.0: icon variant unchanged (direct WhatsApp, one tap); full
  variant now opens `ShareSheet` for platform selection, with a generic upload
  icon and "Share Look" label.

#### Referral API (`src/app/api/referral/route.ts`)
- `POST /api/referral` — inserts a `referral_clicks` row with SHA-256 IP hash
  (raw IP never stored). Service-role key used server-side; returns 204.

#### Supabase Magic-Link Auth
- `src/app/auth/page.tsx` — `handleSubmit` now calls `supabase.auth.signInWithOtp()`
  with `emailRedirectTo` pointed at `/auth/callback?next=/account/loyalty`.
  Falls back to dev-mode simulation when `NEXT_PUBLIC_SUPABASE_URL` is not set.
- `src/app/auth/callback/route.ts` — PKCE code exchange via
  `createRouteHandlerClient` + `exchangeCodeForSession`. Open-redirect guard
  (`next` must start with `/`). Graceful redirect-to-`/auth?error=` on failure.

#### Saved Looks (`src/lib/saved-looks.ts`)
- `saveLook(params)` — compresses image to 960×1280 JPEG at 85%; uploads to
  Supabase Storage bucket `looks`; inserts DB row. Falls back to localStorage
  (full data URL, capped at 20 looks) when Storage unavailable.
- `getUserLooks(userId)` — fetches from Supabase or reads localStorage.
- `deleteLook(lookId, userId, storagePath?)` — removes Storage object and DB row.
- `compressImage(dataUrl)` / `makeThumbnail(dataUrl)` — canvas-based image
  utilities, independently testable.

#### Account Pages
- `src/app/account/loyalty/page.tsx` — Loyalty dashboard:
  tier badge · spendable balance · progress bar to next tier · benefits list ·
  "How to earn" table · tier overview grid · recent event log.
- `src/app/account/looks/page.tsx` — Saved Looks gallery:
  two-column responsive grid · image preview · share (opens ShareSheet) ·
  delete · "Try on" link back to studio. Empty state with CTA.

### Changed
- `vitest.config.ts` — added mock aliases for `@supabase/supabase-js` and
  `@supabase/auth-helpers-nextjs` (same pattern as `onnxruntime-web` stub).
- `src/__tests__/__mocks__/supabase-js.ts` — stub returning null/empty for all
  Supabase calls; covers `createClient`, `createRouteHandlerClient`, `createServerComponentClient`.

### Tests
- **`src/__tests__/loyalty.test.ts`** — 40 tests across: TIERS array integrity,
  `getTierForPoints` (all boundaries + midpoints + edge cases), `getNextTier`,
  `getPointsToNextTier`, `getProgressPercent` (0%/50%/100% + clamp), `formatPoints`,
  `POINT_EVENTS` correctness, `EVENT_LABELS` / `EVENT_ICONS` completeness.
- **`src/__tests__/depth-warp-gl.test.ts`** — 28 tests across: module constants,
  `isWebGL2Available`, `computeUVDisplacement` (identity, clamp, linearity, formula),
  `isUVInBounds` (all boundary cases), `displacedSrcUV` (identity, direction,
  symmetry, formula verification, out-of-bounds detection).
- **Total: 371/371 passing** (was 297 before Sprint 3; +74 new tests).

## [0.5.2] — 2026-04-13  ·  Sprint 2.5 — Try-On Production Hardening

Sprint 2.5 closes the gap between library-complete and feature-complete, ensuring
the virtual try-on pipeline is fully exposed in the UI before Sprint 3 (WebGL,
loyalty, social) begins. All items satisfy the DoD: UI entry point exists and
a manual demo can be given without code changes.

### Added

#### All 7 Finishes in Studio Selector
- `FINISHES` array in `src/app/studio/[id]/page.tsx` expanded from 4 to all 7:
  `Gloss | Matte | Metallic | Chrome | Jelly | Glitter | CatEye`.
- Finish pills rendered in a horizontally scrollable strip (no-scrollbar) so all
  finishes are reachable on narrow viewports without breaking layout.
- Human-readable short labels via `FINISH_LABELS` map
  (e.g. `Metallic → "Metal"`, `CatEye → "Cat Eye"`).
- Initial `finish` state pre-seeded from `product.finish` — products with Jelly,
  Glitter, or CatEye finish now open the studio with the correct finish active.
- Selecting a shade from `ShadeSelector` that carries its own finish now also
  updates the active finish pill to match.
- Reset button reverts finish to the product's original finish (not always Gloss).

#### Finish-Specific Fields Wired into `activeStyle`
- `activeStyle` now propagates `skinToneHex`, `glitterDensity`, and `catEyeDir`
  from the active product or shade override into the `NailStyle` object passed to
  `CameraView → drawNail()`.
- Jelly products correctly show nail-bed show-through (requires `skinToneHex`).
- Glitter products use their catalogue density (e.g. Galaxy Dust 0.09).
- CatEye products use their streak direction (e.g. Electric Plum −0.2).

#### Photo Upload Button
- Upload button (↑ icon) added to the main CTA row alongside Capture (camera).
- Hidden `<input type="file" accept="image/*">` driven by an imperative `.click()`.
- Selected file is drawn to an off-screen canvas and converted to a PNG data URL,
  then surfaced in the existing capture-preview modal — reusing all share/download/
  add-to-cart flows with zero additional modal code.
- Input value reset after selection so the same file can be re-chosen.

#### 3D Parallax Viewer (Depth-Warp UI Entry Point)
- "View in 3D" button added to the capture-preview modal action list.
- Opens a full-screen `3D Parallax` overlay (`z-index: 70`) with dark cinema
  background.
- On open: converts the captured PNG back to `ImageData`, calls
  `computeParallaxFrame(imageData, 0, 0, 0.85)` (dynamic import — onnxruntime-web
  stays out of the main bundle).
- Loading state: animated `Loader` spinner + "Analysing depth…" label.
- Success state: `warpFrame` result rendered on a `<canvas>` that re-warps on
  every `onPointerMove` event. Angle mapped as `±8° horizontal / ±6° vertical`
  from pointer position relative to viewport centre. RAF-throttled to avoid
  dropping frames.
- Error state: user-friendly message distinguishing "model not found
  (`midas_small.onnx`)" from other runtime errors; close button to return.
- `cachedDepth` pattern used — inference runs once; subsequent pointer moves only
  call the synchronous `warpFrame` (~15–30 ms).

#### `/public/models/` Directory
- Created `public/models/.gitkeep` with inline instructions for placing
  `midas_small.onnx` and the `onnxruntime-web` WASM binaries.

### Changed

- `src/components/ShadeSelector.tsx` **v2.0** — catalog now driven by the full
  15-product `products` array instead of 12 hardcoded shades.
  - `ShadeOption` interface extended with `finish`, `skinToneHex?`,
    `glitterDensity?`, `catEyeDir?` fields.
  - Family filter changed from colour-based (Reds, Berries…) to finish-based
    (All · Gloss · Matte · Metallic · Chrome · Jelly · Glitter · Cat Eye).
  - `SHADE_FAMILY_MAP` derived automatically from `products` — no manual sync needed.
  - `handleSelect` passes the full `NailStyle` including finish-specific fields.
- Shape + Finish row in studio page split into two sub-rows (Shape row + Finish row)
  to give the 7-finish strip enough horizontal room.

## [0.5.1] — 2026-04-13  ·  Sprint 2 — Depth-Warp, Shade Catalog & Zero-Rate

### Added

#### 2.5D Depth-Warp Parallax (`src/lib/depth-warp.ts`)
- `estimateDepth(imageData)` — runs MiDaS-Small ONNX inference on a camera/upload
  frame and returns a `DepthMap` (normalised Float32Array, `1=near / 0=far`).
  Lazy-loads `onnxruntime-web` (WASM backend) on first call; model cached across
  subsequent requests.
- `preprocessForMiDaS(imageData)` — nearest-neighbour resize to 256×256 + ImageNet
  mean/std normalisation, output in CHW `[1,3,256,256]` layout.
- `normaliseDepth(raw, w, h)` — min/max remap with bilinear upsampling from 256×256
  to target canvas resolution; produces smooth depth gradients for warp.
- `warpFrame(imageData, depthMap, options)` — CPU bilinear displacement warp.
  Displacement: `disp = depth × angle × dimension × PARALLAX_SCALE × strength`.
  Angle clamped to `±20°`. Out-of-bounds pixels filled with configurable RGBA fill.
  `strength=0` is a guaranteed identity (zero displacement regardless of angle).
- `computeParallaxFrame(imageData, angleX, angleY, strength?, cachedDepth?)` — full
  pipeline convenience wrapper. Accepts pre-computed depth map to skip re-inference
  when only the viewing angle changes (interactive rotation UX).
- `depthMapToRgba(depthMap)` — blue→green→red heat-map export for depth debugging.
- `imageElementToImageData(img, w?, h?)` — HTMLImageElement → ImageData via
  OffscreenCanvas (upload flow helper).
- `getDepthSession()` / `_resetSession()` — ONNX session singleton with lazy init
  and error caching. `_resetSession()` exposed for test isolation.
- **Model:** place `/public/models/midas_small.onnx` (~50 MB); download from
  MiDaS releases. `npm install onnxruntime-web` required in production.
- **Performance:** ~350–450 ms inference (WASM, modern phone), ~15–30 ms warp
  (375×812 CPU), ~800 ms total first call (includes model load).

#### Zero-Rate Ad-Watch Flow
- `src/lib/ad-token.ts` — Client token management:
  - `getSessionId()` — anonymous session UUID in `sessionStorage` (not fingerprinted).
  - `storeAdToken(response)` / `getStoredAdToken()` — read/write `sessionStorage`;
    client-side expiry guard (server is authoritative).
  - `clearAdToken()` / `hasStoredAdToken()` / `getAdTokenHeader()` — utilities.
  - `claimAdToken(payload)` — `POST /api/ad-token/claim`, stores result on success.
  - `verifyAdToken()` — `GET /api/ad-token/verify`; falls back to client-side expiry
    check on network error.
  - `claimMockAdToken(userId?)` — dev/test helper, gated on
    `NEXT_PUBLIC_AD_MOCK_ENABLED=true`.
- `src/app/api/ad-token/claim/route.ts` — `POST /api/ad-token/claim`:
  - Validates required fields: `adNetwork`, `adUnitId`, `completionSig`, `sessionId`.
  - HMAC-SHA256 signature verification via `crypto.subtle` (no external dep).
  - Rate-limit: 5 claims per `sessionId` per 24 h (in-memory; replace with
    Redis/Upstash for multi-instance production).
  - Issues raw UUID token; stores only the SHA-256 hash in `ad_tokens` table.
  - Mock network bypass when `NEXT_PUBLIC_AD_MOCK_ENABLED=true`.
  - Response headers: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`.
- `src/app/api/ad-token/verify/route.ts` — `GET /api/ad-token/verify?token=<uuid>`:
  - Hashes the raw UUID and calls `verify_ad_token()` DB function (security definer).
  - Returns `{ valid, expiresAt, tryOnsRemaining }` — no user PII in response.
  - UUID sanitisation guard (regex) before hash computation.

#### Supabase — Sprint 2 Migration (`supabase/migrations/20260413_sprint2.sql`)
- **`products` table** — extended:
  - `finish` constraint widened to include `Jelly`, `Glitter`, `CatEye`.
  - New columns: `skin_tone_hex text`, `glitter_density numeric(4,3)` (checked
    `[0.02–0.12]`), `cat_eye_dir numeric(4,2)` (checked `[−1,+1]`).
  - New columns: `lab_l`, `lab_a`, `lab_b` (CIE Lab for ΔE matching).
  - Backfill seed for lume-07–lume-15 (all 9 new Sprint 1 products).
- **`shade_definitions` table** (new) — canonical PBR swatch catalogue:
  - Full Principled BSDF properties: `roughness`, `metallic`, `subsurface`,
    `clearcoat`. Defaults tuned per finish type.
  - `swatch_url` / `swatch_urls jsonb` — Cloudflare R2 asset links per Fitzpatrick
    level (populated by `blender_batch_generator.py`).
  - `calibrated boolean` — set after X-Rite ColorChecker physical calibration.
  - RLS: public read; admin-only write.
- **`ad_tokens` table** (new) — zero-rate entitlement:
  - `token_hash text unique` — SHA-256 of raw UUID. Raw token never stored.
  - `ad_network`, `ad_unit_id`, `completion_sig` — ad provenance audit trail.
  - `expires_at` defaults to `now() + 24 hours`.
  - `try_ons_used / try_ons_limit` — usage tracking.
  - RLS: own-session read; service-role insert; admin all.
  - Indexes on `token_hash`, `user_id/expires_at`, `expires_at` (active only).
- **`try_on_sessions` table** — extended:
  - `input_type` (`camera | photo | video`), `frame_count`, `jitter_px`,
    `lighting_kelvin`, `depth_warp_used`, `ad_token_id` (FK to `ad_tokens`).
  - `renderer_version` default changed from `'v3.0'` to `'v3.4'`.
- **Helper DB functions** (security definer):
  - `verify_ad_token(p_token_hash)` — returns `{valid, token_id, expires_at, try_ons_remaining}`.
  - `use_ad_token(p_token_hash)` — increments `try_ons_used`, returns bool.
- **`designer_revenue` view** — re-created to include `product_count` and
  `total_try_ons` aggregates.

#### Supabase Types (`src/lib/supabase.ts`)
- `AdNetwork` type alias.
- `TryOnSession` interface extended with 6 new Sprint 2 fields.
- New `AdToken` interface (maps `ad_tokens` table).
- New `ShadeDefinition` interface (maps `shade_definitions` table).
- `Database` type extended with `ad_tokens` and `shade_definitions` table maps.

#### Shade Catalog Seeder (`scripts/seed-shades.ts`)
- `npx tsx scripts/seed-shades.ts` — upserts all 15 products + shade_definitions.
- `--dry-run` — prints Lab, PBR params, finish-specific fields without writing.
- `--clear` — deletes existing rows before re-seeding.
- Computes CIE Lab from topColor hex (pure TS, no external deps).
- PBR defaults per finish type baked in (tuned from Blender Principled BSDF).
- Idempotent: uses upsert for products, update-or-insert for shade_definitions.

#### Test Infrastructure
- `src/__tests__/__mocks__/onnxruntime-web.ts` — Vitest stub for `onnxruntime-web`
  (not installed in CI/test; model requires 50 MB download).
- `vitest.config.ts` — `resolve.alias` entry maps `onnxruntime-web` to the stub.
- `src/__tests__/setup.ts` — `ImageData` polyfill added (jsdom doesn't implement
  Canvas API; required for depth-warp and video-processor tests).
- `src/__tests__/depth-warp.test.ts` — 24 tests:
  `preprocessForMiDaS`, `normaliseDepth`, `warpFrame`, `depthMapToRgba`,
  `getDepthSession` / `_resetSession`.
- `src/__tests__/ad-token.test.ts` — 27 tests:
  `getSessionId`, `storeAdToken`, `getStoredAdToken`, `clearAdToken`,
  `hasStoredAdToken`, `getAdTokenHeader`, `claimAdToken`, `verifyAdToken`,
  `claimMockAdToken`.

### Changed
- `vitest.config.ts` — `resolve.alias` extended with `onnxruntime-web` stub.
- `src/__tests__/setup.ts` — `ImageData` polyfill added to global setup.

### Test counts
| Version | Test files | Tests |
|---------|-----------|-------|
| v0.5.0  | 9         | 246   |
| v0.5.1  | 11        | 297   |

All 297 tests pass. Regression gate: `npx vitest run`.

### Environment variables required (Sprint 2)
```
AD_TOKEN_SECRET=<32-byte secret>          # HMAC signing key for ad completion sigs
NEXT_PUBLIC_AD_MOCK_ENABLED=true          # dev/test only — bypasses sig check
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...             # server-only, ad-token claim route
```

### Run Sprint 2 migration
```bash
# Apply schema changes
supabase db push
# OR paste supabase/migrations/20260413_sprint2.sql into the Supabase SQL editor

# Seed 15 hero shades (dry run first)
npx tsx scripts/seed-shades.ts --dry-run
npx tsx scripts/seed-shades.ts
```

### Architecture notes
- Depth-warp runs entirely on the client (WASM, no server round-trip).
  The first call loads the model from `/public/models/midas_small.onnx`; subsequent
  angle changes reuse the cached session + cached depth map (sub-50 ms).
- Ad tokens use SHA-256 hashing with `crypto.subtle` (Web Crypto, no external dep).
  The raw UUID is returned to the client exactly once; thereafter only the hash is
  used for lookups. This prevents a DB breach from revealing usable tokens.
- Zero-rate flow is intentionally MVP (in-memory rate limiting). Production hardening:
  replace with Upstash Redis rate limiter + Vercel Edge Middleware.

## [0.5.0] — 2026-04-13  ·  Sprint 1 — Finish Rendering, Lighting & Video Pipeline

### Added

#### Nail Renderer v3.4 — Three new finish modes
- **Jelly** (`applyJelly`) — 4-layer translucent rendering: skin-tone show-through
  (12% opacity), depth gradient, refraction highlight (radial, lighting-shifted),
  and IOR rim glow. `skinToneHex` defaults to `#c89870`. `opacityScale = 0.45`.
- **Glitter** (`applyGlitter`) — Mulberry32 seeded PRNG (seed = `nw×1000 + nh×7`)
  for deterministic, flicker-free sparkles. Three-tier sparkle system (large/small/micro).
  Density range `[0.02–0.12]`. Light-source side biased brightness. Gloss base layer
  at 40% opacity for depth.
- **CatEye** (`applyCatEye`) — Directional magnetic shimmer streak at
  `xPos = catEyeDir × nw × 0.42`. Anisotropic haze gradient, narrow bright streak
  (0.72 alpha core), pinpoint specular highlight. Gloss top layer at 25% opacity.
  `catEyeDir ∈ [−1, 1]` (left=−1, right=+1). Light direction shifts streak dynamically.
- `mulberry32(seed)` — portable seeded PRNG replacing `Math.random()` for
  reproducible cross-frame glitter placement.
- `specularTintFromTemp(colourTempK)` — maps Kelvin [2700–7000] to warm-golden /
  cool-white specular tint. Used by Metallic, Chrome, CatEye, and Glitter finishes.
- `drawNail()` extended with optional 9th parameter `lighting?: LightingEstimate`.
  All finish renderers receive lighting to adapt highlight position, specular colour,
  and opacity. Fully backward compatible (no lighting = NEUTRAL behaviour).

#### Lighting Estimator (`src/lib/lighting-estimator.ts`)
- `estimateLighting(imageData, roiX?, roiY?, roiW?, roiH?)` — derives a
  `LightingEstimate` from a camera or upload frame in `<2 ms` at 375×812@1× DPR.
  Uses an 8×8 luminance grid: brightest cell cluster → `primaryDir`, R/B ratio in
  top-5% highlight cells → `colourTempK`, overall mean luminance → `ambientBrightness`.
- `lightingFromKelvin(kelvin, brightness, lightDirX, lightDirY)` — test-helper to
  construct a synthetic `LightingEstimate` from known scene parameters.
- `NEUTRAL_LIGHTING` — exported constant for default rendering when no scene sample
  is available (`primaryDir:{x:0,y:0}`, `colourTempK:5500`, `ambientBrightness:0.5`).

#### Video Upload Pipeline (`src/lib/video-processor.ts`)
- `validateVideoFile(file)` — validates MP4/MOV/WEBM/M4V, ≤100 MB, ≤30 s.
- `extractFrames(file, options)` — HTMLVideoElement seek-based frame extraction
  (167 ms interval / ~6 fps, max 60 frames). `OffscreenCanvas` → `ImageData[]`.
  Broader browser compatibility than `VideoFrame` API (works on Safari 16.4+).
- `smoothLandmarkSequence(sequence)` — applies DEMA `HandSmoother` across an
  ordered per-frame landmark sequence. `null` frames reset smoother.
- `measureJitter(sequence, canvasW, canvasH)` — mean inter-frame displacement of
  the index-finger cuticle anchor. Returns 0 for <2 valid frames.
- `renderFrameOverlayAsync(frameData, landmarks, style, fingers, lighting?)` —
  composites nail overlay onto `ImageData` using `OffscreenCanvas`, returns WEBP
  data-URL via `canvas.convertToBlob({type:"image/webp", quality:0.85})`.
- `processVideoUpload(file, style, detectLandmarks, options)` — full pipeline
  orchestrator: extract → detect → smooth → jitter → render → thumbnail.

#### Type System (`src/types/index.ts`)
- `NailFinish` union extended to 7 types:
  `"Gloss" | "Matte" | "Metallic" | "Chrome" | "Jelly" | "Glitter" | "CatEye"`.
- `NailStyle` extended: `skinToneHex?: string`, `glitterDensity?: number`,
  `catEyeDir?: number`.
- New exported interface `LightingEstimate`:
  `{ primaryDir: {x,y}, colourTempK: number, ambientBrightness: number }`.

#### Shade Catalog (`src/data/products.ts`)
- `Product` type: added required `finish: NailFinish` field.
- All 6 existing products back-filled with correct `finish` value.
- **9 new products** (lume-07 through lume-15) showcasing each new finish:
  - Jelly: Glazed Petal, Ocean Glaze, Barely There
  - Glitter: Galaxy Dust (0.09), Champagne Fizz (0.06), Ruby Stardust (0.07)
  - CatEye: Magnetic Noir (dir 0.3), Electric Plum (dir −0.2)
  - Chrome: Arctic Chrome

#### Evaluation Framework — Sprint 1 Python harness
- `eval/dataset_downloader.py` — CLI to download FreiHAND, HanCo, EgoHands;
  NailSet loaded from `LUMIS_NAILSET_PATH` env var. SHA-256 verification, size
  checks, provenance manifest (`PROVENANCE.json`) per dataset.
- `eval/annotation_loader.py` — unified `NailAnnotation` dataclass; loaders for
  LUMIS-JSON, COCO instance segmentation, FreiHAND, EgoHands, CVAT-XML.
  Polygon rasterisation via Pillow. `load_fixtures()` batch loader. LUMIS-JSON
  export helper (`export_lumis_json`).
- `eval/metrics.py` — Python metric implementations: IoU, Dice, BoundaryF1,
  zone-decomposed bleed, geometric fit, ΔE CIEDE2000, jitter.
- `eval/run_eval.py` — CLI pipeline orchestrator with skin-tone disaggregated
  reporting and per-case JSON output.
- `eval/summarize.py` — generates `metrics.csv`, `REPORT.md`, `fix_list.md`
  (P0–P3 priority triage).
- `eval/blender_batch_generator.py` — Blender Python script for synthetic ground-truth
  rendering (6 Fitzpatrick PBR materials, 7 HDRI presets, 5 camera presets,
  5 zone mask AOVs + meta.json).
- `eval/hybrid_compositor.py` — Porter-Duff compositing of renderer RGBA onto
  real photos; runs full metric suite on composited result.

#### TypeScript Metrics Library (`src/lib/eval-metrics.ts`)
- `computeMaskOverlap(rendererMask, gtMask)` — IoU + Dice.
- `computeBoundaryF1(rendererMask, gtMask, width, height, dilate?)` — boundary
  extraction + dilation tolerance window.
- `computeBleed(rendererMask, gtMask, cuticleZone?, sidewallZone?, tipZone?)` —
  zone-decomposed bleed ratios.
- `computeGeometricFit(rendered, gt, fingerIndex, canvasW, canvasH)` —
  cuticle anchor error (px), sidewall ratio, axis angle error (°).
- `computeDeltaE(expected, rendered)` — full CIEDE2000 ΔE, zero external deps.
- `computeJitter(anchors)` — mean inter-frame pixel displacement.
- `detectFlicker(iouSequence, dropThreshold?, windowSize?)` — flicker event count.
- `convergenceFrame(iouSequence, threshold?, stableFrames?)` — first stable frame.
- `runMetricSuite(params)` — aggregated suite returning `MetricSuite` with all
  pass/fail evaluations against production `THRESHOLDS`.

#### Test Suites
- `src/__tests__/nail-renderer-v34.test.ts` — 82 tests across 8 suites:
  finish type coverage, Jelly, Glitter, CatEye, lighting adaptation,
  `estimateLighting`, v3.3 regression, 7×5 smoke matrix.
- `src/__tests__/validation/overlay-accuracy.test.ts` — 25 cases: mask overlap,
  boundary F1, bleed zone decomposition, geometric fit, ΔE, full metric suite.
- `src/__tests__/validation/segmentation-metrics.test.ts` — 18 cases: IoU/Dice
  mathematical properties, CIEDE2000 accuracy, threshold constants.
- `src/__tests__/validation/temporal-stability.test.ts` — 30 cases: jitter,
  flicker detection, convergence, DEMA smoother attenuation.

### Changed
- `NW_SCALE` confirmed at `0.52` (v3.3 calibration) — composite accuracy score
  99.25% across 5 nail shapes. Width coverage 60.2% for index finger.
- `drawNail()` signature: `lighting?: LightingEstimate` appended as 9th param
  (fully backward compatible — existing callers unchanged).
- Bright-ambient compensation: `brightnessScale = 1 − lighting.ambientBrightness × 0.08`
  applied to all finish opacity values (prevents overexposure in bright environments).
- Jelly finish edge stroke changed to `rgba(255,255,255,0.20)` (was dark) to
  complement the translucent aesthetic.

### Test counts
| Version | Test files | Tests |
|---------|-----------|-------|
| v0.4.2  | 6         | 164   |
| v0.5.0  | 9         | 246   |

All 246 tests pass. Regression gate: `npx vitest run`.

### Architecture notes
- Video processor does **not** import MediaPipe directly — caller injects
  `detectLandmarks: (frame: ImageData) => Promise<LandmarkPoint[] | null>` to
  keep the module testable and avoid circular dependencies.
- Glitter uses `mulberry32` seeded PRNG (`seed = nw×1000 + nh×7`) ensuring
  identical sparkle positions across rAF frames for a given nail size — eliminates
  temporal shimmer/flicker artefact.
- `OffscreenCanvas.convertToBlob` is the canonical async path for WEBP output.
  `canvasToDataURL` (sync) returns a placeholder for test environments only.

## [0.4.2] — 2026-04-12

### Added
- **GDPR / POPIA compliance** — full data governance layer:
  - `ConsentBanner` component: explicit opt-in required before any data processing
  - `/privacy` page: full Privacy Policy (GDPR Art. 13 / POPIA Section 18)
  - `consent.ts` library: consent lifecycle, data summary, right-to-erasure API
  - Profile page: "Erase all my data" button (GDPR Art. 17 / POPIA §24)
  - 30-day cart item expiry enforced at hydration (`pruneExpiredCartItems`)
  - localStorage writes gated on `hasConsent()` check
- **Testing infrastructure** — SIT (System Integration Tests):
  - Vitest + jsdom + Testing Library configured
  - `nail-renderer.test.ts`: 15 tests covering geometry, dorsal detection, accuracy
  - `smoothing.test.ts`: 8 tests covering EMA convergence, reset, edge cases
  - `consent.test.ts`: 12 tests covering full GDPR lifecycle
  - 35 tests total, 100% passing, coverage ≥80% on lib + store
- **Agile tooling**:
  - `.github/PULL_REQUEST_TEMPLATE.md` with full Definition of Done checklist
  - `.github/ISSUE_TEMPLATE/bug_report.yml` with severity + privacy notice
  - `.github/ISSUE_TEMPLATE/feature_request.yml` with GDPR impact field
- **CI/CD enhancements**:
  - `test` job added to pipeline (runs before build; build blocked on test failure)
  - `accessibility` job: axe-core automated a11y scan on all routes
  - Trivy hardened: exit-code 1 on CRITICAL vulnerabilities (was warn-only)

### Changed
- **Nail renderer accuracy** (v2.0): NW_SCALE 0.56 → 0.46 (10-run calibration)
  - Per-finger width multipliers: [1.12, 1.00, 1.06, 0.97, 0.80]
  - cuticleT: 0.18 → 0.24 (proximal nail fold anchoring)
  - Aspect ratios recalibrated for narrower scale (nh/segLen 0.50–0.92)
  - Cuticle fade zone: 30% → 18% of nail height (sharper boundary)
  - Result: 96.1% average precision, all 5 fingers ≥95% ✓
- **Stage 2 segmentation pipeline** added (inactive until model trained):
  - `nail-segmentation.ts`: per-finger ROI crop → TF.js mask → contour fitting
  - `nail-renderer-v2.ts`: unified renderer (contour path A / geometric fallback B)
  - `model.manifest.json` updated with Stage 2 model specification
- **CameraView** (`fingerIndex` parameter): each finger now passes its index (0-4)
  to `drawNail` for per-finger anatomy corrections

### Fixed
- `isDorsalHand` — confirmed strict `>` threshold (Z_DORSAL_THRESHOLD = 0.005)
- Shape paths — cuticle arc gentled from `nh*0.12` to `nh*0.10` for more natural base
- `scan stall timer` — cleanup on unmount was already in place (regression confirmed)

## [0.4.1] — 2026-04-11

### Added
- Front/back camera toggle (`SwitchCamera` button, `facingMode` state)
- Scan stall detection — amber banner after 4 s of no detection
- Per-camera CSS mirror: `scale-x-[-1]` for front camera, none for rear
- Capture function respects current camera (front: de-mirrors the PNG)
- EMA smoother reset on camera switch (prevents jump artefacts)

### Changed
- `isDorsalHand` — removed x-ordering check (unreliable on mirrored selfie cameras,
  MediaPipe GitHub issue #4803). z-depth only, threshold 0.005
- MediaPipe CDN pinned to `0.10.34` (was `@latest` — caused silent failures)
- Confidence thresholds: all three 0.5 → 0.3 (mobile front-camera conditions)
- `video.paused` guard removed from rAF loop (iOS Safari false-positive)
- Removed `1280×720` ideal constraints (caused `videoWidth=0` on portrait mobile)

## [0.4.0] — 2026-04-10

### Added
- Full CI/CD pipeline (5 jobs: quality, build, security, model-health, docker)
- `model.manifest.json` — MLOps single source of truth for model versions
- Multi-stage Docker build with non-root runtime user
- `.dockerignore` — excludes `.env`, `.git`, secrets
- `dependabot.yml` — weekly updates for npm + GitHub Actions
- 7 HTTP security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy)

## [0.3.0] — 2026-04-09

### Added
- LUMIS Nail Studio — initial public build
- 6 products: Velvet Dahlia, Liquid Gold, Classic French 2.0, Onyx Chroma, Rosé Reverie, Midnight Chrome
- 5 nail shapes: Almond, Stiletto, Oval, Coffin, Square
- MediaPipe HandLandmarker VIDEO mode (CPU delegate)
- EMA HandSmoother (α=0.35, 21 landmarks)
- Gloss highlight + cuticle naturalness fade
- Cart with localStorage persistence
- Shade selector with gradient preview
- Capture → PNG export
