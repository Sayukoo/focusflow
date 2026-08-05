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
8. Wszystko ma być smooth, przyjemne, z ultra płynnymi przejściami i animacjami; całość ma być bardzo płynna i low friction. Unikaj nagłych zmian, migotania, skoków layoutu i animacji, które obniżają FPS.
9. For modal and popover transitions, prefer Framer Motion with `AnimatePresence`: animate opacity plus a restrained translate/scale, keep the backdrop calmer than the panel, and use `layout` only for small intentional shifts.
10. Every Framer Motion surface must respect accessibility: use `useReducedMotion` or `MotionConfig reducedMotion="user"`, remove transform/layout motion and use zero-duration transitions when motion is reduced, and preserve focus management, Escape handling, backdrop dismissal, and `aria-*` relationships.
11. Keep motion composited and low-friction: prefer `transform` and `opacity`, avoid animating expensive visual effects or timer/audio state, and let CSS handle simple hover/pressed feedback.

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

## Motion pattern

```tsx
const shouldReduceMotion = useReducedMotion() ?? false;
const transition = shouldReduceMotion
  ? { duration: 0 }
  : { type: "spring", stiffness: 380, damping: 32, mass: 0.72 };

<AnimatePresence initial={false}>
  {open ? (
    <motion.section
      key="surface"
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={transition}
    />
  ) : null}
</AnimatePresence>
```

Keep dialog focus inside the surface while it is open, move focus to the first useful control, return focus to the trigger after exit, and give every trigger `aria-haspopup="dialog"` plus a matching `aria-expanded` state.

## Anti-patterns

- Large paragraphs or instructional walls of text on the main canvas
- Native browser tooltips as the primary help surface
- Bright, busy, dashboard-like chrome that breaks the immersive focus look
- Hard-coded demo tracks instead of the user's imported library
