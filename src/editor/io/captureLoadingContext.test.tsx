import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import {
  CaptureLoadingProvider,
  getCaptureLoadingController,
  setCaptureLoadingController,
} from "./captureLoadingContext";
import { requestViewportCaptureWithStorage } from "./captureWorkflow";
import { setCaptureUploadHandler } from "./captureUpload";
import { setViewportCaptureHandler } from "./captureBridge";

afterEach(() => {
  setCaptureLoadingController(null);
  setCaptureUploadHandler(null);
  vi.restoreAllMocks();
});

function renderCaptureLoadingProvider() {
  return render(
    <I18nProvider lang="zh">
      <CaptureLoadingProvider>
        <div data-testid="desk-child" />
      </CaptureLoadingProvider>
    </I18nProvider>
  );
}

describe("capture loading overlay", () => {
  it("shows localized capture and upload messages", async () => {
    renderCaptureLoadingProvider();

    await waitFor(() => {
      expect(getCaptureLoadingController()).not.toBeNull();
    });

    getCaptureLoadingController()?.start("正在截图…");
    expect(await screen.findByRole("status", { name: "正在截图…" })).toBeInTheDocument();

    getCaptureLoadingController()?.update("正在上传截图…");
    expect(await screen.findByRole("status", { name: "正在上传截图…" })).toBeInTheDocument();

    getCaptureLoadingController()?.stop();
    await waitFor(() => {
      expect(screen.queryByRole("status", { name: "正在上传截图…" })).not.toBeInTheDocument();
    });
  });

  it("runs capture pipeline with localized upload phase", async () => {
    renderCaptureLoadingProvider();

    await waitFor(() => {
      expect(getCaptureLoadingController()).not.toBeNull();
    });

    let resolveCapture: ((value: Array<{
      label: string;
      dataUrl: string;
      meta: {
        mode: "camera";
        cameraId: string;
        fov: number;
        position: [number, number, number];
        target: [number, number, number];
      };
    }>) => void) | null = null;

    setViewportCaptureHandler(
      () =>
        new Promise((resolve) => {
          resolveCapture = resolve;
        })
    );
    setCaptureUploadHandler(async (files) => files.map((file) => `https://cdn.example.com/${file.name}`));

    const pipeline = requestViewportCaptureWithStorage({
      preset: "current",
      source: "camera-panel",
      cameraId: "cam_1",
    });

    expect(await screen.findByRole("status", { name: "正在截图…" })).toBeInTheDocument();

    resolveCapture?.([
      {
        label: "当前机位",
        dataUrl: "data:image/png;base64,abc",
        meta: {
          mode: "camera",
          cameraId: "cam_1",
          fov: 45,
          position: [0, 1, 2],
          target: [0, 1, 0],
        },
      },
    ]);

    const { storageUrls } = await pipeline;
    expect(storageUrls[0]).toMatch(/^https:\/\/cdn\.example\.com\//);

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });
});
