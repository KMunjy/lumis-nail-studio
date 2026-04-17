/**
 * LUMIS — 2.5D Depth-Warp Parallax  v1.0
 *
 * Provides monocular depth estimation (MiDaS-Small ONNX) and a CPU-side
 * displacement warp to simulate ±20° rotational parallax from a single
 * uploaded photo. Used in the "3D view" feature on the try-on studio.
 *
 * Architecture
 * ────────────
 *   estimateDepth(imageData)                  — MiDaS-Small → Float32Array depth map
 *   normaliseDepth(rawDepth, w, h)            — remap to [0,1] per-image
 *   warpFrame(imageData, depthMap, ax, ay)    — bilinear displacement warp
 *   computeParallaxFrame(…)                   — full pipeline convenience wrapper
 *
 * ONNX runtime dependency
 * ───────────────────────
 *   npm install onnxruntime-web
 *   Place MiDaS-Small model at: /public/models/midas_small.onnx  (~50 MB)
 *   Download: https://github.com/isl-org/MiDaS/releases  (midas_v21_small_256.onnx)
 *
 * Performance targets
 * ───────────────────
 *   Depth inference  ~350–450 ms  (modern phone, WASM backend)
 *   Warp (375×812)   ~15–30 ms    (pure JS bilinear, CPU)
 *   Total first call ~800 ms      (includes ONNX model load)
 *   Total warm call  ~400 ms
 *
 * Browser compatibility
 * ─────────────────────
 *   onnxruntime-web WASM: Chrome 89+, Safari 15+, Firefox 79+
 *   OffscreenCanvas:      Chrome 69+, Safari 16.4+
 *
 * Notes
 * ─────
 *   - MiDaS outputs *inverse relative depth* (higher value = closer to camera).
 *   - We normalise per-frame so absolute scale is meaningless; only relative
 *     depth ordering drives the parallax effect.
 *   - Angle range is clamped to ±20° to prevent excessive warping artefacts
 *     near depth discontinuities.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DepthMap {
  /** Normalised depth values [0,1]. 1 = closest, 0 = furthest. */
  data:   Float32Array;
  width:  number;
  height: number;
}

export interface WarpOptions {
  /**
   * Horizontal rotation angle in degrees [-20, 20].
   * Positive = tilt right (camera pans left, objects shift right proportional to depth).
   */
  angleX: number;
  /**
   * Vertical rotation angle in degrees [-20, 20].
   * Positive = tilt up.
   */
  angleY: number;
  /**
   * Parallax strength scale factor [0, 1]. Default 1.0.
   * Lower values reduce the apparent depth displacement.
   */
  strength?: number;
  /** Background fill for uncovered regions. Default transparent black. */
  fillR?: number;
  fillG?: number;
  fillB?: number;
  fillA?: number;
}

export interface ParallaxResult {
  /** Warped frame as ImageData (same dimensions as input). */
  frame:    ImageData;
  /** Depth map used for warping. */
  depthMap: DepthMap;
  /** Inference time in milliseconds. */
  inferenceMs: number;
  /** Warp time in milliseconds. */
  warpMs: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** MiDaS-Small input resolution. */
const MIDAS_W = 256;
const MIDAS_H = 256;

/** Maximum warp angle (degrees). Requests beyond this are clamped. */
const MAX_ANGLE_DEG = 20;

/** Effective pixels-per-degree of parallax at max depth. Tuned empirically. */
const PARALLAX_SCALE = 0.015;   // fraction of canvas width per degree

// ─── ONNX session singleton ───────────────────────────────────────────────────

let _session: unknown | null = null;
let _sessionLoading = false;
let _sessionError: Error | null = null;

/**
 * Lazily load and cache the ONNX inference session.
 * Throws if onnxruntime-web is not installed or the model is missing.
 */
export async function getDepthSession(): Promise<unknown> {
  if (_session) return _session;
  if (_sessionError) throw _sessionError;
  if (_sessionLoading) {
    // Wait for concurrent load
    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        if (_session)      { clearInterval(interval); resolve(_session); }
        if (_sessionError) { clearInterval(interval); reject(_sessionError); }
      }, 50);
    });
  }

  _sessionLoading = true;
  try {
    // Dynamic import keeps onnxruntime-web out of the main bundle
    // until the user actually opens the 3D view.
    const ort = await import(/* webpackChunkName: "onnx" */ "onnxruntime-web");

    // Default WASM backend (no GPU required; works in all browsers)
    ort.env.wasm.wasmPaths = "/models/";

    _session = await ort.InferenceSession.create("/models/midas_small.onnx", {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });

    return _session;
  } catch (err) {
    _sessionError = err instanceof Error ? err : new Error(String(err));
    throw _sessionError;
  } finally {
    _sessionLoading = false;
  }
}

