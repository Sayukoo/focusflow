import { isTauriRuntime } from "./audio";

export interface RunningApp {
  processName: string;
  windowTitle: string;
}

export async function listRunningApps(): Promise<RunningApp[]> {
  if (!isTauriRuntime()) return [];
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<RunningApp[]>("list_running_apps");
  } catch {
    return [];
  }
}

export async function startAppLock(allowed: string[]): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("start_app_lock", { allowed });
  } catch {
    // Unsupported platform or native IPC unreachable; ignore.
  }
}

export async function stopAppLock(): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("stop_app_lock");
  } catch {
    // Ignore native IPC errors gracefully.
  }
}
