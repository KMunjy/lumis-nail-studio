# LUMIS — Model Assets

Place the following files in this directory before deploying the 3D parallax feature.

## MiDaS Small — Depth Estimation

| Property | Value |
|----------|-------|
| File     | `midas_small.onnx` |
| Size     | ~50 MB |
| Used by  | `src/lib/depth-warp.ts` via `onnxruntime-web` |
| Feature  | 3D parallax viewer on `/studio/[id]` |
| Runtime  | `onnxruntime-web` WASM backend (dynamic import — excluded from main bundle) |

**Download:**
```
https://github.com/isl-org/MiDaS/releases
```
File to grab: `midas_v21_small_256.onnx` → rename to `midas_small.onnx`

**Without this file:** the 3D viewer silently falls back to CPU warp without depth inference.
The rest of the app (AR try-on, NailShoot, NailCard, NailBoard, NailTransform) is unaffected.

**CI note:** This file is excluded from the repo via `.gitignore` (binary, 50 MB).
Add it to your deployment artefact or serve from a CDN and update the path in `depth-warp.ts`.
