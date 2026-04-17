# LUMIS | Nail Studio V1

The Digital Aesthetician. Hyper-realistic virtual nail try-on powered by MediaPipe and the LUMIS editorial design system.

## 🚀 Vision
NailSta has been transformed from a technical proof-of-concept into a premium, production-ready V1 experience. The focus was on "Product Truth": a try-on engine that is actually correct and a UI that actually inspires.

## 🛠 Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript.
- **Styling**: Tailwind CSS 4, Framer Motion.
- **AR Engine**: MediaPipe Tasks Vision (Hand Landmarker).
- **Design**: LUMIS Design System (via Stitch).

## ✨ Key Features
1. **Lume Engine V4.1**:
   - **Canvas-Based Rendering**: Optimized for 60FPS AR performance by removing DOM/SVG overhead.
   - **Precise Anchoring**: Nails now pivot at the cuticle, following the distal phalanx anatomy rather than just finger tips.
   - **Dorsal Gating**: Active pose validation. Nails only render on the back of the hand.
   - **Smoothing**: Kalman-inspired smoothing to eliminate tracking jitter.
2. **LUMIS Interface**:
   - **Editorial Aesthetic**: Dark mode by default, Noto Serif typography, gold accents.
   - **Glassmorphic Hud**: Immersive AR controls that blend seamlessly with the camera feed.
   - **Floating Nav**: A luxury bottom bar that understands context (hides during try-on).
3. **Commerce Flow**:
   - **Onboarding**: "Editorial Series No. 01" entry point.
   - **Studio**: Custom try-on with high-fidelity shaders.
   - **Storefront**: Clean, grid-based discovery.
   - **Bag & Profile**: Consistent brand-aligned utility pages.

## 📦 Getting Started
1. `npm install`
2. `npm run dev`
3. Visit `localhost:3000/auth` to begin the journey.

---
*Created for the Digital Aesthetician.*
