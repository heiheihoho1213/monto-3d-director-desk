import { buildCaptureFileName, type ScreenshotResult } from "./screenshotExport";

/** Host batch uploader — receives PNG files, returns remote URLs in the same order. */
export type DirectorDeskUploadCaptures = (files: File[]) => Promise<string[]>;

let captureUploadHandler: DirectorDeskUploadCaptures | null = null;

export function setCaptureUploadHandler(handler: DirectorDeskUploadCaptures | null) {
  captureUploadHandler = handler;
}

export function getCaptureUploadHandler() {
  return captureUploadHandler;
}

export async function dataUrlToCaptureFile(dataUrl: string, fileName: string) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], fileName, { type: blob.type || "image/png" });
}

export async function resolveCaptureStorageUrls(
  results: ScreenshotResult[],
  uploadCaptures: DirectorDeskUploadCaptures | null | undefined = getCaptureUploadHandler()
) {
  if (results.length === 0) {
    return [] as string[];
  }

  if (!uploadCaptures) {
    return results.map((result) => result.dataUrl);
  }

  const files = await Promise.all(
    results.map((result, index) => dataUrlToCaptureFile(result.dataUrl, buildCaptureFileName(result, index)))
  );
  const urls = await uploadCaptures(files);

  if (!Array.isArray(urls) || urls.length !== files.length) {
    throw new Error("CAPTURE_UPLOAD_INVALID_URLS");
  }

  return urls.map((url, index) => {
    if (typeof url !== "string" || !url.trim()) {
      throw new Error("CAPTURE_UPLOAD_INVALID_URLS");
    }

    return url.trim();
  });
}
