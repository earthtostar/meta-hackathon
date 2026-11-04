/**
 * KIVO hero-signal design tokens.
 *
 * Resolved through the shared product theme (`lib/kivo-theme.ts`) so the
 * hero city, atlas lighting, and fallback always match the interface
 * palette. To reskin, change the CSS tokens and `lib/kivo-theme.ts`
 * together — this file follows automatically.
 */

import { KIVO_THEME } from "../../lib/kivo-theme.ts";

export const KIVO_SYMBOL_TOKENS = {
  /** Scene background and fog. */
  background: KIVO_THEME.symbol.background,
  /** The two independent paths: muted slate with a metallic finish. */
  path: KIVO_THEME.symbol.path,
  /** Hover lift on the paths. */
  pathHover: KIVO_THEME.symbol.pathHover,
  /** The shared point and new direction: product accent. */
  core: KIVO_THEME.symbol.core,
  /** Travelers riding each path toward the shared point. */
  traveler: KIVO_THEME.symbol.traveler,
  /** Cool rim light that carves the silhouette. */
  rim: KIVO_THEME.symbol.rim,
  /** Warm key light. */
  key: KIVO_THEME.symbol.key,
} as const;

export type KivoSymbolTokens = typeof KIVO_SYMBOL_TOKENS;

/** Hex sanity check shared with tests: tokens must stay valid colors. */
export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}
