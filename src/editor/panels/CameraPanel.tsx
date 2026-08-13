import { Camera, Download, Eye, Images, Send, Trash2, X, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "../../i18n";
import {
  InspectorAxisGroup,
  InspectorPanel,
  InspectorRangeNumberField,
  InspectorSection,
  InspectorSelectField,
  InspectorTextField,
} from "./InspectorControls";
import { requestViewportCapture } from "../io/captureBridge";
import { requestViewportCaptureWithStorage } from "../io/captureWorkflow";
import { downloadDataUrl } from "../io/screenshotExport";
import { postDirectorDeskCapturesToHost } from "../io/hostBridge";
import { getDirectorObjectFocusTarget, isCameraFocusableObject } from "../schema/cameraTarget";
import type { DirectorCameraCapture } from "../schema/directorProject";
import { useDirectorStore } from "../store/directorStore";

const VIEWER_ZOOM_MIN = 0.25;
const VIEWER_ZOOM_MAX = 5;
const VIEWER_ZOOM_STEP = 0.25;

function replaceAxis(tuple: [number, number, number], axis: 0 | 1 | 2, value: number): [number, number, number] {
  return tuple.map((item, index) => (index === axis ? value : item)) as [number, number, number];
}

export function CameraPanel() {
  const t = useT();
  const [activeTab, setActiveTab] = useState<"properties" | "captures">("properties");
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [hoveredCaptureId, setHoveredCaptureId] = useState<string | null>(null);
  const [viewerCapture, setViewerCapture] = useState<DirectorCameraCapture | null>(null);
  const [viewerPortalRoot, setViewerPortalRoot] = useState<HTMLElement | null>(null);
  const [viewerScale, setViewerScale] = useState(1);
  const [viewerOffset, setViewerOffset] = useState({ x: 0, y: 0 });
  const [viewerDragging, setViewerDragging] = useState(false);
  const viewerDragStateRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const camera = useDirectorStore((state) =>
    state.project.cameras.find((item) => item.id === state.project.activeCameraId)
  );
  const cameras = useDirectorStore((state) => state.project.cameras);
  const objects = useDirectorStore((state) => state.project.objects);
  const setActiveCamera = useDirectorStore((state) => state.setActiveCamera);
  const addCameraCaptures = useDirectorStore((state) => state.addCameraCaptures);
  const updateCamera = useDirectorStore((state) => state.updateCamera);
  const deleteSelectedObject = useDirectorStore((state) => state.deleteSelectedObject);

  const linkedCameraObjectId = useMemo(() => {
    if (!camera) return null;
    return objects.find((item) => item.kind === "camera" && item.linkedCameraId === camera.id)?.id ?? null;
  }, [camera, objects]);
  const canDeleteCamera = cameras.length > 1;

  if (!camera) return null;
  const currentCamera = camera;
  const captures = useMemo(() => currentCamera.captures ?? [], [currentCamera.captures]);
  const cameraCaptureGroups = useMemo(
    () =>
      cameras.map((item) => ({
        camera: item,
        captures: item.captures ?? [],
      })),
    [cameras]
  );
  const hasAnyCameraCapture = cameraCaptureGroups.some((group) => group.captures.length > 0);
  const focusableObjects = useMemo(() => objects.filter(isCameraFocusableObject), [objects]);
  const targetSelectValue =
    currentCamera.targetMode === "object" && currentCamera.targetObjectId
      ? `object:${currentCamera.targetObjectId}`
      : "manual";

  useEffect(() => {
    if (!viewerCapture) {
      setViewerScale(1);
      setViewerOffset({ x: 0, y: 0 });
      setViewerDragging(false);
      viewerDragStateRef.current = null;
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setViewerCapture(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewerCapture]);

  useLayoutEffect(() => {
    const root = document.querySelector(".director-desk-root");
    setViewerPortalRoot(root instanceof HTMLElement ? root : document.body);
  }, []);

  useEffect(() => {
    if (viewerScale <= 1) {
      setViewerOffset({ x: 0, y: 0 });
      setViewerDragging(false);
      viewerDragStateRef.current = null;
    }
  }, [viewerScale]);

  useEffect(() => {
    if (!viewerDragging) {
      return;
    }

    function handleMouseMove(event: MouseEvent) {
      const dragState = viewerDragStateRef.current;
      if (!dragState) {
        return;
      }

      setViewerOffset({
        x: dragState.originX + event.clientX - dragState.startX,
        y: dragState.originY + event.clientY - dragState.startY,
      });
    }

    function handleMouseUp() {
      setViewerDragging(false);
      viewerDragStateRef.current = null;
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [viewerDragging]);

  const clampViewerScale = useCallback((value: number) => {
    return Math.min(VIEWER_ZOOM_MAX, Math.max(VIEWER_ZOOM_MIN, value));
  }, []);

  const updateViewerScale = useCallback((updater: (currentScale: number) => number) => {
    setViewerScale((currentScale) => clampViewerScale(Number(updater(currentScale).toFixed(2))));
  }, [clampViewerScale]);

  const sendCaptureToCanvas = useCallback((capture: DirectorCameraCapture) => {
    postDirectorDeskCapturesToHost([
      {
        dataUrl: capture.dataUrl,
        fileName: `${capture.name}.png`,
      },
    ]);
  }, []);

  const sendAllCapturesToCanvas = useCallback(() => {
    postDirectorDeskCapturesToHost(
      cameraCaptureGroups.flatMap((group) =>
        group.captures.map((capture) => ({
          dataUrl: capture.dataUrl,
          fileName: `${capture.name}.png`,
        }))
      )
    );
  }, [cameraCaptureGroups]);

  async function handleCameraCapture() {
    try {
      setCaptureError(null);
      const { storageUrls } = await requestViewportCaptureWithStorage({
        preset: "current",
        source: "camera-panel",
        cameraId: currentCamera.id,
      });
      if (storageUrls.length > 0) {
        addCameraCaptures(currentCamera.id, storageUrls);
      }
    } catch (error) {
      if (error instanceof Error && error.message === "CAPTURE_UPLOAD_INVALID_URLS") {
        setCaptureError(t("errors.captureUploadInvalidUrls"));
        return;
      }

      setCaptureError(error instanceof Error ? error.message : t("camera.captureFailed"));
    }
  }

  function handleDeleteCapture(captureId: string) {
    const captureCamera = cameras.find((item) => (item.captures ?? []).some((capture) => capture.id === captureId));
    if (!captureCamera) return;

    const nextCaptures = (captureCamera.captures ?? []).filter((item) => item.id !== captureId);
    updateCamera(captureCamera.id, {
      captures: nextCaptures,
      lastCaptureUrl: nextCaptures[nextCaptures.length - 1]?.dataUrl ?? null,
    });
    setHoveredCaptureId((current) => (current === captureId ? null : current));
    setViewerCapture((current) => (current?.id === captureId ? null : current));
  }

  function handleClearAllCaptures() {
    cameras.forEach((item) => {
      if ((item.captures ?? []).length === 0 && !item.lastCaptureUrl) return;

      updateCamera(item.id, {
        captures: [],
        lastCaptureUrl: null,
      });
    });
    setHoveredCaptureId(null);
    setViewerCapture(null);
  }

  function handleViewerZoom(direction: "in" | "out") {
    updateViewerScale((current) => current + (direction === "in" ? VIEWER_ZOOM_STEP : -VIEWER_ZOOM_STEP));
  }

  function handleViewerWheel(event: React.WheelEvent<HTMLImageElement>) {
    event.preventDefault();
    event.stopPropagation();
    updateViewerScale((current) => current + (event.deltaY < 0 ? VIEWER_ZOOM_STEP : -VIEWER_ZOOM_STEP));
  }

  function handleViewerMouseDown(event: React.MouseEvent<HTMLImageElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (viewerScale <= 1) {
      return;
    }

    viewerDragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: viewerOffset.x,
      originY: viewerOffset.y,
    };
    setViewerDragging(true);
  }

  function closeViewer() {
    setViewerCapture(null);
  }

  function handleDeleteCamera() {
    if (!canDeleteCamera || !linkedCameraObjectId) return;

    const state = useDirectorStore.getState();
    if (state.selectedObjectId !== linkedCameraObjectId) {
      useDirectorStore.setState({
        ...state,
        selectedObjectId: linkedCameraObjectId,
        selectedObjectIds: [linkedCameraObjectId],
        selectedCrowdId: null,
      });
    }

    deleteSelectedObject();
  }

  function handleTargetSelection(value: string) {
    if (value === "manual") {
      updateCamera(currentCamera.id, {
        targetMode: "manual",
        targetObjectId: null,
      });
      return;
    }

    const objectId = value.replace(/^object:/, "");
    const targetObject = focusableObjects.find((item) => item.id === objectId);

    if (!targetObject) {
      updateCamera(currentCamera.id, {
        targetMode: "manual",
        targetObjectId: null,
      });
      return;
    }

    updateCamera(currentCamera.id, {
      targetMode: "object",
      targetObjectId: targetObject.id,
      target: getDirectorObjectFocusTarget(targetObject),
    });
  }

  function updateManualTarget(axis: 0 | 1 | 2, value: string) {
    updateCamera(currentCamera.id, {
      targetMode: "manual",
      targetObjectId: null,
      target: replaceAxis(currentCamera.target, axis, Number(value)),
    });
  }

  function renderCaptureCards(captureList: DirectorCameraCapture[]) {
    return (
      <div className="camera-capture-grid" aria-label={t("camera.captureList")}>
        {captureList.map((capture) => {
          const captureActive = hoveredCaptureId === capture.id;

          return (
            <div key={capture.id} className="camera-capture-card">
              <div
                className="camera-capture-thumb-wrap"
                onClick={() => setViewerCapture(capture)}
                onMouseEnter={() => setHoveredCaptureId(capture.id)}
                onMouseLeave={() => setHoveredCaptureId((current) => (current === capture.id ? null : current))}
              >
                <img
                  className="camera-capture-thumb"
                  alt={t("camera.thumbAlt", { name: capture.name })}
                  src={capture.dataUrl}
                />
                <div
                  aria-label={t("camera.thumbActions", { name: capture.name })}
                  className={`camera-capture-actions${captureActive ? " is-visible" : ""}`}
                  role="group"
                >
                  <button
                    aria-label={t("camera.deleteCapture", { name: capture.name })}
                    className="camera-capture-action"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteCapture(capture.id);
                    }}
                  >
                    <Trash2 aria-hidden="true" size={14} strokeWidth={1.9} />
                  </button>
                  <button
                    aria-label={t("camera.sendOne", { name: capture.name })}
                    className="camera-capture-action"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      sendCaptureToCanvas(capture);
                    }}
                  >
                    <Send aria-hidden="true" size={14} strokeWidth={1.9} />
                  </button>
                  <button
                    aria-label={t("camera.viewCapture", { name: capture.name })}
                    className="camera-capture-action"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setViewerCapture(capture);
                    }}
                  >
                    <Eye aria-hidden="true" size={14} strokeWidth={1.9} />
                  </button>
                </div>
              </div>
              <span className="camera-capture-name">{capture.name}</span>
            </div>
          );
        })}
      </div>
    );
  }

  function renderCurrentCameraCaptureGrid() {
    if (captures.length === 0) {
      return <div className="capture-list-placeholder">{t("camera.emptyCurrentCaptures")}</div>;
    }

    return renderCaptureCards(captures);
  }

  function renderCaptureEmptyState() {
    return (
      <div className="camera-capture-empty object-search-empty-state" role="status" aria-label={t("camera.emptyCaptures")}>
        <span className="object-search-empty-icon" data-testid="camera-capture-empty-icon">
          <Images aria-hidden="true" size={16} strokeWidth={1.8} />
        </span>
        <span>{t("camera.emptyCaptures")}</span>
      </div>
    );
  }

  function renderAllCameraCaptures() {
    return (
      <div className="camera-capture-overview">
        <div className="camera-capture-overview-scroll">
          {hasAnyCameraCapture ? (
            cameraCaptureGroups
              .filter((group) => group.captures.length > 0)
              .map((group) => (
                <section
                  key={group.camera.id}
                  aria-label={t("camera.groupCaptures", { name: group.camera.name })}
                  className="camera-capture-group"
                >
                  <h3>{t("camera.groupCaptures", { name: group.camera.name })}</h3>
                  {renderCaptureCards(group.captures)}
                </section>
              ))
          ) : (
            renderCaptureEmptyState()
          )}
        </div>
      </div>
    );
  }

  function renderCaptureOverviewFooter() {
    if (activeTab !== "captures") {
      return null;
    }

    return (
      <div className="camera-capture-overview-footer">
        <button className="camera-capture-clear-all" type="button" onClick={handleClearAllCaptures}>
          <Trash2 aria-hidden="true" data-testid="camera-capture-clear-icon" size={14} strokeWidth={1.9} />
          <span>{t("camera.clearAll")}</span>
        </button>
        <button
          className="camera-capture-send-all viewport-toolbar-crowd-confirm"
          type="button"
          onClick={sendAllCapturesToCanvas}
        >
          <Send aria-hidden="true" data-testid="camera-capture-send-icon" size={14} strokeWidth={1.9} />
          <span>{t("camera.sendToCanvas")}</span>
        </button>
      </div>
    );
  }

  function renderViewer() {
    if (!viewerCapture || !viewerPortalRoot) {
      return null;
    }

    const viewerImageClassName = [
      "camera-capture-viewer-image",
      viewerScale > 1 ? "is-zoomed" : "",
      viewerDragging ? "is-dragging" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const viewer = (
      <div
        aria-label={t("camera.viewerMask")}
        className="camera-capture-viewer-backdrop"
        role="presentation"
        onClick={closeViewer}
      >
        <div
          aria-label={t("camera.viewer")}
          aria-modal="true"
          className="camera-capture-viewer"
          role="dialog"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="camera-capture-viewer-header">
            <span className="camera-capture-viewer-title" title={viewerCapture.name}>
              {viewerCapture.name}
            </span>
            <div
              aria-label={t("camera.viewerToolbar")}
              className="camera-capture-viewer-toolbar"
              role="toolbar"
            >
              <button
                aria-label={t("camera.zoomIn")}
                className="camera-capture-viewer-tool"
                type="button"
                onClick={() => handleViewerZoom("in")}
              >
                <ZoomIn aria-hidden="true" size={16} strokeWidth={2} />
              </button>
              <button
                aria-label={t("camera.zoomOut")}
                className="camera-capture-viewer-tool"
                type="button"
                onClick={() => handleViewerZoom("out")}
              >
                <ZoomOut aria-hidden="true" size={16} strokeWidth={2} />
              </button>
              <button
                aria-label={t("camera.download")}
                className="camera-capture-viewer-tool"
                type="button"
                onClick={() => downloadDataUrl(viewerCapture.dataUrl, `${viewerCapture.name}.png`)}
              >
                <Download aria-hidden="true" size={16} strokeWidth={2} />
              </button>
              <button
                aria-label={t("camera.closeViewer")}
                className="camera-capture-viewer-tool camera-capture-viewer-close"
                type="button"
                onClick={closeViewer}
              >
                <X aria-hidden="true" size={16} strokeWidth={2} />
              </button>
            </div>
          </div>
          <div className="camera-capture-viewer-stage">
            <img
              className={viewerImageClassName}
              alt={t("camera.viewLarge", { name: viewerCapture.name })}
              src={viewerCapture.dataUrl}
              style={{ transform: `translate(${viewerOffset.x}px, ${viewerOffset.y}px) scale(${viewerScale})` }}
              onWheel={handleViewerWheel}
              onMouseDown={handleViewerMouseDown}
              draggable={false}
            />
          </div>
        </div>
      </div>
    );

    const portalContent = viewerPortalRoot.classList.contains("director-desk-root")
      ? viewer
      : (
        <div
          className="director-desk-root"
          data-theme={document.querySelector(".director-desk-root")?.getAttribute("data-theme") ?? "dark"}
        >
          {viewer}
        </div>
      );

    return createPortal(portalContent, viewerPortalRoot);
  }

  return (
    <InspectorPanel
      title={t("camera.title")}
      ariaLabel={t("camera.aria")}
      className={activeTab === "captures" ? "camera-inspector-captures" : undefined}
      footer={renderCaptureOverviewFooter()}
      tabs={[
        { label: t("common.properties"), active: activeTab === "properties", onClick: () => setActiveTab("properties") },
        { label: t("camera.capturesTab"), active: activeTab === "captures", onClick: () => setActiveTab("captures") },
      ]}
    >
      {activeTab === "properties" ? (
        <>
          <InspectorTextField
            label={t("common.name")}
            ariaLabel={t("camera.name")}
            value={currentCamera.name}
            onChange={(value) => updateCamera(currentCamera.id, { name: value })}
          />
          <InspectorSelectField
            label={t("camera.activeCamera")}
            ariaLabel={t("camera.activeCamera")}
            value={currentCamera.id}
            onChange={(value) => setActiveCamera(value)}
          >
            {cameras.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </InspectorSelectField>
          <InspectorAxisGroup
            label={t("camera.position")}
            axes={[
              {
                axis: "X",
                ariaLabel: t("camera.posX"),
                value: currentCamera.transform.position[0],
                onChange: (value) =>
                  updateCamera(currentCamera.id, {
                    transform: {
                      ...currentCamera.transform,
                      position: replaceAxis(currentCamera.transform.position, 0, Number(value)),
                    },
                  }),
              },
              {
                axis: "Y",
                ariaLabel: t("camera.posY"),
                value: currentCamera.transform.position[1],
                onChange: (value) =>
                  updateCamera(currentCamera.id, {
                    transform: {
                      ...currentCamera.transform,
                      position: replaceAxis(currentCamera.transform.position, 1, Number(value)),
                    },
                  }),
              },
              {
                axis: "Z",
                ariaLabel: t("camera.posZ"),
                value: currentCamera.transform.position[2],
                onChange: (value) =>
                  updateCamera(currentCamera.id, {
                    transform: {
                      ...currentCamera.transform,
                      position: replaceAxis(currentCamera.transform.position, 2, Number(value)),
                    },
                  }),
              },
            ]}
          />
          <InspectorSelectField
            label={t("camera.lookTarget")}
            ariaLabel={t("camera.lookTargetMode")}
            value={targetSelectValue}
            onChange={handleTargetSelection}
          >
            <option value="manual">{t("camera.manualCoords")}</option>
            {focusableObjects.map((item) => (
              <option key={item.id} value={`object:${item.id}`}>
                {item.name}
              </option>
            ))}
          </InspectorSelectField>
          <InspectorAxisGroup
            label={t("camera.lookCoords")}
            axes={[
              {
                axis: "X",
                ariaLabel: t("camera.targetX"),
                value: currentCamera.target[0],
                onChange: (value) => updateManualTarget(0, value),
              },
              {
                axis: "Y",
                ariaLabel: t("camera.targetY"),
                value: currentCamera.target[1],
                onChange: (value) => updateManualTarget(1, value),
              },
              {
                axis: "Z",
                ariaLabel: t("camera.targetZ"),
                value: currentCamera.target[2],
                onChange: (value) => updateManualTarget(2, value),
              },
            ]}
          />
          <InspectorRangeNumberField
            label={t("camera.fov")}
            rangeAriaLabel={t("camera.fovSlider")}
            numberAriaLabel={t("camera.fovValue")}
            max="120"
            min="10"
            step="0.1"
            value={currentCamera.fov}
            onValueChange={(value) => updateCamera(currentCamera.id, { fov: Number(value) })}
          />
          <button
            className="inspector-action-button camera-delete-button"
            type="button"
            disabled={!canDeleteCamera}
            aria-label={t("camera.deleteAria", { name: currentCamera.name })}
            onClick={handleDeleteCamera}
          >
            <Trash2 aria-hidden="true" size={14} strokeWidth={1.9} />
            <span>{t("camera.delete")}</span>
          </button>
          <InspectorSection title={t("camera.captures")} className="camera-capture-section">
            <button
              className="camera-capture-current-button"
              type="button"
              onClick={() => void handleCameraCapture()}
            >
              <Camera aria-hidden="true" data-testid="camera-current-capture-icon" size={14} strokeWidth={1.9} />
              <span>{t("camera.captureCurrent")}</span>
            </button>
            {captureError ? <p>{captureError}</p> : null}
            {renderCurrentCameraCaptureGrid()}
          </InspectorSection>
        </>
      ) : (
        <div className="camera-capture-tab">
          {captureError ? <p>{captureError}</p> : null}
          {renderAllCameraCaptures()}
        </div>
      )}
      {renderViewer()}
    </InspectorPanel>
  );
}