/**
 * Reset the session (useful for testing or if the model file changes).
 * @internal
 */
export function _resetSession(): void {
  _session = null;
  _sessionLoading = false;
  _sessionError = null;
}

// ─── Preprocessing ────────────────────────────────────────────────────────────

/**
 * Resize and normalise an ImageData frame to the 256×256 float tensor
 * expected by MiDaS-Small.
 *
 * Normalisation: ImageNet mean/std per channel.
 *   mean = [0.485, 0.456, 0.406]
 *   std  = [0.229, 0.224, 0.225]
 *
 * Output layout: CHW (channels-first), shape [1, 3, 256, 256].
 */
export function preprocessForMiDaS(imageData: ImageData): Float32Array {
  const { data, width, height } = imageData;
  const scaleX = width  / MIDAS_W;
  const scaleY = height / MIDAS_H;

  const tensor = new Float32Array(3 * MIDAS_W * MIDAS_H);
  const rOff = 0;
  const gOff = MIDAS_W * MIDAS_H;
  const bOff = MIDAS_W * MIDAS_H * 2;

  const MEAN = [0.485, 0.456, 0.406];
  const STD  = [0.229, 0.224, 0.225];

  for (let y = 0; y < MIDAS_H; y++) {
    for (let x = 0; x < MIDAS_W; x++) {
      // Nearest-neighbour sample from source
      const srcX  = Math.min(Math.floor(x * scaleX), width  - 1);
      const srcY  = Math.min(Math.floor(y * scaleY), height - 1);
      const srcIdx = (srcY * width + srcX) * 4;

      const r = data[srcIdx]     / 255;
      const g = data[srcIdx + 1] / 255;
      const b = data[srcIdx + 2] / 255;

      const dstIdx = y * MIDAS_W + x;
      tensor[rOff + dstIdx] = (r - MEAN[0]) / STD[0];
      tensor[gOff + dstIdx] = (g - MEAN[1]) / STD[1];
      tensor[bOff + dstIdx] = (b - MEAN[2]) / STD[2];
    }
  }

  return tensor;
}

// ─── Depth normalisation ──────────────────────────────────────────────────────

/**
 * Normalise a raw MiDaS output depth map to [0, 1].
 *
 * MiDaS outputs inverse relative disparity (larger = closer).
 * We remap so that 1.0 = closest point, 0.0 = furthest.
 * Then upsample from 256×256 to the target canvas size using bilinear
 * interpolation for smoother warp gradients.
 */
export function normaliseDepth(
  rawDepth: Float32Array,
  targetW:  number,
  targetH:  number,
): DepthMap {
  // Find min/max in 256×256 output
  let minD = Infinity, maxD = -Infinity;
  for (let i = 0; i < rawDepth.length; i++) {
    if (rawDepth[i] < minD) minD = rawDepth[i];
    if (rawDepth[i] > maxD) maxD = rawDepth[i];
  }
  const range = Math.max(maxD - minD, 1e-6);

  // Upsample to target dimensions with bilinear interpolation
  const out = new Float32Array(targetW * targetH);
  const scaleX = MIDAS_W / targetW;
  const scaleY = MIDAS_H / targetH;

  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const sx = x * scaleX;
      const sy = y * scaleY;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(x0 + 1, MIDAS_W - 1);
      const y1 = Math.min(y0 + 1, MIDAS_H - 1);
      const tx = sx - x0;
      const ty = sy - y0;

      const v00 = (rawDepth[y0 * MIDAS_W + x0] - minD) / range;
      const v10 = (rawDepth[y0 * MIDAS_W + x1] - minD) / range;
      const v01 = (rawDepth[y1 * MIDAS_W + x0] - minD) / range;
      const v11 = (rawDepth[y1 * MIDAS_W + x1] - minD) / range;

      out[y * targetW + x] = v00 * (1 - tx) * (1 - ty)
                            + v10 *      tx  * (1 - ty)
                            + v01 * (1 - tx) *      ty
                            + v11 *      tx  *      ty;
    }
  }

  return { data: out, width: targetW, height: targetH };
}

