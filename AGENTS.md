# FocusFlow — AGENTS.md
> **For AI coding agents.** Read this file first before reading or editing any source file.
> It maps the entire codebase so you can navigate confidently without guessing.

---

## 1. What is FocusFlow?

A **desktop focus-music player** built with **Tauri 2 + React 18 + TypeScript**.
It lets the user play local music files or remote tracks (YouTube / Spotify / SoundCloud / TikTok) while running a focus timer with Gemini-generated subtasks (mini-goals). Think Brain.fm, self-hosted.

**Key UX ideas:**
- Full-screen immersive dark UI — no distractions.
- Large countdown timer in the center.
- Optional AI subtasks (mini-goals) generated from a "Work Goal" text input.
- Animated blurred thumbnail backdrop reacts to the playing track.
- "Window Pin" mode shrinks the window and pins it always-on-top in the top-right corner.

---

## 2. Stack

| Layer | Technology |
|---|---|
| Native shell | Tauri 2 (Rust) |
| Frontend | React 18, TypeScript |
| Build | Vite |
| CSS | Single vanilla CSS file (`src/styles.css`) — **no Tailwind** |
| AI | Google Gemini API (`VITE_GEMINI_API_KEY` in `.env.local`) |
| Tests | Vitest + Testing Library |
| Release builder | `node scripts/build-release.mjs` |

---

## 3. Directory tree (annotated)

