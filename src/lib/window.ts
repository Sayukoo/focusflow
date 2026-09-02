import { isTauriRuntime } from "./audio";

const WINDOW_PIN_KEY = "focusflow.window-pin";
const WINDOW_RESTORE_KEY = "focusflow.window-restore";
const MINI_WINDOW_WIDTH = 360;
const MINI_WINDOW_HEIGHT = 420;

interface RestorableWindowState {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function setWindowPinned(pinned: boolean): Promise<void> {
  if (isTauriRuntime()) {
    await applyNativeWindowState(pinned);
  }
  localStorage.setItem(WINDOW_PIN_KEY, String(pinned));
  if (!pinned) {
    localStorage.removeItem(WINDOW_RESTORE_KEY);
  }
}

export async function restoreWindowPin(): Promise<boolean> {
  if (!isTauriRuntime() || localStorage.getItem(WINDOW_PIN_KEY) !== "true") {
    return false;
  }

  try {
    await applyNativeWindowState(true);
    return true;
  } catch {
    return false;
  }
}

async function applyNativeWindowState(pinned: boolean): Promise<void> {
  const [
    { currentMonitor, getCurrentWindow },
    { LogicalSize, PhysicalPosition, PhysicalSize },
  ] = await Promise.all([
    import("@tauri-apps/api/window"),
    import("@tauri-apps/api/dpi"),
  ]);
  const appWindow = getCurrentWindow();

  if (!pinned) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("set_window_pinned", { pinned: false });
    } catch {
      // Ignore if native command unavailable
    }
    await appWindow.setAlwaysOnTop(false);
    await appWindow.setDecorations(true);
    await appWindow.setResizable(true);
    await appWindow.setShadow(true);
    const restoreState = readRestoreWindowState();
    if (!restoreState) return;

    await appWindow.setSize(
      new PhysicalSize(restoreState.width, restoreState.height),
    );
    await appWindow.setPosition(
      new PhysicalPosition(restoreState.x, restoreState.y),
    );
    await appWindow.setAlwaysOnTop(false);
    return;
  }

  if (!readRestoreWindowState()) {
    const [windowSize, windowPosition] = await Promise.all([
      appWindow.outerSize(),
      appWindow.outerPosition(),
    ]);
    writeRestoreWindowState({
      x: windowPosition.x,
      y: windowPosition.y,
      width: windowSize.width,
      height: windowSize.height,
    });
  }

  await appWindow.setDecorations(false);
  await appWindow.setResizable(false);
  await appWindow.setShadow(false);
  await appWindow.setSize(new LogicalSize(MINI_WINDOW_WIDTH, MINI_WINDOW_HEIGHT));

  const [monitor, windowSize] = await Promise.all([
    currentMonitor(),
    appWindow.outerSize(),
  ]);
  if (monitor) {
    const margin = 0;
    const x =
      monitor.workArea.position.x +
      monitor.workArea.size.width -
      windowSize.width -
      margin;
    const y = monitor.workArea.position.y + margin;
    await appWindow.setPosition(new PhysicalPosition(x, y));
  }

  await appWindow.setAlwaysOnTop(true);
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("set_window_pinned", { pinned: true });
  } catch {
    // Ignore if native command unavailable
  }
}

function readRestoreWindowState(): RestorableWindowState | null {
  try {
    const raw = localStorage.getItem(WINDOW_RESTORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RestorableWindowState>;
    if (
      typeof parsed.x !== "number" ||
      !Number.isFinite(parsed.x) ||
      typeof parsed.y !== "number" ||
      !Number.isFinite(parsed.y) ||
      typeof parsed.width !== "number" ||
      !Number.isFinite(parsed.width) ||
      parsed.width <= 0 ||
      typeof parsed.height !== "number" ||
      !Number.isFinite(parsed.height) ||
      parsed.height <= 0
    ) {
      return null;
    }
    return {
      x: parsed.x,
      y: parsed.y,
      width: parsed.width,
      height: parsed.height,
    };
  } catch {
    return null;
  }
}

function writeRestoreWindowState(state: RestorableWindowState): void {
  localStorage.setItem(WINDOW_RESTORE_KEY, JSON.stringify(state));
}
