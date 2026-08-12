const LOCAL_MODEL_EXTENSION_RE = /\.(fbx|obj)$/i;

/** Host-provided async uploader — typically `export async function uploadModel(file) { ... return url }`. */
export type DirectorDeskUploadModel = (file: File) => Promise<string>;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("模型文件读取失败"));
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("模型文件读取失败")));
    reader.readAsDataURL(file);
  });
}

function assertSupportedLocalModelFile(file: File) {
  if (!LOCAL_MODEL_EXTENSION_RE.test(file.name)) {
    throw new Error("当前仅支持 FBX / OBJ 模型文件");
  }
}

async function resolveLocalModelUrl(file: File, uploadModel?: DirectorDeskUploadModel | null) {
  if (!uploadModel) {
    return readFileAsDataUrl(file);
  }

  const url = await uploadModel(file);
  if (typeof url !== "string" || !url.trim()) {
    throw new Error("模型上传未返回有效 URL");
  }

  return url.trim();
}

export async function readLocalModelFile(
  file: File,
  options?: {
    uploadModel?: DirectorDeskUploadModel | null;
  }
) {
  assertSupportedLocalModelFile(file);

  return {
    id: crypto.randomUUID(),
    fileName: file.name,
    name: file.name.replace(LOCAL_MODEL_EXTENSION_RE, ""),
    url: await resolveLocalModelUrl(file, options?.uploadModel),
  };
}
