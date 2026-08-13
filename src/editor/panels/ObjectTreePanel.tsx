import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { Box, Camera, ChevronDown, ChevronRight, Eye, EyeOff, Lock, Search, Unlock, User, Users } from "lucide-react";
import { useT } from "../../i18n";
import type { DirectorObject } from "../schema/directorProject";
import { resolveSelectedObjectIds } from "../store/directorSelectors";
import { useDirectorStore } from "../store/directorStore";

type SceneTreePreviewItem = {
  id: string;
  name: string;
  icon: ObjectTreeIconKind;
};

type SceneTreeItem = {
  id: string;
  name: string;
  icon: ObjectTreeIconKind;
  object?: DirectorObject;
  objectIds: string[];
  crowdId?: string;
  previewChildren?: SceneTreePreviewItem[];
};

type ObjectTreeIconKind = "character" | "crowd" | "geometry" | "model" | "camera";

function ObjectKindIcon({ icon }: { icon: ObjectTreeIconKind }) {
  const iconProps = { "aria-hidden": true, size: 16, strokeWidth: 1.8 } as const;

  return (
    <span className="object-row-kind-icon" data-testid={`object-row-icon-${icon}`}>
      {icon === "camera" ? <Camera {...iconProps} /> : null}
      {icon === "crowd" ? <Users {...iconProps} /> : null}
      {icon === "geometry" || icon === "model" ? <Box {...iconProps} /> : null}
      {icon === "character" ? <User {...iconProps} /> : null}
    </span>
  );
}

function isEditableKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function ObjectTreePanel() {
  const t = useT();
  const [query, setQuery] = useState("");
  const [expandedCrowdIds, setExpandedCrowdIds] = useState<string[]>([]);
  const assets = useDirectorStore((state) => state.project.assets);
  const objects = useDirectorStore((state) => state.project.objects);
  const selectedObjectId = useDirectorStore((state) => state.selectedObjectId);
  const selectedObjectIds = useDirectorStore((state) => state.selectedObjectIds);
  const selectedCrowdId = useDirectorStore((state) => state.selectedCrowdId);
  const resolvedSelectedObjectIds = useMemo(
    () => resolveSelectedObjectIds({ selectedObjectId, selectedObjectIds, project: { objects } }),
    [objects, selectedObjectId, selectedObjectIds]
  );
  const viewMode = useDirectorStore((state) => state.viewMode);
  const selectObject = useDirectorStore((state) => state.selectObject);
  const selectCrowd = useDirectorStore((state) => state.selectCrowd);
  const toggleObjectSelection = useDirectorStore((state) => state.toggleObjectSelection);
  const toggleObjectVisible = useDirectorStore((state) => state.toggleObjectVisible);
  const toggleObjectLocked = useDirectorStore((state) => state.toggleObjectLocked);
  const deleteSelectedObject = useDirectorStore((state) => state.deleteSelectedObject);
  const canEditSceneObjects = viewMode === "director";

  const groupLabels = useMemo(
    () => [
      { key: "characters", title: t("objectTree.characters") },
      { key: "crowd", title: t("objectTree.crowds") },
      { key: "geometry", title: t("objectTree.geometry") },
      { key: "my-models", title: t("objectTree.myModels") },
      { key: "cameras", title: t("objectTree.cameras") },
    ],
    [t]
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (isEditableKeyboardTarget(event.target)) return;
      const state = useDirectorStore.getState();
      const selectedIds =
        state.selectedObjectIds.length > 0
          ? state.selectedObjectIds
          : state.selectedObjectId
            ? [state.selectedObjectId]
            : [];
      if (!selectedIds.length) return;

      const selectedObjects = state.project.objects.filter((item) => selectedIds.includes(item.id));
      if (!selectedObjects.length) return;

      if (state.viewMode === "camera") {
        if (selectedObjects.some((item) => item.kind !== "camera")) return;
      } else if (state.viewMode !== "director") {
        return;
      }

      const deletingCameraCount = selectedObjects.filter(
        (item) => item.kind === "camera" && item.linkedCameraId
      ).length;
      if (deletingCameraCount > 0 && state.project.cameras.length - deletingCameraCount < 1) return;

      event.preventDefault();
      deleteSelectedObject();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [deleteSelectedObject]);

  const assetsById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const isModelBackedObject = (object: DirectorObject | undefined) => {
    if (!object?.assetRefId) return false;

    const asset = assetsById.get(object.assetRefId);
    return !asset || asset.sourceType === "model";
  };

  const groupedItems = useMemo(() => {
    const crowdItems = new Map<string, SceneTreeItem>();
    const regularItems: SceneTreeItem[] = [];

    objects.forEach((object) => {
      if (object.kind === "character" && object.crowdId && object.crowdLabel) {
        const existing = crowdItems.get(object.crowdId);
        if (existing) {
          existing.objectIds.push(object.id);
          existing.previewChildren = [
            ...(existing.previewChildren ?? []),
            {
              id: object.id,
              name: object.name,
              icon: "character",
            },
          ];
          return;
        }

        crowdItems.set(object.crowdId, {
          id: object.crowdId,
          name: object.crowdLabel,
          icon: "crowd",
          crowdId: object.crowdId,
          objectIds: [object.id],
          previewChildren: [
            {
              id: object.id,
              name: object.name,
              icon: "character",
            },
          ],
        });
        return;
      }

      regularItems.push({
        id: object.id,
        name: object.name,
        icon:
          object.kind === "camera"
            ? "camera"
            : object.kind === "character"
              ? "character"
              : isModelBackedObject(object)
                ? "model"
                : "geometry",
        object,
        objectIds: [object.id],
      });
    });

    return {
      characters: regularItems.filter((item) => item.object?.kind === "character"),
      crowd: Array.from(crowdItems.values()),
      geometry: regularItems.filter(
        (item) =>
          (item.object?.kind === "scene" && !isModelBackedObject(item.object)) ||
          (item.object?.kind === "prop" && !item.object?.assetRefId)
      ),
      myModels: regularItems.filter((item) => isModelBackedObject(item.object)),
      cameras: regularItems.filter((item) => item.object?.kind === "camera"),
    };
  }, [objects, assetsById]);

  useEffect(() => {
    const crowdIds = new Set(groupedItems.crowd.map((item) => item.id));
    setExpandedCrowdIds((current) => current.filter((crowdId) => crowdIds.has(crowdId)));
  }, [groupedItems.crowd]);

  const filteredGroups = groupLabels.map((group) => {
    const itemsByGroup =
      group.key === "characters"
        ? groupedItems.characters
        : group.key === "crowd"
          ? groupedItems.crowd
          : group.key === "geometry"
            ? groupedItems.geometry
            : group.key === "my-models"
              ? groupedItems.myModels
              : groupedItems.cameras;

    const filteredItems = itemsByGroup
      .map((item) => {
        if (!query.trim()) return item;

        const matchedPreviewChildren = item.previewChildren?.filter((child) => child.name.includes(query)) ?? [];
        if (!item.name.includes(query) && matchedPreviewChildren.length === 0) return null;

        return matchedPreviewChildren.length
          ? {
              ...item,
              previewChildren: matchedPreviewChildren,
            }
          : item;
      })
      .filter((item): item is SceneTreeItem => Boolean(item));

    return {
      ...group,
      items: filteredItems,
    };
  }).filter((group) => group.items.length > 0);
  const hasEmptySearchResult = query.trim().length > 0 && filteredGroups.length === 0;

  function selectTreeItem(item: SceneTreeItem, event: MouseEvent<HTMLElement>) {
    // Both view modes select in place; view switches only via the top toggle.
    if (item.crowdId) {
      const selectedIds = getSelectedIds();

      if (canEditSceneObjects && event.shiftKey) {
        const allSelected = item.objectIds.every((id) => selectedIds.includes(id));

        if (allSelected) {
          item.objectIds.forEach((id) => {
            if (getSelectedIds().includes(id)) {
              toggleObjectSelection(id);
            }
          });
          return;
        }

        item.objectIds.forEach((id) => {
          if (!getSelectedIds().includes(id)) {
            toggleObjectSelection(id);
          }
        });
        return;
      }

      selectCrowd(item.crowdId);
      return;
    }

    if (item.objectIds.length > 1) {
      const selectedIds = getSelectedIds();

      if (canEditSceneObjects && event.shiftKey) {
        const allSelected = item.objectIds.every((id) => selectedIds.includes(id));

        if (allSelected) {
          item.objectIds.forEach((id) => {
            if (getSelectedIds().includes(id)) {
              toggleObjectSelection(id);
            }
          });
          return;
        }

        item.objectIds.forEach((id) => {
          if (!getSelectedIds().includes(id)) {
            toggleObjectSelection(id);
          }
        });
        return;
      }

      const [firstId, ...restIds] = item.objectIds;
      selectObject(firstId ?? null);
      restIds.forEach((id) => toggleObjectSelection(id));
      return;
    }

    if (canEditSceneObjects && event.shiftKey) {
      toggleObjectSelection(item.id);
      return;
    }

    selectObject(item.id);
  }

  function toggleCrowdExpanded(crowdId: string) {
    setExpandedCrowdIds((current) =>
      current.includes(crowdId) ? current.filter((item) => item !== crowdId) : [...current, crowdId]
    );
  }

  function getSelectedIds() {
    return resolvedSelectedObjectIds;
  }

  return (
    <section className="panel-card object-tree-panel">
      <h2 className="visually-hidden">{t("objectTree.title")}</h2>
      <label className="object-search-field">
        <Search aria-hidden="true" size={16} strokeWidth={1.8} />
        <input
          className="ui-field"
          aria-label={t("objectTree.searchAria")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("objectTree.searchPlaceholder")}
        />
      </label>
      {hasEmptySearchResult ? (
        <div className="object-search-empty-state" role="status" aria-label={t("objectTree.searchEmpty")}>
          <span className="object-search-empty-icon" data-testid="object-search-empty-icon">
            <Search aria-hidden="true" size={16} strokeWidth={1.8} />
          </span>
          <span>{t("objectTree.searchEmpty")}</span>
        </div>
      ) : (
        <div className="object-tree-groups" role="tree" aria-label={t("objectTree.listAria")}>
          {filteredGroups.map((group) => (
            <section
              key={group.key}
              className="object-tree-group"
              role="group"
              aria-label={t("objectTree.groupAria", { title: group.title })}
            >
              <h3>{group.title}</h3>
              <ul className="object-list">
                {group.items.map((item) => {
                  const selected = item.crowdId
                    ? selectedCrowdId === item.crowdId ||
                      item.objectIds.every((id) => resolvedSelectedObjectIds.includes(id))
                    : item.objectIds.length > 1
                      ? item.objectIds.every((id) => resolvedSelectedObjectIds.includes(id))
                      : resolvedSelectedObjectIds.includes(item.id);
                  const expanded = item.crowdId ? expandedCrowdIds.includes(item.crowdId) : false;

                  return (
                    <li key={item.id} className="object-list-item">
                      <div
                        className={`object-row${selected ? " is-selected" : ""}${item.crowdId ? " object-row-crowd" : ""}`}
                        role="treeitem"
                        aria-label={item.name}
                        aria-selected={selected}
                        onClick={(event) => selectTreeItem(item, event)}
                      >
                        <div className="object-row-main">
                          {item.crowdId ? (
                            <button
                              aria-label={
                                expanded
                                  ? t("objectTree.collapse", { name: item.name })
                                  : t("objectTree.expand", { name: item.name })
                              }
                              className="object-row-toggle-button"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleCrowdExpanded(item.crowdId as string);
                              }}
                            >
                              {expanded ? (
                                <ChevronDown aria-hidden="true" size={14} strokeWidth={1.8} />
                              ) : (
                                <ChevronRight aria-hidden="true" size={14} strokeWidth={1.8} />
                              )}
                            </button>
                          ) : null}
                          <button className="object-select-button" type="button">
                            <ObjectKindIcon icon={item.icon} />
                            <span>{item.name}</span>
                          </button>
                        </div>
                        {item.object ? (
                          <>
                            <button
                              className="object-flag-button object-icon-flag-button"
                              type="button"
                              aria-label={t("objectTree.visibility", { name: item.name })}
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleObjectVisible(item.id);
                              }}
                            >
                              {item.object.visible ? (
                                <Eye aria-hidden="true" size={15} strokeWidth={1.8} />
                              ) : (
                                <EyeOff aria-hidden="true" size={15} strokeWidth={1.8} />
                              )}
                            </button>
                            <button
                              className="object-flag-button object-icon-flag-button"
                              type="button"
                              aria-label={
                                item.object.locked
                                  ? t("objectTree.unlock", { name: item.name })
                                  : t("objectTree.lock", { name: item.name })
                              }
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleObjectLocked(item.id);
                              }}
                            >
                              {item.object.locked ? (
                                <Lock aria-hidden="true" size={15} strokeWidth={1.8} />
                              ) : (
                                <Unlock aria-hidden="true" size={15} strokeWidth={1.8} />
                              )}
                            </button>
                          </>
                        ) : null}
                      </div>
                      {item.crowdId && expanded && item.previewChildren?.length ? (
                        <ul
                          className="object-crowd-preview-list"
                          aria-label={t("objectTree.membersPreview", { name: item.name })}
                        >
                          {item.previewChildren.map((child) => (
                            <li key={child.id}>
                              <div className={`object-row object-row-preview${selected ? " is-selected" : ""}`}>
                                <span className="object-row-preview-spacer" aria-hidden="true" />
                                <div className="object-row-main">
                                  <button
                                    className="object-select-button"
                                    type="button"
                                    onClick={(event) => selectTreeItem(item, event)}
                                  >
                                    <ObjectKindIcon icon={child.icon} />
                                    <span>{child.name}</span>
                                  </button>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
