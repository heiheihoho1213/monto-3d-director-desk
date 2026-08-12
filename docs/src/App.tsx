import { useMemo, useRef, useState } from "react";
import {
  DirectorDesk,
  DIRECTOR_THEME_SKY_COLORS,
  createDefaultDirectorProject,
  type DirectorDeskCapture,
  type DirectorDeskHandle,
  type DirectorDeskLang,
  type DirectorDeskMaterial,
  type DirectorDeskScreenshot,
  type DirectorDeskTheme,
  type DirectorProject,
} from "monto-3d-director-desk";

/**
 * 宿主上传示例：真实环境里改成你们的模型库上传 API，返回 CDN / OSS URL。
 * playground 用 object URL 代替 base64，避免大文件把 onChange 工程 JSON 撑爆。
 */
export async function uploadModel(file: File): Promise<string> {
  await new Promise((resolve) => {
    window.setTimeout(resolve, 2000);
  });
  return URL.createObjectURL(file);
}

/** Route remote http(s) images through the docs Vite CORS proxy for WebGL texture loads. */
function toPlaygroundPanoramaUrl(url: string) {
  if (!/^https?:\/\//i.test(url)) return url;
  return `/__cors-image?url=${encodeURIComponent(url)}`;
}

function summarizeProject(project: DirectorProject | null) {
  if (!project) return "—";
  return `v${project.version} · objects ${project.objects.length} · cameras ${project.cameras.length} · assets ${project.assets.length}`;
}

function toPrettyJson(project: DirectorProject) {
  return JSON.stringify(project, null, 2);
}

function isDirectorProject(value: unknown): value is DirectorProject {
  if (!value || typeof value !== "object") return false;
  const project = value as Partial<DirectorProject>;
  return (
    project.version === 1 &&
    Array.isArray(project.assets) &&
    Array.isArray(project.objects) &&
    Array.isArray(project.cameras) &&
    Boolean(project.scene) &&
    typeof project.scene?.backgroundColor === "string"
  );
}

function parseProjectJson(raw: string): { project: DirectorProject | null; error: string | null } {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isDirectorProject(parsed)) {
      return { project: null, error: "JSON 结构不符合 DirectorProject（需要 version/scene/objects/cameras/assets）" };
    }
    return { project: parsed, error: null };
  } catch (error) {
    return {
      project: null,
      error: error instanceof Error ? error.message : "JSON 解析失败",
    };
  }
}

type SceneFormState = {
  backgroundColor: string;
  panoramaYaw: number;
  panoramaRadius: number;
  groundHeight: number;
  groundOpacity: number;
  showGround: boolean;
  showLabels: boolean;
  snapToGrid: boolean;
};

function sceneFormFromProject(project: DirectorProject): SceneFormState {
  return {
    backgroundColor: project.scene.backgroundColor,
    panoramaYaw: project.scene.panoramaYaw,
    panoramaRadius: project.scene.panoramaRadius,
    groundHeight: project.scene.groundHeight,
    groundOpacity: project.scene.groundOpacity,
    showGround: project.scene.showGround,
    showLabels: project.scene.showLabels,
    snapToGrid: project.scene.snapToGrid,
  };
}

function applySceneForm(project: DirectorProject, form: SceneFormState): DirectorProject {
  return {
    ...project,
    scene: {
      ...project.scene,
      backgroundColor: form.backgroundColor,
      panoramaYaw: form.panoramaYaw,
      panoramaRadius: form.panoramaRadius,
      groundHeight: form.groundHeight,
      groundOpacity: form.groundOpacity,
      showGround: form.showGround,
      showLabels: form.showLabels,
      snapToGrid: form.snapToGrid,
    },
  };
}

