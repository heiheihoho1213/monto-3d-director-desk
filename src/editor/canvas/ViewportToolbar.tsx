import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type MutableRefObject,
} from "react";
import {
  Box,
  Boxes,
  Camera,
  ChevronRight,
  Expand,
  Grid2X2,
  Grid3X3,
  Image,
  ImagePlus,
  Loader2,
  Move3D,
  Plus,
  Ratio,
  Rotate3D,
  Scale3D,
  Trash2,
  UserPlus,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import { requestViewportCapture } from "../io/captureBridge";
import { useModelUpload } from "../io/modelUploadContext";
import { readLocalModelFile } from "../loaders/localModelImport";
import { readPanoramaFile } from "../loaders/panoramaImport";
import { useT } from "../../i18n";
import {
  getModelLibraryItems,
  MODEL_LIBRARY_CATEGORIES,
  type ModelLibraryCategoryId,
  type ModelLibraryItem,
} from "../modelLibrary/modelLibraryCatalog";
import {
  VIEWPORT_ASPECT_RATIO_OPTIONS,
  type ViewportAspectRatio,
} from "../schema/viewportAspectRatio";
import { BODY_TYPE_OPTIONS, type CharacterBodyType } from "../runtime/mannequin/bodyTypes";
import { GEOMETRY_PRIMITIVE_OPTIONS, type GeometryPrimitiveType } from "../schema/directorProject";
import {
  useDirectorStore,
  type CameraShotSnapshot,
  type CrowdCharactersInput,
  type TransformMode,
} from "../store/directorStore";

type ToolbarAction = {
  label: string;
  icon: LucideIcon;
  mode?: TransformMode;
  disabled?: boolean;
  onClick: () => void;
};

const DEFAULT_VIEWPORT_TOOLBAR_HEIGHT = 46;
const VIEWPORT_TOOLBAR_BOTTOM_OFFSET = 40;
const DEFAULT_CROWD_ROWS = 3;
const DEFAULT_CROWD_COLUMNS = 3;
const DEFAULT_CROWD_SPACING = 1.2;
const MIN_CROWD_GRID_SIZE = 1;
const MAX_CROWD_GRID_SIZE = 12;
const MIN_CROWD_SPACING = 0.1;
const MAX_CROWD_SPACING = 10;

function clampCrowdGridSize(value: number) {
  if (!Number.isFinite(value)) return MIN_CROWD_GRID_SIZE;
  return Math.min(MAX_CROWD_GRID_SIZE, Math.max(MIN_CROWD_GRID_SIZE, Math.round(value)));
}

function clampCrowdSpacing(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_CROWD_SPACING;
  return Math.min(MAX_CROWD_SPACING, Math.max(MIN_CROWD_SPACING, Number(value.toFixed(2))));
}

function waitForNextAnimationFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

/** Capsule buttons for local model import / model library. Hidden for now; pass true to show. */
const DEFAULT_SHOW_EXTERNAL_MODEL_ACTIONS = false;

export function ViewportToolbar({
  getViewportCameraSnapshot,
  toolbarContainerRef,
  showExternalModelActions = DEFAULT_SHOW_EXTERNAL_MODEL_ACTIONS,
}: {
  getViewportCameraSnapshot?: () => CameraShotSnapshot;
  toolbarContainerRef?: MutableRefObject<HTMLDivElement | null>;
  showExternalModelActions?: boolean;
}) {
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const aspectRatioPanelRef = useRef<HTMLDivElement | null>(null);
  const characterTriggerRef = useRef<HTMLButtonElement | null>(null);
  const geometryTriggerRef = useRef<HTMLButtonElement | null>(null);
  const crowdTriggerRef = useRef<HTMLButtonElement | null>(null);
  const modelLibraryTriggerRef = useRef<HTMLButtonElement | null>(null);
  const characterMenuRef = useRef<HTMLDivElement | null>(null);
  const geometryMenuRef = useRef<HTMLDivElement | null>(null);
  const crowdPanelRef = useRef<HTMLDivElement | null>(null);
  const modelLibraryPanelRef = useRef<HTMLDivElement | null>(null);
  const sceneLocalModelInputRef = useRef<HTMLInputElement | null>(null);
  const libraryLocalModelInputRef = useRef<HTMLInputElement | null>(null);
  const panoramaInputRef = useRef<HTMLInputElement | null>(null);
  const uploadModel = useModelUpload();
  const t = useT();
  const [characterMenuOpen, setCharacterMenuOpen] = useState(false);
  const [geometryMenuOpen, setGeometryMenuOpen] = useState(false);
  const [crowdPanelOpen, setCrowdPanelOpen] = useState(false);
  const [modelLibraryOpen, setModelLibraryOpen] = useState(false);
  const [aspectRatioPanelOpen, setAspectRatioPanelOpen] = useState(false);
  const [modelImporting, setModelImporting] = useState(false);
  const [modelImportLabel, setModelImportLabel] = useState(() => t("toolbar.importingGeneric"));
  const [toolbarHeight, setToolbarHeight] = useState(DEFAULT_VIEWPORT_TOOLBAR_HEIGHT);
  const [characterMenuStyle, setCharacterMenuStyle] = useState<CSSProperties>({});
  const [geometryMenuStyle, setGeometryMenuStyle] = useState<CSSProperties>({});
  const [crowdPanelStyle, setCrowdPanelStyle] = useState<CSSProperties>({});
  const [modelLibraryPanelStyle, setModelLibraryPanelStyle] = useState<CSSProperties>({});
  const [crowdBodyType, setCrowdBodyType] = useState<CharacterBodyType>(BODY_TYPE_OPTIONS[0]?.bodyType ?? "mannequin");
  const [crowdRows, setCrowdRows] = useState(String(DEFAULT_CROWD_ROWS));
  const [crowdColumns, setCrowdColumns] = useState(String(DEFAULT_CROWD_COLUMNS));
  const [crowdSpacing, setCrowdSpacing] = useState(String(DEFAULT_CROWD_SPACING));
  const [activeModelLibraryCategoryId, setActiveModelLibraryCategoryId] =
    useState<ModelLibraryCategoryId>("convenience");
  const addImportedAsset = useDirectorStore((state) => state.addImportedAsset);
  const addObjectFromAsset = useDirectorStore((state) => state.addObjectFromAsset);
  const removeImportedAsset = useDirectorStore((state) => state.removeImportedAsset);
  const assets = useDirectorStore((state) => state.project.assets);
  const addPresetCharacter = useDirectorStore((state) => state.addPresetCharacter);
  const addCrowdCharacters = useDirectorStore((state) => state.addCrowdCharacters);
  const addGeometryPrimitive = useDirectorStore((state) => state.addGeometryPrimitive);
  const addCameraShot = useDirectorStore((state) => state.addCameraShot);
  const addCameraCaptures = useDirectorStore((state) => state.addCameraCaptures);
  const activeCameraId = useDirectorStore((state) => state.project.activeCameraId);
  const viewMode = useDirectorStore((state) => state.viewMode);
  const transformMode = useDirectorStore((state) => state.transformMode);
  const viewportAspectRatio = useDirectorStore((state) => state.viewportAspectRatio);
  const setViewMode = useDirectorStore((state) => state.setViewMode);
  const setTransformMode = useDirectorStore((state) => state.setTransformMode);
  const setViewportAspectRatio = useDirectorStore((state) => state.setViewportAspectRatio);
  const toggleViewportPanelsCollapsed = useDirectorStore((state) => state.toggleViewportPanelsCollapsed);
  const panoramaImportLocked = useDirectorStore((state) => state.panoramaImportLocked);

  useEffect(() => {
    if (!characterMenuOpen && !crowdPanelOpen && !modelLibraryOpen && !aspectRatioPanelOpen) return;

    function closeMenusOnOutsidePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && toolbarRef.current?.contains(event.target)) return;
      if (event.target instanceof Node && characterMenuRef.current?.contains(event.target)) return;
      if (event.target instanceof Node && geometryMenuRef.current?.contains(event.target)) return;
      if (event.target instanceof Node && crowdPanelRef.current?.contains(event.target)) return;
      if (event.target instanceof Node && modelLibraryPanelRef.current?.contains(event.target)) return;
      if (event.target instanceof Node && aspectRatioPanelRef.current?.contains(event.target)) return;
      if (event.target instanceof Node && sceneLocalModelInputRef.current?.contains(event.target)) return;
      if (event.target instanceof Node && libraryLocalModelInputRef.current?.contains(event.target)) return;
      if (event.target instanceof Node && panoramaInputRef.current?.contains(event.target)) return;

      setCharacterMenuOpen(false);
      setGeometryMenuOpen(false);
      setCrowdPanelOpen(false);
      setModelLibraryOpen(false);
      setAspectRatioPanelOpen(false);
    }

    document.addEventListener("pointerdown", closeMenusOnOutsidePointerDown);

    return () => {
      document.removeEventListener("pointerdown", closeMenusOnOutsidePointerDown);
    };
  }, [aspectRatioPanelOpen, characterMenuOpen, crowdPanelOpen, modelLibraryOpen]);

  useLayoutEffect(() => {
    const element = toolbarRef.current;
    if (!element) return;

    const updateHeight = () => {
      const nextHeight = Math.max(element.offsetHeight, DEFAULT_VIEWPORT_TOOLBAR_HEIGHT);
      setToolbarHeight((currentHeight) => (currentHeight === nextHeight ? currentHeight : nextHeight));
    };

    updateHeight();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateHeight);
      return () => {
        window.removeEventListener("resize", updateHeight);
      };
    }

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(element);
    window.addEventListener("resize", updateHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  useLayoutEffect(() => {
    const toolbarElement = toolbarRef.current;
    const frameElement = toolbarElement?.parentElement;
    if (!toolbarElement || !frameElement) return;

    const updateFloatingPositions = () => {
      const frameRect = frameElement.getBoundingClientRect();

      if (characterMenuOpen && characterTriggerRef.current) {
        const triggerRect = characterTriggerRef.current.getBoundingClientRect();
        setCharacterMenuStyle({
          left: `${triggerRect.left - frameRect.left + triggerRect.width / 2}px`,
          bottom: `${frameRect.bottom - triggerRect.top + 8}px`,
        });
      }

      if (geometryMenuOpen && geometryTriggerRef.current) {
        const triggerRect = geometryTriggerRef.current.getBoundingClientRect();
        setGeometryMenuStyle({
          left: `${triggerRect.right - frameRect.left + 8}px`,
          bottom: `${frameRect.bottom - triggerRect.bottom}px`,
        });
      }

      if (crowdPanelOpen && crowdTriggerRef.current) {
        const triggerRect = crowdTriggerRef.current.getBoundingClientRect();
        setCrowdPanelStyle({
          left: `${triggerRect.right - frameRect.left + 8}px`,
          bottom: `${frameRect.bottom - triggerRect.bottom}px`,
        });
      }

      if (modelLibraryOpen) {
        const toolbarRect = toolbarElement.getBoundingClientRect();
        setModelLibraryPanelStyle({
          left: `${toolbarRect.left - frameRect.left + toolbarRect.width / 2}px`,
          bottom: `${frameRect.bottom - toolbarRect.top + 10}px`,
        });
      }
    };

    updateFloatingPositions();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateFloatingPositions);
      return () => {
        window.removeEventListener("resize", updateFloatingPositions);
      };
    }

    const resizeObserver = new ResizeObserver(updateFloatingPositions);
    resizeObserver.observe(frameElement);
    resizeObserver.observe(toolbarElement);
    if (characterTriggerRef.current) {
      resizeObserver.observe(characterTriggerRef.current);
    }
    if (geometryTriggerRef.current) {
      resizeObserver.observe(geometryTriggerRef.current);
    }
    if (crowdTriggerRef.current) {
      resizeObserver.observe(crowdTriggerRef.current);
    }
    if (modelLibraryTriggerRef.current) {
      resizeObserver.observe(modelLibraryTriggerRef.current);
    }
    window.addEventListener("resize", updateFloatingPositions);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateFloatingPositions);
    };
  }, [characterMenuOpen, crowdPanelOpen, geometryMenuOpen, modelLibraryOpen]);

  async function handleLocalModelChange(
    event: ChangeEvent<HTMLInputElement>,
    addToScene: boolean
  ) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    if (!files.length || modelImporting) return;

    const total = files.length;
    setModelImporting(true);
    setModelImportLabel(
      total > 1
        ? t("toolbar.importingProgress", { current: 0, total })
        : t("toolbar.importingFile", { name: files[0]?.name ?? "" })
    );

    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]!;
        setModelImportLabel(
          total > 1
            ? t("toolbar.importingProgress", { current: index + 1, total })
            : t("toolbar.importingFile", { name: file.name })
        );
        const result = await readLocalModelFile(file, { uploadModel });
        addImportedAsset({
          kind: "prop",
          ...result,
          addToScene,
          assetSource: "local",
        });
      }
    } catch {
      // The toolbar keeps file actions quiet; detailed import feedback lives in the side panel.
    } finally {
      input.value = "";
      setModelImporting(false);
      setModelImportLabel(t("toolbar.importingGeneric"));
    }
  }

  async function handlePanoramaChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const result = await readPanoramaFile(file);
      addImportedAsset({ kind: "panorama", ...result });
    } catch {
      // The toolbar keeps file actions quiet; detailed import feedback lives in the side panel.
    } finally {
      input.value = "";
    }
  }

  async function handleCapture(preset: "current" | "four" | "twelve") {
    try {
      const targetCameraId =
        viewMode === "director" ? addCameraShot(getViewportCameraSnapshot?.()) : activeCameraId;

      setViewMode("camera");
      await waitForNextAnimationFrame();

      const results = await requestViewportCapture({
        preset,
        source: "camera-panel",
        cameraId: targetCameraId,
      });
      addCameraCaptures(targetCameraId, results.map((result) => result.dataUrl));
    } catch {
      // Keep the capsule toolbar icon-only and free of transient status text.
    }
  }

  function selectTransformMode(mode: TransformMode) {
    setTransformMode(mode);
  }

  function toggleCharacterMenu() {
    setCharacterMenuOpen((isOpen) => !isOpen);
    setGeometryMenuOpen(false);
    setCrowdPanelOpen(false);
    setModelLibraryOpen(false);
    setAspectRatioPanelOpen(false);
  }

  function addCharacterWithBodyType(bodyType: CharacterBodyType) {
    addPresetCharacter(bodyType);
    setCharacterMenuOpen(false);
    setGeometryMenuOpen(false);
    setCrowdPanelOpen(false);
  }

  function addGeometryWithType(geometryType: GeometryPrimitiveType) {
    addGeometryPrimitive(geometryType);
    setCharacterMenuOpen(false);
    setGeometryMenuOpen(false);
    setCrowdPanelOpen(false);
  }

  function openCrowdPanel() {
    setCrowdPanelOpen(true);
    setGeometryMenuOpen(false);
  }

  function closeCrowdPanel() {
    setCrowdPanelOpen(false);
  }

  function getCrowdInputValue(): CrowdCharactersInput {
    return {
      bodyType: crowdBodyType,
      rows: clampCrowdGridSize(Number(crowdRows)),
      columns: clampCrowdGridSize(Number(crowdColumns)),
      spacing: clampCrowdSpacing(Number(crowdSpacing)),
    };
  }

  function applyCrowdValueDrafts(input: CrowdCharactersInput) {
    setCrowdRows(String(input.rows));
    setCrowdColumns(String(input.columns));
    setCrowdSpacing(String(input.spacing));
  }

  function addCrowd() {
    const nextInput = getCrowdInputValue();
    applyCrowdValueDrafts(nextInput);
    addCrowdCharacters(nextInput);
    setCharacterMenuOpen(false);
    setGeometryMenuOpen(false);
    setCrowdPanelOpen(false);
  }

  function toggleModelLibrary() {
    setModelLibraryOpen((isOpen) => !isOpen);
    setCharacterMenuOpen(false);
    setGeometryMenuOpen(false);
    setCrowdPanelOpen(false);
    setAspectRatioPanelOpen(false);
  }

  function addModelLibraryItem(item: ModelLibraryItem) {
    addImportedAsset({
      kind: "prop",
      assetSource: "library",
      fileName: item.fileName,
      name: item.name,
      url: item.url,
    });
    setModelLibraryOpen(false);
  }

  async function handleMyModelsImport() {
    if (modelImporting) return;
    libraryLocalModelInputRef.current?.click();
  }

  const myModelLibraryItems: ModelLibraryItem[] = assets
    .filter((asset) => asset.sourceType === "model" && asset.assetSource === "local")
    .map(
      (asset) =>
        ({
          categoryId: "my-models",
          fileName: asset.fileName,
          id: asset.id,
          name: asset.name ?? asset.fileName.replace(/\.(fbx|obj)$/i, ""),
          thumbUrl: undefined,
          url: asset.url,
        }) satisfies ModelLibraryItem
    );

  function addCameraFromViewport() {
    const snapshot = getViewportCameraSnapshot?.();
    addCameraShot(snapshot);
  }

  function toggleAspectRatioPanel() {
    setAspectRatioPanelOpen((isOpen) => !isOpen);
    setCharacterMenuOpen(false);
    setGeometryMenuOpen(false);
    setCrowdPanelOpen(false);
    setModelLibraryOpen(false);
  }

  function selectAspectRatio(ratio: ViewportAspectRatio) {
    setViewportAspectRatio(ratio);
    setAspectRatioPanelOpen(false);
  }

  const actions: ToolbarAction[] = [
    { label: t("toolbar.move"), icon: Move3D, mode: "translate", onClick: () => selectTransformMode("translate") },
    { label: t("toolbar.rotate"), icon: Rotate3D, mode: "rotate", onClick: () => selectTransformMode("rotate") },
    { label: t("toolbar.scale"), icon: Scale3D, mode: "scale", onClick: () => selectTransformMode("scale") },
    {
      label: t("toolbar.importPanorama"),
      icon: ImagePlus,
      disabled: panoramaImportLocked,
      onClick: () => {
        if (panoramaImportLocked) return;
        panoramaInputRef.current?.click();
      },
    },
    ...(showExternalModelActions
      ? [
          {
            label: t("toolbar.importLocalModel"),
            icon: Box,
            disabled: modelImporting,
            onClick: () => {
              if (modelImporting) return;
              sceneLocalModelInputRef.current?.click();
            },
          },
          {
            label: t("toolbar.modelLibrary"),
            icon: Boxes,
            onClick: toggleModelLibrary,
            disabled: modelImporting,
          },
        ]
      : []),
    { label: t("toolbar.addCamera"), icon: Video, onClick: addCameraFromViewport },
    { label: t("toolbar.aspectRatio"), icon: Ratio, onClick: toggleAspectRatioPanel },
    { label: t("toolbar.captureCurrent"), icon: Camera, onClick: () => void handleCapture("current") },
    { label: t("toolbar.captureFour"), icon: Grid2X2, onClick: () => void handleCapture("four") },
    { label: t("toolbar.captureTwelve"), icon: Grid3X3, onClick: () => void handleCapture("twelve") },
    { label: t("toolbar.fullscreen"), icon: Expand, onClick: toggleViewportPanelsCollapsed },
  ];

  function renderActionButton(action: ToolbarAction) {
    const Icon = action.icon;
    const active = action.mode ? transformMode === action.mode : false;

    return (
      <button
        key={action.label}
        aria-label={action.label}
        aria-pressed={action.mode ? active : undefined}
        className={`ui-icon-button viewport-toolbar-button${active ? " is-active" : ""}${action.disabled ? " is-disabled" : ""}`}
        disabled={action.disabled}
        title={
          action.disabled && action.label === t("toolbar.importPanorama")
            ? t("toolbar.importPanoramaLocked")
            : action.label
        }
        type="button"
        onClick={action.onClick}
      >
        <Icon aria-hidden="true" size={17} strokeWidth={1.9} />
        <span className="viewport-toolbar-label">{action.label}</span>
      </button>
    );
  }

  const modelLibraryItems = getModelLibraryItems();
  const activeModelLibraryItems =
    activeModelLibraryCategoryId === "my-models"
      ? myModelLibraryItems
      : modelLibraryItems.filter((item) => item.categoryId === activeModelLibraryCategoryId);
  const crowdInputValue = getCrowdInputValue();
  const crowdTotalCount = crowdInputValue.rows * crowdInputValue.columns;

  function setToolbarElement(element: HTMLDivElement | null) {
    toolbarRef.current = element;
    if (toolbarContainerRef) {
      toolbarContainerRef.current = element;
    }
  }

  const aspectRatioPanelStyle = {
    "--viewport-toolbar-height": `${toolbarHeight}px`,
  } as CSSProperties;

  return (
    <>
      <div className="viewport-toolbar" role="group" aria-label={t("toolbar.group")} ref={setToolbarElement}>
        {actions.slice(0, 3).map(renderActionButton)}
        <div className="viewport-toolbar-menu-wrap">
          <button
            aria-expanded={characterMenuOpen}
            aria-label={t("toolbar.addCharacter")}
            className="ui-icon-button viewport-toolbar-button"
            ref={characterTriggerRef}
            type="button"
            onClick={toggleCharacterMenu}
          >
            <UserPlus aria-hidden="true" size={17} strokeWidth={1.9} />
            <span className="viewport-toolbar-label">{t("toolbar.addCharacter")}</span>
          </button>
        </div>
        {actions.slice(3).map((action) => {
          if (action.label !== t("toolbar.modelLibrary")) {
            return renderActionButton(action);
          }

          const Icon = action.icon;

          return (
            <button
              key={action.label}
              aria-label={action.label}
              className={`ui-icon-button viewport-toolbar-button${action.disabled ? " is-disabled" : ""}`}
              disabled={action.disabled}
              ref={modelLibraryTriggerRef}
              type="button"
              onClick={action.onClick}
            >
              <Icon aria-hidden="true" size={17} strokeWidth={1.9} />
              <span className="viewport-toolbar-label">{action.label}</span>
            </button>
          );
        })}
      </div>
      {characterMenuOpen ? (
        <div
          ref={characterMenuRef}
          className="viewport-toolbar-menu"
          role="menu"
          aria-label={t("toolbar.chooseBodyType")}
          style={characterMenuStyle}
        >
          {BODY_TYPE_OPTIONS.map((option) => (
            <button
              key={option.bodyType}
              role="menuitem"
              type="button"
              onClick={() => addCharacterWithBodyType(option.bodyType)}
              onMouseEnter={() => {
                setGeometryMenuOpen(false);
                setCrowdPanelOpen(false);
              }}
            >
              {t(`bodyType.${option.bodyType}`)}
            </button>
          ))}
          <div
            className="viewport-toolbar-submenu-wrap"
            onMouseEnter={openCrowdPanel}
          >
            <button
              ref={crowdTriggerRef}
              aria-expanded={crowdPanelOpen}
              aria-haspopup="dialog"
              className="viewport-toolbar-menu-subtrigger"
              role="menuitem"
              type="button"
              onFocus={openCrowdPanel}
              onMouseEnter={openCrowdPanel}
            >
              <span>{t("toolbar.crowdMenu")}</span>
              <ChevronRight aria-hidden="true" size={14} strokeWidth={1.8} />
            </button>
          </div>
          <div
            className="viewport-toolbar-submenu-wrap"
            onMouseEnter={() => {
              setGeometryMenuOpen(true);
              setCrowdPanelOpen(false);
            }}
          >
            <button
              ref={geometryTriggerRef}
              aria-expanded={geometryMenuOpen}
              aria-haspopup="menu"
              className="viewport-toolbar-menu-subtrigger"
              role="menuitem"
              type="button"
              onMouseEnter={() => {
                setGeometryMenuOpen(true);
                setCrowdPanelOpen(false);
              }}
            >
              <span>{t("toolbar.geometryModels")}</span>
              <ChevronRight aria-hidden="true" size={14} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      ) : null}
      {crowdPanelOpen ? (
        <div
          ref={crowdPanelRef}
          className="viewport-toolbar-crowd-panel"
          role="dialog"
          aria-label={t("toolbar.crowdArray")}
          style={crowdPanelStyle}
        >
          <div className="viewport-toolbar-crowd-panel-header">
            <h2 className="viewport-toolbar-crowd-panel-title">{t("toolbar.crowdArray")}</h2>
            <span className="viewport-toolbar-crowd-panel-count">{t("toolbar.crowdTotal", { count: crowdTotalCount })}</span>
          </div>
          <div className="viewport-toolbar-crowd-grid">
            <label className="viewport-toolbar-crowd-field">
              <span>{t("toolbar.crowdRows")}</span>
              <input
                className="ui-field"
                aria-label={t("toolbar.crowdRowsAria")}
                inputMode="numeric"
                type="number"
                min={MIN_CROWD_GRID_SIZE}
                max={MAX_CROWD_GRID_SIZE}
                value={crowdRows}
                onChange={(event) => setCrowdRows(event.currentTarget.value)}
              />
            </label>
            <span className="viewport-toolbar-crowd-separator" aria-hidden="true">
              ×
            </span>
            <label className="viewport-toolbar-crowd-field">
              <span>{t("toolbar.crowdColumns")}</span>
              <input
                className="ui-field"
                aria-label={t("toolbar.crowdColumnsAria")}
                inputMode="numeric"
                type="number"
                min={MIN_CROWD_GRID_SIZE}
                max={MAX_CROWD_GRID_SIZE}
                value={crowdColumns}
                onChange={(event) => setCrowdColumns(event.currentTarget.value)}
              />
            </label>
            <label className="viewport-toolbar-crowd-field viewport-toolbar-crowd-field-spacing">
              <span>{t("toolbar.crowdSpacing")}</span>
              <input
                className="ui-field"
                aria-label={t("toolbar.crowdSpacingAria")}
                inputMode="decimal"
                type="number"
                min={MIN_CROWD_SPACING}
                max={MAX_CROWD_SPACING}
                step="0.1"
                value={crowdSpacing}
                onChange={(event) => setCrowdSpacing(event.currentTarget.value)}
              />
            </label>
          </div>
          <div className="viewport-toolbar-crowd-actions">
            <button className="viewport-toolbar-crowd-cancel camera-capture-clear-all" type="button" onClick={closeCrowdPanel}>
              {t("toolbar.crowdCancel")}
            </button>
            <button
              aria-label={t("toolbar.crowdAddAria")}
              className="viewport-toolbar-crowd-confirm camera-capture-send-all"
              type="button"
              onClick={addCrowd}
            >
              {t("toolbar.crowdAdd")}
            </button>
          </div>
        </div>
      ) : null}
      {geometryMenuOpen ? (
        <div
          ref={geometryMenuRef}
          className="viewport-toolbar-submenu"
          role="menu"
          aria-label={t("toolbar.chooseGeometryMenu")}
          style={geometryMenuStyle}
        >
          {GEOMETRY_PRIMITIVE_OPTIONS.map((option) => (
            <button
              key={option.type}
              role="menuitem"
              type="button"
              onClick={() => addGeometryWithType(option.type)}
            >
              {t(`geometry.${option.type}`)}
            </button>
          ))}
        </div>
      ) : null}
      {modelLibraryOpen ? (
        <div
          ref={modelLibraryPanelRef}
          className="model-library-panel"
          role="dialog"
          aria-label={t("toolbar.modelLibrary")}
          style={modelLibraryPanelStyle}
        >
          <div className="model-library-header">
            <h2 className="model-library-title">{t("toolbar.modelLibrary")}</h2>
            <button
              aria-label={t("toolbar.closeModelLibrary")}
              className="top-bar-action-button model-library-close-button"
              type="button"
              onClick={() => setModelLibraryOpen(false)}
            >
              <X aria-hidden="true" size={16} strokeWidth={1.8} />
            </button>
          </div>
          <div className="model-library-tabs" role="tablist" aria-label={t("toolbar.modelCategories")}>
            {MODEL_LIBRARY_CATEGORIES.map((category) => {
              const active = category.id === activeModelLibraryCategoryId;
              const categoryLabel =
                category.id === "my-models" ? t("modelLibrary.myModels") : t(`modelLibrary.${category.id}`);

              return (
                <button
                  key={category.id}
                  aria-selected={active}
                  className={`model-library-tab${active ? " is-active" : ""}`}
                  role="tab"
                  type="button"
                  onClick={() => setActiveModelLibraryCategoryId(category.id)}
                >
                  {categoryLabel}
                </button>
              );
            })}
          </div>
          {activeModelLibraryCategoryId === "my-models" && activeModelLibraryItems.length === 0 ? (
            <div className="model-library-empty-state object-search-empty-state" role="status" aria-label={t("toolbar.noModels")}>
              <span className="object-search-empty-icon" data-testid="my-models-empty-icon">
                <Boxes aria-hidden="true" size={16} strokeWidth={1.8} />
              </span>
              <span>{t("toolbar.noModels")}</span>
              <button
                className="top-bar-action-button model-library-empty-action"
                disabled={modelImporting}
                type="button"
                onClick={() => void handleMyModelsImport()}
              >
                {modelImporting ? t("toolbar.importing") : t("toolbar.localImport")}
              </button>
            </div>
          ) : (
            <div className="model-library-grid" role="list" aria-label={t("toolbar.modelList")}>
              {activeModelLibraryItems.map((item) => (
                activeModelLibraryCategoryId === "my-models" ? (
                  <div key={item.id} className="model-library-card-wrap">
                    <button
                      aria-label={t("toolbar.addModel", { name: item.name })}
                      className="model-library-card"
                      type="button"
                      onClick={() => {
                        addObjectFromAsset(item.id);
                        setModelLibraryOpen(false);
                      }}
                    >
                      <span className="model-library-thumb" aria-hidden="true">
                        {item.thumbUrl ? (
                          <img
                            alt=""
                            aria-hidden="true"
                            className="model-library-thumb-image"
                            loading="lazy"
                            src={item.thumbUrl}
                          />
                        ) : (
                          <Boxes size={24} strokeWidth={1.6} />
                        )}
                      </span>
                      <span className="model-library-name">{item.name}</span>
                    </button>
                    <button
                      aria-label={t("toolbar.deleteModel", { name: item.name })}
                      className="model-library-card-delete"
                      type="button"
                      onClick={() => {
                        removeImportedAsset(item.id);
                      }}
                    >
                      <Trash2 aria-hidden="true" size={14} strokeWidth={1.9} />
                    </button>
                  </div>
                ) : (
                  <button
                    key={item.id}
                    aria-label={t("toolbar.addModel", { name: item.name })}
                    className="model-library-card"
                    type="button"
                    onClick={() => {
                      addModelLibraryItem(item);
                    }}
                  >
                    <span className="model-library-thumb" aria-hidden="true">
                      {item.thumbUrl ? (
                        <img
                          alt=""
                          aria-hidden="true"
                          className="model-library-thumb-image"
                          loading="lazy"
                          src={item.thumbUrl}
                        />
                      ) : (
                        <Boxes size={24} strokeWidth={1.6} />
                      )}
                    </span>
                    <span className="model-library-name">{item.name}</span>
                  </button>
                )
              ))}
              {activeModelLibraryCategoryId === "my-models" ? (
                <button
                  aria-label={t("toolbar.localImport")}
                  aria-busy={modelImporting}
                  className={`model-library-card model-library-import-card${modelImporting ? " is-loading" : ""}`}
                  disabled={modelImporting}
                  type="button"
                  onClick={() => void handleMyModelsImport()}
                >
                  <span className="model-library-thumb model-library-thumb-import" aria-hidden="true">
                    {modelImporting ? (
                      <Loader2 className="model-import-spinner" size={28} strokeWidth={1.8} />
                    ) : (
                      <Plus size={28} strokeWidth={1.8} />
                    )}
                  </span>
                  <span className="model-library-name">
                    {modelImporting ? t("toolbar.importing") : t("toolbar.localImport")}
                  </span>
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
      {aspectRatioPanelOpen ? (
        <div
          ref={aspectRatioPanelRef}
          className="viewport-aspect-panel"
          role="dialog"
          aria-label={t("toolbar.ratio")}
          style={aspectRatioPanelStyle}
        >
          <h2 className="viewport-aspect-panel-title">{t("toolbar.ratio")}</h2>
          <div className="viewport-aspect-panel-grid" role="group" aria-label={t("toolbar.ratioOptions")}>
            {VIEWPORT_ASPECT_RATIO_OPTIONS.map((option) => {
              const active = option.id === viewportAspectRatio;
              const frameClassName = `viewport-aspect-option-frame viewport-aspect-option-frame-${option.id.replace(":", "-")}`;
              const optionLabel = option.id === "auto" ? t("aspect.auto") : option.label;

              return (
                <button
                  key={option.id}
                  aria-pressed={active}
                  className={`viewport-aspect-option${active ? " is-active" : ""}`}
                  type="button"
                  onClick={() => selectAspectRatio(option.id)}
                >
                  <span className={frameClassName} aria-hidden="true" />
                  <span className="viewport-aspect-option-label">{optionLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {modelImporting ? (
        <div
          aria-busy="true"
          aria-label={modelImportLabel}
          className="model-import-loading-overlay"
          role="status"
        >
          <div className="model-import-loading-card">
            <Loader2 aria-hidden="true" className="model-import-spinner" size={22} strokeWidth={2} />
            <span className="model-import-loading-text">{modelImportLabel}</span>
          </div>
        </div>
      ) : null}
      <input
        ref={panoramaInputRef}
        aria-hidden="true"
        className="hidden-file-input"
        tabIndex={-1}
        accept=".jpg,.jpeg,.png,.webp"
        type="file"
        onChange={(event) => void handlePanoramaChange(event)}
      />
      <input
        ref={sceneLocalModelInputRef}
        aria-hidden="true"
        className="hidden-file-input"
        data-testid="scene-local-model-input"
        disabled={modelImporting}
        tabIndex={-1}
        accept=".fbx,.obj"
        type="file"
        onChange={(event) => void handleLocalModelChange(event, true)}
      />
      <input
        ref={libraryLocalModelInputRef}
        aria-hidden="true"
        className="hidden-file-input"
        data-testid="library-local-model-input"
        disabled={modelImporting}
        tabIndex={-1}
        accept=".fbx,.obj"
        multiple
        type="file"
        onChange={(event) => void handleLocalModelChange(event, false)}
      />
    </>
  );
}
