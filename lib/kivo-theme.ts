/**
 * KIVO theme — the single TypeScript source of truth for 3D materials and
 * lighting.
 *
 * Values mirror the semantic tokens in `app/globals.css`
 * (`--accent`, `--group-*`, `--link-idle`, …). Three.js materials cannot
 * consume CSS variables at construction time, so this module mirrors them
 * here; `lib/kivo-theme.test.ts` pins the parity. To reskin KIVO, change
 * the CSS tokens and this file together — nothing else should carry a color.
 *
 * Twilight atlas: a dusk environmental base with the pastel palette as
 * luminous signals — moonlit route tubes, lavender arrival light,
 * mint signal pulses, district lamp hues.
 */

export type ExperienceGroup = "workshop" | "market" | "learning";

export const KIVO_THEME = {
  background: "#101623",
  backgroundDeep: "#0b101b",
  surface: "#1a2334",
  surfaceRaised: "#202b40",
  surfaceSunken: "#0e1420",
  textPrimary: "#f4f1ea",
  textMuted: "#a7b4c8",
  textFaint: "#7e8da3",
  accent: "#cdb7e6",
  accentInk: "#241b38",
  accentHover: "#d9c8f0",
  teal: "#a3ddd0",
  border: "#2b3750",
  borderStrong: "#3d4c6b",
  danger: "#e89aab",
  confirm: "#a3ddd0",
  symbol: {
    background: "#0e1420",
    path: "#8fa0bd",
    pathHover: "#c9d4e8",
    core: "#cdb7e6",
    traveler: "#a3ddd0",
    rim: "#8fb4ec",
    key: "#f4f1ea",
  },
  group: {
    workshop: { base: "#5fd0b8", deep: "#2f7d6c" },
    market: { base: "#8fb4ec", deep: "#3a5e94" },
    learning: { base: "#c9a5ec", deep: "#6e4594" },
  } as Record<ExperienceGroup, { base: string; deep: string }>,
  link: { idle: "#3a4763", active: "#cdb7e6" },
  marker: { idle: "#7e8da3", active: "#cdb7e6" },
  halo: "#cdb7e6",
  city: {
    block: "#1b2540",
    blockEdge: "#2c3a58",
    windowWarm: "#f1ddea",
    windowCool: "#a3ddd0",
  },
} as const;

/** Every leaf of the theme must be a valid hex color. */
export function themeLeaves(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (typeof value === "object" && value !== null) {
    for (const v of Object.values(value)) themeLeaves(v, out);
  }
  return out;
}
