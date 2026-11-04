import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { KIVO_THEME, themeLeaves } from "./kivo-theme.ts";
import { KIVO_SYMBOL_TOKENS, isHexColor } from "../components/kivo/tokens.ts";

/**
 * Pins the visual contract: the TypeScript theme used by the 3D scenes
 * must carry exactly the values of the CSS semantic tokens, and the
 * KIVO symbol tokens must resolve through the same theme.
 */

function cssVar(css: string, name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  assert.ok(match, `expected CSS token --${name} to exist`);
  return match[1].trim().toLowerCase();
}

describe("kivo theme validity", () => {
  it("contains only valid hex colors", () => {
    for (const leaf of themeLeaves(KIVO_THEME)) {
      assert.ok(isHexColor(leaf), `not a hex color: ${leaf}`);
    }
  });

  it("covers every leaf the 3D scenes need", () => {
    assert.equal(typeof KIVO_THEME.accent, "string");
    assert.equal(typeof KIVO_THEME.teal, "string");
    for (const group of ["workshop", "market", "learning"] as const) {
      assert.ok(KIVO_THEME.group[group].base);
      assert.ok(KIVO_THEME.group[group].deep);
    }
    assert.ok(KIVO_THEME.link.idle && KIVO_THEME.link.active);
    assert.ok(KIVO_THEME.marker.idle && KIVO_THEME.marker.active);
  });
});

describe("css parity", () => {
  it("matches the semantic tokens in app/globals.css", () => {
    const css = readFileSync("app/globals.css", "utf8").toLowerCase();
    const pairs: [string, string][] = [
      ["background", KIVO_THEME.background],
      ["background-deep", KIVO_THEME.backgroundDeep],
      ["surface", KIVO_THEME.surface],
      ["surface-raised", KIVO_THEME.surfaceRaised],
      ["surface-sunken", KIVO_THEME.surfaceSunken],
      ["text-primary", KIVO_THEME.textPrimary],
      ["text-muted", KIVO_THEME.textMuted],
      ["text-faint", KIVO_THEME.textFaint],
      ["accent", KIVO_THEME.accent],
      ["accent-ink", KIVO_THEME.accentInk],
      ["accent-hover", KIVO_THEME.accentHover],
      ["teal", KIVO_THEME.teal],
      ["border", KIVO_THEME.border],
      ["border-strong", KIVO_THEME.borderStrong],
      ["danger", KIVO_THEME.danger],
      ["confirm", KIVO_THEME.confirm],
      ["group-workshop", KIVO_THEME.group.workshop.base],
      ["group-workshop-deep", KIVO_THEME.group.workshop.deep],
      ["group-market", KIVO_THEME.group.market.base],
      ["group-market-deep", KIVO_THEME.group.market.deep],
      ["group-learning", KIVO_THEME.group.learning.base],
      ["group-learning-deep", KIVO_THEME.group.learning.deep],
      ["link-idle", KIVO_THEME.link.idle],
      ["marker-idle", KIVO_THEME.marker.idle],
    ];
    for (const [name, value] of pairs) {
      assert.equal(cssVar(css, name), value, `--${name} drifted`);
    }
    // Active states reuse the accent by design.
    assert.equal(KIVO_THEME.link.active, KIVO_THEME.accent);
    assert.equal(KIVO_THEME.marker.active, KIVO_THEME.accent);
    assert.equal(KIVO_THEME.halo, KIVO_THEME.accent);
  });
});

describe("symbol tokens", () => {
  it("resolve through the shared theme, not duplicates", () => {
    // Every symbol token must be one of the theme's own leaves: the
    // hero reuses shared signals (core = accent arrival, pulses =
    // transfer mint, rim = moonlit mist) without carrying its own hex.
    const leaves = new Set(themeLeaves(KIVO_THEME));
    for (const [name, value] of Object.entries(KIVO_SYMBOL_TOKENS)) {
      assert.ok(leaves.has(value), `${name} must reuse a theme leaf`);
    }
    assert.equal(KIVO_SYMBOL_TOKENS.core, KIVO_THEME.accent);
    assert.equal(KIVO_SYMBOL_TOKENS.background, KIVO_THEME.symbol.background);
  });
});
