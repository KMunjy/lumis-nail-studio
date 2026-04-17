import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

/**
 * Patch console.error HERE (in module body, not in the inline <script>) so we
 * intercept AFTER Next.js has already wrapped console.error for its dev overlay,
 * but BEFORE the WASM bridge loads (which happens lazily inside FilesetResolver).
 *
 * Execution order:
 *  1. layout.tsx <script> runs → patches console.error (too early, Next.js re-wraps)
 *  2. Next.js module scripts load → Next.js wraps console.error for dev overlay
 *  3. mediapipe.ts module body runs (here) → we wrap NEXTJS's version
 *  4. CameraView useEffect calls getHandLandmarker() → WASM bridge loads and
 *     captures OUR version of console.error (via bind)
 *  5. TFLite writes INFO: message → captured bind calls OUR filter → suppressed ✓
 */
if (typeof window !== "undefined") {
  const _prevCE = console.error.bind(console);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (console as any).error = function (...args: unknown[]) {
    const msg = String(args[0] ?? "");
    if (
      msg.includes("TensorFlow Lite") ||
      msg.includes("XNNPACK") ||
      msg.startsWith("INFO:") ||
      msg.startsWith("WARNING:") ||
      msg.includes("inference_feedback") ||
      msg.includes("landmark_projection") ||
      msg.includes("gl_context")
    ) return;
    _prevCE(...args);
  };
}

let handLandmarker: HandLandmarker | null = null;
let isInitializing = false;

/**
 * Release the HandLandmarker and its WASM heap (~25 MB).
 * Call this when the AR view unmounts so memory is freed on page navigation.
 * getHandLandmarker() will reinitialise on the next call.
 */
export function destroyHandLandmarker(): void {
  if (handLandmarker) {
    handLandmarker.close();
    handLandmarker = null;
  }
  isInitializing = false;
}

export async function getHandLandmarker(): Promise<HandLandmarker> {
  if (handLandmarker) return handLandmarker;
  
  if (isInitializing) {
    // Wait for initialization to complete if called concurrently
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const interval = setInterval(() => {
        if (handLandmarker) {
          clearInterval(interval);
          resolve(handLandmarker);
        }
        if (attempts > 50) { // 5s timeout
          clearInterval(interval);
          reject(new Error("MediaPipe initialization timeout"));
        }
        attempts++;
      }, 100);
    });
  }

  isInitializing = true;
  try {
    // Pinned to 0.10.34 — the exact version installed via npm (package.json
    // specifies "^0.10.34"). Using @latest caused silent detectForVideo failures
    // on mobile when CDN served a version with a different internal WASM API.
    // The CI model-health job enforces that this string stays in sync with the
    // installed npm package version so drift is caught before it reaches prod.
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm"
    );

    // Initialize the HandLandmarker model.
    // Confidence thresholds lowered from 0.5 → 0.3:
    //   Mobile front cameras produce noisier, lower-contrast frames than the
    //   webcam environment MediaPipe's defaults were tuned for. 0.5 caused
    //   consistent detection failure on backlit / close-up hand poses.
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "CPU", // CPU: no WebGL crashes on Safari / Android WebView
      },
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: 0.3, // was default 0.5 — too strict for mobile
      minHandPresenceConfidence:  0.3, // was default 0.5
      minTrackingConfidence:      0.3, // was default 0.5
    });
    
    isInitializing = false;
    return handLandmarker;
  } catch (err) {
    isInitializing = false;
    console.error("Failed to initialize MediaPipe", err);
    throw err;
  }
}
