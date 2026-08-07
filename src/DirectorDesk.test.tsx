import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import {
  createDefaultDirectorProject,
  createInitialDirectorState,
  useDirectorStore,
} from "./editor/store/directorStore";

vi.mock("./editor/canvas/DirectorCanvas", () => ({
  DirectorCanvas: () => <div data-testid="mock-director-canvas" />,
}));

import { DirectorDesk, DIRECTOR_DESK_ON_CHANGE_DEBOUNCE_MS } from "./DirectorDesk";

function renderDesk() {
  return render(<DirectorDesk enableHostBridge showCloseButton />);
}

beforeEach(() => {
  useDirectorStore.setState({
    ...useDirectorStore.getState(),
    ...createInitialDirectorState(),
  });
});

it("renders the director desk header and view mode switch", () => {
  const { container } = renderDesk();

  expect(screen.getByText("3D导演台")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "导演视角" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "机位视角" })).toBeInTheDocument();
  expect(container.querySelector(".top-bar-center .mode-toggle")).toBeInTheDocument();
  expect(screen.queryByLabelText("帮助")).not.toBeInTheDocument();
  expect(screen.getByLabelText("关闭")).toBeInTheDocument();
});

it("notifies the host canvas when the director desk app is ready", () => {
  const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);

  renderDesk();

  expect(postMessage).toHaveBeenCalledWith(
    { type: "monto:director-desk-ready" },
    window.location.origin
  );

  postMessage.mockRestore();
});

it("notifies the host canvas when the director desk close button is clicked", async () => {
  const user = userEvent.setup();
  const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);

  renderDesk();

  await user.click(screen.getByRole("button", { name: "关闭" }));

  expect(postMessage).toHaveBeenCalledWith(
    { type: "monto:director-desk-close" },
    window.location.origin
  );

  postMessage.mockRestore();
});

it("uses a full-width director desk frame instead of floating card columns", () => {
  const { container } = renderDesk();
  const shell = container.querySelector(".director-shell.director-shell-fullbleed");

  expect(shell).toBeInTheDocument();
  expect(shell?.firstElementChild).toHaveClass("viewport-column");
  expect(screen.getByLabelText("场景")).toHaveClass("left-sidebar");
  expect(screen.getByLabelText("3D视口")).toHaveClass("viewport-column");
  expect(screen.getByLabelText("属性")).toHaveClass("right-sidebar");
});

it("collapses both side panels from the fullscreen toolbar action", async () => {
  const { container, rerender } = renderDesk();

  expect(container.querySelector(".director-shell-fullbleed.is-sidebars-collapsed")).not.toBeInTheDocument();

  act(() => {
    useDirectorStore.setState({
      ...useDirectorStore.getState(),
      viewportPanelsCollapsed: true,
    } as ReturnType<typeof useDirectorStore.getState>);
  });
  rerender(<DirectorDesk enableHostBridge showCloseButton />);

  expect(container.querySelector(".director-shell-fullbleed.is-sidebars-collapsed")).toBeInTheDocument();
  expect(screen.getByLabelText("场景")).toHaveAttribute("aria-hidden", "true");
  expect(screen.getByLabelText("属性")).toHaveAttribute("aria-hidden", "true");
});

it("switches from director mode to camera mode", async () => {
  const user = userEvent.setup();
  renderDesk();

  const directorButton = screen.getByRole("button", { name: "导演视角" });
  const cameraButton = screen.getByRole("button", { name: "机位视角" });

  expect(directorButton).toHaveAttribute("aria-pressed", "true");
  expect(cameraButton).toHaveAttribute("aria-pressed", "false");

  await user.click(cameraButton);

  expect(directorButton).toHaveAttribute("aria-pressed", "false");
  expect(cameraButton).toHaveAttribute("aria-pressed", "true");
});

it("supports Cmd/Ctrl+C and Cmd/Ctrl+V to duplicate the selected object", async () => {
  const user = userEvent.setup();
  renderDesk();

  await user.click(screen.getByRole("button", { name: "角色01" }));
  await user.keyboard("{Control>}c{/Control}");
  await user.keyboard("{Control>}v{/Control}");

  const state = useDirectorStore.getState();
  const characters = state.project.objects.filter((item) => item.kind === "character");

  expect(characters).toHaveLength(2);
  expect(characters[1]?.id).not.toBe("char_default_a");
  expect(state.selectedObjectId).toBe(characters[1]?.id ?? null);
});

it("supports Cmd/Ctrl+Z to undo the latest scene edit", async () => {
  const user = userEvent.setup();
  renderDesk();

  act(() => {
    useDirectorStore.getState().addPresetCharacter("female");
  });
  expect(useDirectorStore.getState().project.objects.some((item) => item.name === "角色02")).toBe(true);

  await user.keyboard("{Control>}z{/Control}");

  expect(useDirectorStore.getState().project.objects.some((item) => item.name === "角色02")).toBe(false);
});

it("hydrates from initial project once per instance scope", () => {
  const initial = createDefaultDirectorProject();
  initial.scene.backgroundColor = "#112233";
  initial.objects = initial.objects.map((object) =>
    object.id === "char_default_a" ? { ...object, name: "初始角色" } : object
  );

  render(
    <DirectorDesk instanceId="scope-a" initial={initial} showCloseButton={false} />
  );

  expect(useDirectorStore.getState().project.objects.some((item) => item.name === "初始角色")).toBe(true);
  expect(useDirectorStore.getState().project.scene.backgroundColor).toBe("#000000");
});

it("debounces onChange when project content changes", () => {
  vi.useFakeTimers();
  const onChange = vi.fn();

  render(
    <DirectorDesk instanceId="scope-change" onChange={onChange} showCloseButton={false} />
  );

  act(() => {
    vi.runOnlyPendingTimers();
  });
  onChange.mockClear();

  act(() => {
    useDirectorStore.getState().addPresetCharacter("female");
  });

  expect(onChange).not.toHaveBeenCalled();

  act(() => {
    vi.advanceTimersByTime(DIRECTOR_DESK_ON_CHANGE_DEBOUNCE_MS - 1);
  });
  expect(onChange).not.toHaveBeenCalled();

  act(() => {
    vi.advanceTimersByTime(1);
  });

  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange.mock.calls[0]?.[0].objects.some((item: { name: string }) => item.name === "角色02")).toBe(true);

  vi.useRealTimers();
});

it("does not emit onChange while applying initial", () => {
  vi.useFakeTimers();
  const onChange = vi.fn();
  const initial = createDefaultDirectorProject();
  initial.scene.showGround = false;

  render(
    <DirectorDesk instanceId="scope-initial-change" initial={initial} onChange={onChange} showCloseButton={false} />
  );

  act(() => {
    vi.advanceTimersByTime(DIRECTOR_DESK_ON_CHANGE_DEBOUNCE_MS + 50);
  });

  expect(onChange).not.toHaveBeenCalled();
  expect(useDirectorStore.getState().project.scene.showGround).toBe(false);

  vi.useRealTimers();
});
