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
  });

  it("falls back to Chinese when a key is missing in English", () => {
    const t = createTranslator("en");
    expect(t("chrome.title")).toBe("3D Director Desk");
  });
});