// ─── Depth estimation ─────────────────────────────────────────────────────────

/**
 * Run MiDaS-Small inference on a camera/upload frame.
 *
 * @param imageData  Source frame at any resolution.
 * @returns Normalised depth map upsampled to the source resolution.
 * @throws  If onnxruntime-web is not installed or the model is unavailable.
 */
export async function estimateDepth(imageData: ImageData): Promise<DepthMap> {
  const t0 = performance.now();

  const session = await getDepthSession() as {
    run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>>;
    inputNames: string[];
  };

  // Dynamically import Tensor to avoid top-level dependency
  const ort = await import("onnxruntime-web");

  const inputTensor = preprocessForMiDaS(imageData);
  const tensor = new ort.Tensor("float32", inputTensor, [1, 3, MIDAS_H, MIDAS_W]);

  const feeds: Record<string, unknown> = {};
  feeds[session.inputNames[0]] = tensor;

  const results = await session.run(feeds);
  const outputKey = Object.keys(results)[0];
  const rawDepth  = results[outputKey].data as Float32Array;

  console.debug(`[depth-warp] MiDaS inference: ${(performance.now() - t0).toFixed(0)}ms`);
  return normaliseDepth(rawDepth, imageData.width, imageData.height);
}

// ─── Displacement warp ────────────────────────────────────────────────────────

/**
 * Apply a depth-guided displacement warp to an ImageData frame.
 *
 * Algorithm:
 *   For each output pixel (x, y):
 *     depth  = depthMap.data[y * w + x]          // 0=far, 1=near
 *     dispX  = depth × angleX × w × PARALLAX_SCALE × strength
 *     dispY  = depth × angleY × h × PARALLAX_SCALE × strength
 *     srcX   = x − dispX        // forward warp: camera panning reveals what was behind
 *     srcY   = y − dispY
 *     output[x,y] = bilinearSample(input, srcX, srcY)
 *
 * Out-of-bounds samples are filled with the configured fill colour.
 *
 * @param imageData  Source ImageData (not mutated).
 * @param depthMap   Normalised depth map (must match imageData dimensions).
 * @param options    Warp parameters.
 * @returns New ImageData with the warped result.
 */
