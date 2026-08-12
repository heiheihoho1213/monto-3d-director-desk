import { Loader2 } from "lucide-react";
import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ViewportCapturePreset } from "./captureBridge";
import { useT } from "../../i18n";

export type CaptureLoadingMessages = {
  capturing: string;
  uploading: string;
};

export type CaptureLoadingMessageFactory = (preset: ViewportCapturePreset) => CaptureLoadingMessages;

export type CaptureLoadingController = {
  start: (message: string) => void;
  update: (message: string) => void;
  stop: () => void;
};

let captureLoadingController: CaptureLoadingController | null = null;
let captureLoadingMessageFactory: CaptureLoadingMessageFactory | null = null;

export function setCaptureLoadingController(controller: CaptureLoadingController | null) {
  captureLoadingController = controller;
}

export function getCaptureLoadingController() {
  return captureLoadingController;
}

export function setCaptureLoadingMessageFactory(factory: CaptureLoadingMessageFactory | null) {
  captureLoadingMessageFactory = factory;
}

export function getCaptureLoadingMessages(preset: ViewportCapturePreset): CaptureLoadingMessages {
  return (
    captureLoadingMessageFactory?.(preset) ?? {
      capturing: "Capturing…",
      uploading: "Uploading captures…",
    }
  );
}

const CaptureLoadingContext = createContext<CaptureLoadingController | null>(null);

export function CaptureLoadingProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [portalRoot, setPortalRoot] = useState<HTMLElement>(() => document.body);
  const [state, setState] = useState<{ active: boolean; message: string }>({
    active: false,
    message: "",
  });

  useLayoutEffect(() => {
    const root = document.querySelector(".director-desk-root");
    if (root instanceof HTMLElement) {
      setPortalRoot(root);
    }
  }, []);

  useEffect(() => {
    setCaptureLoadingMessageFactory((preset) => ({
      capturing:
        preset === "current"
          ? t("toolbar.captureProcessing")
          : t("toolbar.captureProcessingBatch", { count: preset === "four" ? 4 : 12 }),
      uploading: t("toolbar.captureUploading"),
    }));

    return () => setCaptureLoadingMessageFactory(null);
  }, [t]);

  useEffect(() => {
    const controller: CaptureLoadingController = {
      start: (message) => setState({ active: true, message }),
      update: (message) => setState((current) => (current.active ? { active: true, message } : current)),
      stop: () => setState({ active: false, message: "" }),
    };

    setCaptureLoadingController(controller);
    return () => setCaptureLoadingController(null);
  }, []);

  const overlay =
    state.active
      ? createPortal(
          <div
            aria-busy="true"
            aria-label={state.message}
            className="model-import-loading-overlay desk-capture-loading-overlay"
            role="status"
          >
            <div className="model-import-loading-card">
              <Loader2 aria-hidden="true" className="model-import-spinner" size={22} strokeWidth={2} />
              <span className="model-import-loading-text">{state.message}</span>
            </div>
          </div>,
          portalRoot
        )
      : null;

  return (
    <CaptureLoadingContext.Provider value={captureLoadingController}>
      {children}
      {overlay}
    </CaptureLoadingContext.Provider>
  );
}

export function useCaptureLoading() {
  return useContext(CaptureLoadingContext);
}
