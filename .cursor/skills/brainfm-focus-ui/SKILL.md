---
name: brainfm-focus-ui
description: Enforces a Brain.fm-inspired focus-player UI with almost no visible text and KaTeX tooltips for all labels/help. Use when building or editing FocusFlow UI, player controls, library panels, tooltips, or any screen that should stay visually close to Brain.fm.
---

# Brain.fm Focus UI

## Rules

1. Keep visible text minimal. Prefer icons, glyphs, and short pills over sentences.
2. Put explanatory copy, shortcuts, filenames, folder paths, and status details inside KaTeX tooltips via `KaTeXTooltip`.
3. Preserve accessibility: every interactive control needs an `aria-label` even when the visible label is an icon.
4. Match the focus-player composition:
   - dark abstract atmosphere background
   - top mode pill + sparse icon actions
   - huge centered timer
   - bottom now-playing / transport / volume row
5. Use calm dark tones (bronze, midnight blue, soft neutrals) with white foreground and occasional red accent for volume/notifications.
6. Do not copy Brain.fm branding, logos, or proprietary assets. Keep the product identity as FocusFlow / local music.
7. Local music is first-class: library actions must support import into the managed AppData `music` folder and opening that folder.

## Tooltip pattern

```tsx
import { KaTeXTooltip } from "./components/KaTeXTooltip";

<KaTeXTooltip formula="\\text{Play}">
  <button type="button" aria-label="Play" onClick={onPlay}>
    ▶
  </button>
</KaTeXTooltip>
```

Use `\\text{...}` for plain labels. Escape special TeX characters in dynamic strings.

## Anti-patterns

- Large paragraphs or instructional walls of text on the main canvas
- Native browser tooltips as the primary help surface
- Bright, busy, dashboard-like chrome that breaks the immersive focus look
- Hard-coded demo tracks instead of the user's imported library
