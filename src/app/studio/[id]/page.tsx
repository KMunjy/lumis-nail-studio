"use client";

import { use, useRef, useState, useCallback, useEffect } from "react";
import { products } from "@/data/products";
import { notFound, useRouter } from "next/navigation";
import { CameraView, type CameraViewRef } from "@/components/CameraView";
import { ShadeSelector } from "@/components/ShadeSelector";
import { useTryOn } from "@/store/try-on-context";
import Link from "next/link";
import type { TrackingStatus } from "@/components/CameraView";
import {
  ArrowLeft, ShoppingBag, Camera, Download, CheckCircle, X,
  Upload, Layers, Loader, Sun, Bookmark,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { NailStyle, NailShape, NailFinish } from "@/types";
import { NailSwatch } from "@/components/NailSwatch";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConsentBanner } from "@/components/ConsentBanner";
import { hasConsent } from "@/lib/consent";
import { ShareButton } from "@/components/ShareButton";
import type { DepthMap } from "@/lib/depth-warp";
import type { DepthWarpGLContext } from "@/lib/depth-warp-gl";
import { awardPoints, POINT_EVENTS } from "@/lib/loyalty";
import { Suspense } from "react";
import { useCreatorParams } from "@/hooks/use-creator-params";
import { CreatorBanner } from "@/components/CreatorBanner";

// ─── Shape paths for miniature SVG picker ─────────────────────────────────────

const SHAPE_PATHS: Record<string, string> = {
  Almond:   "M 50 92 Q 20 96 15 72 C 12 46 18 20 35 8 C 42 3 58 3 65 8 C 82 20 88 46 85 72 Q 80 96 50 92 Z",
  Stiletto: "M 50 92 Q 20 96 15 76 C 12 56 22 30 50 4 C 78 30 88 56 85 76 Q 80 96 50 92 Z",
  Oval:     "M 50 92 Q 18 95 14 70 C 11 44 22 16 50 10 C 78 16 89 44 86 70 Q 82 95 50 92 Z",
  Coffin:   "M 50 92 Q 20 96 15 72 L 15 28 C 18 16 30 10 38 10 L 62 10 C 70 10 82 16 85 28 L 85 72 Q 80 96 50 92 Z",
  Square:   "M 50 92 Q 20 96 15 72 L 15 10 L 85 10 L 85 72 Q 80 96 50 92 Z",
};

const NAIL_SHAPES: NailShape[] = ["Almond", "Stiletto", "Oval", "Coffin", "Square"];

/** All 7 finishes the renderer supports as of v3.4. */
const FINISHES: NailFinish[] = ["Gloss", "Matte", "Metallic", "Chrome", "Jelly", "Glitter", "CatEye"];

/** Human-readable short labels for the pill chips. */
const FINISH_LABELS: Record<NailFinish, string> = {
  Gloss:    "Gloss",
  Matte:    "Matte",
  Metallic: "Metal",
  Chrome:   "Chrome",
  Jelly:    "Jelly",
  Glitter:  "Glitter",
  CatEye:   "Cat Eye",
};

