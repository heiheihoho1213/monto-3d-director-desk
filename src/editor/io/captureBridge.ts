import type { CameraShotSnapshot } from "../store/directorStore";
import type { ScreenshotResult } from "./screenshotExport";

export type ViewportCapturePreset = "current" | "four" | "twelve";

export interface ViewportCaptureRequest {
  preset: ViewportCapturePreset;
  source: "capture-panel" | "camera-panel";
  cameraId?: string | null;
}

export type ViewportCaptureHandler = (request: ViewportCaptureRequest) => Promise<ScreenshotResult[]>;
export type ViewportCameraSnapshotProvider = () => CameraShotSnapshot;

let viewportCaptureHandler: ViewportCaptureHandler | null = null;
let viewportCameraSnapshotProvider: ViewportCameraSnapshotProvider | null = null;

export function setViewportCaptureHandler(handler: ViewportCaptureHandler) {
  viewportCaptureHandler = handler;
}

export function clearViewportCaptureHandler() {
  viewportCaptureHandler = null;
}

export function setViewportCameraSnapshotProvider(provider: ViewportCameraSnapshotProvider | null) {
  viewportCameraSnapshotProvider = provider;
}

export function getViewportCameraSnapshotProvider() {
  return viewportCameraSnapshotProvider;
}

export async function requestViewportCapture(request: ViewportCaptureRequest) {
  if (!viewportCaptureHandler) {
    throw new Error("Viewport capture handler is not registered");
  }

  return viewportCaptureHandler(request);
}
