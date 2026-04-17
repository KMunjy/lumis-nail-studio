"use client";

// ── TFLite WASM stderr suppressor ────────────────────────────────────────────
// MediaPipe's WASM bridge emits INFO/WARNING messages via console.error.
// Next.js dev overlay treats any console.error as fatal. Patched here at
// module-load time so the filter is in place before FilesetResolver runs.
if (typeof window !== "undefined") {
  const _prev = console.error.bind(console);
  // eslint-disable-next-line no-console
  console.error = (...args: unknown[]) => {
    const msg = String(args[0] ?? "");
    if (
      msg.includes("TensorFlow Lite") ||
      msg.includes("XNNPACK")         ||
      msg.includes("TfLite")          ||
      msg.includes("tflite")          ||
      msg.includes("inference_feedback_manager") ||
      msg.includes("landmark_projection_calculator") ||
      msg.includes("gl_context")      ||
      msg.startsWith("INFO:")         ||
      msg.startsWith("WARNING:")      ||
      /^[IW][0-9]{7}/.test(msg)
    ) return;
    _prev(...args);
  };
}

/**
 * CameraView — Lume Engine V4.3
 *
 * RAF loop has zero useCallback dependencies — style + showThumb kept in refs.
 * Timestamp is strictly monotonic: Math.max(performance.now(), last + 1).
 * readyState check uses HAVE_ENOUGH_DATA (4).
 */

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import { AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getHandLandmarker, destroyHandLandmarker } from "@/lib/mediapipe";
import { HandSmoother } from "@/lib/smoothing";
import { drawNail, dorsalConfidence } from "@/lib/nail-renderer";
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import type { NailStyle, LandmarkPoint } from "@/types";

// ─── Finger → landmark index map ─────────────────────────────────────────────

