import { createContext, useContext, type ReactNode } from "react";
import type { DirectorDeskUploadModel } from "../loaders/localModelImport";

const ModelUploadContext = createContext<DirectorDeskUploadModel | null>(null);

export function ModelUploadProvider({
  uploadModel = null,
  children,
}: {
  uploadModel?: DirectorDeskUploadModel | null;
  children: ReactNode;
}) {
  return <ModelUploadContext.Provider value={uploadModel}>{children}</ModelUploadContext.Provider>;
}

export function useModelUpload() {
  return useContext(ModelUploadContext);
}
