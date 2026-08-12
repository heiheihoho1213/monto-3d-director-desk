import { beforeEach, expect, it, vi } from "vitest";
import { createInitialDirectorState, useDirectorStore } from "../store/directorStore";
import {
  captureCameraShot,
  captureCurrentView,
  captureFromViewportToolbar,
  mapScreenshotResults,
} from "./directorDeskCaptureApi";
import {
  clearViewportCaptureHandler,
  setViewportCameraSnapshotProvider,
  setViewportCaptureHandler,
} from "./captureBridge";
import { setCaptureUploadHandler } from "./captureUpload";

beforeEach(() => {
  clearViewportCaptureHandler();
  setViewportCameraSnapshotProvider(null);
  setCaptureUploadHandler(null);
  useDirectorStore.setState({
    ...useDirectorStore.getState(),
    ...createInitialDirectorState(),
  });
});

it("maps screenshot results to public capture payloads with file names", () => {
  const mapped = mapScreenshotResults([
    {
      label: "当前视角",
      dataUrl: "data:image/png;base64,abc",
      meta: {
        mode: "director",
        cameraId: null,
        fov: 50,
        position: [0, 1, 2],
        target: [0, 0, 0],
      },
    },
  ]);

  expect(mapped[0]?.fileName).toMatch(/monto-director-desk-director-当前视角-1\.png/);
});

it("captures the current viewport through the registered handler", async () => {
  const handler = vi.fn(async () => [
    {
      label: "当前视角",
      dataUrl: "data:image/png;base64,abc",
      meta: {
        mode: "director" as const,
        cameraId: null,
        fov: 50,
        position: [0, 1, 2] as [number, number, number],
        target: [0, 0, 0] as [number, number, number],
      },
    },
  ]);
  setViewportCaptureHandler(handler);

  const results = await captureCurrentView();
  expect(handler).toHaveBeenCalledWith({
    preset: "current",
    source: "capture-panel",
    cameraId: null,
  });
  expect(results[0]?.dataUrl).toBe("data:image/png;base64,abc");
});

it("captures from the active camera rig", async () => {
  const handler = vi.fn(async () => [
    {
      label: "当前机位",
      dataUrl: "data:image/png;base64,cam",
      meta: {
        mode: "camera" as const,
        cameraId: "cam_1",
        fov: 45,
        position: [1, 2, 3] as [number, number, number],
        target: [0, 1, 0] as [number, number, number],
      },
    },
  ]);
  setViewportCaptureHandler(handler);

  const results = await captureCameraShot("cam_1", { saveToProject: true });
  expect(handler).toHaveBeenCalledWith({
    preset: "current",
    source: "camera-panel",
    cameraId: "cam_1",
  });
  expect(useDirectorStore.getState().project.cameras[0]?.captures?.[0]?.dataUrl).toBe("data:image/png;base64,cam");
  expect(results[0]?.label).toBe("当前机位");
});

it("matches viewport toolbar capture by creating a camera and saving captures", async () => {
  setViewportCameraSnapshotProvider(() => ({
    fov: 50,
    position: [0, 2, 6],
    target: [0, 1, 0],
  }));
  setViewportCaptureHandler(async () => [
    {
      label: "当前机位",
      dataUrl: "data:image/png;base64,toolbar",
      meta: {
        mode: "camera" as const,
        cameraId: "cam_2",
        fov: 50,
        position: [0, 2, 6],
        target: [0, 1, 0],
      },
    },
  ]);

  const beforeCount = useDirectorStore.getState().project.cameras.length;
  const results = await captureFromViewportToolbar("current", () => ({
    fov: 50,
    position: [0, 2, 6],
    target: [0, 1, 0],
  }));

  expect(useDirectorStore.getState().project.cameras.length).toBe(beforeCount + 1);
  expect(useDirectorStore.getState().viewMode).toBe("camera");
  expect(results[0]?.dataUrl).toBe("data:image/png;base64,toolbar");
});

it("uploads captures through the host batch uploader before saving to project", async () => {
  setViewportCaptureHandler(async () => [
    {
      label: "当前机位",
      dataUrl: "data:image/png;base64,cam",
      meta: {
        mode: "camera" as const,
        cameraId: "cam_1",
        fov: 45,
        position: [1, 2, 3] as [number, number, number],
        target: [0, 1, 0] as [number, number, number],
      },
    },
  ]);
  setCaptureUploadHandler(async (files) => files.map((file) => `https://cdn.example.com/${file.name}`));

  const results = await captureCameraShot("cam_1", { saveToProject: true });

  expect(results[0]?.dataUrl).toBe("https://cdn.example.com/monto-director-desk-camera-cam_1-当前机位-1.png");
  expect(useDirectorStore.getState().project.cameras[0]?.captures?.[0]?.dataUrl).toBe(
    "https://cdn.example.com/monto-director-desk-camera-cam_1-当前机位-1.png"
  );
});
