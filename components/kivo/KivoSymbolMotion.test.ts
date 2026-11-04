import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isHexColor, KIVO_SYMBOL_TOKENS } from "./tokens.ts";
import {
  applyPhase,
  createMotionState,
  nextSymbolPhase,
  stepMotion,
  travelerT,
} from "./KivoSymbolMotion.ts";

describe("symbol phase transitions", () => {
  it("converges only on real application traffic", () => {
    assert.equal(nextSymbolPhase("idle", "search-started"), "searching");
    assert.equal(nextSymbolPhase("searching", "results"), "converged");
    assert.equal(nextSymbolPhase("idle", "results"), "converged");
    assert.equal(nextSymbolPhase("converged", "search-started"), "searching");
  });

  it("returns to a stable pose when results clear or fail", () => {
    assert.equal(nextSymbolPhase("searching", "cleared"), "idle");
    assert.equal(nextSymbolPhase("converged", "cleared"), "idle");
    assert.equal(nextSymbolPhase("idle", "cleared"), "idle");
  });

  it("locks once departing for the explorer", () => {
    assert.equal(nextSymbolPhase("converged", "depart"), "departing");
    assert.equal(nextSymbolPhase("departing", "search-started"), "departing");
    assert.equal(nextSymbolPhase("departing", "results"), "departing");
    assert.equal(nextSymbolPhase("departing", "cleared"), "departing");
  });
});

describe("symbol motion stepping", () => {
  it("eases toward the phase target without overshooting", () => {
    const m = createMotionState(false);
    applyPhase(m, "searching");
    assert.equal(m.target, 1);
    let last = m.progress;
    for (let i = 0; i < 600; i++) {
      stepMotion(m, 1 / 60);
      assert.ok(m.progress >= last - 1e-9);
      assert.ok(m.progress <= 1);
      last = m.progress;
    }
    assert.ok(m.progress > 0.99);
  });

  it("fires the converge pulse once, then decays it", () => {
    const m = createMotionState(false);
    applyPhase(m, "converged");
    assert.equal(m.pulse, 1);
    stepMotion(m, 1);
    assert.ok(m.pulse < 1 && m.pulse >= 0);
  });

  it("snaps instantly under reduced motion", () => {
    const m = createMotionState(true);
    applyPhase(m, "searching");
    assert.equal(m.progress, 1);
    assert.equal(m.pulse, 0);
    applyPhase(m, "idle");
    assert.equal(m.progress, 0);
  });

  it("parks travelers at path mouths and runs them to the core", () => {
    assert.ok(travelerT(0, 0) < 0.01);
    assert.ok(travelerT(0, 0.15) < 0.01);
    assert.equal(travelerT(1, 0), 1);
    assert.equal(travelerT(1, 0.15), 1);
    const mid = travelerT(0.5, 0);
    assert.ok(mid > 0.5 && mid < 1);
  });
});

describe("symbol tokens", () => {
  it("exposes only valid hex colors", () => {
    for (const [name, value] of Object.entries(KIVO_SYMBOL_TOKENS)) {
      assert.ok(isHexColor(value), `${name} must be a hex color`);
    }
    assert.equal(isHexColor("red"), false);
  });
});
