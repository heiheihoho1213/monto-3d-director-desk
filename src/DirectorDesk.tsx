import "./styles/index.css";
import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties, type ReactNode } from "react";
import { X } from "lucide-react";
import { DirectorDeskShell } from "./app/layout/DirectorDeskShell";
import { DirectorCanvas } from "./editor/canvas/DirectorCanvas";
import {
  clearDirectorDeskHostBridge,
  configureDirectorDeskHost,
  initDirectorDeskHostBridge,
} from "./editor/io/hostBridge";
import { createDirectorDeskHandle, type DirectorDeskHandle, type DirectorDeskImageDataUrl } from "./editor/io/directorDeskCaptureApi";
import type { DirectorProject } from "./editor/schema/directorProject";
import { useDirectorStore } from "./editor/store/directorStore";

export type {
  DirectorDeskCapturePreset,
  DirectorDeskCaptureRequestOptions,
  DirectorDeskHandle,
  DirectorDeskScreenshot,
  DirectorDeskImageDataUrl,
} from "./editor/io/directorDeskCaptureApi";

export type DirectorDeskTheme = "dark" | "light";

/** Default 3D sky colors paired with UI theme. */
export const DIRECTOR_THEME_SKY_COLORS: Record<DirectorDeskTheme, string> = {
  dark: "#000000",
  light: "#E8ECF1",
};

/** Debounce for host `onChange` so rapid edits do not flood persistence. */
export const DIRECTOR_DESK_ON_CHANGE_DEBOUNCE_MS = 300;

/**
 * PNG screenshot payload emitted by `onCapturesSent` and `sendCaptures`.
 *
 * `dataUrl` is always a PNG Data URL: `data:image/png;base64,...`
 */
export interface DirectorDeskCapture {
  /** PNG Data URL — see {@link DirectorDeskImageDataUrl}. */
  dataUrl: DirectorDeskImageDataUrl;
  /** Suggested download / upload file name (typically ends with `.png`). */
  fileName: string;
}

/** Host-provided scene material. Currently only panorama is supported. */
export type DirectorDeskMaterial = {
  kind: "panorama";
  url: string;
  fileName?: string;
  name?: string;
};

export interface DirectorDeskProps {
  className?: string;
  style?: CSSProperties;
  /** Top-bar title; accepts a string or custom React nodes (e.g. host back button + label). */
  title?: ReactNode;
  theme?: DirectorDeskTheme;
  /** Isolate localStorage scene persistence when embedding multiple desks. */
  instanceId?: string | null;
  /**
   * Seed the desk with an external project snapshot.
   * Takes priority over localStorage for the current `instanceId` (skips restore when present).
   * Applied once per `instanceId` when first available (including async load).
   * Later in-session edits are owned by the component until the next scope change.
   */
  initial?: DirectorProject | null;
  /** Externally provided panorama (locks the in-app「导入全景图」control). */
  material?: DirectorDeskMaterial | null;
  showCloseButton?: boolean;
  /** Listen for host iframe `postMessage` host protocol. Default: false for component use. */
  enableHostBridge?: boolean;
  /** Also mirror ready/close/captures events via iframe postMessage. Default: same as enableHostBridge. */
  enablePostMessage?: boolean;
  onReady?: () => void;
  onClose?: () => void;
  /** Fired when captures are sent to the host. Each `dataUrl` is a PNG base64 Data URL. */
  onCapturesSent?: (captures: DirectorDeskCapture[]) => void;
  /** Fired (debounced) when the editable project content changes. */
  onChange?: (project: DirectorProject) => void;
}

function cloneProject(project: DirectorProject): DirectorProject {
  return JSON.parse(JSON.stringify(project)) as DirectorProject;
}

function serializeProjectSnapshot(project: DirectorProject) {
  return JSON.stringify(project);
}

