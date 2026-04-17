import "@testing-library/jest-dom";

// ─── ImageData polyfill ───────────────────────────────────────────────────────
// jsdom does not implement the Canvas ImageData API.
// This polyfill satisfies depth-warp.ts and video-processor.ts in tests.
if (typeof globalThis.ImageData === "undefined") {
  class ImageDataPolyfill {
    readonly data: Uint8ClampedArray;
    readonly width: number;
    readonly height: number;

    constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
      if (typeof dataOrWidth === "number") {
        // ImageData(width, height)
        this.width  = dataOrWidth;
        this.height = widthOrHeight;
        this.data   = new Uint8ClampedArray(dataOrWidth * widthOrHeight * 4);
      } else {
        // ImageData(data, width, height?)
        this.data   = dataOrWidth;
        this.width  = widthOrHeight;
        this.height = height ?? dataOrWidth.length / widthOrHeight / 4;
      }
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ImageData = ImageDataPolyfill;
}

// jsdom doesn't implement Path2D — stub it so canvas drawing code doesn't throw
class Path2DStub {
  moveTo = vi.fn();
  lineTo = vi.fn();
  quadraticCurveTo = vi.fn();
  bezierCurveTo = vi.fn();
  closePath = vi.fn();
  arc = vi.fn();
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).Path2D = Path2DStub;

// Mock canvas context — jsdom doesn't implement canvas 2D rendering.
// Provides a complete stub covering nail-renderer, composition-engine, and export-canvas usage.
const mockCtx: Partial<CanvasRenderingContext2D> = {
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  clip: vi.fn(),
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  arc: vi.fn(),
  arcTo: vi.fn(),
  rect: vi.fn(),
  roundRect: vi.fn(),
  quadraticCurveTo: vi.fn(),
  bezierCurveTo: vi.fn(),
  drawImage: vi.fn(),
  fillText: vi.fn(),
  strokeText: vi.fn(),
  measureText: vi.fn(() => ({ width: 100 })) as unknown as CanvasRenderingContext2D["measureText"],
  createLinearGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })) as unknown as CanvasRenderingContext2D["createLinearGradient"],
  createRadialGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })) as unknown as CanvasRenderingContext2D["createRadialGradient"],
  createPattern: vi.fn(() => null) as unknown as CanvasRenderingContext2D["createPattern"],
  globalAlpha: 1,
  globalCompositeOperation: "source-over" as GlobalCompositeOperation,
  strokeStyle: "",
  fillStyle: "",
  lineWidth: 1,
  font: "",
  textAlign: "left" as CanvasTextAlign,
  textBaseline: "alphabetic" as CanvasTextBaseline,
  shadowBlur: 0,
  shadowColor: "",
  shadowOffsetX: 0,
  shadowOffsetY: 0,
};

HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx) as unknown as typeof HTMLCanvasElement.prototype.getContext;

// Mock localStorage with in-memory implementation.
// Implements length + key() so GDPR prefix-scan logic works in tests.
const store: Record<string, string> = {};
const localStorageMock = {
  get length() { return Object.keys(store).length; },
  key:       (i: number): string | null => Object.keys(store)[i] ?? null,
  getItem:    (key: string): string | null => store[key] ?? null,
  setItem:    (key: string, val: string): void => { store[key] = val; },
  removeItem: (key: string): void => { delete store[key]; },
  clear:      (): void => { Object.keys(store).forEach(k => delete store[k]); },
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

// Reset all mocks + localStorage between tests
beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
});
