# KIVO — Distinctive Asset Design Specification

Palette frozen: use existing tokens only (`--accent`, `--teal`,
`--text-primary`, `--text-muted`, `--border-strong`). No new colors.
3D environment untouched by this phase.

## 1. Wordmark

- Text: `KIVO`, set in the product display serif
  (`--font-display`), weight 700, letter-spacing `0.14em`, uppercase.
- Lockup: symbol + `KIVO` + thin divider + `Experience Match` in
  0.8rem muted sans. One line in the header.
- Never set KIVO in body sans, never letterspace it loosely, never add
  a tagline inside the lockup.

## 2. Symbol — "The Convergence"

Two independent paths converge into one shared point: connections
between experiences and the discovery of applicable insight.

Geometry (`viewBox="0 0 32 32"`, stroke-width 2.4, round caps):

- Path A: `M4,7 C12,9 18,13 23.5,15.4` (upper path, currentColor)
- Path B: `M4,25 C12,23 18,19 23.5,16.6` (lower path, currentColor)
- Point: circle `cx=26` `cy=16` `r=2.4`, filled with `--accent`.

Rules: clear space on all sides equals the point diameter; minimum
16px; never rotate, stretch, outline, or recolor outside the palette;
no brain/sparkle/robot/network-icon substitutes.

## 3. Repeatable motif

The convergence mark at 14–18px precedes section kickers
(`.section-kicker`, `.universe-kicker`) and the results reading aid.
Same SVG, same proportions — familiarity through repetition, not
decoration.

## 4. Signature transition — "converge"

Entering result content fades in while rising 14px over ~480ms
`ease-out`; list siblings stagger 70ms; exits fade in 160ms with no
rise. Applied to match cards and insight panels on mount only —
re-renders of unchanged nodes must not replay it.
Fully disabled under `prefers-reduced-motion` by the global motion
rule; keyboard focus is never moved by the transition.

## 5. Typographic hierarchy (unchanged families)

1. Display serif, clamp 2.4–4.2rem — hero statement only.
2. Display serif, 1.5–1.9rem — section titles.
3. Sans 700, 0.78–0.8rem, +0.14em, uppercase — kickers, always with
   the motif or in `--teal`/`--accent`.
4. Sans 650, 1rem+ — controls and labels.
5. Sans 400, 0.85–0.95rem, muted — evidence, hints, quotes.
