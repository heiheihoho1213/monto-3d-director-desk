import { createContext, useContext, useEffect, type ReactNode } from "react";
import { setCaptureUploadHandler, type DirectorDeskUploadCaptures } from "./captureUpload";

const CaptureUploadContext = createContext<DirectorDeskUploadCaptures | null>(null);

export function CaptureUploadProvider({
  uploadCaptures = null,
  children,
}: {
  uploadCaptures?: DirectorDeskUploadCaptures | null;
  children: ReactNode;
}) {
  useEffect(() => {
    setCaptureUploadHandler(uploadCaptures ?? null);
    return () => setCaptureUploadHandler(null);
  }, [uploadCaptures]);

  return <CaptureUploadContext.Provider value={uploadCaptures}>{children}</CaptureUploadContext.Provider>;
}

export function useCaptureUpload() {
  return useContext(CaptureUploadContext);
}
