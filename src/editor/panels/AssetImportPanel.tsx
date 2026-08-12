import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useT } from "../../i18n";
import { readLocalModelFile } from "../loaders/localModelImport";
import { useModelUpload } from "../io/modelUploadContext";
import { readPanoramaFile } from "../loaders/panoramaImport";
import { useDirectorStore } from "../store/directorStore";

export function AssetImportPanel() {
  const t = useT();
  const addImportedAsset = useDirectorStore((state) => state.addImportedAsset);
  const uploadModel = useModelUpload();
  const assets = useDirectorStore((state) => state.project.assets);
  const panoramaAssetId = useDirectorStore((state) => state.project.panoramaAssetId);
  const panoramaImportLocked = useDirectorStore((state) => state.panoramaImportLocked);
  const [importError, setImportError] = useState<string | null>(null);
  const [modelImporting, setModelImporting] = useState(false);

  const latestLocalModel = [...assets].reverse().find((item) => item.kind !== "panorama");
  const panoramaAsset = assets.find((item) => item.id === panoramaAssetId);

  async function handleLocalModel(file: File) {
    setImportError(null);
    setModelImporting(true);
    try {
      const result = await readLocalModelFile(file, { uploadModel });
      addImportedAsset({ kind: "prop", ...result });
    } finally {
      setModelImporting(false);
    }
  }

  async function handlePanorama(file: File) {
    if (panoramaImportLocked) return;
    setImportError(null);
    const result = await readPanoramaFile(file);
    addImportedAsset({ kind: "panorama", ...result });
  }

  return (
    <section className="panel-card">
      <h2>{t("assetImport.title")}</h2>
      <label className={`asset-import-item${modelImporting ? " is-loading" : ""}`}>
        {modelImporting ? (
          <span className="asset-import-loading-label">
            <Loader2 aria-hidden="true" className="model-import-spinner" size={14} strokeWidth={2} />
            {t("assetImport.importing")}
          </span>
        ) : (
          t("assetImport.importLocalModel")
        )}
        <input
          aria-busy={modelImporting}
          aria-label={t("assetImport.importLocalModel")}
          accept=".fbx,.obj"
          disabled={modelImporting}
          type="file"
          onChange={async (event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            if (!file) return;
            try {
              await handleLocalModel(file);
            } catch (error) {
              setImportError(error instanceof Error ? error.message : t("assetImport.modelFailed"));
            } finally {
              input.value = "";
            }
          }}
        />
        <p className="asset-import-status">
          {modelImporting
            ? t("assetImport.importingHint")
            : latestLocalModel
              ? t("assetImport.importedModel", { name: latestLocalModel.fileName })
              : t("assetImport.supportModels")}
        </p>
      </label>
      <label className={`asset-import-item${panoramaImportLocked ? " is-disabled" : ""}`}>
        {t("assetImport.importPanorama")}
        <input
          aria-label={t("assetImport.importPanorama")}
          accept=".jpg,.jpeg,.png,.webp"
          disabled={panoramaImportLocked}
          type="file"
          onChange={async (event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            if (!file) return;
            try {
              await handlePanorama(file);
            } catch (error) {
              setImportError(error instanceof Error ? error.message : t("assetImport.panoramaFailed"));
            } finally {
              input.value = "";
            }
          }}
        />
        <p className="asset-import-status">
          {panoramaImportLocked
            ? t("assetImport.panoramaLocked")
            : panoramaAsset
              ? t("assetImport.importedPanorama", { name: panoramaAsset.fileName })
              : t("assetImport.supportPanorama")}
        </p>
      </label>
      {importError ? <p className="capture-status">{importError}</p> : null}
    </section>
  );
}
