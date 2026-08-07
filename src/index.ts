export { DirectorDesk, DIRECTOR_THEME_SKY_COLORS, DIRECTOR_DESK_ON_CHANGE_DEBOUNCE_MS } from "./DirectorDesk";
export type {
  DirectorDeskCapture,
  DirectorDeskMaterial,
  DirectorDeskProps,
  DirectorDeskTheme,
} from "./DirectorDesk";

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
