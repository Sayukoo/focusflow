Build the complete FocusFlow release from the workspace root.

Run:

```sh
npm run release:build
```

The script must:

1. Start from the current workspace source and clean stale generated release outputs.
2. Regenerate the Windows and Android icon bundle from `src-tauri/icons/focusflow.svg`.
3. Build the portable Windows executable without an installer.
4. Initialize the Tauri Android project automatically if it does not exist.
5. Build the ARM64 (`aarch64`) release APK.
6. Copy the newest artifacts and `BUILD-MANIFEST.txt` into `release/`.

The manifest must record the actual current artifact paths, sizes, hashes, build status, and icon source. If the Android build cannot start, report the missing Android SDK, JDK, Rust/Android tooling, or Developer Mode clearly and keep any successfully created Windows artifact. Do not hide build errors or claim success without checking the files in `release/`.

On Windows, Android builds require Developer Mode (or an Administrator terminal) because Tauri links the native library into the Android project. If that prerequisite is missing, tell the user to enable Settings → System → For developers and rerun `/build`.

Keep Gemini credentials only in a local ignored `.env.local` file. Never put API keys in tracked source, scripts, documentation, or release manifests.
