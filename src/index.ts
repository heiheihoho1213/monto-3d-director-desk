export { DirectorDesk, DIRECTOR_THEME_SKY_COLORS, DIRECTOR_DESK_ON_CHANGE_DEBOUNCE_MS } from "./DirectorDesk";
export type {
  DirectorDeskCapture,
  DirectorDeskMaterial,
  DirectorDeskProps,
  DirectorDeskTheme,
  DirectorDeskCapturePreset,
  DirectorDeskCaptureRequestOptions,
  DirectorDeskHandle,
  DirectorDeskScreenshot,
  DirectorDeskImageDataUrl,
  DirectorDeskUploadModel,
  DirectorDeskLang,
} from "./DirectorDesk";

export { DIRECTOR_DESK_LANGS } from "./DirectorDesk";

export {
  captureCurrentView,
  captureFourDirections,
  captureTwelveDirections,
  captureCameraShot,
  captureFromViewportToolbar,
  sendDirectorDeskCaptures,
  mapScreenshotResults,
} from "./editor/io/directorDeskCaptureApi";

export { requestViewportCapture } from "./editor/io/captureBridge";
export type { ViewportCapturePreset, ViewportCaptureRequest } from "./editor/io/captureBridge";

export { buildCaptureFileName, downloadCaptureResults } from "./editor/io/screenshotExport";
export type { ScreenshotDataUrl, ScreenshotMeta, ScreenshotResult } from "./editor/io/screenshotExport";

export type {
  DirectorProject,
  DirectorAssetRef,
  DirectorObject,
  DirectorCameraShot,
  SceneSettings,
} from "./editor/schema/directorProject";

export { useDirectorStore, createInitialDirectorState, createDefaultDirectorProject } from "./editor/store/directorStore";
export type {
  DirectorStore,
  DirectorState,
  DirectorActions,
  ImportedAssetInput,
} from "./editor/store/directorStore";

export {
  initDirectorDeskHostBridge,
  clearDirectorDeskHostBridge,
  configureDirectorDeskHost,
  postDirectorDeskCapturesToHost,
} from "./editor/io/hostBridge";

export { serializeProject } from "./editor/io/exportProjectJson";
export { parseProject } from "./editor/io/importProjectJson";
