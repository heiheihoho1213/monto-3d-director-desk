import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dataUrlToCaptureFile,
  resolveCaptureStorageUrls,
  setCaptureUploadHandler,
  type DirectorDeskUploadCaptures,
} from "./captureUpload";
import type { ScreenshotResult } from "./screenshotExport";

const sampleResult: ScreenshotResult = {
  label: "当前视角",
  dataUrl: "data:image/png;base64,abc",
  meta: {
    mode: "director",
    cameraId: null,
    fov: 45,
    position: [0, 1, 5],
    target: [0, 1.2, 0],
  },
};

afterEach(() => {
  setCaptureUploadHandler(null);
  vi.restoreAllMocks();
});

it("keeps PNG data URLs when no upload handler is configured", async () => {
  await expect(resolveCaptureStorageUrls([sampleResult], null)).resolves.toEqual([sampleResult.dataUrl]);
});

it("uploads capture files and stores returned URLs", async () => {
  const uploadCaptures: DirectorDeskUploadCaptures = vi.fn(async (files) =>
    files.map((file, index) => `https://cdn.example.com/${index}-${file.name}`)
  );

  const urls = await resolveCaptureStorageUrls([sampleResult], uploadCaptures);

  expect(uploadCaptures).toHaveBeenCalledTimes(1);
  expect(uploadCaptures.mock.calls[0]?.[0]).toHaveLength(1);
  expect(uploadCaptures.mock.calls[0]?.[0][0]?.name).toMatch(/\.png$/);
  expect(urls).toEqual(["https://cdn.example.com/0-monto-director-desk-director-当前视角-1.png"]);
});

it("rejects invalid upload responses", async () => {
  const uploadCaptures: DirectorDeskUploadCaptures = async () => ["https://cdn.example.com/only-one.png"];

  await expect(resolveCaptureStorageUrls([sampleResult, sampleResult], uploadCaptures)).rejects.toThrow(
    "CAPTURE_UPLOAD_INVALID_URLS"
  );
});

it("converts data URLs to PNG files", async () => {
  const file = await dataUrlToCaptureFile("data:image/png;base64,abc", "capture.png");
  expect(file.name).toBe("capture.png");
  expect(file.type).toBe("image/png");
});
