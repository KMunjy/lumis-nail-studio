/**
 * Vitest stub for onnxruntime-web.
 *
 * onnxruntime-web is a 50 MB package not installed in the test environment.
 * This stub satisfies Vite's static import resolution so depth-warp.ts can
 * be imported in tests. The actual ONNX session is mocked at the test level
 * via _resetSession() + vi.mock().
 */

export const env = {
  wasm: { wasmPaths: "" },
};

export class Tensor {
  constructor(
    public type: string,
    public data: Float32Array,
    public dims: number[],
  ) {}
}

export class InferenceSession {
  static async create(_path: string, _opts?: unknown): Promise<InferenceSession> {
    throw new Error(
      "[onnxruntime-web mock] InferenceSession.create() called in test environment. " +
      "Mock getDepthSession() via vi.mock('@/lib/depth-warp') instead.",
    );
  }

  async run(_feeds: Record<string, unknown>): Promise<Record<string, { data: Float32Array }>> {
    throw new Error("[onnxruntime-web mock] run() not available in tests.");
  }

  get inputNames(): string[] { return ["input"]; }
}
