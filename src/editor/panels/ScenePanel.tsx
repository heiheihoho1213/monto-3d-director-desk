import { useEffect, useState } from "react";
import { Eye, EyeOff, ImageOff, Trash2 } from "lucide-react";
import { useT } from "../../i18n";
import {
  InspectorAxisGroup,
  InspectorColorField,
  InspectorPanel,
  InspectorRangeNumberField,
  InspectorSection,
} from "./InspectorControls";
import { useDirectorStore } from "../store/directorStore";

const PANORAMA_RADIUS_MIN = 10;
const PANORAMA_RADIUS_MAX = 300;
const PANORAMA_YAW_MIN = -180;
const PANORAMA_YAW_MAX = 180;
const SCENE_SCALE_MIN = 0.1;
const SCENE_SCALE_MAX = 3;
const GROUND_HEIGHT_MIN = -5;
const GROUND_HEIGHT_MAX = 5;

function replaceAxis(tuple: [number, number, number], axis: 0 | 1 | 2, value: number): [number, number, number] {
  return tuple.map((item, index) => (index === axis ? value : item)) as [number, number, number];
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function ScenePanel() {
  const t = useT();
  const scene = useDirectorStore((state) => state.project.scene);
  const assets = useDirectorStore((state) => state.project.assets);
  const panoramaAssetId = useDirectorStore((state) => state.project.panoramaAssetId);
  const panoramaImportLocked = useDirectorStore((state) => state.panoramaImportLocked);
  const panoramaPreviewVisible = useDirectorStore((state) => state.panoramaPreviewVisible);
  const updateScene = useDirectorStore((state) => state.updateScene);
  const removePanoramaAsset = useDirectorStore((state) => state.removePanoramaAsset);
  const togglePanoramaPreviewVisible = useDirectorStore((state) => state.togglePanoramaPreviewVisible);
  const [sceneScaleDraft, setSceneScaleDraft] = useState(String(scene.scale));
  const [panoramaYawDraft, setPanoramaYawDraft] = useState(String(scene.panoramaYaw));
  const [panoramaRadiusDraft, setPanoramaRadiusDraft] = useState(String(scene.panoramaRadius));
  const [groundHeightDraft, setGroundHeightDraft] = useState(String(scene.groundHeight));
  const panoramaAsset = assets.find((item) => item.id === panoramaAssetId);

  useEffect(() => {
    setSceneScaleDraft(String(scene.scale));
  }, [scene.scale]);

  useEffect(() => {
    setPanoramaRadiusDraft(String(scene.panoramaRadius));
  }, [scene.panoramaRadius]);

  useEffect(() => {
    setPanoramaYawDraft(String(scene.panoramaYaw));
  }, [scene.panoramaYaw]);

  useEffect(() => {
    setGroundHeightDraft(String(scene.groundHeight));
  }, [scene.groundHeight]);

  function commitSceneScale(value: string) {
    const parsed = Number(value);
    const nextScale = Number.isFinite(parsed) ? clampNumber(parsed, SCENE_SCALE_MIN, SCENE_SCALE_MAX) : scene.scale;
    updateScene({ scale: nextScale });
    setSceneScaleDraft(String(nextScale));
  }

  function commitPanoramaYaw(value: string) {
    const parsed = Number(value);
    const nextYaw = Number.isFinite(parsed) ? clampNumber(parsed, PANORAMA_YAW_MIN, PANORAMA_YAW_MAX) : scene.panoramaYaw;
    updateScene({ panoramaYaw: nextYaw });
    setPanoramaYawDraft(String(nextYaw));
  }

  function commitPanoramaRadius(value: string) {
    const parsed = Number(value);
    const nextRadius = Number.isFinite(parsed)
      ? clampNumber(parsed, PANORAMA_RADIUS_MIN, PANORAMA_RADIUS_MAX)
      : scene.panoramaRadius;
    updateScene({ panoramaRadius: nextRadius });
    setPanoramaRadiusDraft(String(nextRadius));
  }

  function commitGroundHeight(value: string) {
    const parsed = Number(value);
    const nextHeight = Number.isFinite(parsed) ? clampNumber(parsed, GROUND_HEIGHT_MIN, GROUND_HEIGHT_MAX) : scene.groundHeight;
    updateScene({ groundHeight: nextHeight });
    setGroundHeightDraft(String(nextHeight));
  }

  return (
    <InspectorPanel title={t("scene.title")} ariaLabel={t("scene.aria")} className="scene-inspector">
      <InspectorRangeNumberField
        label={t("scene.sceneScale")}
        rangeAriaLabel={t("scene.sceneScaleSlider")}
        numberAriaLabel={t("scene.sceneScale")}
        max={SCENE_SCALE_MAX}
        min={SCENE_SCALE_MIN}
        step="0.01"
        value={sceneScaleDraft}
        onValueChange={commitSceneScale}
        onRangeChange={commitSceneScale}
        onNumberBlur={commitSceneScale}
        onNumberChange={(value) => {
          setSceneScaleDraft(value);
          if (value !== "") {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) {
              updateScene({ scale: parsed });
            }
          }
        }}
      />
      <InspectorAxisGroup
        label={t("scene.sceneTranslate")}
        axes={[
          {
            axis: "X",
            ariaLabel: t("scene.axisX"),
            step: "0.1",
            value: scene.position[0],
            onChange: (value) => updateScene({ position: replaceAxis(scene.position, 0, Number(value)) }),
          },
          {
            axis: "Y",
            ariaLabel: t("scene.axisY"),
            step: "0.1",
            value: scene.position[1],
            onChange: (value) => updateScene({ position: replaceAxis(scene.position, 1, Number(value)) }),
          },
          {
            axis: "Z",
            ariaLabel: t("scene.axisZ"),
            step: "0.1",
            value: scene.position[2],
            onChange: (value) => updateScene({ position: replaceAxis(scene.position, 2, Number(value)) }),
          },
        ]}
      />
      <InspectorAxisGroup
        label={t("scene.sceneRotate")}
        axes={[
          {
            axis: "X",
            ariaLabel: t("scene.rotX"),
            value: scene.rotation[0],
            onChange: (value) => updateScene({ rotation: replaceAxis(scene.rotation, 0, Number(value)) }),
          },
          {
            axis: "Y",
            ariaLabel: t("scene.rotY"),
            value: scene.rotation[1],
            onChange: (value) => updateScene({ rotation: replaceAxis(scene.rotation, 1, Number(value)) }),
          },
          {
            axis: "Z",
            ariaLabel: t("scene.rotZ"),
            value: scene.rotation[2],
            onChange: (value) => updateScene({ rotation: replaceAxis(scene.rotation, 2, Number(value)) }),
          },
        ]}
      />
      <InspectorSection
        title={t("scene.panorama")}
        titleAccessory={
          panoramaAsset ? (
            <button
              aria-label={panoramaPreviewVisible ? t("scene.panoramaHide") : t("scene.panoramaShow")}
              aria-pressed={panoramaPreviewVisible}
              className="inspector-section-eye-button"
              title={panoramaPreviewVisible ? t("scene.panoramaHideTitle") : t("scene.panoramaShowTitle")}
              type="button"
              onClick={() => togglePanoramaPreviewVisible()}
            >
              {panoramaPreviewVisible ? (
                <Eye aria-hidden="true" size={14} strokeWidth={1.9} />
              ) : (
                <EyeOff aria-hidden="true" size={14} strokeWidth={1.9} />
              )}
            </button>
          ) : null
        }
      >
        {panoramaAsset ? (
          <div
            className={`panorama-thumbnail-card${panoramaPreviewVisible ? "" : " is-preview-hidden"}`}
            aria-label={t("scene.panoramaThumbCard")}
          >
            {panoramaImportLocked ? null : (
              <button
                aria-label={t("scene.removePanorama")}
                className="panorama-thumbnail-delete"
                type="button"
                onClick={() => removePanoramaAsset()}
              >
                <Trash2 aria-hidden="true" size={14} strokeWidth={1.9} />
              </button>
            )}
            <img
              className="panorama-thumbnail-image"
              alt={t("scene.panoramaThumbAlt", { name: panoramaAsset.fileName })}
              src={panoramaAsset.url}
            />
            <span className="panorama-thumbnail-name">{panoramaAsset.fileName}</span>
          </div>
        ) : (
          <div className="panorama-empty-card" aria-label={t("scene.panoramaStatus")}>
            <span className="panorama-empty-icon" data-testid="panorama-empty-icon">
              <ImageOff aria-hidden="true" size={16} strokeWidth={1.8} />
            </span>
            <span>{t("scene.panoramaEmpty")}</span>
          </div>
        )}
        <InspectorColorField
          label={t("scene.skyColor")}
          colorAriaLabel={t("scene.skyColor")}
          hexAriaLabel={t("scene.skyColorHex")}
          value={scene.backgroundColor}
          onColorChange={(value) => updateScene({ backgroundColor: value })}
          onHexChange={(value) => updateScene({ backgroundColor: value })}
        />
      </InspectorSection>
      <InspectorSection title={t("scene.panoramaSphere")}>
        <InspectorRangeNumberField
          label={t("scene.panoramaYaw")}
          rangeAriaLabel={t("scene.panoramaYawSlider")}
          numberAriaLabel={t("scene.panoramaYawValue")}
          max={PANORAMA_YAW_MAX}
          min={PANORAMA_YAW_MIN}
          step="1"
          value={panoramaYawDraft}
          onValueChange={commitPanoramaYaw}
          onRangeChange={commitPanoramaYaw}
          onNumberBlur={commitPanoramaYaw}
          onNumberChange={(value) => {
            setPanoramaYawDraft(value);
            if (value !== "") {
              const parsed = Number(value);
              if (Number.isFinite(parsed)) {
                updateScene({ panoramaYaw: parsed });
              }
            }
          }}
        />
        <InspectorRangeNumberField
          label={t("scene.panoramaRadius")}
          rangeAriaLabel={t("scene.panoramaRadiusSlider")}
          numberAriaLabel={t("scene.panoramaRadiusValue")}
          max={PANORAMA_RADIUS_MAX}
          min={PANORAMA_RADIUS_MIN}
          step="1"
          value={panoramaRadiusDraft}
          onValueChange={commitPanoramaRadius}
          onRangeChange={commitPanoramaRadius}
          onNumberBlur={commitPanoramaRadius}
          onNumberChange={(value) => {
            setPanoramaRadiusDraft(value);
            if (value !== "") {
              const parsed = Number(value);
              if (Number.isFinite(parsed)) {
                updateScene({ panoramaRadius: parsed });
              }
            }
          }}
        />
      </InspectorSection>
      <InspectorSection title={t("scene.helpers")}>
        <div className="scene-switch-row" role="group" aria-label={t("scene.helpersAria")}>
          <div className="inspector-toggle-row">
            <input
              aria-label={t("scene.showLabels")}
              checked={scene.showLabels}
              type="checkbox"
              onChange={(event) => updateScene({ showLabels: event.target.checked })}
            />
            <span>{t("scene.showLabels")}</span>
          </div>
          <div className="inspector-toggle-row">
            <input
              aria-label={t("scene.snapToGrid")}
              checked={scene.snapToGrid}
              type="checkbox"
              onChange={(event) => updateScene({ snapToGrid: event.target.checked })}
            />
            <span>{t("scene.snapToGrid")}</span>
          </div>
          <div className="inspector-toggle-row">
            <input
              aria-label={t("scene.showGround")}
              checked={scene.showGround}
              type="checkbox"
              onChange={(event) => updateScene({ showGround: event.target.checked })}
            />
            <span>{t("scene.showGround")}</span>
          </div>
        </div>
      </InspectorSection>
      {scene.showGround ? (
        <InspectorSection title={t("scene.ground")}>
          <InspectorRangeNumberField
            label={t("scene.opacity")}
            rangeAriaLabel={t("scene.opacitySlider")}
            numberAriaLabel={t("scene.opacityValue")}
            max="1"
            min="0"
            step="0.01"
            value={scene.groundOpacity}
            onValueChange={(value) => updateScene({ groundOpacity: Number(value) })}
          />
          <InspectorRangeNumberField
            label={t("scene.height")}
            rangeAriaLabel={t("scene.heightSlider")}
            numberAriaLabel={t("scene.heightValue")}
            max={GROUND_HEIGHT_MAX}
            min={GROUND_HEIGHT_MIN}
            step="0.1"
            value={groundHeightDraft}
            onValueChange={commitGroundHeight}
            onRangeChange={commitGroundHeight}
            onNumberBlur={commitGroundHeight}
            onNumberChange={(value) => {
              setGroundHeightDraft(value);
              if (value !== "") {
                const parsed = Number(value);
                if (Number.isFinite(parsed)) {
                  updateScene({ groundHeight: parsed });
                }
              }
            }}
          />
        </InspectorSection>
      ) : null}
    </InspectorPanel>
  );
}