function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export const DirectorDesk = forwardRef<DirectorDeskHandle, DirectorDeskProps>(function DirectorDesk(
  {
    className,
    style,
    title = "3D导演台",
    theme = "dark",
    instanceId = null,
    initial = null,
    material = null,
    showCloseButton = true,
    enableHostBridge = false,
    enablePostMessage,
    onReady,
    onClose,
    onCapturesSent,
    onChange,
  },
  ref
) {
  const viewMode = useDirectorStore((state) => state.viewMode);
  const setViewMode = useDirectorStore((state) => state.setViewMode);
  const shouldPostMessage = enablePostMessage ?? enableHostBridge;

  const initialRef = useRef(initial);
  initialRef.current = initial;
  const onReadyRef = useRef(onReady);
  const onCloseRef = useRef(onClose);
  const onCapturesSentRef = useRef(onCapturesSent);
  const onChangeRef = useRef(onChange);
  const appliedExternalPanoramaRef = useRef(false);
  const appliedInitialScopeRef = useRef<string | null>(null);
  const suppressChangeRef = useRef(false);
  onReadyRef.current = onReady;
  onCloseRef.current = onClose;
  onCapturesSentRef.current = onCapturesSent;
  onChangeRef.current = onChange;

  useImperativeHandle(ref, () => createDirectorDeskHandle(), []);

  useEffect(() => {
    configureDirectorDeskHost({
      enablePostMessage: shouldPostMessage,
      onCapturesSent: (captures) => onCapturesSentRef.current?.(captures),
      applyThemeToDocument: enableHostBridge,
    });

    if (enableHostBridge) {
      initDirectorDeskHostBridge();
    } else {
      clearDirectorDeskHostBridge();
    }

    onReadyRef.current?.();
    if (shouldPostMessage) {
      window.parent?.postMessage({ type: "monto:director-desk-ready" }, window.location.origin);
    }

    return () => {
      configureDirectorDeskHost({
        enablePostMessage: false,
        onCapturesSent: null,
        applyThemeToDocument: false,
      });
      if (enableHostBridge) {
        clearDirectorDeskHostBridge();
      }
    };
  }, [enableHostBridge, instanceId, shouldPostMessage]);

  useEffect(() => {
    if (enableHostBridge) return undefined;

    appliedInitialScopeRef.current = null;
    suppressChangeRef.current = true;

    // Prefer `initial` over localStorage when the host already seeded the project.
    const seed = initialRef.current;
    const hasInitial = Boolean(seed);
    useDirectorStore.getState().openScopedScene(instanceId, {
      includePersistedScene: !hasInitial,
    });

    if (seed) {
      useDirectorStore.getState().replaceProject(cloneProject(seed));
      appliedInitialScopeRef.current = instanceId ?? "";
    }

    const release = window.setTimeout(() => {
      suppressChangeRef.current = false;
    }, 0);

    return () => {
      window.clearTimeout(release);
    };
  }, [enableHostBridge, instanceId]);

  useEffect(() => {
    if (!initial) return undefined;

    const scopeKey = instanceId ?? "";
    if (appliedInitialScopeRef.current === scopeKey) return undefined;

    suppressChangeRef.current = true;
    useDirectorStore.getState().replaceProject(cloneProject(initial));
    appliedInitialScopeRef.current = scopeKey;

    const release = window.setTimeout(() => {
      suppressChangeRef.current = false;
    }, 0);

    return () => {
      window.clearTimeout(release);
    };
  }, [initial, instanceId]);

  useEffect(() => {
    suppressChangeRef.current = true;
    useDirectorStore.getState().updateScene({ backgroundColor: DIRECTOR_THEME_SKY_COLORS[theme] }, { trackUndo: false });
    const release = window.setTimeout(() => {
      suppressChangeRef.current = false;
    }, 0);
    return () => {
      window.clearTimeout(release);
    };
  }, [theme]);

  useEffect(() => {
    if (!onChange) return undefined;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastSerialized = serializeProjectSnapshot(useDirectorStore.getState().project);

    const unsubscribe = useDirectorStore.subscribe((state) => {
      const nextSerialized = serializeProjectSnapshot(state.project);
      if (nextSerialized === lastSerialized) return;
      lastSerialized = nextSerialized;

      if (suppressChangeRef.current || !onChangeRef.current) return;

      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        onChangeRef.current?.(cloneProject(useDirectorStore.getState().project));
      }, DIRECTOR_DESK_ON_CHANGE_DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (timer) window.clearTimeout(timer);
    };
  }, [instanceId, onChange]);

  useEffect(() => {
    const panoramaUrl = material?.kind === "panorama" ? material.url.trim() : "";
    const locked = Boolean(panoramaUrl);
    useDirectorStore.getState().setPanoramaImportLocked(locked);

    if (!locked || material?.kind !== "panorama") {
      if (appliedExternalPanoramaRef.current) {
        suppressChangeRef.current = true;
        useDirectorStore.getState().removePanoramaAsset();
        appliedExternalPanoramaRef.current = false;
        const release = window.setTimeout(() => {
          suppressChangeRef.current = false;
        }, 0);
        return () => {
          window.clearTimeout(release);
          useDirectorStore.getState().setPanoramaImportLocked(false);
        };
      }
      return () => {
        useDirectorStore.getState().setPanoramaImportLocked(false);
      };
    }

    const currentPanorama = useDirectorStore
      .getState()
      .project.assets.find((asset) => asset.id === useDirectorStore.getState().project.panoramaAssetId);
    if (currentPanorama?.url !== panoramaUrl) {
      const fileName = material.fileName?.trim() || "外部全景图";
      suppressChangeRef.current = true;
      useDirectorStore.getState().addImportedAsset({
        kind: "panorama",
        name: material.name?.trim() || fileName,
        fileName,
        url: panoramaUrl,
        projectionMode: "equirectangular",
      });
      const release = window.setTimeout(() => {
        suppressChangeRef.current = false;
      }, 0);
      appliedExternalPanoramaRef.current = true;
      return () => {
        window.clearTimeout(release);
        useDirectorStore.getState().setPanoramaImportLocked(false);
        if (appliedExternalPanoramaRef.current) {
          useDirectorStore.getState().removePanoramaAsset();
          appliedExternalPanoramaRef.current = false;
        }
      };
    }
    appliedExternalPanoramaRef.current = true;

    return () => {
      useDirectorStore.getState().setPanoramaImportLocked(false);
      if (appliedExternalPanoramaRef.current) {
        useDirectorStore.getState().removePanoramaAsset();
        appliedExternalPanoramaRef.current = false;
      }
    };
  }, [instanceId, material]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || isEditableShortcutTarget(event.target)) return;
      if (!event.metaKey && !event.ctrlKey) return;

      const key = event.key.toLowerCase();
      if (key === "c") {
        event.preventDefault();
        useDirectorStore.getState().copySelectedObjects();
        return;
      }

      if (key === "v") {
        event.preventDefault();
        useDirectorStore.getState().pasteClipboardObjects();
        return;
      }

      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        useDirectorStore.getState().undo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function handleClose() {
    onCloseRef.current?.();
    if (shouldPostMessage) {
      window.parent?.postMessage({ type: "monto:director-desk-close" }, window.location.origin);
    }
  }

  const rootClassName = ["director-desk-root", "app-shell", className].filter(Boolean).join(" ");

  return (
    <div className={rootClassName} data-theme={theme} style={style}>
      <header className="top-bar">
        <div className="top-bar-left">
          <div className="top-bar-title">{title}</div>
        </div>
        <div className="top-bar-center">
          <div className="mode-toggle ui-segmented" role="group" aria-label="视角切换">
            <button
              className={`mode-toggle-button ui-segmented-item ${viewMode === "director" ? "ui-segmented-item-active" : ""}`}
              aria-pressed={viewMode === "director"}
              type="button"
              onClick={() => setViewMode("director")}
            >
              导演视角
            </button>
            <button
              className={`mode-toggle-button ui-segmented-item ${viewMode === "camera" ? "ui-segmented-item-active" : ""}`}
              aria-pressed={viewMode === "camera"}
              type="button"
              onClick={() => setViewMode("camera")}
            >
              机位视角
            </button>
          </div>
        </div>
        <div className="top-bar-actions">
          {showCloseButton ? (
            <button
              className="top-bar-action-button"
              type="button"
              aria-label="关闭"
              title="关闭"
              onClick={handleClose}
            >
              <X aria-hidden="true" size={16} strokeWidth={1.8} />
            </button>
          ) : null}
        </div>
      </header>
      <DirectorDeskShell>
        <DirectorCanvas />
      </DirectorDeskShell>
    </div>
  );
});
