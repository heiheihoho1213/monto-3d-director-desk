import { useMemo, useState } from "react";
import {
  InspectorAxisGroup,
  InspectorColorField,
  InspectorPanel,
  InspectorRangeNumberField,
  InspectorTextField,
  InspectorSection,
} from "./InspectorControls";
import { useT, type Translator } from "../../i18n";
import { MANNEQUIN_POSE_PRESETS } from "../presets/mannequinPosePresets";
import { getCrowdAnchorTransform, useDirectorStore } from "../store/directorStore";

function replaceAxis(tuple: [number, number, number], axis: 0 | 1 | 2, value: number): [number, number, number] {
  return tuple.map((item, index) => (index === axis ? value : item)) as [number, number, number];
}

function posePresetLabel(t: Translator, id: string, fallback: string) {
  const key = id.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
  const path = `pose.${key}`;
  const translated = t(path);
  return translated === path ? fallback : translated;
}

export function CharacterPanel() {
  const t = useT();
  const [activeTab, setActiveTab] = useState<"properties" | "pose">("properties");
  const selectedCrowdId = useDirectorStore((state) => state.selectedCrowdId);
  const selectedObjectId = useDirectorStore((state) => state.selectedObjectId);
  const objects = useDirectorStore((state) => state.project.objects);
  const updateObjectName = useDirectorStore((state) => state.updateObjectName);
  const updateCrowdLabel = useDirectorStore((state) => state.updateCrowdLabel);
  const updateObjectTransform = useDirectorStore((state) => state.updateObjectTransform);
  const updateCrowdTransform = useDirectorStore((state) => state.updateCrowdTransform);
  const updateUniformScale = useDirectorStore((state) => state.updateUniformScale);
  const updateCrowdUniformScale = useDirectorStore((state) => state.updateCrowdUniformScale);
  const updateObjectColor = useDirectorStore((state) => state.updateObjectColor);
  const updateCrowdColor = useDirectorStore((state) => state.updateCrowdColor);
  const applyPosePreset = useDirectorStore((state) => state.applyPosePreset);
  const applyCrowdPosePreset = useDirectorStore((state) => state.applyCrowdPosePreset);
  const updatePoseControl = useDirectorStore((state) => state.updatePoseControl);
  const updateCrowdPoseControl = useDirectorStore((state) => state.updateCrowdPoseControl);

  const selection = useMemo(() => {
    const role = objects.find((item) => item.id === selectedObjectId && item.kind === "character");

    if (selectedCrowdId) {
      const crowdMembers = objects.filter((item) => item.kind === "character" && item.crowdId === selectedCrowdId);
      const crowdAnchor = getCrowdAnchorTransform(objects, selectedCrowdId);

      if (crowdMembers.length && crowdAnchor) {
        return {
          mode: "crowd" as const,
          crowdId: selectedCrowdId,
          crowdMembers,
          crowdAnchor,
          role: crowdMembers[crowdMembers.length - 1] ?? crowdMembers[0],
          name: crowdMembers[0]?.crowdLabel ?? t("objectTree.crowds"),
          color: crowdMembers[0]?.color ?? "#4F8EF7",
        };
      }
    }

    if (!role) return null;

    return {
      mode: "single" as const,
      crowdId: null,
      crowdMembers: [role],
      crowdAnchor: role.transform,
      role,
      name: role.name,
      color: role.color ?? "#4F8EF7",
    };
  }, [objects, selectedCrowdId, selectedObjectId, t]);

  if (!selection) return null;

  const role = selection.role;
  const roleColor = selection.color;
  const transform = selection.crowdAnchor;
  const isCrowd = selection.mode === "crowd";
  const poseGroups = [
    {
      title: t("poseControl.body"),
      controls: [
        { key: "body.pitch", label: t("poseControl.lean") },
        { key: "body.yaw", label: t("poseControl.turn") },
        { key: "body.roll", label: t("poseControl.sideLean") },
      ],
    },
    {
      title: t("poseControl.torso"),
      controls: [
        { key: "torso.pitch", label: t("poseControl.lean") },
        { key: "torso.yaw", label: t("poseControl.twist") },
        { key: "torso.roll", label: t("poseControl.sideLean") },
      ],
    },
    {
      title: t("poseControl.head"),
      controls: [
        { key: "head.pitch", label: t("poseControl.nod") },
        { key: "head.yaw", label: t("poseControl.headTurn") },
        { key: "head.roll", label: t("poseControl.headTilt") },
      ],
    },
    {
      title: t("poseControl.leftShoulder"),
      controls: [
        { key: "leftShoulder.pitch", label: t("poseControl.raise") },
        { key: "leftShoulder.spread", label: t("poseControl.spread") },
        { key: "leftShoulder.twist", label: t("poseControl.twist") },
      ],
    },
    {
      title: t("poseControl.rightShoulder"),
      controls: [
        { key: "rightShoulder.pitch", label: t("poseControl.raise") },
        { key: "rightShoulder.spread", label: t("poseControl.spread") },
        { key: "rightShoulder.twist", label: t("poseControl.twist") },
      ],
    },
    {
      title: t("poseControl.leftElbow"),
      controls: [{ key: "leftElbow.bend", label: t("poseControl.bend") }],
    },
    {
      title: t("poseControl.rightElbow"),
      controls: [{ key: "rightElbow.bend", label: t("poseControl.bend") }],
    },
    {
      title: t("poseControl.leftHip"),
      controls: [
        { key: "leftHip.pitch", label: t("poseControl.lift") },
        { key: "leftHip.spread", label: t("poseControl.spread") },
        { key: "leftHip.twist", label: t("poseControl.twist") },
      ],
    },
    {
      title: t("poseControl.rightHip"),
      controls: [
        { key: "rightHip.pitch", label: t("poseControl.lift") },
        { key: "rightHip.spread", label: t("poseControl.spread") },
        { key: "rightHip.twist", label: t("poseControl.twist") },
      ],
    },
    {
      title: t("poseControl.leftKnee"),
      controls: [{ key: "leftKnee.bend", label: t("poseControl.bend") }],
    },
    {
      title: t("poseControl.rightKnee"),
      controls: [{ key: "rightKnee.bend", label: t("poseControl.bend") }],
    },
  ];

  return (
    <InspectorPanel
      title={t("character.title")}
      ariaLabel={t("character.aria")}
      className="character-inspector"
      tabs={[
        { label: t("common.properties"), active: activeTab === "properties", onClick: () => setActiveTab("properties") },
        { label: t("common.pose"), active: activeTab === "pose", onClick: () => setActiveTab("pose") },
      ]}
    >
      {activeTab === "properties" ? (
        <>
          <InspectorTextField
            label={t("common.name")}
            ariaLabel={t("character.name")}
            value={selection.name}
            onChange={(value) => {
              if (isCrowd && selection.crowdId) {
                updateCrowdLabel(selection.crowdId, value);
                return;
              }

              updateObjectName(role.id, value);
            }}
          />
          <InspectorAxisGroup
            label={t("common.position")}
            axes={[
              {
                axis: "X",
                ariaLabel: t("character.posX"),
                value: transform.position[0],
                onChange: (value) =>
                  isCrowd && selection.crowdId
                    ? updateCrowdTransform(selection.crowdId, {
                        position: replaceAxis(transform.position, 0, Number(value)),
                      })
                    : updateObjectTransform(role.id, {
                        position: replaceAxis(transform.position, 0, Number(value)),
                      }),
              },
              {
                axis: "Y",
                ariaLabel: t("character.posY"),
                value: transform.position[1],
                onChange: (value) =>
                  isCrowd && selection.crowdId
                    ? updateCrowdTransform(selection.crowdId, {
                        position: replaceAxis(transform.position, 1, Number(value)),
                      })
                    : updateObjectTransform(role.id, {
                        position: replaceAxis(transform.position, 1, Number(value)),
                      }),
              },
              {
                axis: "Z",
                ariaLabel: t("character.posZ"),
                value: transform.position[2],
                onChange: (value) =>
                  isCrowd && selection.crowdId
                    ? updateCrowdTransform(selection.crowdId, {
                        position: replaceAxis(transform.position, 2, Number(value)),
                      })
                    : updateObjectTransform(role.id, {
                        position: replaceAxis(transform.position, 2, Number(value)),
                      }),
              },
            ]}
          />
          <InspectorAxisGroup
            label={t("common.rotation")}
            axes={[
              {
                axis: "X",
                ariaLabel: t("character.rotX"),
                value: transform.rotation[0],
                onChange: (value) =>
                  isCrowd && selection.crowdId
                    ? updateCrowdTransform(selection.crowdId, {
                        rotation: replaceAxis(transform.rotation, 0, Number(value)),
                      })
                    : updateObjectTransform(role.id, {
                        rotation: replaceAxis(transform.rotation, 0, Number(value)),
                      }),
              },
              {
                axis: "Y",
                ariaLabel: t("character.rotY"),
                value: transform.rotation[1],
                onChange: (value) =>
                  isCrowd && selection.crowdId
                    ? updateCrowdTransform(selection.crowdId, {
                        rotation: replaceAxis(transform.rotation, 1, Number(value)),
                      })
                    : updateObjectTransform(role.id, {
                        rotation: replaceAxis(transform.rotation, 1, Number(value)),
                      }),
              },
              {
                axis: "Z",
                ariaLabel: t("character.rotZ"),
                value: transform.rotation[2],
                onChange: (value) =>
                  isCrowd && selection.crowdId
                    ? updateCrowdTransform(selection.crowdId, {
                        rotation: replaceAxis(transform.rotation, 2, Number(value)),
                      })
                    : updateObjectTransform(role.id, {
                        rotation: replaceAxis(transform.rotation, 2, Number(value)),
                      }),
              },
            ]}
          />
          <InspectorAxisGroup
            label={t("common.scale")}
            axes={[
              {
                axis: "X",
                ariaLabel: t("character.scaleX"),
                value: transform.scale[0],
                onChange: (value) =>
                  isCrowd && selection.crowdId
                    ? updateCrowdTransform(selection.crowdId, {
                        scale: replaceAxis(transform.scale, 0, Number(value)),
                      })
                    : updateObjectTransform(role.id, {
                        scale: replaceAxis(transform.scale, 0, Number(value)),
                      }),
              },
              {
                axis: "Y",
                ariaLabel: t("character.scaleY"),
                value: transform.scale[1],
                onChange: (value) =>
                  isCrowd && selection.crowdId
                    ? updateCrowdTransform(selection.crowdId, {
                        scale: replaceAxis(transform.scale, 1, Number(value)),
                      })
                    : updateObjectTransform(role.id, {
                        scale: replaceAxis(transform.scale, 1, Number(value)),
                      }),
              },
              {
                axis: "Z",
                ariaLabel: t("character.scaleZ"),
                value: transform.scale[2],
                onChange: (value) =>
                  isCrowd && selection.crowdId
                    ? updateCrowdTransform(selection.crowdId, {
                        scale: replaceAxis(transform.scale, 2, Number(value)),
                      })
                    : updateObjectTransform(role.id, {
                        scale: replaceAxis(transform.scale, 2, Number(value)),
                      }),
              },
            ]}
          />
          <InspectorRangeNumberField
            label={t("common.uniformScale")}
            rangeAriaLabel={t("character.uniformScaleSlider")}
            numberAriaLabel={t("character.uniformScale")}
            max="3"
            min="0.2"
            step="0.1"
            value={transform.scale[0]}
            onValueChange={(value) =>
              isCrowd && selection.crowdId
                ? updateCrowdUniformScale(selection.crowdId, Number(value))
                : updateUniformScale(role.id, Number(value))
            }
          />
          <InspectorColorField
            label={t("common.color")}
            colorAriaLabel={t("character.color")}
            hexAriaLabel={t("character.colorHex")}
            value={roleColor}
            onColorChange={(value) =>
              isCrowd && selection.crowdId ? updateCrowdColor(selection.crowdId, value) : updateObjectColor(role.id, value)
            }
            onHexChange={(value) =>
              isCrowd && selection.crowdId ? updateCrowdColor(selection.crowdId, value) : updateObjectColor(role.id, value)
            }
          />
        </>
      ) : (
        <InspectorSection title={t("character.posePresets")} className="pose-preset-section">
          {role.characterRig ? (
            <>
              <div className="preset-grid">
                {MANNEQUIN_POSE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    className={role.characterRig?.posePresetId === preset.id ? "is-active" : undefined}
                    type="button"
                    onClick={() =>
                      isCrowd && selection.crowdId
                        ? applyCrowdPosePreset(selection.crowdId, preset.id)
                        : applyPosePreset(role.id, preset.id)
                    }
                  >
                    {posePresetLabel(t, preset.id, preset.label)}
                  </button>
                ))}
              </div>
              <InspectorSection title={t("character.poseAdjust")} className="pose-adjust-section">
                <div className="pose-groups">
                  {poseGroups.map((group) => (
                    <section key={group.title} className="pose-group">
                      <h4>{group.title}</h4>
                      {group.controls.map((control) => (
                        <InspectorRangeNumberField
                          key={control.key}
                          label={control.label}
                          rangeAriaLabel={t("poseControl.sliderAria", { group: group.title, label: control.label })}
                          numberAriaLabel={t("poseControl.valueAria", { group: group.title, label: control.label })}
                          max="90"
                          min="-90"
                          step="1"
                          value={role.characterRig?.controls[control.key] ?? 0}
                          onValueChange={(value) =>
                            isCrowd && selection.crowdId
                              ? updateCrowdPoseControl(selection.crowdId, control.key, Number(value))
                              : updatePoseControl(role.id, control.key, Number(value))
                          }
                        />
                      ))}
                    </section>
                  ))}
                </div>
              </InspectorSection>
            </>
          ) : (
            <p>{t("character.poseUnsupported")}</p>
          )}
        </InspectorSection>
      )}
    </InspectorPanel>
  );
}
