import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Vitest configuration — SIT (System Integration Tests) for LUMIS Nail Studio.
 *
 * Test scope:
 *   - Unit tests for pure library functions (nail-renderer, smoothing, consent)
 *   - Integration tests for the rendering pipeline (geometry → canvas)
 *   - Data integrity tests for state management and GDPR data pruning
 *
 * Excluded from this runner:
 *   - E2E / UAT tests → Playwright (playwright.config.ts)
 *   - Visual regression → planned (Chromatic / Percy)
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["src/lib/**", "src/store/**"],
      exclude: ["src/lib/nail-segmentation.ts"], // requires TF.js, tested separately
      thresholds: {
        lines:     80,
        functions: 80,
        branches:  75,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // onnxruntime-web is not installed in the test environment (50 MB model).
      // Depth-warp tests that exercise ONNX inference use getDepthSession() mock.
      "onnxruntime-web": path.resolve(__dirname, "src/__tests__/__mocks__/onnxruntime-web.ts"),
      // @supabase/supabase-js is not installed in the test environment.
      // Modules that dynamically import supabase fall back to null gracefully.
      "@supabase/supabase-js": path.resolve(__dirname, "src/__tests__/__mocks__/supabase-js.ts"),
      "@supabase/auth-helpers-nextjs": path.resolve(__dirname, "src/__tests__/__mocks__/supabase-js.ts"),
    },
  },
});