```
e:/Programowanie/brainfm/
├── src/
│   ├── App.tsx                    # Root component. Owns all global state.
│   ├── main.tsx                   # Vite entry point.
│   ├── types.ts                   # ALL shared TypeScript types & defaults.
│   ├── styles.css                 # SINGLE global stylesheet (~3800 lines).
│   │                              #   Sections are separated by comments.
│   │
│   ├── lib/                       # Pure logic — no React, no JSX
│   │   ├── audio.ts               # Track loading, Tauri FS, remote detection
│   │   ├── autostart.ts           # OS autostart via Tauri plugin
│   │   ├── gemini.ts              # Gemini API client (mini-goals + track category)
│   │   ├── phaseCues.ts           # Voice / sound cue scheduling for timer phases
│   │   ├── profiles.ts            # Music profile CRUD (localStorage)
│   │   ├── timer.ts               # Timer math, normalization, mini-goal helpers
│   │   ├── voicePacks.ts          # ElevenLabs calm-female voice pack loader
│   │   └── window.ts              # Native window pin/restore logic (Tauri)
│   │
│   ├── hooks/                     # Custom React hooks
│   │   └── useAudioLibrary.ts     # Master hook: owns all audio + timer state
│   │
│   ├── components/
│   │   ├── index.ts               # Re-exports every public component
│   │   │
│   │   ├── player/                # Main player shell & controls
│   │   │   ├── FocusPlayer.tsx    # Root player component (renders shell layout)
│   │   │   ├── HeaderControls.tsx # Top-right icon buttons (pin, library, profile)
│   │   │   ├── PlaybackControls.tsx # Seek bar, play/pause/next/prev, volume
│   │   │   └── ThumbnailBackground.tsx # Animated blurred backdrop (thumbnail → bg)
│   │   │
│   │   ├── settings/              # Modal panels opened from the player
│   │   │   ├── TimerSettings.tsx  # Full-screen timer/goal/mini-goals settings panel
│   │   │   └── ProfilePicker.tsx  # Profile selector + "About me" AI context editor
│   │   │
│   │   ├── library/               # Music library drawer
│   │   │   └── MusicLibrary.tsx   # Track list, import, delete, YouTube/link add
│   │   │
│   │   ├── tasks/                 # Task / mini-goal editing
│   │   │   └── MiniGoalChecklist.tsx # Inline editable checkbox list of mini-goals
│   │   │
│   │   ├── audio/                 # Remote provider embeds (iframes)
│   │   │   ├── RemotePlayer.tsx   # Dispatcher — picks the right player by source
│   │   │   ├── YouTubePlayer.tsx
│   │   │   ├── SpotifyPlayer.tsx
│   │   │   ├── SoundCloudPlayer.tsx
│   │   │   └── TikTokPlayer.tsx
│   │   │
│   │   └── ui/                    # Generic UI primitives
│   │       ├── Icon.tsx           # SVG icon sprite wrapper
│   │       ├── KaTeXTooltip.tsx   # Hover tooltip with KaTeX math rendering
│   │       └── MobileMenu.tsx     # Full-screen bottom sheet (mobile/narrow layouts)
│   │
│   ├── test/                      # Shared Vitest/Testing Library setup
│   └── assets/                    # Static assets (fonts, images)
│
├── src-tauri/                     # Rust/Tauri native layer
│   ├── src/main.rs                # Tauri app entry + commands
│   ├── tauri.conf.json            # Window size, permissions, app ID
│   └── Cargo.toml
│
├── scripts/
│   └── build-release.mjs          # Regenerates icons + builds portable .exe
│
├── release/
│   └── FocusFlow-portable.exe     # Build artifact — DO NOT commit changes here
│
├── docs/                          # Design notes (optional reading)
├── .env.example                   # Shows which env vars are needed
├── .env.local                     # Actual secrets — NEVER commit
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 4. Key files — what lives where

### `src/types.ts` — the single source of truth for types
- `Track` — a playable audio item (local file or remote provider)
- `TimerSettings` — all timer + AI goal config (kind, durations, goal text, miniGoals, userAboutMe, voice settings)
- `MiniGoal` — `{ id, text, completed }`
- `DEFAULT_TIMER_SETTINGS` — canonical default values for TimerSettings
- `PlaybackQueue` — union of "all" / "favorites" / "recent" / "genre"
- `FocusMode` — `"deep" | "energizing"`

### `src/lib/gemini.ts` — Gemini AI integration
- `generateMiniGoalsDetailed(goal, context, signal, clarificationAnswer)` — main function
  - Returns `{ improvedGoal?, miniGoals[], clarifyingQuestion? }`
  - **improvedGoal**: an AI-cleaned version of the user's work goal text
  - **miniGoals**: 3–5 actionable subtasks
  - **clarifyingQuestion**: asked when goal is ambiguous
- `MiniGoalContext` — carries `kind`, `workDurationMinutes`, `breakDurationMinutes`, `userAboutMe`
- `userAboutMe` is treated as **psychological context / AI memory** — NOT a task list.
  The prompt instructs Gemini to use it to empathetically adapt mini-goals.
- Max `userAboutMe` length: **4000 characters**
- `buildTrackCategoryPrompt` / `categorizeTrackWithStatus` — AI genre classification

### `src/lib/timer.ts` — pure timer math
- `normalizeTimerSettings(unknown)` — validates + normalizes all timer settings from storage
- `normalizeUserAboutMe(unknown)` — validates + trims to 4000 chars
- `normalizeMiniGoalText(unknown)` — trims + limits mini-goal text
- `createMiniGoals(string[])` — converts raw strings to `MiniGoal[]`
- `getIntervalPhase(elapsedMs, settings)` — returns current work/break phase state

### `src/hooks/useAudioLibrary.ts` — global stateful hook
- Owns: tracks list, currentTrack, isPlaying, volume, progress, timer state, mini-goals, profiles
- Consumed only by `App.tsx` — props flow down to `FocusPlayer`

### `src/App.tsx` — root
- Instantiates `useAudioLibrary()`
- Manages `windowPinned` state
- Renders `FocusPlayer` with all props

### `src/components/player/FocusPlayer.tsx` — main shell
- Renders: `ThumbnailBackground`, `focus-atmosphere`, `focus-vignette`, header, profile picker, mobile menu, center timer + goals, footer player controls
- Imports all child components
- **Does NOT own state** — receives everything via props

### `src/components/settings/TimerSettings.tsx` — settings panel
- Has an AI "Generate" button that calls `generateMiniGoalsDetailed`
- On success: updates both the Work Goal input (with `improvedGoal`) and mini-goals list
- `handleApply` persists all draft settings to parent via `onTimerSettingsChange`

### `src/components/settings/ProfilePicker.tsx` — profile + "About me"
- Contains `<textarea maxLength={4000}>` for the userAboutMe field
- Save button calls `onUserAboutMeChange` which propagates up to `App.tsx` → `TimerSettings`

### `src/components/player/ThumbnailBackground.tsx` — animated backdrop
- Crossfades between two thumbnail URLs using CSS animations
- Three overlapping blurred image layers (far/mid/near) with independent drift animations
- When `isPlaying=true` → breathing animation intensifies and opacity/saturation increases

---

## 5. State flow (simplified)

```
useAudioLibrary()  (hooks/useAudioLibrary.ts)
    │
    └─ App.tsx  [windowPinned state here]
         │
         └─ FocusPlayer  (props only: no local state for audio)
              ├─ ThumbnailBackground  (thumbnail, isPlaying)
              ├─ HeaderControls  (pin toggle)
              ├─ ProfilePicker  (userAboutMe editor)
              ├─ TimerSettingsModal  (goal, mini-goals, voice, duration)
              ├─ MusicLibrary  (track list + import)
              ├─ MiniGoalChecklist  (inline checkbox editing on main screen)
              └─ PlaybackControls  (seek bar, play/pause, volume)