function ShapeIcon({ shape, color, size = 26 }: { shape: string; color: string; size?: number }) {
  const d = SHAPE_PATHS[shape] ?? SHAPE_PATHS.Almond;
  const gradId = `si-${shape}-${color.replace("#", "")}`;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.95} />
          <stop offset="100%" stopColor={color} stopOpacity={0.55} />
        </linearGradient>
      </defs>
      <path d={d} fill={`url(#${gradId})`} />
      <path d={d} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="1.5" />
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function StudioPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id }    = use(params);
  const product   = products.find((p) => p.id === id);
  if (!product) notFound();

  const { addToCart, cartCount, setLastViewed } = useTryOn();
  const cameraRef     = useRef<CameraViewRef>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // ── Core UI state ──────────────────────────────────────────────────────────
  const [activeShadeId,   setActiveShadeId]   = useState<string | null>(null);
  const [styleOverride,   setStyleOverride]   = useState<NailStyle | null>(null);
  const [shapeOverride,   setShapeOverride]   = useState<NailShape | null>(null);
  // Pre-select the product's own finish so Jelly/Glitter/CatEye products open correctly
  const [finish,          setFinish]          = useState<NailFinish>(product.finish);
  const [capturedImage,   setCapturedImage]   = useState<string | null>(null);
  const [addedToCart,     setAddedToCart]     = useState(false);
  const [trackingStatus,  setTrackingStatus]  = useState<TrackingStatus>("loading");
  const [consentGiven,    setConsentGiven]    = useState(false);
  // [CA-3] Camera pre-prompt: shown once before consent banner activates camera.
  // Skip for returning users who already have consent stored.
  const [cameraPrePromptDone, setCameraPrePromptDone] = useState(() => {
    if (typeof window === "undefined") return true;
    return hasConsent(); // returning users skip the pre-prompt
  });
  // [CA-4] Inline save trigger: floating bookmark shown after 3s of active tracking
  const [showInlineSave,  setShowInlineSave]  = useState(false);
  const inlineSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Batch 4: Creator Collab + Challenge Mode ──────────────────────────────
  const creatorParams                        = useCreatorParams();
  const [showCreatorBanner, setShowCreatorBanner] = useState(true);

  // Pre-load shade + finish from URL params (creator or challenge deep-link)
  useEffect(() => {
    if (!creatorParams.shadeHex) return;
    const matchedProduct = products.find(
      (p) => p.topColor.toLowerCase() === creatorParams.shadeHex!.toLowerCase()
    );
    if (matchedProduct) {
      setStyleOverride({
        topColor:       matchedProduct.topColor,
        midColor:       matchedProduct.midColor,
        bottomColor:    matchedProduct.bottomColor,
        shape:          matchedProduct.shape,
        finish:         creatorParams.finish ?? matchedProduct.finish,
        opacity:        0.93,
        skinToneHex:    matchedProduct.skinToneHex,
        glitterDensity: matchedProduct.glitterDensity,
        catEyeDir:      matchedProduct.catEyeDir,
      });
    }
    if (creatorParams.finish) setFinish(creatorParams.finish);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatorParams.shadeHex, creatorParams.finish]);

  // ── F5 feature state ───────────────────────────────────────────────────────
  // [F5-4] Warm / Natural / Cool lighting filter applied to camera div
  const [lightingMode,   setLightingMode]    = useState<"warm" | "natural" | "cool">("natural");
  // [F5-2] Toast shown after capture auto-saves to Looks
  const [savedLookToast, setSavedLookToast]  = useState(false);
  // [F5-5] Before / after split view slider position (%)
  const [splitPos,       setSplitPos]        = useState(50);
  const [splitDragging,  setSplitDragging]   = useState(false);
  // [F5-3] Swipe-to-switch: track touch start X; hide hint once animation finishes
  const swipeTouchStartXRef = useRef<number | null>(null);
  const [swipeHintDone, setSwipeHintDone] = useState(false);
  const router = useRouter();

  // ── 3D parallax viewer state ───────────────────────────────────────────────
  const [show3DViewer,  setShow3DViewer]  = useState(false);
  const [depthLoading,  setDepthLoading]  = useState(false);
  const [depthError,    setDepthError]    = useState<string | null>(null);
  const depthMapRef      = useRef<DepthMap | null>(null);
  const parallaxSrcRef   = useRef<ImageData | null>(null);
  const parallax3DRef    = useRef<HTMLCanvasElement>(null);
  const parallaxRafRef   = useRef<number>(0);
  const parallaxAngleRef = useRef({ x: 0, y: 0 });
  // WebGL2 context for GPU-accelerated warp (falls back to CPU)
  const glCtxRef         = useRef<DepthWarpGLContext | null>(null);

  // ── Loyalty points ─────────────────────────────────────────────────────────
  // Award try-on session points after ≥5 s of active dorsal tracking
  const trackingStartRef  = useRef<number | null>(null);
  const sessionAwardedRef = useRef(false);
  // Demo user ID (production: read from Supabase auth session)
  // Initialized to a stable SSR-safe value; updated client-side after hydration.
  const loyaltyUserIdRef = useRef<string>("demo-user");
  const loyaltyUserId = loyaltyUserIdRef.current;
  useEffect(() => {
    const stored = localStorage.getItem("lumis_demo_user_id");
    if (stored) {
      loyaltyUserIdRef.current = stored;
    } else {
      const id = crypto.randomUUID();
      localStorage.setItem("lumis_demo_user_id", id);
      loyaltyUserIdRef.current = id;
    }
  }, []);

  useEffect(() => { setLastViewed(id); },      [id, setLastViewed]);
  useEffect(() => { setConsentGiven(hasConsent()); }, []);

  const handleStatusChange = useCallback((s: TrackingStatus) => {
    setTrackingStatus(s);
    // Loyalty: track ≥5 s of active dorsal tracking → award session points
    if (s === "tracking") {
      if (trackingStartRef.current === null) {
        trackingStartRef.current = Date.now();
        // [CA-4] Show inline save CTA after 3 s of engaged tracking
        inlineSaveTimerRef.current = setTimeout(() => {
          setShowInlineSave(true);
        }, 3000);
      } else if (!sessionAwardedRef.current) {
        const elapsed = Date.now() - trackingStartRef.current;
        if (elapsed >= 5000) {
          sessionAwardedRef.current = true;
          awardPoints(loyaltyUserId, POINT_EVENTS.TRY_ON_SESSION, "try_on_session", { productId: id });
        }
      }
    } else {
      // Reset timer if tracking drops (e.g. hand left frame)
      trackingStartRef.current = null;
      if (inlineSaveTimerRef.current) {
        clearTimeout(inlineSaveTimerRef.current);
        inlineSaveTimerRef.current = null;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, loyaltyUserId]);

  // ── Resolved style — shade override wins; product fields fill gaps ─────────
  // Finish-specific fields (skinToneHex, glitterDensity, catEyeDir) flow through
  // from the selected shade, falling back to the product's own values.
  const activeStyle: NailStyle = {
    ...(styleOverride ?? {
      topColor:       product.topColor,
      midColor:       product.midColor,
      bottomColor:    product.bottomColor,
      shape:          product.shape,
      opacity:        0.93,
      skinToneHex:    product.skinToneHex,
      glitterDensity: product.glitterDensity,
      catEyeDir:      product.catEyeDir,
    }),
    shape:  shapeOverride ?? (styleOverride?.shape  ?? product.shape),
    finish,
  };

  const handleShadeSelect = useCallback((style: NailStyle | null, shadeId: string | null) => {
    setStyleOverride(style);
    setActiveShadeId(shadeId);
    // When a shade with its own finish is selected, apply that finish
    if (style?.finish) setFinish(style.finish);
  }, []);

  // ── Camera capture ─────────────────────────────────────────────────────────
  const handleCapture = useCallback(() => {
    const url = cameraRef.current?.capture();
    if (url) {
      setCapturedImage(url);
      // [F5-2] Auto-save via saveLook() — uses lumis_saved_looks_${userId} key
      // so the Account/Looks page can read it via getUserLooks()
      import("@/lib/saved-looks").then(({ saveLook }) => {
        saveLook({
          userId: loyaltyUserIdRef.current,
          productId: product.id,
          productName: product.name,
          imageDataUrl: url,
          style: activeStyle,
        }).catch(() => { /* ignore storage quota errors */ });
      });
      setSavedLookToast(true);
      setTimeout(() => setSavedLookToast(false), 2500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, product.name, activeStyle]);

  // ── Photo upload ───────────────────────────────────────────────────────────
  const handleUploadFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      // Draw to an off-screen canvas to get a PNG data URL for the preview modal
      const canvas = document.createElement("canvas");
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        setCapturedImage(canvas.toDataURL("image/png"));
      }
    };
    img.onerror = () => URL.revokeObjectURL(objectUrl);
    img.src = objectUrl;

    // Reset so the same file can be re-selected
    e.target.value = "";
  }, []);

  // ── 3D parallax viewer ─────────────────────────────────────────────────────

  /** Convert a PNG data URL to ImageData via a temporary canvas. */
  const dataUrlToImageData = useCallback((dataUrl: string): Promise<ImageData> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("No canvas context")); return; }
        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
      };
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = dataUrl;
    });
  }, []);

  /** Draw a warped parallax frame to the 3D canvas.
   *  Uses WebGL2 GPU renderer when available; falls back to CPU warpFrame. */
  const draw3DFrame = useCallback(() => {
    const canvas = parallax3DRef.current;
    const depth  = depthMapRef.current;
    const src    = parallaxSrcRef.current;
    if (!canvas || !depth || !src) return;

    const { x: angleX, y: angleY } = parallaxAngleRef.current;

    // ── GPU path (WebGL2) ──────────────────────────────────────────────────
    if (glCtxRef.current) {
      import("@/lib/depth-warp-gl").then(({ renderParallaxGL }) => {
        if (!glCtxRef.current) return;
        canvas.width  = src.width;
        canvas.height = src.height;
        renderParallaxGL(glCtxRef.current, angleX, angleY, 0.85);
      });
      return;
    }

    // ── CPU fallback ───────────────────────────────────────────────────────
    import("@/lib/depth-warp").then(({ warpFrame }) => {
      const warped = warpFrame(src, depth, {
        angleX,
        angleY,
        strength: 0.85,
        fillR: 10, fillG: 9, fillB: 7, fillA: 255,
      });
      canvas.width  = warped.width;
      canvas.height = warped.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.putImageData(warped, 0, 0);
    });
  }, []);

  /** Open the 3D viewer: convert captured image, initialise GL, run depth estimation. */
  const handle3DOpen = useCallback(async () => {
    if (!capturedImage) return;
    setShow3DViewer(true);
    setDepthLoading(true);
    setDepthError(null);
    depthMapRef.current   = null;
    glCtxRef.current      = null;
    parallaxAngleRef.current = { x: 0, y: 0 };

    try {
      const imageData = await dataUrlToImageData(capturedImage);
      parallaxSrcRef.current = imageData;

      // Dynamic import keeps onnxruntime-web out of main bundle
      const { computeParallaxFrame } = await import("@/lib/depth-warp");
      const result = await computeParallaxFrame(imageData, 0, 0, 0.85);
      depthMapRef.current = result.depthMap;

      // ── Try to initialise WebGL2 GPU renderer ──────────────────────────
      const canvas = parallax3DRef.current;
      if (canvas) {
        try {
          const { createDepthWarpGL, uploadSourceTexture, uploadDepthTexture, isWebGL2Available } =
            await import("@/lib/depth-warp-gl");
          if (isWebGL2Available()) {
            const glCtx = createDepthWarpGL(canvas);
            uploadSourceTexture(glCtx, imageData);
            uploadDepthTexture(glCtx,  result.depthMap);
            glCtxRef.current = glCtx;
          }
        } catch (glErr) {
          console.warn("[studio/3D] WebGL2 init failed, using CPU fallback:", glErr);
        }
      }

      setDepthLoading(false);
      draw3DFrame();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      const friendly = msg.includes("midas_small.onnx") || msg.includes("404") || msg.includes("Failed to fetch")
        ? "Depth model not found. Place midas_small.onnx in /public/models/ to enable 3D view."
        : `3D depth failed: ${msg}`;
      setDepthError(friendly);
      setDepthLoading(false);
    }
  }, [capturedImage, dataUrlToImageData, draw3DFrame]);

  const handle3DClose = useCallback(() => {
    cancelAnimationFrame(parallaxRafRef.current);
    // Release GPU resources
    if (glCtxRef.current) {
      import("@/lib/depth-warp-gl").then(({ destroyDepthWarpGL }) => {
        if (glCtxRef.current) {
          destroyDepthWarpGL(glCtxRef.current);
          glCtxRef.current = null;
        }
      });
    }
    setShow3DViewer(false);
    setDepthError(null);
    depthMapRef.current    = null;
    parallaxSrcRef.current = null;
  }, []);

  /** Mouse / pointer move over the 3D canvas → update parallax angle. */
  const handle3DPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!depthMapRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left)  / rect.width  - 0.5; // -0.5 → +0.5
    const relY = (e.clientY - rect.top)   / rect.height - 0.5;
    parallaxAngleRef.current = { x: relX * 16, y: relY * -12 }; // ±8° H, ±6° V

    cancelAnimationFrame(parallaxRafRef.current);
    parallaxRafRef.current = requestAnimationFrame(draw3DFrame);
  }, [draw3DFrame]);

  // ── Download / cart ────────────────────────────────────────────────────────
  const handleDownload = useCallback(() => {
    if (!capturedImage) return;
    const a = document.createElement("a");
    a.href = capturedImage;
    a.download = `LUMIS_${product.name.replace(/\s+/g, "_")}.png`;
    a.click();
  }, [capturedImage, product.name]);

  const handleAddToCart = useCallback(() => {
    addToCart(product.id);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2200);
    // Loyalty: award add-to-cart points (fire-and-forget)
    awardPoints(loyaltyUserId, POINT_EVENTS.ADD_TO_CART, "add_to_cart", { productId: product.id });
  }, [addToCart, product.id, loyaltyUserId]);

  // ── [F5-4] Lighting filter map ─────────────────────────────────────────────
  const LIGHTING_FILTERS: Record<string, string> = {
    warm:    "sepia(0.18) saturate(1.15) brightness(1.06)",
    natural: "none",
    cool:    "hue-rotate(14deg) saturate(0.88) brightness(1.03)",
  };
  const LIGHTING_LABELS: Record<string, string> = {
    warm: "Warm", natural: "Natural", cool: "Cool",
  };
  const cycleLighting = () => {
    setLightingMode(prev =>
      prev === "warm" ? "natural" : prev === "natural" ? "cool" : "warm"
    );
  };

  // ── [F5-3] Swipe-to-switch products ────────────────────────────────────────
  const handleSwipeTouchStart = (e: React.TouchEvent) => {
    swipeTouchStartXRef.current = e.touches[0].clientX;
  };
  const handleSwipeTouchEnd = (e: React.TouchEvent) => {
    if (swipeTouchStartXRef.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeTouchStartXRef.current;
    swipeTouchStartXRef.current = null;
    if (Math.abs(dx) < 65) return;
    const idx = products.findIndex((p) => p.id === id);
    if (dx < 0 && idx < products.length - 1) {
      router.push(`/studio/${products[idx + 1].id}`);
    } else if (dx > 0 && idx > 0) {
      router.push(`/studio/${products[idx - 1].id}`);
    }
  };

  // ── [F5-5] Before/after split drag handlers ─────────────────────────────────
  const handleSplitPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setSplitDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const handleSplitPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!splitDragging) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pct = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
    setSplitPos(pct);
  };
  const handleSplitPointerUp = () => setSplitDragging(false);

  // ── Active shade label for display ─────────────────────────────────────────
  const activeShadeLabel = activeShadeId
    ? (activeShadeId.replace(/-\d+$/, "").replace(/-/g, " "))
    : null;

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden" style={{ backgroundColor: "#FFFFFF" }}>

      {/* Hidden upload input */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleUploadFile}
      />

      {/* ── [Batch 4 F4] Creator Collab banner ───────────────────────────── */}
      <AnimatePresence>
        {creatorParams.creatorName && showCreatorBanner && (
          <CreatorBanner
            creatorName={creatorParams.creatorName}
            productName={product.name}
            onDismiss={() => setShowCreatorBanner(false)}
          />
        )}
      </AnimatePresence>

      {/* ── [CA-4] Inline save trigger — appears after 3s of active tracking ── */}
      <AnimatePresence>
        {showInlineSave && trackingStatus === "tracking" && !capturedImage && (
          <motion.div
            key="inline-save"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ type: "spring", damping: 20, stiffness: 260 }}
            style={{
              position: "absolute",
              right: 14,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 70,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
            }}
          >
            {/* Pulsing capture button */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              animate={{ boxShadow: ["0 0 0 0 rgba(244,63,120,0.5)", "0 0 0 10px rgba(244,63,120,0)", "0 0 0 0 rgba(244,63,120,0)"] }}
              transition={{ repeat: Infinity, duration: 1.8 }}
              onClick={() => {
                handleCapture();
                setShowInlineSave(false);
              }}
              style={{
                width: 52, height: 52, borderRadius: "50%",
                backgroundColor: "var(--color-pink)",
                border: "3px solid rgba(255,255,255,0.85)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(244,63,120,0.45)",
              }}
            >
              <Camera size={20} style={{ color: "#FFFFFF" }} />
            </motion.button>
            <div style={{
              backgroundColor: "rgba(0,0,0,0.55)",
              borderRadius: 6, padding: "4px 8px",
              backdropFilter: "blur(4px)",
            }}>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 600, color: "#FFFFFF", letterSpacing: "0.08em", textAlign: "center" }}>
                Save<br />look
              </p>
            </div>
            {/* Dismiss */}
            <button
              onClick={() => setShowInlineSave(false)}
              style={{
                width: 20, height: 20, borderRadius: "50%",
                backgroundColor: "rgba(255,255,255,0.20)",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "rgba(255,255,255,0.70)",
              }}
            >
              <X size={10} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── [F5-2] Saved to Looks toast ──────────────────────────────────── */}
      <AnimatePresence>
        {savedLookToast && (
          <motion.div
            key="saved-toast"
            initial={{ opacity: 0, y: 24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={{ type: "spring", damping: 22, stiffness: 260 }}
            style={{
              position: "absolute", top: 80, left: "50%", transform: "translateX(-50%)",
              zIndex: 80,
              backgroundColor: "#1A1A1A",
              color: "#FFFFFF",
              borderRadius: 24,
              padding: "10px 18px",
              display: "flex", alignItems: "center", gap: 8,
              boxShadow: "0 8px 28px rgba(0,0,0,0.30)",
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            <Bookmark size={13} style={{ color: "var(--color-pink)" }} />
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600 }}>
              Saved to Looks
            </span>
            <CheckCircle size={13} style={{ color: "#22C55E" }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── [CA-3] Camera pre-prompt — rationale screen before consent ─────── */}
      <AnimatePresence>
        {!cameraPrePromptDone && !consentGiven && (
          <motion.div
            key="camera-preprompt"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.28 }}
            style={{
              position: "absolute", inset: 0, zIndex: 110,
              backgroundColor: "rgba(10,8,8,0.88)",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              padding: "40px 32px",
              backdropFilter: "blur(12px)",
            }}
          >
            {/* Animated camera icon */}
            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
              style={{
                width: 72, height: 72, borderRadius: "50%",
                backgroundColor: "rgba(244,63,120,0.15)",
                border: "1px solid rgba(244,63,120,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 28,
              }}
            >
              <Camera size={30} style={{ color: "var(--color-pink)" }} strokeWidth={1.5} />
            </motion.div>

            <h2 style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.6rem, 4vw, 2.2rem)",
              fontWeight: 300, fontStyle: "italic",
              color: "#FFFFFF", lineHeight: 1.1,
              letterSpacing: "-0.02em",
              textAlign: "center",
              marginBottom: 16,
            }}>
              See it live on<br />your hand.
            </h2>

            <p style={{
              fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 300,
              color: "rgba(255,255,255,0.60)", lineHeight: 1.7,
              textAlign: "center", maxWidth: 280, marginBottom: 36,
            }}>
              LUMIS uses your camera to overlay nail shades in real time.
              Your video never leaves your device.
            </p>

            {/* Feature chips */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 36 }}>
              {["🔒 On-device only", "📵 Never recorded", "✨ Real-time AR"].map((t) => (
                <div key={t} style={{
                  padding: "6px 12px", borderRadius: 20,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  fontFamily: "var(--font-sans)", fontSize: 11,
                  color: "rgba(255,255,255,0.70)", letterSpacing: "0.02em",
                }}>
                  {t}
                </div>
              ))}
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setCameraPrePromptDone(true)}
              style={{
                width: "100%", maxWidth: 280, height: 52,
                backgroundColor: "var(--color-pink)", border: "none", borderRadius: 2,
                fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                color: "#FFFFFF", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                letterSpacing: "0.06em",
              }}
            >
              <Camera size={15} />
              Allow camera access
            </motion.button>

            <button
              onClick={() => setCameraPrePromptDone(true)}
              style={{
                marginTop: 16, background: "none", border: "none", cursor: "pointer",
                fontFamily: "var(--font-sans)", fontSize: 11,
                color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em",
              }}
            >
              Not now
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Consent gate — only shown after camera pre-prompt ───────────────── */}
      {cameraPrePromptDone && <ConsentBanner onConsent={() => setConsentGiven(true)} />}

      {/* ── Full-screen camera ────────────────────────────────────────────── */}
      {/* [F5-3] Touch-swipe to navigate prev/next product */}
      <div
        className="absolute inset-0"
        onTouchStart={handleSwipeTouchStart}
        onTouchEnd={handleSwipeTouchEnd}
        style={{ filter: LIGHTING_FILTERS[lightingMode] }} /* [F5-4] Lighting filter */
      >
        <ErrorBoundary context="CameraView">
          {consentGiven && (
            <CameraView
              ref={cameraRef}
              style={activeStyle}
              onStatusChange={handleStatusChange}
            />
          )}
        </ErrorBoundary>
      </div>

      {/* ── Top bar — white fade, floats over camera ──────────────────────── */}
      <div
        className="absolute top-0 inset-x-0 z-30 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, rgba(255,255,255,0.90) 0%, rgba(255,255,255,0.50) 70%, transparent 100%)",
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        <div
          className="pointer-events-auto"
          style={{ display: "flex", alignItems: "center", padding: "14px 16px 20px" }}
        >
          {/* Back */}
          <Link
            href="/"
            aria-label="Back to catalogue"
            style={{
              width: 36, height: 36, borderRadius: 4, flexShrink: 0,
              backgroundColor: "#FFFFFF",
              border: "1px solid var(--color-border)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--color-ink)",
            }}
          >
            <ArrowLeft size={14} />
          </Link>

          {/* Product identity — centred */}
          <div style={{ flex: 1, textAlign: "center", padding: "0 12px" }}>
            <p style={{
              fontFamily: "var(--font-sans)",
              fontSize: 14, fontWeight: 600,
              color: "var(--color-ink)",
              lineHeight: 1.2, letterSpacing: "-0.01em",
            }}>
              {product.name}
            </p>
            {/* [F5-1] Color-coded tracking status pill */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 3 }}>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 10, color: "var(--color-ink-light)" }}>
                {product.designer}
              </p>
              <AnimatePresence mode="wait">
                <motion.span
                  key={trackingStatus}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.18 }}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "2px 7px", borderRadius: 20,
                    fontSize: 9, fontWeight: 700,
                    fontFamily: "var(--font-sans)",
                    letterSpacing: "0.04em",
                    backgroundColor: trackingStatus === "tracking"
                      ? "rgba(34,197,94,0.12)"
                      : trackingStatus === "scanning"
                        ? "rgba(251,191,36,0.14)"
                        : "rgba(156,163,175,0.12)",
                    color: trackingStatus === "tracking"
                      ? "#16A34A"
                      : trackingStatus === "scanning"
                        ? "#D97706"
                        : "#6B7280",
                    border: `1px solid ${trackingStatus === "tracking"
                      ? "rgba(34,197,94,0.25)"
                      : trackingStatus === "scanning"
                        ? "rgba(251,191,36,0.30)"
                        : "rgba(156,163,175,0.20)"}`,
                  }}
                >
                  <span style={{
                    width: 5, height: 5, borderRadius: "50%",
                    backgroundColor: trackingStatus === "tracking"
                      ? "#22C55E"
                      : trackingStatus === "scanning"
                        ? "#F59E0B"
                        : "#9CA3AF",
                    ...(trackingStatus === "tracking"
                      ? { animation: "pulse-dot 1.6s ease-in-out infinite" }
                      : {}),
                  }} />
                  {trackingStatus === "tracking" ? "Live" : trackingStatus === "scanning" ? "Scanning" : "Loading"}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>

          {/* [F5-4] Lighting toggle */}
          <button
            onClick={cycleLighting}
            aria-label={`Lighting: ${LIGHTING_LABELS[lightingMode]}`}
            title={`Lighting: ${LIGHTING_LABELS[lightingMode]}`}
            style={{
              width: 36, height: 36, borderRadius: 4, flexShrink: 0,
              backgroundColor: lightingMode !== "natural" ? "var(--color-pink-pale)" : "#FFFFFF",
              border: lightingMode !== "natural"
                ? "1px solid var(--color-pink)"
                : "1px solid var(--color-border)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
              cursor: "pointer",
              color: lightingMode !== "natural" ? "var(--color-pink)" : "var(--color-ink)",
            }}
          >
            <Sun size={11} />
            <span style={{ fontSize: 7, fontWeight: 700, fontFamily: "var(--font-sans)", lineHeight: 1 }}>
              {lightingMode === "warm" ? "WARM" : lightingMode === "cool" ? "COOL" : "NAT"}
            </span>
          </button>

          {/* Cart */}
          <Link
            href="/cart"
            aria-label="Cart"
            style={{
              position: "relative", width: 36, height: 36, borderRadius: 4, flexShrink: 0,
              backgroundColor: "#FFFFFF",
              border: "1px solid var(--color-border)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--color-ink)",
            }}
          >
            <ShoppingBag size={14} />
            {cartCount > 0 && (
              <span style={{
                position: "absolute", top: -4, right: -4,
                width: 14, height: 14, borderRadius: "50%",
                backgroundColor: "var(--color-pink)",
                color: "#FFFFFF",
                fontSize: 7, fontWeight: 600,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* [F5-3] Swipe hint — fades out after 2.5s then unmounts */}
      {consentGiven && !swipeHintDone && (
        <motion.div
          initial={{ opacity: 0.8 }}
          animate={{ opacity: 0 }}
          transition={{ delay: 2.5, duration: 1.2 }}
          onAnimationComplete={() => setSwipeHintDone(true)}
          style={{
            position: "absolute", bottom: 220, left: 0, right: 0,
            display: "flex", justifyContent: "center",
            zIndex: 25, pointerEvents: "none",
          }}
        >
          <span style={{
            fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 600,
            color: "rgba(255,255,255,0.80)",
            backgroundColor: "rgba(0,0,0,0.35)",
            padding: "5px 12px", borderRadius: 20,
            letterSpacing: "0.05em",
          }}>← swipe to browse shades →</span>
        </motion.div>
      )}

      {/* ── Nailster-style floating bottom overlay ────────────────────────── */}
      {/* Sits over the full-screen camera as a translucent bottom sheet.      */}
      {/* Three zones: shape/finish toggles → shade strip → CTA bar.           */}
      <div
        className="absolute bottom-0 inset-x-0 z-30"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)", pointerEvents: "none" }}
      >
        {/* Long vignette fade merging camera into panel */}
        <div style={{
          height: 100,
          background: "linear-gradient(to top, rgba(255,255,255,0.96) 0%, transparent 100%)",
          pointerEvents: "none",
        }} />

        <div style={{
          backgroundColor: "rgba(255,255,255,0.94)",
          pointerEvents: "auto",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderTop: "1px solid rgba(0,0,0,0.06)",
        }}>

          {/* ── Zone 1: Shape picker — NailSwatch nail-shaped buttons ─────── */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "10px 16px 6px",
            overflowX: "auto",
          }}
            className="no-scrollbar"
          >
            {NAIL_SHAPES.map((s) => {
              const active = activeStyle.shape === s;
              return (
                <button
                  key={s}
                  onClick={() => setShapeOverride(s)}
                  aria-label={s}
                  aria-pressed={active}
                  style={{
                    flexShrink: 0,
                    display: "flex", flexDirection: "column",
                    alignItems: "center", gap: 3,
                    background: "none", border: "none", cursor: "pointer",
                    padding: "4px 6px",
                    borderRadius: 8,
                    backgroundColor: active ? "var(--color-pink-pale)" : "transparent",
                    transition: "background-color 0.14s",
                  }}
                >
                  <div style={{
                    padding: 2,
                    borderRadius: 6,
                    outline: active ? "2px solid var(--color-pink)" : "2px solid transparent",
                    outlineOffset: 1,
                    transition: "outline-color 0.14s",
                  }}>
                    <NailSwatch
                      shape={s}
                      finish={finish}
                      topColor={active ? activeStyle.topColor : "#CCCCCC"}
                      midColor={active ? activeStyle.midColor : "#AAAAAA"}
                      bottomColor={active ? activeStyle.bottomColor : "#888888"}
                      size="sm"
                      aria-label={s}
                    />
                  </div>
                  <span style={{
                    fontFamily: "var(--font-sans)", fontSize: 9,
                    color: active ? "var(--color-pink)" : "var(--color-ink-light)",
                    fontWeight: active ? 600 : 400,
                    textTransform: "uppercase", letterSpacing: "0.08em",
                  }}>{s}</span>
                </button>
              );
            })}

            {/* Divider */}
            <div style={{ width: 1, height: 40, backgroundColor: "var(--color-border-light)", flexShrink: 0, margin: "0 2px" }} />

            {/* Finish pills — compact, same row */}
            <div className="overflow-x-auto no-scrollbar" style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 4, width: "max-content" }}>
                {FINISHES.map((f) => {
                  const active = finish === f;
                  return (
                    <button
                      key={f}
                      onClick={() => setFinish(f)}
                      aria-pressed={active}
                      style={{
                        padding: "5px 10px", borderRadius: 20,
                        border: active ? "1.5px solid var(--color-pink)" : "1px solid var(--color-border)",
                        backgroundColor: active ? "var(--color-pink)" : "#FFFFFF",
                        fontFamily: "var(--font-sans)", fontSize: 11,
                        fontWeight: 600,
                        color: active ? "#FFFFFF" : "var(--color-ink-mid)",
                        cursor: "pointer", transition: "all 0.14s ease",
                        whiteSpace: "nowrap", flexShrink: 0,
                        boxShadow: active ? "0 2px 8px rgba(232,64,112,0.30)" : "none",
                      }}
                    >{FINISH_LABELS[f]}</button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Zone 2: Shade strip — primary colour selection ────────────── */}
          <div style={{ padding: "4px 16px 2px", maxHeight: 220, overflowY: "auto" }} className="no-scrollbar">
            <ShadeSelector activeShadeId={activeShadeId} onSelect={handleShadeSelect} />
          </div>

          {/* ── Zone 3: Product info + CTA + Capture ─────────────────────── */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 16px 14px",
          }}>
            {/* Shade name + reset */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                color: "var(--color-ink)", lineHeight: 1.2,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {activeShadeLabel
                  ? activeShadeLabel.replace(/\b\w/g, (c) => c.toUpperCase())
                  : product.name}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <p style={{
                  fontFamily: "var(--font-sans)", fontSize: 11,
                  color: "var(--color-ink-light)",
                }}>
                  {activeStyle.shape} · {FINISH_LABELS[finish]}
                </p>
                {activeShadeId && (
                  <button
                    onClick={() => { setStyleOverride(null); setActiveShadeId(null); setFinish(product.finish); }}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontFamily: "var(--font-sans)", fontSize: 10,
                      color: "var(--color-pink)", fontWeight: 600, padding: 0,
                    }}
                  >Reset</button>
                )}
              </div>
            </div>

            {/* Price */}
            <p style={{
              fontFamily: "var(--font-sans)", fontSize: 15,
              fontWeight: 700, color: "var(--color-ink)", flexShrink: 0,
            }}>
              ${product.price}
            </p>

            {/* Capture icon button */}
            <button
              onClick={handleCapture}
              aria-label="Capture look"
              style={{
                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                backgroundColor: "#F5F5F5",
                border: "1px solid var(--color-border)",
                color: "var(--color-ink-mid)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <Camera size={16} />
            </button>

            {/* Upload icon button */}
            <button
              onClick={() => uploadInputRef.current?.click()}
              aria-label="Upload photo"
              style={{
                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                backgroundColor: "#F5F5F5",
                border: "1px solid var(--color-border)",
                color: "var(--color-ink-mid)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <Upload size={16} />
            </button>

            {/* Add to Bag — primary CTA */}
            <button
              onClick={handleAddToCart}
              style={{
                height: 44, paddingInline: 18, flexShrink: 0,
                backgroundColor: "var(--color-pink)",
                color: "#FFFFFF",
                fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700,
                letterSpacing: "0.01em",
                borderRadius: 10, border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                boxShadow: "0 4px 14px rgba(232,64,112,0.35)",
                transition: "background-color 0.15s, box-shadow 0.15s",
                position: "relative", overflow: "hidden",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-pink-hover)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 18px rgba(232,64,112,0.45)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-pink)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 14px rgba(232,64,112,0.35)";
              }}
            >
              <AnimatePresence mode="wait">
                {addedToCart ? (
                  <motion.span key="added"
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <CheckCircle size={14} /> Added
                  </motion.span>
                ) : (
                  <motion.span key="buy"
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <ShoppingBag size={14} /> Add to Bag
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </div>

      {/* ── Capture preview modal — white, clean ──────────────────────────── */}
      <AnimatePresence>
        {capturedImage && !show3DViewer && (
          <motion.div
            key="preview"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: "absolute", inset: 0, zIndex: 60,
              backgroundColor: "#FFFFFF",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              padding: 24,
            }}
          >
            <div style={{ width: "100%", maxWidth: 360 }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <p style={{
                    fontFamily: "var(--font-sans)", fontSize: 10,
                    color: "var(--color-pink)", fontWeight: 600,
                    textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 6,
                  }}>LUMIS Capture</p>
                  <h2 style={{
                    fontFamily: "var(--font-sans)", fontSize: 20,
                    fontWeight: 700,
                    color: "var(--color-ink)", lineHeight: 1.15,
                  }}>{product.name}</h2>
                  <p style={{
                    fontFamily: "var(--font-sans)", fontSize: 12,
                    color: "var(--color-ink-light)", marginTop: 4,
                  }}>{activeStyle.shape} · {FINISH_LABELS[finish]}</p>
                </div>
                <button
                  onClick={() => setCapturedImage(null)}
                  style={{
                    width: 32, height: 32, borderRadius: 4,
                    backgroundColor: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-ink-mid)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <X size={14} />
                </button>
              </div>

              {/* [F5-5] Before / After split view */}
              <div
                style={{
                  position: "relative", width: "100%", aspectRatio: "9/16",
                  borderRadius: 4, marginBottom: 16, overflow: "hidden",
                  border: "1px solid var(--color-border-light)",
                  cursor: splitDragging ? "col-resize" : "ew-resize",
                  userSelect: "none",
                }}
                onPointerDown={handleSplitPointerDown}
                onPointerMove={handleSplitPointerMove}
                onPointerUp={handleSplitPointerUp}
              >
                {/* After (full color) — full width base */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={capturedImage!}
                  alt="After"
                  draggable={false}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
                />
                {/* Before (greyscale) — clipped to left of split */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={capturedImage!}
                  alt="Before"
                  draggable={false}
                  style={{
                    position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
                    filter: "grayscale(1) brightness(1.04)",
                    clipPath: `inset(0 ${100 - splitPos}% 0 0)`,
                    pointerEvents: "none",
                  }}
                />
                {/* Divider line */}
                <div style={{
                  position: "absolute", top: 0, bottom: 0,
                  left: `calc(${splitPos}% - 1px)`, width: 2,
                  backgroundColor: "#FFFFFF",
                  boxShadow: "0 0 6px rgba(0,0,0,0.35)",
                  pointerEvents: "none",
                }}>
                  {/* Handle circle */}
                  <div style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 28, height: 28, borderRadius: "50%",
                    backgroundColor: "#FFFFFF",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.28)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 700,
                    color: "var(--color-ink)",
                    letterSpacing: "-0.5px",
                  }}>⇔</div>
                </div>
                {/* Labels */}
                <span style={{
                  position: "absolute", top: 10, left: 10,
                  fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 700,
                  letterSpacing: "0.10em", textTransform: "uppercase",
                  color: "#FFFFFF", backgroundColor: "rgba(0,0,0,0.45)",
                  padding: "3px 7px", borderRadius: 10,
                  pointerEvents: "none",
                }}>Before</span>
                <span style={{
                  position: "absolute", top: 10, right: 10,
                  fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 700,
                  letterSpacing: "0.10em", textTransform: "uppercase",
                  color: "#FFFFFF", backgroundColor: "rgba(232,64,112,0.70)",
                  padding: "3px 7px", borderRadius: 10,
                  pointerEvents: "none",
                }}>After</span>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  onClick={handleAddToCart}
                  style={{
                    height: 46,
                    backgroundColor: "var(--color-pink)",
                    border: "none", borderRadius: 4, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                    color: "#FFFFFF",
                  }}
                >
                  <CheckCircle size={13} />
                  Add to Bag
                </button>

                {/* 3D View — triggers depth-warp parallax viewer */}
                <button
                  onClick={handle3DOpen}
                  style={{
                    height: 46,
                    backgroundColor: "#FFFFFF",
                    border: "1px solid var(--color-border)",
                    borderRadius: 4, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500,
                    color: "var(--color-ink)",
                  }}
                >
                  <Layers size={13} />
                  View in 3D
                </button>

                <ShareButton
                  productId={product.id}
                  productName={product.name}
                  capturedImageDataUrl={capturedImage ?? undefined}
                  variant="full"
                />
                <button
                  onClick={handleDownload}
                  style={{
                    height: 46,
                    backgroundColor: "#FFFFFF",
                    border: "1px solid var(--color-border)",
                    borderRadius: 4, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500,
                    color: "var(--color-ink-mid)",
                  }}
                >
                  <Download size={13} />
                  Save PNG
                </button>
              </div>

              <button
                onClick={() => setCapturedImage(null)}
                style={{
                  width: "100%", marginTop: 10,
                  background: "none", border: "none", cursor: "pointer",
                  fontFamily: "var(--font-sans)", fontSize: 12,
                  color: "var(--color-ink-light)",
                  padding: "8px 0",
                }}
              >
                Continue trying on
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 3D Parallax Viewer ────────────────────────────────────────────── */}
      <AnimatePresence>
        {show3DViewer && (
          <motion.div
            key="3d-viewer"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: "absolute", inset: 0, zIndex: 70,
              backgroundColor: "#0A0907",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
            }}
            onPointerMove={handle3DPointerMove}
          >
            {/* Close button */}
            <button
              onClick={handle3DClose}
              aria-label="Close 3D view"
              style={{
                position: "absolute", top: 16, right: 16,
                width: 36, height: 36, borderRadius: 4,
                backgroundColor: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: "rgba(249,246,242,0.60)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", zIndex: 5,
              }}
            >
              <X size={14} />
            </button>

            {/* Header */}
            <div style={{
              position: "absolute", top: 16, left: 16,
              display: "flex", flexDirection: "column", gap: 2,
            }}>
              <p style={{
                fontFamily: "var(--font-mono)", fontSize: 8,
                color: "rgba(155,107,78,0.70)", textTransform: "uppercase",
                letterSpacing: "0.18em",
              }}>
                3D PARALLAX
              </p>
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 500,
                color: "rgba(249,246,242,0.55)",
              }}>
                {depthLoading ? "Analysing depth…" : depthError ? "Error" : "Move pointer to tilt"}
              </p>
            </div>

            {/* Loading state */}
            {depthLoading && (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
              }}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                >
                  <Loader size={24} style={{ color: "rgba(155,107,78,0.65)" }} />
                </motion.div>
                <p style={{
                  fontFamily: "var(--font-mono)", fontSize: 9,
                  color: "rgba(249,246,242,0.30)", letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}>
                  Loading depth model · ~400 ms
                </p>
              </div>
            )}

            {/* Error state */}
            {depthError && !depthLoading && (
              <div style={{
                maxWidth: 300, textAlign: "center", padding: "0 24px",
              }}>
                <p style={{
                  fontFamily: "var(--font-sans)", fontSize: 13,
                  color: "rgba(249,246,242,0.60)", lineHeight: 1.6,
                  marginBottom: 20,
                }}>
                  {depthError}
                </p>
                <button
                  onClick={handle3DClose}
                  style={{
                    padding: "8px 20px", borderRadius: 4,
                    border: "1px solid rgba(155,107,78,0.40)",
                    backgroundColor: "transparent",
                    fontFamily: "var(--font-sans)", fontSize: 12,
                    color: "rgba(155,107,78,0.80)",
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>
            )}

            {/* 3D canvas — shown once depth is ready */}
            {!depthLoading && !depthError && (
              <canvas
                ref={parallax3DRef}
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                  borderRadius: 4,
                }}
              />
            )}

            {/* Instruction overlay at bottom */}
            {!depthLoading && !depthError && (
              <div style={{
                position: "absolute", bottom: 24, left: 0, right: 0,
                display: "flex", justifyContent: "center",
                pointerEvents: "none",
              }}>
                <p style={{
                  fontFamily: "var(--font-mono)", fontSize: 8,
                  color: "rgba(249,246,242,0.22)", letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}>
                  Move pointer · gyro on mobile
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Suspense wrapper required because StudioPageInner calls useSearchParams(). */
export default function StudioPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <StudioPageInner params={params} />
    </Suspense>
  );
}
