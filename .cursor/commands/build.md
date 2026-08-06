Build the FocusFlow Windows release from the workspace root.

Run:

```sh
npm run release:build
```

The script must:

1. Start from the current workspace source and clean stale generated release outputs.
2. Regenerate the desktop icon bundle from `src-tauri/icons/focusflow.svg`.
3. Build the portable Windows executable without an installer.
4. Copy the newest Windows artifact and `BUILD-MANIFEST.txt` into `release/`.

Android APK builds are temporarily disabled. Do not initialize the Android project, do not require Android SDK/JDK/Developer Mode, and do not claim an APK was created. The manifest must record the actual Windows artifact path, size, hash, build status, icon source, and that Android is disabled.

Do not hide build errors or claim success without checking the files in `release/`.

Keep Gemini credentials only in a local ignored `.env.local` file. Never put API keys in tracked source, scripts, documentation, or release manifests.