export default function App() {
  const defaultProject = useMemo(() => createDefaultDirectorProject(), []);
  const [theme, setTheme] = useState<DirectorDeskTheme>("light");
  const [lang, setLang] = useState<DirectorDeskLang>("zh");
  const [readyAt, setReadyAt] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState("等待组件事件…");
  const [captures, setCaptures] = useState<DirectorDeskCapture[]>([]);
  const [changeCount, setChangeCount] = useState(0);
  const [panoramaUrl, setPanoramaUrl] = useState("");
  const [scopeNonce, setScopeNonce] = useState(0);
  const [initial, setInitial] = useState<DirectorProject>(defaultProject);
  const [sceneForm, setSceneForm] = useState<SceneFormState>(() => sceneFormFromProject(defaultProject));
  const [draftJson, setDraftJson] = useState(() => toPrettyJson(defaultProject));
  const [formError, setFormError] = useState<string | null>(null);
  const [latestProject, setLatestProject] = useState<DirectorProject | null>(null);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [captureSaveToProject, setCaptureSaveToProject] = useState(false);
  const [captureSendToHost, setCaptureSendToHost] = useState(true);
  const [captureCameraId, setCaptureCameraId] = useState("");
  const [lastCaptureTest, setLastCaptureTest] = useState<{
    method: string;
    results: DirectorDeskScreenshot[];
  } | null>(null);

  const deskRef = useRef<DirectorDeskHandle>(null);
  const instanceId = useMemo(() => `docs-playground-${scopeNonce}`, [scopeNonce]);
  const cameraOptions = useMemo(() => {
    const project = latestProject ?? initial;
    return project.cameras.map((camera) => ({ id: camera.id, name: camera.name }));
  }, [initial, latestProject]);
  const material = useMemo<DirectorDeskMaterial | null>(() => {
    const url = panoramaUrl.trim();
    if (!url) return null;
    return { kind: "panorama", url: toPlaygroundPanoramaUrl(url), fileName: "docs-panorama" };
  }, [panoramaUrl]);

  function syncFormFromProject(project: DirectorProject) {
    setLatestProject(project);
    setSceneForm(sceneFormFromProject(project));
    setDraftJson(toPrettyJson(project));
    setFormError(null);
  }

  function remountWithProject(project: DirectorProject, eventLabel: string) {
    setInitial(project);
    syncFormFromProject(project);
    setChangeCount(0);
    setScopeNonce((value) => value + 1);
    setLastEvent(eventLabel);
  }

  function handleApplyInitial() {
    const parsed = parseProjectJson(draftJson);
    if (!parsed.project) {
      setFormError(parsed.error);
      return;
    }
    const next = applySceneForm(parsed.project, sceneForm);
    remountWithProject(next, "apply initial form");
  }

  function patchSceneForm<K extends keyof SceneFormState>(key: K, value: SceneFormState[K]) {
    setSceneForm((prev) => {
      const next = { ...prev, [key]: value };
      const parsed = parseProjectJson(draftJson);
      if (parsed.project) {
        setDraftJson(toPrettyJson(applySceneForm(parsed.project, next)));
        setFormError(null);
      }
      return next;
    });
  }

  async function runCaptureTest(method: string, action: () => Promise<DirectorDeskScreenshot[]>) {
    if (!deskRef.current) {
      setCaptureError("DirectorDesk ref 未就绪，请等 onReady 后再试");
      return;
    }

    setCaptureBusy(true);
    setCaptureError(null);
    try {
      const results = await action();
      setLastCaptureTest({ method, results });
      setLastEvent(`${method} (${results.length})`);
      console.log(method, results);
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : `${method} 失败`);
      setLastEvent(`${method} error`);
    } finally {
      setCaptureBusy(false);
    }
  }

  const captureOptions = {
    saveToProject: captureSaveToProject,
    sendToHost: captureSendToHost,
  };

  return (
    <div className="docs-page" data-theme={theme}>
      <aside className="docs-sidebar">
        <p className="docs-eyebrow">docs playground</p>

        <label className="docs-field">
          <span>主题</span>
          <select
            value={theme}
            onChange={(event) => {
              const nextTheme = event.target.value as DirectorDeskTheme;
              setTheme(nextTheme);
              const sky = DIRECTOR_THEME_SKY_COLORS[nextTheme];
              setSceneForm((prev) => {
                const next = { ...prev, backgroundColor: sky };
                const parsed = parseProjectJson(draftJson);
                if (parsed.project) {
                  setDraftJson(toPrettyJson(applySceneForm(parsed.project, next)));
                }
                return next;
              });
            }}
          >
            <option value="dark">dark</option>
            <option value="light">light</option>
          </select>
        </label>

        <label className="docs-field">
          <span>语言 lang</span>
          <select value={lang} onChange={(event) => setLang(event.target.value as DirectorDeskLang)}>
            <option value="zh">zh</option>
            <option value="en">en</option>
          </select>
        </label>

        <label className="docs-field">
          <span>导入全景图</span>
          <input
            type="url"
            placeholder="传入全景图 URL 后禁用「导入全景图」"
            value={panoramaUrl}
            onChange={(event) => setPanoramaUrl(event.target.value)}
          />
        </label>

        <section className="docs-form-section">
          <h2>当前场景参数</h2>
          <label className="docs-field">
            <span>天空色 backgroundColor</span>
            <input
              type="text"
              value={sceneForm.backgroundColor}
              onChange={(event) => patchSceneForm("backgroundColor", event.target.value)}
            />
          </label>
          <label className="docs-field">
            <span>全景水平旋转 panoramaYaw</span>
            <input
              type="number"
              value={sceneForm.panoramaYaw}
              onChange={(event) => patchSceneForm("panoramaYaw", Number(event.target.value))}
            />
          </label>
          <label className="docs-field">
            <span>全景半径 panoramaRadius</span>
            <input
              type="number"
              value={sceneForm.panoramaRadius}
              onChange={(event) => patchSceneForm("panoramaRadius", Number(event.target.value))}
            />
          </label>
          <label className="docs-field">
            <span>地面高度 groundHeight</span>
            <input
              type="number"
              value={sceneForm.groundHeight}
              onChange={(event) => patchSceneForm("groundHeight", Number(event.target.value))}
            />
          </label>
          <label className="docs-field">
            <span>地面透明度 groundOpacity</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={sceneForm.groundOpacity}
              onChange={(event) => patchSceneForm("groundOpacity", Number(event.target.value))}
            />
          </label>
          <div className="docs-checkboxes">
            <label>
              <input
                type="checkbox"
                checked={sceneForm.showGround}
                onChange={(event) => patchSceneForm("showGround", event.target.checked)}
              />
              showGround
            </label>
            <label>
              <input
                type="checkbox"
                checked={sceneForm.showLabels}
                onChange={(event) => patchSceneForm("showLabels", event.target.checked)}
              />
              showLabels
            </label>
            <label>
              <input
                type="checkbox"
                checked={sceneForm.snapToGrid}
                onChange={(event) => patchSceneForm("snapToGrid", event.target.checked)}
              />
              snapToGrid
            </label>
          </div>
        </section>

        <label className="docs-field">
          <span>当前工程 JSON（跟随 onChange，也可手改后应用）</span>
          <textarea
            className="docs-json-editor"
            spellCheck={false}
            value={draftJson}
            onChange={(event) => {
              setDraftJson(event.target.value);
              setFormError(null);
            }}
          />
        </label>

        {formError ? <p className="docs-form-error">{formError}</p> : null}

        <div className="docs-debug-actions">
          <button type="button" onClick={handleApplyInitial}>
            应用 initial
          </button>
          <button
            type="button"
            onClick={() => {
              const project = createDefaultDirectorProject();
              setLatestProject(null);
              remountWithProject(project, "reset default initial");
            }}
          >
            重置默认 initial
          </button>
          <button
            type="button"
            disabled={!latestProject}
            title={latestProject ? "用最近一次 onChange 回写到表单并重灌" : "先在场景里改点内容，等 onChange 触发后再点"}
            onClick={() => {
              if (!latestProject) return;
              remountWithProject(latestProject, "reseed from onChange");
            }}
          >
            用 onChange 结果重灌
          </button>
        </div>
        {!latestProject ? (
          <p className="docs-hint">提示：上面按钮灰掉是因为还没有 onChange 数据。在视口里移动角色/改属性后会自动亮起。</p>
        ) : null}

        <section className="docs-form-section">
          <h2>截图 API 测试（ref）</h2>
          <div className="docs-checkboxes">
            <label>
              <input
                type="checkbox"
                checked={captureSaveToProject}
                onChange={(event) => setCaptureSaveToProject(event.target.checked)}
              />
              saveToProject
            </label>
            <label>
              <input
                type="checkbox"
                checked={captureSendToHost}
                onChange={(event) => setCaptureSendToHost(event.target.checked)}
              />
              sendToHost（触发 onCapturesSent）
            </label>
          </div>
          <label className="docs-field">
            <span>captureCameraShot 机位 ID</span>
            <select value={captureCameraId} onChange={(event) => setCaptureCameraId(event.target.value)}>
              <option value="">默认 activeCamera</option>
              {cameraOptions.map((camera) => (
                <option key={camera.id} value={camera.id}>
                  {camera.name} ({camera.id})
                </option>
              ))}
            </select>
          </label>
          <div className="docs-debug-actions">
            <button
              type="button"
              disabled={captureBusy}
              onClick={() =>
                void runCaptureTest("captureCurrentView", () =>
                  deskRef.current!.captureCurrentView(captureOptions)
                )
              }
            >
              captureCurrentView
            </button>
            <button
              type="button"
              disabled={captureBusy}
              onClick={() =>
                void runCaptureTest("captureFourDirections", () =>
                  deskRef.current!.captureFourDirections(captureOptions)
                )
              }
            >
              captureFourDirections
            </button>
            <button
              type="button"
              disabled={captureBusy}
              onClick={() =>
                void runCaptureTest("captureTwelveDirections", () =>
                  deskRef.current!.captureTwelveDirections(captureOptions)
                )
              }
            >
              captureTwelveDirections
            </button>
            <button
              type="button"
              disabled={captureBusy}
              onClick={() =>
                void runCaptureTest("captureCameraShot", () =>
                  deskRef.current!.captureCameraShot(captureCameraId || undefined, captureOptions)
                )
              }
            >
              captureCameraShot
            </button>
            <button
              type="button"
              disabled={captureBusy}
              onClick={() =>
                void runCaptureTest("captureFromToolbar(current)", () =>
                  deskRef.current!.captureFromToolbar("current", {
                    sendToHost: captureSendToHost,
                  })
                )
              }
            >
              captureFromToolbar(current)
            </button>
            <button
              type="button"
              disabled={captureBusy || !lastCaptureTest?.results.length}
              onClick={() => {
                const items = lastCaptureTest?.results ?? [];
                deskRef.current?.sendCaptures(
                  items.map((item) => ({ dataUrl: item.dataUrl, fileName: item.fileName }))
                );
                setLastEvent(`sendCaptures (${items.length})`);
              }}
            >
              sendCaptures（最近一批）
            </button>
          </div>
          {captureError ? <p className="docs-form-error">{captureError}</p> : null}
          {lastCaptureTest ? (
            <div className="docs-captures">
              <h3>
                最近测试：{lastCaptureTest.method} · {lastCaptureTest.results.length} 张
              </h3>
              <ul>
                {lastCaptureTest.results.map((item) => (
                  <li key={`${item.fileName}-${item.label}`}>
                    <img src={item.dataUrl} alt={item.label} />
                    <span>
                      {item.label} · {item.fileName}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <hr style={{ width: "100%" }} />

        <dl className="docs-meta">
          <div>
            <dt>instanceId</dt>
            <dd>{instanceId}</dd>
          </div>
          <div>
            <dt>applied initial</dt>
            <dd>{summarizeProject(initial)}</dd>
          </div>
          <div>
            <dt>latest onChange</dt>
            <dd>{summarizeProject(latestProject)}</dd>
          </div>
          <div>
            <dt>ready</dt>
            <dd>{readyAt ?? "—"}</dd>
          </div>
          <div>
            <dt>last event</dt>
            <dd>{lastEvent}</dd>
          </div>
          <div>
            <dt>onChange</dt>
            <dd>{changeCount}</dd>
          </div>
          <div>
            <dt>captures</dt>
            <dd>{captures.length}</dd>
          </div>
          <div>
            <dt>material</dt>
            <dd>{material ? "panorama locked" : "—"}</dd>
          </div>
        </dl>

        {captures.length > 0 ? (
          <div className="docs-captures">
            <h2>最近截图</h2>
            <ul>
              {captures.slice(0, 4).map((capture) => (
                <li key={`${capture.fileName}-${capture.dataUrl.slice(0, 32)}`}>
                  <img src={capture.dataUrl} alt={capture.fileName} />
                  <span>{capture.fileName}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>

      <main className="docs-stage">
        <DirectorDesk
          ref={deskRef}
          key={`${instanceId}-${lang}`}
          theme={theme}
          lang={lang}
          instanceId={instanceId}
          initial={initial}
          material={material}
          title={lang === "en" ? "Component playground" : "组件调用示例"}
          showCloseButton
          onReady={() => {
            setReadyAt(new Date().toLocaleTimeString());
            setLastEvent("onReady");
          }}
          onClose={() => setLastEvent("onClose")}
          onChange={(project: DirectorProject) => {
            console.log("onChange", project);
            syncFormFromProject(project);
            setChangeCount((count) => count + 1);
            setLastEvent("onChange");
          }}
          onCapturesSent={(items) => {
            console.log("onCapturesSent", items);
            setCaptures(items);
            setLastEvent(`onCapturesSent (${items.length})`);
          }}
          uploadModel={async (file) => {
            setLastEvent(`uploadModel: ${file.name}`);
            const url = await uploadModel(file);
            console.log("uploadModel", file.name, url);
            return url;
          }}
        />
      </main>
    </div>
  );
}
