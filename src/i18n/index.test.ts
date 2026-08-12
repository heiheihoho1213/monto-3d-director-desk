import { describe, expect, it } from "vitest";
import { createTranslator } from "./index";

describe("i18n translator", () => {
  it("returns Chinese chrome copy by default", () => {
    const t = createTranslator("zh");
    expect(t("chrome.directorView")).toBe("导演视角");
    expect(t("toolbar.importLocalModel")).toBe("导入本地模型");
  });

  it("returns English chrome copy when lang is en", () => {
    const t = createTranslator("en");
    expect(t("chrome.directorView")).toBe("Director View");
    expect(t("toolbar.importLocalModel")).toBe("Import local model");
  });

  it("interpolates variables", () => {
    const t = createTranslator("en");
    expect(t("toolbar.importingFile", { name: "chair.obj" })).toBe("Importing chair.obj…");
    expect(t("toolbar.importingProgress", { current: 2, total: 5 })).toBe("Importing models (2/5)…");
    expect(t("toolbar.captureProcessingBatch", { count: 12 })).toBe("Capturing (12)…");
    expect(t("toolbar.captureUploading")).toBe("Uploading captures…");
  });

  it("falls back to Chinese when a key is missing in English", () => {
    const t = createTranslator("en");
    expect(t("chrome.title")).toBe("3D Director Desk");
  });

  it("covers every mannequin pose preset id in both languages", async () => {
    const { MANNEQUIN_POSE_PRESETS } = await import("../editor/presets/mannequinPosePresets");
    const zh = createTranslator("zh");
    const en = createTranslator("en");

    for (const preset of MANNEQUIN_POSE_PRESETS) {
      const key = preset.id.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
      const path = `pose.${key}`;
      expect(zh(path), path).toBe(preset.label);
      expect(en(path), path).not.toBe(path);
      expect(en(path), path).not.toBe(preset.label);
    }
  });

  it("translates pose control group labels", () => {
    const zh = createTranslator("zh");
    const en = createTranslator("en");
    expect(zh("poseControl.body")).toBe("身体");
    expect(en("poseControl.body")).toBe("Body");
    expect(zh("poseControl.lean")).toBe("前倾");
    expect(en("poseControl.lean")).toBe("Lean");
    expect(en("poseControl.sliderAria", { group: "Body", label: "Lean" })).toBe("Body · Lean slider");
  });
});