const FINGERS = [
  { name: "thumb",  tip: 4,  dip: 3,  pip: 2,  fingerIndex: 0 },
  { name: "index",  tip: 8,  dip: 7,  pip: 6,  fingerIndex: 1 },
  { name: "middle", tip: 12, dip: 11, pip: 10, fingerIndex: 2 },
  { name: "ring",   tip: 16, dip: 15, pip: 14, fingerIndex: 3 },
  { name: "pinky",  tip: 20, dip: 19, pip: 18, fingerIndex: 4 },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CameraViewRef {
  capture: () => string | null;
}

export type TrackingStatus = "loading" | "scanning" | "tracking";

export interface CameraViewProps {
  style: NailStyle;
  showThumb?: boolean;
  onStatusChange?: (status: TrackingStatus) => void;
}

type PermissionState = "pending" | "granted" | "denied" | "unavailable";
type EngineState     = "loading" | "ready" | "error";

// ─── Corner mark — four-point scan guide ─────────────────────────────────────

function CornerMark({
  top, right, bottom, left,
}: {
  top?: number; right?: number; bottom?: number; left?: number;
}) {
  const borderColor = "rgba(155,107,78,0.35)";
  const size = 14;
  const thick = 1;
  return (
    <div style={{
      position: "absolute", top, right, bottom, left,
      width: size, height: size, pointerEvents: "none",
    }}>
      {/* horizontal arm */}
      <div style={{
        position: "absolute",
        width: size, height: thick,
        top: top !== undefined ? 0 : undefined,
        bottom: bottom !== undefined ? 0 : undefined,
        left: left !== undefined ? 0 : undefined,
        right: right !== undefined ? 0 : undefined,
        backgroundColor: borderColor,
      }} />
      {/* vertical arm */}
      <div style={{
        position: "absolute",
        width: thick, height: size,
        top: top !== undefined ? 0 : undefined,
        bottom: bottom !== undefined ? 0 : undefined,
        left: left !== undefined ? 0 : undefined,
        right: right !== undefined ? 0 : undefined,
        backgroundColor: borderColor,
      }} />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export const CameraView = forwardRef<CameraViewRef, CameraViewProps>(
  function CameraView({ style, showThumb = false, onStatusChange }, ref) {
    const videoRef    = useRef<HTMLVideoElement>(null);
    const canvasRef   = useRef<HTMLCanvasElement>(null);
    const lmRef       = useRef<HandLandmarker | null>(null);
    const smootherRef = useRef<HandSmoother>(new HandSmoother(21, 0.35));
    const rafRef      = useRef<number>(0);
    const tsRef       = useRef<number>(0);

    const styleRef      = useRef<NailStyle>(style);
    const showThumbRef  = useRef<boolean>(showThumb);
    const onStatusRef   = useRef(onStatusChange);
    const lastStatusRef = useRef<TrackingStatus>("loading");
    useEffect(() => { styleRef.current = style; },         [style]);
    useEffect(() => { showThumbRef.current = showThumb; }, [showThumb]);
    useEffect(() => { onStatusRef.current = onStatusChange; }, [onStatusChange]);

    const emitStatus = useCallback((s: TrackingStatus) => {
      if (s !== lastStatusRef.current) {
        lastStatusRef.current = s;
        onStatusRef.current?.(s);
      }
    }, []);

    const [permission,  setPermission]  = useState<PermissionState>("pending");
    const [engine,      setEngine]      = useState<EngineState>("loading");
    const [tracked,     setTracked]     = useState(false);
    const [dorsal,      setDorsal]      = useState(false);
    const [flashing,    setFlashing]    = useState(false);
    const [facingMode,  setFacingMode]  = useState<"user" | "environment">("user");
    const [scanStalled, setScanStalled] = useState(false);
    const scanTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
    const facingModeRef = useRef<"user" | "environment">("user");
    useEffect(() => { facingModeRef.current = facingMode; }, [facingMode]);

    // ── Capture ──────────────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      capture(): string | null {
        const video  = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return null;
        const out = document.createElement("canvas");
        out.width  = canvas.width;
        out.height = canvas.height;
        const ctx = out.getContext("2d");
        if (!ctx) return null;
        if (facingModeRef.current === "user") {
          ctx.save(); ctx.scale(-1, 1);
          ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
          ctx.restore();
          ctx.save(); ctx.scale(-1, 1);
          ctx.drawImage(canvas, -canvas.width, 0, canvas.width, canvas.height);
          ctx.restore();
        } else {
          ctx.drawImage(video,  0, 0, canvas.width, canvas.height);
          ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height);
        }
        const dataUrl = out.toDataURL("image/png");
        // Release native canvas backing store — not in DOM so won't GC promptly
        // on mobile Safari without this explicit nudge.
        out.width  = 0;
        out.height = 0;
        setFlashing(true);
        setTimeout(() => setFlashing(false), 500);
        return dataUrl;
      },
    }));

    // ── Scan stall timer cleanup on unmount ──────────────────────────────────
    useEffect(() => {
      return () => {
        if (scanTimerRef.current) { clearTimeout(scanTimerRef.current); scanTimerRef.current = null; }
      };
    }, []);

    // ── MediaPipe init ────────────────────────────────────────────────────────
    useEffect(() => {
      let cancelled = false;
      getHandLandmarker()
        .then((lm) => { if (!cancelled) { lmRef.current = lm; setEngine("ready"); } })
        .catch(() => { if (!cancelled) setEngine("error"); });
      return () => {
        cancelled = true;
        // Release the WASM model (~25 MB) when the AR view unmounts.
        // getHandLandmarker() will reinitialise on the next mount.
        lmRef.current = null;
        destroyHandLandmarker();
      };
    }, []);

    // ── Camera ────────────────────────────────────────────────────────────────
    useEffect(() => {
      let stream: MediaStream | null = null;
      let cancelled = false;
      (async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
          setPermission("unavailable");
          return;
        }
        try {
          // Request HD resolution — browser picks the closest available.
          // 1920×1080 ideal; hard minimum 1280×720 to avoid VGA fallback.
          // focusMode cast to any: Chrome extension of MediaTrackConstraints.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const videoConstraints: any = {
            facingMode,
            width:     { ideal: 1920, min: 1280 },
            height:    { ideal: 1080, min: 720  },
            frameRate: { ideal: 30,   min: 24   },
            focusMode: "continuous",
          };
          stream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: false,
          });
          if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
          const video = videoRef.current;
          if (!video) return;

          // Apply advanced image-quality constraints after track is live
          // (not all browsers honour these in getUserMedia, so we try applyConstraints too)
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (videoTrack as any).applyConstraints({
                width:        { ideal: 1920 },
                height:       { ideal: 1080 },
                frameRate:    { ideal: 30   },
                focusMode:    "continuous",
                exposureMode: "continuous",
                whiteBalanceMode: "continuous",
              });
            } catch {
              // applyConstraints is best-effort — not all devices/browsers support it
            }
          }

          video.srcObject = stream;
          smootherRef.current.reset();
          const tryPlay = () => video.play().catch(() => {});
          video.addEventListener("canplay", tryPlay, { once: true });
          tryPlay();
          setPermission("granted");
        } catch (err) {
          const name = err instanceof Error ? err.name : "";
          setPermission(
            name === "NotAllowedError" || name === "PermissionDeniedError"
              ? "denied" : "unavailable"
          );
        }
      })();
      return () => { cancelled = true; stream?.getTracks().forEach((t) => t.stop()); };
    }, [facingMode]);

    // ── Main rAF loop — ZERO external dependencies ────────────────────────────
    const loop = useCallback(() => {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      const lm     = lmRef.current;

      if (!video || !canvas || !lm) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      if (video.readyState < 4 || video.videoWidth === 0) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      // Match canvas backing resolution to the native video feed.
      // Using the raw videoWidth/videoHeight (not CSS pixels) gives full sharpness;
      // CSS object-cover handles display scaling. No DPR multiplication needed here
      // because the canvas is composited over the <video> at 1:1 backing pixels.
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
      if (!ctx) { rafRef.current = requestAnimationFrame(loop); return;
      }

      const ts = Math.max(performance.now(), tsRef.current + 1);
      tsRef.current = ts;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      try {
        const results = lm.detectForVideo(video, ts);

        if (!results.landmarks?.length) {
          setTracked(false);
          setDorsal(false);
          smootherRef.current.reset();
          emitStatus("scanning");
          if (!scanTimerRef.current) {
            scanTimerRef.current = setTimeout(() => setScanStalled(true), 4000);
          }
        } else {
          setTracked(true);
          setScanStalled(false);
          if (scanTimerRef.current) { clearTimeout(scanTimerRef.current); scanTimerRef.current = null; }
          emitStatus("tracking");
          const raw        = results.landmarks[0] as LandmarkPoint[];
          const handedness = results.handedness[0]?.[0]?.displayName ?? "Right";
          const smoothed   = smootherRef.current.smooth(raw);
          const dConf      = dorsalConfidence(smoothed, handedness);

          setDorsal(dConf > 0.5);

          if (dConf > 0.02) {
            const fingers = showThumbRef.current ? FINGERS : FINGERS.slice(1);
            for (const f of fingers) {
              const tip = smoothed[f.tip];
              const dip = smoothed[f.dip];
              const pip = smoothed[f.pip];
              if (tip && dip) {
                drawNail(ctx, tip, dip, canvas.width, canvas.height, styleRef.current, f.fingerIndex, pip, dConf);
              }
            }
          }
        }
      } catch {
        // Recover silently from frame-boundary errors
      }

      rafRef.current = requestAnimationFrame(loop);
    }, []);

    useEffect(() => {
      if (engine === "ready" && permission === "granted") {
        emitStatus("scanning");
        rafRef.current = requestAnimationFrame(loop);
      } else {
        emitStatus("loading");
      }
      return () => cancelAnimationFrame(rafRef.current);
    }, [engine, permission, loop, emitStatus]);

    // ── Error states ──────────────────────────────────────────────────────────
    if (permission === "denied") {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", height: "100%", textAlign: "center",
          padding: 40, backgroundColor: "#0A0907",
        }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 18,
            fontStyle: "italic", color: "rgba(249,246,242,0.80)", marginBottom: 12 }}>
            Camera access required
          </p>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 12,
            color: "rgba(249,246,242,0.35)", lineHeight: 1.7, maxWidth: 280 }}>
            Allow camera access in your browser settings to use the try-on studio.
          </p>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 9,
            color: "rgba(155,107,78,0.60)", letterSpacing: "0.14em",
            textTransform: "uppercase", marginTop: 24 }}>
            Settings → Privacy → Camera
          </p>
        </div>
      );
    }

    if (permission === "unavailable") {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", height: "100%", textAlign: "center",
          padding: 40, backgroundColor: "#0A0907",
        }}>
          <AlertTriangle size={24} style={{ color: "rgba(155,107,78,0.60)", marginBottom: 16 }} />
          <p style={{ fontFamily: "var(--font-display)", fontSize: 18,
            fontStyle: "italic", color: "rgba(249,246,242,0.80)", marginBottom: 12 }}>
            No camera found
          </p>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 12,
            color: "rgba(249,246,242,0.35)", lineHeight: 1.7, maxWidth: 280 }}>
            This device has no accessible camera, or your browser is blocking access.
          </p>
        </div>
      );
    }

    // ── Main viewport ─────────────────────────────────────────────────────────
    return (
      <div className="relative w-full h-full overflow-hidden" style={{ backgroundColor: "#0A0907" }}>

        <video
          ref={videoRef}
          autoPlay playsInline muted
          className={`absolute inset-0 w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
        />

        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
        />

        {/* ── AI Transparency disclosure (POPIA §18 / responsible AI) ─────── */}
        {/* Displayed during active tracking so users know the output is simulated */}
        <div
          aria-label="AI simulation notice"
          style={{
            position: "absolute",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 90,
            display: "flex",
            alignItems: "center",
            gap: 5,
            backgroundColor: "rgba(10,9,7,0.70)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 50,
            padding: "4px 12px",
            pointerEvents: "none",
            backdropFilter: "blur(8px)",
          }}
        >
          <span style={{
            width: 5, height: 5, borderRadius: "50%",
            backgroundColor: "rgba(255,140,60,0.85)",
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 8,
            letterSpacing: "0.14em",
            color: "rgba(249,246,242,0.45)",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}>
            Simulated overlay · results vary by lighting &amp; skin tone
          </span>
        </div>

        {/* Cinematic depth vignette */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 100% 80% at 50% 60%, transparent 40%, rgba(10,9,7,0.55) 100%)" }} />
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, rgba(10,9,7,0.40) 0%, transparent 20%, transparent 75%, rgba(10,9,7,0.75) 100%)" }} />

        {/* ── Loading state ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {(engine === "loading" || permission === "pending") && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{
                position: "absolute", inset: 0, zIndex: 50,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                backgroundColor: "#0A0907",
              }}
            >
              <p style={{
                fontFamily: "var(--font-display)",
                fontSize: 22, fontWeight: 400, fontStyle: "italic",
                letterSpacing: "0.04em", color: "var(--color-bone)",
                marginBottom: 32,
              }}>LUMIS</p>

              {/* Animated terra scan line */}
              <div style={{
                position: "relative", width: 120, height: 1,
                backgroundColor: "rgba(155,107,78,0.15)",
                overflow: "hidden",
              }}>
                <motion.div
                  animate={{ left: ["0%", "calc(100% - 32px)"] }}
                  transition={{ duration: 1.4, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }}
                  style={{
                    position: "absolute", top: 0, width: 32, height: 1,
                    backgroundColor: "var(--color-terra)",
                  }}
                />
              </div>

              <p style={{
                fontFamily: "var(--font-mono)", fontSize: 9,
                color: "rgba(249,246,242,0.22)", letterSpacing: "0.18em",
                textTransform: "uppercase", marginTop: 16,
              }}>
                {permission === "pending" ? "Requesting camera" : "Loading model"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Engine error ──────────────────────────────────────────────── */}
        {engine === "error" && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 40,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: 32, textAlign: "center",
          }}>
            <AlertTriangle size={22} style={{ color: "rgba(155,107,78,0.6)", marginBottom: 16 }} />
            <p style={{ fontFamily: "var(--font-display)", fontSize: 16,
              fontStyle: "italic", color: "rgba(249,246,242,0.75)", marginBottom: 8 }}>
              Model failed to load
            </p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 9,
              color: "rgba(249,246,242,0.28)", letterSpacing: "0.10em" }}>
              Check connection · model is ~25 MB on first load
            </p>
          </div>
        )}

        {/* ── Scan guide — four corner marks + instruction ──────────────── */}
        <AnimatePresence>
          {engine === "ready" && permission === "granted" && !tracked && (
            <motion.div
              key="guide-scan"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
                {/* Four-corner frame */}
                <div style={{ position: "relative", width: 164, height: 240 }}>
                  <CornerMark top={0}   left={0}  />
                  <CornerMark top={0}   right={0} />
                  <CornerMark bottom={0} left={0} />
                  <CornerMark bottom={0} right={0} />
                  {/* Terra scan line */}
                  <motion.div
                    animate={{ top: ["2%", "98%", "2%"] }}
                    transition={{ duration: 3.2, ease: "easeInOut", repeat: Infinity }}
                    style={{
                      position: "absolute", left: 0, right: 0, height: 1,
                      background: "linear-gradient(to right, transparent, rgba(155,107,78,0.55), transparent)",
                    }}
                  />
                </div>

                {/* Instruction lines */}
                <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 6 }}>
                  <p style={{
                    fontFamily: "var(--font-mono)", fontSize: 9,
                    color: "rgba(249,246,242,0.45)", textTransform: "uppercase",
                    letterSpacing: "0.18em",
                  }}>
                    Back of hand · fingers spread
                  </p>
                  <p style={{
                    fontFamily: "var(--font-mono)", fontSize: 8,
                    color: "rgba(249,246,242,0.22)", textTransform: "uppercase",
                    letterSpacing: "0.14em",
                  }}>
                    Hold ~30 cm from camera
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Scan stall — plain text, no container ────────────────────── */}
        <AnimatePresence>
          {scanStalled && !tracked && (
            <motion.div
              key="stall-hint"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{
                position: "absolute", bottom: 148, left: 0, right: 0,
                display: "flex", justifyContent: "center", pointerEvents: "none",
              }}
            >
              <p style={{
                fontFamily: "var(--font-mono)", fontSize: 9,
                color: "rgba(155,107,78,0.65)", textTransform: "uppercase",
                letterSpacing: "0.14em",
              }}>
                Move hand closer · show wrist
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Palm-facing instruction ───────────────────────────────────── */}
        <AnimatePresence>
          {tracked && !dorsal && (
            <motion.div
              key="guide-flip"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{
                position: "absolute", bottom: 148, left: 0, right: 0,
                display: "flex", justifyContent: "center", pointerEvents: "none",
              }}
            >
              <p style={{
                fontFamily: "var(--font-mono)", fontSize: 9,
                color: "rgba(249,246,242,0.50)", textTransform: "uppercase",
                letterSpacing: "0.18em",
              }}>
                Turn hand over
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Status + camera flip — top right ─────────────────────────── */}
        {engine === "ready" && permission === "granted" && (
          <div style={{
            position: "absolute", top: 12, right: 12,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {/* Camera flip — square, 2px radius, no icon */}
            <button
              onClick={() => {
                setScanStalled(false);
                if (scanTimerRef.current) { clearTimeout(scanTimerRef.current); scanTimerRef.current = null; }
                setFacingMode((m) => m === "user" ? "environment" : "user");
              }}
              aria-label="Switch camera"
              style={{
                width: 32, height: 32, borderRadius: 2,
                backgroundColor: "rgba(10,9,7,0.65)",
                border: "1px solid rgba(255,255,255,0.07)",
                color: "rgba(249,246,242,0.38)",
                cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-mono)", fontSize: 13,
                lineHeight: 1, backdropFilter: "blur(12px)",
                transition: "color 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(249,246,242,0.65)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(249,246,242,0.38)"; }}
            >
              ↺
            </button>

            {/* Status — no pill, minimal */}
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              backgroundColor: "rgba(10,9,7,0.60)",
              padding: "6px 9px", borderRadius: 2,
              border: "1px solid rgba(255,255,255,0.05)",
              backdropFilter: "blur(12px)",
            }}>
              <span style={{
                display: "inline-block", width: 4, height: 4, borderRadius: "50%",
                backgroundColor: tracked && dorsal
                  ? "var(--color-terra)"
                  : tracked
                  ? "rgba(155,107,78,0.45)"
                  : "rgba(249,246,242,0.18)",
                flexShrink: 0,
              }} />
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 8,
                color: "rgba(249,246,242,0.35)",
                textTransform: "uppercase", letterSpacing: "0.16em",
              }}>
                {tracked && dorsal ? "Live" : tracked ? "Pose" : "Scan"}
              </span>
            </div>
          </div>
        )}

        {/* ── Capture flash ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {flashing && (
            <motion.div
              key="flash"
              initial={{ opacity: 0.85 }} animate={{ opacity: 0 }}
              transition={{ duration: 0.40 }}
              style={{ position: "absolute", inset: 0, backgroundColor: "#F9F6F2",
                       pointerEvents: "none", zIndex: 50 }}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }
);

CameraView.displayName = "CameraView";
