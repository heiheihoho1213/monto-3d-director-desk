import {
  InspectorAxisGroup,
  InspectorColorField,
  InspectorPanel,
  InspectorRangeNumberField,
  InspectorTextField,
} from "./InspectorControls";
import { useT } from "../../i18n";
import { useDirectorStore } from "../store/directorStore";

function replaceAxis(tuple: [number, number, number], axis: 0 | 1 | 2, value: number): [number, number, number] {
  return tuple.map((item, index) => (index === axis ? value : item)) as [number, number, number];
}

export function PropPanel() {
  const t = useT();
  const prop = useDirectorStore((state) => {
    const selected = state.project.objects.find((item) => item.id === state.selectedObjectId);
    const selectedAsset = selected?.assetRefId
      ? state.project.assets.find((asset) => asset.id === selected.assetRefId)
      : undefined;

    if (!selected) return undefined;
    if (selected.kind === "prop") return selected;
    if (selectedAsset?.sourceType === "model") return selected;

    return undefined;
  });
  const updateObjectName = useDirectorStore((state) => state.updateObjectName);
  const updateObjectTransform = useDirectorStore((state) => state.updateObjectTransform);
  const updateUniformScale = useDirectorStore((state) => state.updateUniformScale);
  const updateObjectColor = useDirectorStore((state) => state.updateObjectColor);

  if (!prop) return null;

  const propColor = prop.color ?? "#d7e7ff";

  return (
    <InspectorPanel title={t("prop.title")} ariaLabel={t("prop.aria")} className="prop-inspector">
      <InspectorTextField
        label={t("common.name")}
        ariaLabel={t("prop.name")}
        value={prop.name}
        onChange={(value) => updateObjectName(prop.id, value)}
      />
      <InspectorAxisGroup
        label={t("common.position")}
        axes={[
          {
            axis: "X",
            ariaLabel: t("prop.posX"),
            value: prop.transform.position[0],
            onChange: (value) => updateObjectTransform(prop.id, { position: replaceAxis(prop.transform.position, 0, Number(value)) }),
          },
          {
            axis: "Y",
            ariaLabel: t("prop.posY"),
            value: prop.transform.position[1],
            onChange: (value) => updateObjectTransform(prop.id, { position: replaceAxis(prop.transform.position, 1, Number(value)) }),
          },
          {
            axis: "Z",
            ariaLabel: t("prop.posZ"),
            value: prop.transform.position[2],
            onChange: (value) => updateObjectTransform(prop.id, { position: replaceAxis(prop.transform.position, 2, Number(value)) }),
          },
        ]}
      />
      <InspectorAxisGroup
        label={t("common.rotation")}
        axes={[
          {
            axis: "X",
            ariaLabel: t("prop.rotX"),
            value: prop.transform.rotation[0],
            onChange: (value) => updateObjectTransform(prop.id, { rotation: replaceAxis(prop.transform.rotation, 0, Number(value)) }),
          },
          {
            axis: "Y",
            ariaLabel: t("prop.rotY"),
            value: prop.transform.rotation[1],
            onChange: (value) => updateObjectTransform(prop.id, { rotation: replaceAxis(prop.transform.rotation, 1, Number(value)) }),
          },
          {
            axis: "Z",
            ariaLabel: t("prop.rotZ"),
            value: prop.transform.rotation[2],
            onChange: (value) => updateObjectTransform(prop.id, { rotation: replaceAxis(prop.transform.rotation, 2, Number(value)) }),
          },
        ]}
      />
      <InspectorAxisGroup
        label={t("common.scale")}
        axes={[
          {
            axis: "X",
            ariaLabel: t("prop.scaleX"),
            value: prop.transform.scale[0],
            onChange: (value) => updateObjectTransform(prop.id, { scale: replaceAxis(prop.transform.scale, 0, Number(value)) }),
          },
          {
            axis: "Y",
            ariaLabel: t("prop.scaleY"),
            value: prop.transform.scale[1],
            onChange: (value) => updateObjectTransform(prop.id, { scale: replaceAxis(prop.transform.scale, 1, Number(value)) }),
          },
          {
            axis: "Z",
            ariaLabel: t("prop.scaleZ"),
            value: prop.transform.scale[2],
            onChange: (value) => updateObjectTransform(prop.id, { scale: replaceAxis(prop.transform.scale, 2, Number(value)) }),
          },
        ]}
      />
      <InspectorRangeNumberField
        label={t("common.uniformScale")}
        rangeAriaLabel={t("prop.uniformScaleSlider")}
        numberAriaLabel={t("prop.uniformScale")}
        max="3"
        min="0.2"
        step="0.1"
        value={prop.transform.scale[0]}
        onValueChange={(value) => updateUniformScale(prop.id, Number(value))}
      />
      <InspectorColorField
        label={t("common.color")}
        colorAriaLabel={t("prop.color")}
        hexAriaLabel={t("prop.colorHex")}
        value={propColor}
        onColorChange={(value) => updateObjectColor(prop.id, value)}
        onHexChange={(value) => updateObjectColor(prop.id, value)}
      />
    </InspectorPanel>
  );
}
