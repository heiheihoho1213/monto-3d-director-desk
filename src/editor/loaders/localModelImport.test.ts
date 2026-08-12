import { describe, expect, it, vi } from "vitest";
import { readLocalModelFile } from "./localModelImport";

describe("readLocalModelFile", () => {
  it("falls back to a data URL when no uploadModel is provided", async () => {
    const file = new File(["mesh"], "chair.obj", { type: "model/obj" });

    const result = await readLocalModelFile(file);

    expect(result.fileName).toBe("chair.obj");
    expect(result.name).toBe("chair");
    expect(result.url).toBe("data:model/obj;base64,bWVzaA==");
  });

  it("uses the host uploadModel callback and returns its URL", async () => {
    const file = new File(["mesh"], "beast.fbx", { type: "model/fbx" });
    const uploadModel = vi.fn(async () => "https://cdn.example.com/models/beast.fbx");

    const result = await readLocalModelFile(file, { uploadModel });

    expect(uploadModel).toHaveBeenCalledWith(file);
    expect(result.fileName).toBe("beast.fbx");
    expect(result.name).toBe("beast");
    expect(result.url).toBe("https://cdn.example.com/models/beast.fbx");
  });

  it("rejects empty URLs from uploadModel", async () => {
    const file = new File(["mesh"], "beast.fbx", { type: "model/fbx" });

    await expect(readLocalModelFile(file, { uploadModel: async () => "   " })).rejects.toThrow(
      "模型上传未返回有效 URL"
    );
  });

  it("rejects unsupported extensions before uploading", async () => {
    const uploadModel = vi.fn(async () => "https://cdn.example.com/models/x.glb");

    await expect(
      readLocalModelFile(new File(["mesh"], "x.glb"), { uploadModel })
    ).rejects.toThrow("当前仅支持 FBX / OBJ 模型文件");
    expect(uploadModel).not.toHaveBeenCalled();
  });
});
