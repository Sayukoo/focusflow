# FocusFlow

Desktop focus player built with **Tauri 2 + React + TypeScript**.

Play your own local music. Files are copied into a managed app folder:

`%APPDATA%/com.focusflow.app/music`

## Features

- Immersive dark focus UI with large session timer
- Import `.mp3`, `.wav`, `.ogg`, `.flac`, `.m4a`, `.aac`
- Library drawer: import, refresh, delete, open folder
- Minimal visible text; labels live in KaTeX tooltips
- Volume, seek, queue next/previous, duration presets

## Develop

```bash
npm install
npm run tauri dev
```

## Test / typecheck

```bash
npm test
npm run typecheck
```

## Build Windows `.exe`

```bash
npm run tauri build
```

Artifacts land in `src-tauri/target/release/bundle/`.

## Project skill

UI changes should follow [`.cursor/skills/brainfm-focus-ui/SKILL.md`](.cursor/skills/brainfm-focus-ui/SKILL.md).
