# LUMIS Nail Studio — Data Flow Documentation

**Version:** 1.0.0  
**Last updated:** 2026-04-17  
**Regulatory context:** POPIA (South Africa primary) · GDPR (EU users)  
**Data controller:** LUMIS Couture Ltd.

---

## 1. Camera & Computer Vision Pipeline

```
User's physical hand
        │
        ▼ (getUserMedia)
  Browser Camera Feed (MediaStream)
        │
        ▼ (requestAnimationFrame — client only)
  MediaPipe HandLandmarker WASM
  (loaded from cdn.jsdelivr.net — model files only)
        │
        │  21 hand landmarks (x,y,z coordinates)
        │  NO pixel data — raw video frames are NEVER transmitted
        ▼
  EMA HandSmoother (α=0.35)
        │
        ▼
  PBR Nail Renderer v2 / WebGL Depth Warp
        │
        ▼
  Canvas overlay (displayed in browser only)
```

**Privacy classification:** ON-DEVICE ONLY  
**Server transmission:** NONE — no camera frame, pixel, or biometric data leaves the user's device  
**POPIA §11 basis:** Consent (camera use disclosed in ConsentBanner before activation)  
**Retention:** Zero — camera feed is ephemeral; no frame is persisted anywhere

---

## 2. Consent Data Flow

```
User opens /studio (or any camera feature)
        │
        ▼
  ConsentBanner shown (if !hasConsent() in localStorage)
        │
        ├── User accepts
        │       │
        │       ├── localStorage: consent record written (client-side, immediate)
        │       │   key: lumis_consent, value: { given: true, givenAt, version }
        │       │
        │       └── If user is authenticated:
        │               │
        │               ▼ POST /api/consent (JWT required)
        │           Supabase: public.user_consent (upsert)
        │           Fields: user_id, consent_type, given, policy_version,
        │                   given_at, source, metadata.userAgent
        │
        └── User declines → router.back() (no data written)
```

**Server persistence:** Requires authenticated session — anonymous users stored in localStorage only  
**POPIA §11(1)(a):** Explicit informed consent before camera access  
**Consent types:** `camera` | `storage` | `analytics` | `marketing`  
**Policy version pinning:** `CURRENT_POLICY_VERSION = "1.0.0"` — version mismatch triggers re-consent  
**90-day reminder:** ConsentBanner shows soft reminder after 90 days

---

## 3. Right-to-Erasure Flow

```
User requests data deletion (account settings / consent withdrawal)
        │
        ▼ POST /api/consent/withdraw (JWT required)
  user_consent records → withdrawn_at = now(), given = false
  erasure_requests record created (status: pending)
        │
        ▼ POST /api/erasure (JWT required, rate: 2/hour)
  security-definer function: public.process_erasure(user_id)
        │
        ├── DELETE public.saved_looks WHERE user_id = ?
        ├── DELETE public.try_on_sessions WHERE user_id = ?
        ├── UPDATE public.orders SET shipping_address = {anonymised: true}, notes = null
        │   (orders RETAINED for legal/tax — PII ANONYMISED)
        └── UPDATE public.user_consent SET given = false, withdrawn_at = now()
        │
        ▼
  erasure_requests updated: status: completed, actions_taken: [...], retained_records: [...]
        │
        ▼
  Client: localStorage cleared via withdrawConsentAndEraseData()
          (prefix scan: lumis_*)
```

**POPIA §24 / GDPR Art.17:** Right to erasure implemented  
**Legal retention exception:** Orders/order_items retained as required by tax law; PII anonymised  
**Audit trail:** Every erasure request logged with actions_taken JSON  
**Auth deletion:** Supabase Auth user deletion is a separate manual step (admin dashboard)

---

## 4. Order & Payment Data Flow

```
User adds to cart
        │
        ▼
  localStorage: cart items (productId + timestamp, 30-day TTL)
  pruneExpiredCartItems() removes items older than 30 days
        │
        ▼ POST /api/orders (JWT required, rate: 20/min)
  Server validates:
    - JWT → authenticated user
    - Product IDs exist in catalogue
    - Quantities 1–99
    - Cart size ≤ 50 items
  Server computes:
    - Line item totals (server-side pricing — client price ignored)
    - Shipping cost (free over R100)
        │
        ▼ (production)
  INSERT public.orders (user_id, subtotal, total, shipping_address)
  INSERT public.order_items (order_id, product_id, quantity, unit_price)
        │
        ▼
  Stripe PaymentIntent created (server-side, secret key never leaves server)
  client_secret returned to browser for Stripe.js completion
```

