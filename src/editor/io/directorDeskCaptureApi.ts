import type { CameraShotSnapshot } from "../store/directorStore";
import { getViewportCameraSnapshotProvider, type ViewportCapturePreset } from "./captureBridge";
import { requestViewportCaptureWithStorage, withCaptureLoading } from "./captureWorkflow";
import { postDirectorDeskCapturesToHost } from "./hostBridge";
import { buildCaptureFileName, type ScreenshotDataUrl, type ScreenshotMeta, type ScreenshotResult } from "./screenshotExport";
import { useDirectorStore } from "../store/directorStore";

export type { ViewportCapturePreset as DirectorDeskCapturePreset };

/** Re-export for package consumers — PNG Data URL (`data:image/png;base64,...`). */
export type DirectorDeskImageDataUrl = ScreenshotDataUrl;

/** Single screenshot returned by ref / imperative capture APIs. */
export interface DirectorDeskScreenshot {
  label: string;
  /** PNG Data URL — see {@link DirectorDeskImageDataUrl}. */
  dataUrl: DirectorDeskImageDataUrl;
  /** Suggested file name (typically ends with `.png`). */
  fileName: string;
  meta: ScreenshotMeta;
}

export interface DirectorDeskCaptureRequestOptions {
  /** Associate capture metadata with a camera. Defaults to active camera in camera mode. */
  cameraId?: string | null;
  /** Append PNG base64 Data URLs to the camera capture gallery in project state, will trigger onChange event. */
  saveToProject?: boolean;
  /** Invoke onCapturesSent / postMessage after capture, will trigger onCapturesSent event. */
  sendToHost?: boolean;
}

function waitForNextAnimationFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

export function mapScreenshotResults(results: ScreenshotResult[]): DirectorDeskScreenshot[] {
  return results.map((result, index) => ({
    label: result.label,
    dataUrl: result.dataUrl,
    fileName: buildCaptureFileName(result, index),
    meta: result.meta,
  }));
}

async function runViewportCapture(
  preset: ViewportCapturePreset,
  source: "capture-panel" | "camera-panel",
  options: DirectorDeskCaptureRequestOptions = {},
  captureOptions: { manageLoading?: boolean } = {}
): Promise<DirectorDeskScreenshot[]> {
  const state = useDirectorStore.getState();
  const cameraId = options.cameraId ?? (state.viewMode === "camera" ? state.project.activeCameraId : null);

  const { results, storageUrls } = await requestViewportCaptureWithStorage(
    {
      preset,
      source,
      cameraId,
    },
    { manageLoading: captureOptions.manageLoading ?? true }
  );
  const screenshots = results.map((result, index) => ({
    label: result.label,
    dataUrl: storageUrls[index] ?? result.dataUrl,
    fileName: buildCaptureFileName(result, index),
    meta: result.meta,
  }));

  if (options.saveToProject && cameraId) {
    state.addCameraCaptures(
      cameraId,
      screenshots.map((item) => item.dataUrl)
    );
  }

  if (options.sendToHost) {
    postDirectorDeskCapturesToHost(
      screenshots.map((item) => ({
        dataUrl: item.dataUrl,
        fileName: item.fileName,
      }))
    );
  }

  return screenshots;
}

/** Capture the current viewport once (CapturePanel / 纯截图，不切机位). */
export function captureCurrentView(options?: DirectorDeskCaptureRequestOptions) {
  return runViewportCapture("current", "capture-panel", options);
}

/** Capture four orbital directions around the scene target. */
export function captureFourDirections(options?: DirectorDeskCaptureRequestOptions) {
  return runViewportCapture("four", "capture-panel", options);
}

/** Capture twelve orbital directions around the scene target. */
export function captureTwelveDirections(options?: DirectorDeskCaptureRequestOptions) {
  return runViewportCapture("twelve", "capture-panel", options);
}

/**
 * Capture from a camera rig (CameraPanel「当前机位截图」).
 * Uses the active camera when `cameraId` is omitted.
 */
