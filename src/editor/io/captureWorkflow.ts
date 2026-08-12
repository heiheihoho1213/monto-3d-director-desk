import type { ViewportCaptureRequest } from "./captureBridge";
import { requestViewportCapture } from "./captureBridge";
import { getCaptureLoadingController, getCaptureLoadingMessages } from "./captureLoadingContext";
import { getCaptureUploadHandler, resolveCaptureStorageUrls } from "./captureUpload";
import type { ScreenshotResult } from "./screenshotExport";

async function captureCore(request: ViewportCaptureRequest) {
  const loading = getCaptureLoadingController();
  const messages = getCaptureLoadingMessages(request.preset);
  const results = await requestViewportCapture(request);

  if (getCaptureUploadHandler() && results.length > 0) {
    loading?.update(messages.uploading);
  }

  const storageUrls = await resolveCaptureStorageUrls(results);
  return { results, storageUrls } satisfies {
    results: ScreenshotResult[];
    storageUrls: string[];
  };
}

export async function requestViewportCaptureWithStorage(
  request: ViewportCaptureRequest,
  options: { manageLoading?: boolean } = {}
) {
  const manageLoading = options.manageLoading ?? true;
  const loading = getCaptureLoadingController();
  const messages = getCaptureLoadingMessages(request.preset);

  if (manageLoading) {
    loading?.start(messages.capturing);
  }

  try {
    return await captureCore(request);
  } finally {
    if (manageLoading) {
      loading?.stop();
    }
  }
}

export async function withCaptureLoading<T>(
  preset: ViewportCaptureRequest["preset"],
  task: () => Promise<T>
) {
  const loading = getCaptureLoadingController();
  const messages = getCaptureLoadingMessages(preset);

  loading?.start(messages.capturing);

  try {
    return await task();
  } finally {
    loading?.stop();
  }
}
