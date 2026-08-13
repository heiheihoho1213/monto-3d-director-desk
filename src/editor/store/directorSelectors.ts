import type { RightPanelKind } from "../schema/directorProject";
import type { DirectorState } from "./directorStore";

export function resolveSelectedObjectIds(state: {
  selectedObjectId: string | null;
  selectedObjectIds: string[];
  project: { objects: Array<{ id: string }> };
}): string[] {
  const objectIdSet = new Set(state.project.objects.map((item) => item.id));
  const validExplicitIds = state.selectedObjectIds.filter((id) => objectIdSet.has(id));
  const validPrimary =
    state.selectedObjectId && objectIdSet.has(state.selectedObjectId) ? state.selectedObjectId : null;

  if (validPrimary && validExplicitIds.length <= 1) {
    return [validPrimary];
  }

  if (validExplicitIds.length > 0) {
    return validExplicitIds;
  }

  if (validPrimary) {
    return [validPrimary];
  }

  return [];
}

export function resolvePrimarySelectedObjectId(state: {
  selectedObjectId: string | null;
  selectedObjectIds: string[];
  project: { objects: Array<{ id: string }> };
}): string | null {
  const resolved = resolveSelectedObjectIds(state);
  return resolved[resolved.length - 1] ?? null;
}

export function selectRightPanelKind(state: DirectorState): RightPanelKind {
  if (state.viewMode === "director" && state.directorInspectorMode === "scene") {
    return "scene";
  }

  if (state.selectedCrowdId) return "character";

  const selectedObjectId = resolvePrimarySelectedObjectId(state);
  const selected = state.project.objects.find((item) => item.id === selectedObjectId);
  const selectedAsset = selected?.assetRefId
    ? state.project.assets.find((asset) => asset.id === selected.assetRefId)
    : undefined;
  if (selected?.kind === "character") return "character";
  if (selected?.kind === "prop" || selectedAsset?.sourceType === "model") return "prop";
  if (selected?.kind === "camera") return "camera";

  // Camera view with no scene selection falls back to the active shot panel.
  if (state.viewMode === "camera") {
    return "camera";
  }

  return "scene";
}
