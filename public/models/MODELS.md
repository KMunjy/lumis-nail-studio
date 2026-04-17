# LUMIS — Model Assets

Place the following files in this directory before deploying the 3D parallax feature.
Checksums are verified by the CI `model-health` job on every push.

## MiDaS Small — Depth Estimation (P1-4 — G-05)

| Property | Value |
|----------|-------|
| File     | `midas_small.onnx` |
| Expected SHA-256 | `(run: sha256sum midas_small.onnx and record here after download)` |
| Size     | ~50 MB |
| Source   | `https://github.com/isl-org/MiDaS/releases/tag/v2.1` |
| Used by  | `src/lib/depth-warp.ts` via `onnxruntime-web` |
| Feature  | 3D parallax viewer on `/studio/[id]` |
| Runtime  | `onnxruntime-web` WASM backend (dynamic import — excluded from main bundle) |
| Kill-switch | `depth_parallax` flag in `platform_flags` table |

**Download steps:**
```bash
# From the MiDaS v2.1 release:
curl -L -o public/models/midas_small.onnx \
  https://github.com/isl-org/MiDaS/releases/download/v2.1/midas_v21_small_256.onnx

# Verify checksum (update this file with the actual hash):
sha256sum public/models/midas_small.onnx
```

**Without this file:** the 3D viewer silently falls back to 2D rendering (no depth warp).
The `depth_parallax` platform flag is automatically set to `false` when the model is absent.
All other features (AR try-on, NailShoot, NailCard, NailBoard, NailTransform) are unaffected.

**Deployment:**
- Docker: add `COPY public/models/midas_small.onnx /app/public/models/` to Dockerfile
- Vercel: include the file in the project root (it will be bundled as a static asset)
- CDN: serve from a trusted CDN and update the `ONNX_MODEL_PATH` env var

**CI verification (model-health job):**
```yaml
- name: Verify MiDaS model present
  run: |
    if [ ! -f "public/models/midas_small.onnx" ]; then
      echo "WARNING: midas_small.onnx missing — depth_parallax will be disabled"
      exit 0  # Non-fatal: fallback is in place
    fi
    echo "MiDaS model present ($(du -sh public/models/midas_small.onnx | cut -f1))"
```

**CI note:** This binary is excluded from the git repo via `.gitignore`.
Add it to your deployment artefact as part of the release process (see ops checklist).
