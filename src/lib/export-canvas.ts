/**
 * LUMIS — Canvas Export Utilities
 *
 * Shared helpers for downloading and sharing canvas-generated images.
 * Used by NailShoot, NailBoard, NailTransform, and NailCard.
 */

/** Download a Blob as a named file via a temporary anchor. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Share a Blob via Web Share API Level 2 (files).
 * Falls back to downloadBlob on unsupported browsers.
 */
export async function shareBlob(
  blob: Blob,
  filename: string,
  title: string,
  text?: string,
): Promise<void> {
  const file = new File([blob], filename, { type: blob.type });
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    await navigator.share({ files: [file], title, text: text ?? title });
  } else {
    downloadBlob(blob, filename);
  }
}

/** Promise wrapper for HTMLCanvasElement.toBlob. */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = "image/jpeg",
  quality = 0.92,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("canvas.toBlob returned null"));
      },
      type,
      quality,
    );
  });
}