```

---

## 6. AI / Gemini integration

| Feature | Location |
|---|---|
| Mini-goal generation | `src/lib/gemini.ts` → `generateMiniGoalsDetailed` |
| Mini-goal UI trigger | `src/components/settings/TimerSettings.tsx` → `requestMiniGoals` |
| improvedGoal applied | `TimerSettings.tsx` lines ~249-258: sets `goalDraft` + `draftSettings.goal` |
| userAboutMe storage | `TimerSettings.userAboutMe` field in `TimerSettings` type |
| userAboutMe UI | `ProfilePicker.tsx` → textarea |
| Track genre AI | `src/lib/gemini.ts` → `categorizeTrackWithStatus` |

**Prompt design:** The Gemini prompt explicitly instructs the model that `userAboutMe` is psychological / contextual memory (not a literal task list), and to use it to reduce friction and adapt to the user's anxieties or role.

---

## 7. CSS architecture

All styles live in **`src/styles.css`** — one file, no modules, no preprocessor.

Major sections (search by comment heading):
- `:root` — design tokens (colors, fonts)
- `.boot` — loading screen
- `.focus-shell` — root layout (3-row grid: header / main / footer)
- `.thumbnail-bg` — animated blurred backdrop layers (**new**)
- `.focus-atmosphere` — static CSS gradient overlay above thumbnail
- `.focus-vignette` — dark radial vignette for readability
- `.focus-top` / `.focus-center` / `.focus-bottom` — layout sections
- `.icon-btn` — shared icon button styles
- `.mini-goals-list` / `.mini-goal-input` / `.mini-goal-check` — task list styles
- `.timer-display` — large center timer
- `.now-playing` / `.cover` / `.now-meta` — footer track info
- `.transport-strip` / `.seek-bar` / `.volume-bar` — playback controls
- `.timer-settings-*` — settings panel overlay
- `.profile-popover` / `.profile-about-me-*` — profile picker panel
- `.is-window-pinned` — compact pinned window mode overrides (at bottom of file)

**z-index layers (low → high):**
1. `thumbnail-bg` (z-index: 0)
2. `focus-atmosphere` (z-index: 0)
3. `focus-vignette` (z-index: 1)
4. `focus-top / focus-center / focus-bottom` (z-index: 2)
5. Overlays: library drawer, settings panel, profile popover (z-index: 10+)

---

## 8. Window pin mode

- **What it does:** shrinks window to 360×420 px, pins top-right, always-on-top, removes title bar
- **State:** `windowPinned: boolean` in `App.tsx`
- **CSS class:** `is-window-pinned` on `.focus-shell`
- **Key CSS rules:** `.focus-shell.is-window-pinned .focus-top-right > :not(.window-pin-control)` hides all header buttons except the pin button itself
- **Pin button:** `.window-pin-btn` / `.window-pin-btn.is-active` — purple glow when pinned
- **Tauri logic:** `src/lib/window.ts` → `setWindowPinned()` / `restoreWindowPin()`

---

## 9. Commands reference

| Command | What it does |
|---|---|
| `npm run tauri dev` | Dev server + Tauri window |
| `npm run build` | Vite + tsc production build |
| `npm run typecheck` | `tsc --noEmit` only |
| `npm test` | Vitest (63 tests) |
| `npm run release:build` | Full release: icons + Rust + portable .exe |

**Test files live next to the files they test** (`src/lib/gemini.ts` → `src/lib/gemini.test.ts`), except component tests which live in `src/components/*.test.tsx`.

---

## 10. Environment variables

| Variable | Required | Description |
|---|---|---|
| `VITE_GEMINI_API_KEY` | Optional | Enables AI mini-goals and track genre classification |
| `VITE_GEMINI_MODEL` | Optional | Override Gemini model (default: `gemini-2.0-flash`) |

Set in `.env.local` (never committed). See `.env.example` for the template.

---

## 11. Common task recipes for AI agents

### Add a new setting to TimerSettings
1. Add field to `TimerSettings` interface in `src/types.ts`
2. Add default to `DEFAULT_TIMER_SETTINGS` in `src/types.ts`
3. Handle in `normalizeTimerSettings` in `src/lib/timer.ts`
4. Add UI in `src/components/settings/TimerSettings.tsx`
5. Pass through in `App.tsx` → `useAudioLibrary.ts` if needed

### Modify the Gemini prompt
- Edit the `prompt` array in `generateMiniGoalsDetailed` in `src/lib/gemini.ts`
- Update the `responseSchema` if adding new JSON fields
- Update `MiniGoalGenerationResult` interface if adding new return values
- Update `gemini.test.ts` if the expected prompt strings change

### Add a new CSS component
- Append styles to the appropriate section in `src/styles.css`
- Use existing CSS variable/token names for colors
- Do NOT use Tailwind or CSS modules

### Change the animated background
- Component: `src/components/player/ThumbnailBackground.tsx`
- Styles: `src/styles.css` section `THUMBNAIL BACKGROUND`
- The component receives `thumbnail?: string` and `isPlaying: boolean`

### Modify mini-goal behavior
- Generation: `src/lib/gemini.ts`
- UI (settings panel): `src/components/settings/TimerSettings.tsx`
- UI (main screen checklist): `src/components/tasks/MiniGoalChecklist.tsx`
- Data normalization: `src/lib/timer.ts`

---

## 12. Important constraints

- **No Tailwind** — vanilla CSS only
- **Single CSS file** — all styles in `src/styles.css`
- **`src/types.ts` is the type source of truth** — add new types there, not inline
- **Tests must pass** after any change: `npm test`
- **Typecheck must pass**: `npm run typecheck`
- **`userAboutMe` is AI memory, not a task list** — treat it as psychological context
- **The `mini-goal-input` has no focus border** — intentionally ultra-minimal
- The `release/FocusFlow-portable.exe` is a build artifact, do not manually edit
