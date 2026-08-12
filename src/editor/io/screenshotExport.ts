/**
 * PNG screenshot encoded as a browser Data URL.
 *
 * Format: `data:image/png;base64,<payload>`
 *
 * All viewport / camera capture outputs use this shape (not Blob, not raw base64 without the prefix).
 * Safe to assign to `<img src>` or persist as a string.
 */
export type ScreenshotDataUrl = string;

export interface ScreenshotMeta {
  mode: "director" | "camera";
  cameraId: string | null;
  fov: number;
  position: [number, number, number];
  target: [number, number, number];
}

export interface ScreenshotResult {
  label: string;
  /** PNG Data URL — see {@link ScreenshotDataUrl}. */
  dataUrl: ScreenshotDataUrl;
  meta: ScreenshotMeta;
}

export function buildScreenshotMeta(input: ScreenshotMeta) {
  return input;
}

export function buildCaptureFileName(result: ScreenshotResult, index = 0) {
  const labelSlug = result.label.replace(/\s+/g, "-");
  const cameraSuffix = result.meta.cameraId ? `-${result.meta.cameraId}` : "";
  return `monto-director-desk-${result.meta.mode}${cameraSuffix}-${labelSlug}-${index + 1}.png`;
}

export function downloadDataUrl(dataUrl: ScreenshotDataUrl, fileName: string) {
  // If we have a base64 Data URL, we can download directly.
  // If we have a remote URL (e.g. provided by host `uploadCaptures`), we must fetch it first,
  // otherwise some browsers will treat it as a normal navigation (current-tab open).
  const isDataUrl = typeof dataUrl === "string" && dataUrl.startsWith("data:image/");

  if (isDataUrl) {
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = fileName;
    anchor.rel = "noopener";
    anchor.click();
    return;
  }

  // Remote URL case: fetch -> blob -> download.
  // Note: If the upstream doesn't support CORS, fetch may fail; we keep a best-effort fallback.
  void (async () => {
    try {
      const res = await fetch(dataUrl);
      if (!res.ok) {
        throw new Error(`Failed to download: ${res.status}`);
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = fileName;
      anchor.rel = "noopener";
      anchor.click();

      URL.revokeObjectURL(blobUrl);
    } catch {
      // If fetching fails, we cannot safely force a download (the browser may navigate instead).
      // Intentionally do NOT click a remote URL href here to avoid opening "haitong" in the tab.
      // Consumers can handle error UI if needed.
    }
  })();
}

export function downloadCaptureResults(results: ScreenshotResult[]) {
  results.forEach((result, index) => {
    downloadDataUrl(result.dataUrl, buildCaptureFileName(result, index));
  });

  return results.length;
}