export function captureCameraShot(cameraId?: string | null, options: DirectorDeskCaptureRequestOptions = {}) {
  const resolvedCameraId = cameraId ?? useDirectorStore.getState().project.activeCameraId;
  if (!resolvedCameraId) {
    throw new Error("No active camera is available for capture");
  }

  return runViewportCapture("current", "camera-panel", {
    ...options,
    cameraId: resolvedCameraId,
  });
}

/**
 * Match ViewportToolbar「当前视角截图 / 四方位 / 十二方位」:
 * create/use a camera shot, switch to camera mode, capture, and save to project.
 */
export async function captureFromViewportToolbar(
  preset: ViewportCapturePreset,
  getViewportCameraSnapshot: () => CameraShotSnapshot,
  options: Omit<DirectorDeskCaptureRequestOptions, "saveToProject"> = {}
): Promise<DirectorDeskScreenshot[]> {
  const state = useDirectorStore.getState();
  const targetCameraId =
    state.viewMode === "director" ? state.addCameraShot(getViewportCameraSnapshot()) : state.project.activeCameraId;

  if (!targetCameraId) {
    throw new Error("Unable to resolve a camera for viewport toolbar capture");
  }

  return withCaptureLoading(preset, async () => {
    state.setViewMode("camera");
    await waitForNextAnimationFrame();

    return runViewportCapture(
      preset,
      "camera-panel",
      {
        ...options,
        cameraId: targetCameraId,
        saveToProject: true,
      },
      { manageLoading: false }
    );
  });
}

export function sendDirectorDeskCaptures(
  captures: Array<{ dataUrl: DirectorDeskImageDataUrl; fileName?: string }>
) {
  postDirectorDeskCapturesToHost(captures);
}

export interface DirectorDeskHandle {
  /** 当前视角截图（纯视口）。Returns PNG base64 Data URLs. */
  captureCurrentView: (options?: DirectorDeskCaptureRequestOptions) => Promise<DirectorDeskScreenshot[]>;
  /** 四方位截图。Returns PNG base64 Data URLs. */
  captureFourDirections: (options?: DirectorDeskCaptureRequestOptions) => Promise<DirectorDeskScreenshot[]>;
  /** 十二方位截图。Returns PNG base64 Data URLs. */
  captureTwelveDirections: (options?: DirectorDeskCaptureRequestOptions) => Promise<DirectorDeskScreenshot[]>;
  /** 当前机位截图（等同 CameraPanel）。Returns PNG base64 Data URLs. */
  captureCameraShot: (
    cameraId?: string | null,
    options?: DirectorDeskCaptureRequestOptions
  ) => Promise<DirectorDeskScreenshot[]>;
  /**
   * 视口工具栏截图（等同底部工具栏相机按钮）：
   * 必要时新建机位、切到机位视角、截图并写入工程。
   * Returns PNG base64 Data URLs.
   */
  captureFromToolbar: (
    preset: ViewportCapturePreset,
    options?: Omit<DirectorDeskCaptureRequestOptions, "saveToProject">
  ) => Promise<DirectorDeskScreenshot[]>;
  /** 发送到宿主（触发 onCapturesSent / postMessage）。`dataUrl` must be PNG base64 Data URLs. */
  sendCaptures: (captures: Array<{ dataUrl: DirectorDeskImageDataUrl; fileName?: string }>) => void;
}

export function createDirectorDeskHandle(): DirectorDeskHandle {
  return {
    captureCurrentView,
    captureFourDirections,
    captureTwelveDirections,
    captureCameraShot,
    captureFromToolbar: (preset, options) => {
      const provider = getViewportCameraSnapshotProvider();
      if (!provider) {
        throw new Error("Director desk viewport is not ready for toolbar capture");
      }
      return captureFromViewportToolbar(preset, provider, options);
    },
    sendCaptures: sendDirectorDeskCaptures,
  };
}
