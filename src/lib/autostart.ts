import { enable } from "@tauri-apps/plugin-autostart";
import { isTauriRuntime } from "./audio";

export async function ensureWindowsAutostart(): Promise<void> {
  if (
    !import.meta.env.PROD ||
    !isTauriRuntime() ||
    typeof navigator === "undefined" ||
    !/Windows/i.test(navigator.userAgent)
  ) {
    return;
  }

  // Re-register on every production launch so moving/updating the portable
  // executable also refreshes the Windows startup path.
  await enable();
}