export function warpFrame(
  imageData: ImageData,
  depthMap:  DepthMap,
  options:   WarpOptions,
): ImageData {
  const { width: w, height: h } = imageData;

  if (depthMap.width !== w || depthMap.height !== h) {
    throw new Error(
      `Depth map (${depthMap.width}×${depthMap.height}) does not match ` +
      `frame (${w}×${h}).`,
    );
  }

  const angleX  = Math.max(-MAX_ANGLE_DEG, Math.min(MAX_ANGLE_DEG, options.angleX));
  const angleY  = Math.max(-MAX_ANGLE_DEG, Math.min(MAX_ANGLE_DEG, options.angleY));
  const strength = Math.max(0, Math.min(1, options.strength ?? 1.0));

  const fillR = options.fillR ?? 0;
  const fillG = options.fillG ?? 0;
  const fillB = options.fillB ?? 0;
  const fillA = options.fillA ?? 0;

  const scaleX = angleX * w * PARALLAX_SCALE * strength;
  const scaleY = angleY * h * PARALLAX_SCALE * strength;

  const srcData = imageData.data;
  const depData = depthMap.data;
  const output  = new ImageData(w, h);
  const outData = output.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const depth = depData[y * w + x];
      const srcX  = x - depth * scaleX;
      const srcY  = y - depth * scaleY;

      const x0 = Math.floor(srcX);
      const y0 = Math.floor(srcY);
      const x1 = x0 + 1;
      const y1 = y0 + 1;

      const outIdx = (y * w + x) * 4;

      // Check bounds for all 4 samples
      const inBounds00 = x0 >= 0 && x0 < w && y0 >= 0 && y0 < h;
      const inBounds10 = x1 >= 0 && x1 < w && y0 >= 0 && y0 < h;
      const inBounds01 = x0 >= 0 && x0 < w && y1 >= 0 && y1 < h;
      const inBounds11 = x1 >= 0 && x1 < w && y1 >= 0 && y1 < h;

      if (!inBounds00 && !inBounds10 && !inBounds01 && !inBounds11) {
        // Fully out of bounds — use fill colour
        outData[outIdx]     = fillR;
        outData[outIdx + 1] = fillG;
        outData[outIdx + 2] = fillB;
        outData[outIdx + 3] = fillA;
        continue;
      }

      const tx = srcX - x0;
      const ty = srcY - y0;

      // Bilinear interpolation per channel
      for (let c = 0; c < 4; c++) {
        const v00 = inBounds00 ? srcData[(y0 * w + x0) * 4 + c] : 0;
        const v10 = inBounds10 ? srcData[(y0 * w + x1) * 4 + c] : 0;
        const v01 = inBounds01 ? srcData[(y1 * w + x0) * 4 + c] : 0;
        const v11 = inBounds11 ? srcData[(y1 * w + x1) * 4 + c] : 0;

        outData[outIdx + c] = Math.round(
          v00 * (1 - tx) * (1 - ty) +
          v10 *      tx  * (1 - ty) +
          v01 * (1 - tx) *      ty  +
          v11 *      tx  *      ty,
        );
      }
    }
  }

  return output;
}

// ─── Full pipeline ────────────────────────────────────────────────────────────

/**
 * Full 2.5D parallax pipeline: estimate depth then warp.
 *
 * @param imageData  Original camera / upload frame.
 * @param angleX     Horizontal pan angle in degrees [-20, 20].
 * @param angleY     Vertical tilt angle in degrees [-20, 20].
 * @param strength   Parallax strength [0, 1]. Default 1.0.
 * @param cachedDepth  Optional pre-computed depth map (avoids re-inference).
 */
export async function computeParallaxFrame(
  imageData:    ImageData,
  angleX:       number,
  angleY:       number,
  strength?:    number,
  cachedDepth?: DepthMap,
): Promise<ParallaxResult> {
  let depthMap: DepthMap;
  let inferenceMs = 0;

  if (cachedDepth) {
    depthMap = cachedDepth;
  } else {
    const t0 = performance.now();
    depthMap = await estimateDepth(imageData);
    inferenceMs = performance.now() - t0;
  }

  const t1 = performance.now();
  const frame = warpFrame(imageData, depthMap, { angleX, angleY, strength });
  const warpMs = performance.now() - t1;

  return { frame, depthMap, inferenceMs, warpMs };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Convert an HTML ImageElement or OffscreenCanvas to ImageData
 * for use with estimateDepth() and warpFrame().
 */
export function imageElementToImageData(
  img:     HTMLImageElement,
  width?:  number,
  height?: number,
): ImageData {
  const w = width  ?? img.naturalWidth;
  const h = height ?? img.naturalHeight;
  const canvas  = new OffscreenCanvas(w, h);
  const ctx     = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/**
 * Produce a 2D Float32Array heatmap suitable for debugging depth maps
 * (returns an RGBA ImageData where depth is mapped to a blue→red palette).
 */
export function depthMapToRgba(depthMap: DepthMap): ImageData {
  const { data, width, height } = depthMap;
  const out = new ImageData(width, height);
  for (let i = 0; i < data.length; i++) {
    const d   = data[i];
    // Blue (far) → green → red (near)
    const r   = Math.round(d * 255);
    const b   = Math.round((1 - d) * 255);
    const g   = Math.round(Math.sin(d * Math.PI) * 180);
    out.data[i * 4]     = r;
    out.data[i * 4 + 1] = g;
    out.data[i * 4 + 2] = b;
    out.data[i * 4 + 3] = 255;
  }
  return out;
}