**PII in orders:** shipping_address (name, address, city, postal code), email  
**POPIA basis:** Contractual necessity (POPIA §11(1)(c))  
**Retention:** Retained for legal/tax compliance; PII anonymised on erasure request  
**Third-party sharing:** Stripe (payment processing only — subject to Stripe's DPA)

---

## 5. Saved Looks Data Flow

```
User captures try-on (CameraView "capture" button)
        │
        ▼
  canvas.toDataURL("image/png") → base64 data URI (client only)
        │
        ▼ (if user saves)
  Upload to Supabase Storage (saved-looks bucket)
  INSERT public.saved_looks (user_id, product_id, style_snapshot, thumbnail_url)
        │
        ▼
  Displayed in /account/looks
```

**Data type:** Hand image with nail overlay (biometric-adjacent — treated as sensitive)  
**POPIA basis:** Consent (user explicitly taps "Save")  
**Access control:** RLS — users can only read/delete their own saved looks  
**Deletion:** Deleted on right-to-erasure request  
**CDN caching:** Supabase Storage URLs — consider signed URLs for private buckets

---

## 6. Ad Token Data Flow

```
User watches ad (AdMob / IronSource / Unity SDK)
        │
        ▼
  Ad network SDK generates HMAC-SHA256 completion signature
        │
        ▼ POST /api/ad-token/claim
  Server verifies: HMAC sig using AD_TOKEN_SECRET
  Rate limits: 5 tokens/session/24h (session-level) + 10 req/min (IP-level)
        │
        ▼
  raw token UUID generated (returned to client once only)
  token_hash (SHA-256 of UUID) stored in public.ad_tokens
  raw UUID NEVER stored server-side
        │
        ▼ GET /api/ad-token/verify?token=<uuid>
  Server hashes token, looks up token_hash in DB
  Returns: { valid, expiresAt, tryOnsRemaining }
  When Supabase unconfigured: returns { valid: false } (FAIL CLOSED)
```

**PII:** user_id (optional — anonymous sessions supported), session_id  
**Token security:** Only hash stored — raw UUID is a bearer credential, not logged  
**Third-party:** Ad network receives HMAC shared secret only — no user PII transmitted  

---

## 7. Third-Party Data Sharing Summary

| Third Party | Data Shared | Purpose | DPA/Contract | POPIA §22 Operator |
|-------------|------------|---------|-------------|-------------------|
| **Supabase** | All user account data, orders, consent records | Auth, database, storage | Supabase DPA | Yes — processor |
| **Stripe** | Order amount, currency, email (for receipt) | Payment processing | Stripe DPA | Yes — processor |
| **MediaPipe CDN** (Google) | WASM/model file downloads only — no user data | Model delivery | Google ToS | No — CDN only |
| **Ad Networks** | HMAC secret (no user PII) | Ad completion verification | Network-specific | Partial |
| **Google Fonts** | IP address (standard CDN request) | Font delivery | Google ToS | No — CDN only |

---

## 8. Logging & Telemetry

**Current state:** No third-party analytics or error monitoring configured.  
**Server logs:** Console-only (`console.error`, `console.warn`) — no structured log shipping.  
**Client logs:** None — no analytics SDK loaded.  
**Gap (Sprint 3):** Sentry or equivalent needed for production error tracking.  
**PII in logs:** API routes log error messages only — no user IDs, tokens, or PII in log strings.

---

## 9. Data Residency

| Data type | Location | Region |
|-----------|---------|--------|
| User accounts, orders, consent | Supabase Postgres | Configurable — set to `af-south-1` (Cape Town) or `eu-west-1` for POPIA compliance |
| Saved look images | Supabase Storage | Same region as DB |
| Payment data | Stripe | EU/US — covered by Stripe DPA |
| Camera/CV processing | User device only | No residency concern |

**POPIA §72:** Cross-border transfers require adequate protection — Supabase DPA + region selection covers this.
