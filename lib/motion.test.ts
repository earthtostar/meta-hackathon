import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clamp01,
  entranceDelay,
  prefersReducedMotion,
  scrollProgress,
} from "./motion.ts";

describe("clamp01", () => {
  it("clamps into range and rejects non-finite input", () => {
    assert.equal(clamp01(0.4), 0.4);
    assert.equal(clamp01(0), 0);
    assert.equal(clamp01(1), 1);
    assert.equal(clamp01(-3), 0);
    assert.equal(clamp01(2.5), 1);
    assert.equal(clamp01(Number.NaN), 0);
    assert.equal(clamp01(Number.POSITIVE_INFINITY), 0);
  });
});

describe("scrollProgress", () => {
  it("maps element travel to 0..1 over the span", () => {
    assert.equal(scrollProgress(200, 200, 800), 0);
    assert.equal(scrollProgress(-100, 200, 800), 0.5);
    assert.equal(scrollProgress(-400, 200, 800), 1);
    assert.equal(scrollProgress(-2000, 200, 800), 1);
  });

  it("accepts window-scroll coordinates", () => {
    assert.equal(scrollProgress(-240, 0, 800, 0.6), 0.5);
  });

  it("returns 0 for unusable inputs", () => {
    assert.equal(scrollProgress(0, 0, 0), 0);
    assert.equal(scrollProgress(0, 0, -100), 0);
    assert.equal(scrollProgress(0, 0, 800, 0), 0);
    assert.equal(scrollProgress(Number.NaN, 0, 800), 0);
  });
});

describe("prefersReducedMotion", () => {
  it("is a boolean and never throws", () => {
    assert.equal(typeof prefersReducedMotion(), "boolean");
  });
});

describe("entranceDelay", () => {
  it("staggers by step and clamps bad input", () => {
    assert.equal(entranceDelay(0), 0);
    assert.equal(entranceDelay(1), 90);
    assert.equal(entranceDelay(3), 270);
    assert.equal(entranceDelay(2, 120), 240);
    assert.equal(entranceDelay(-1), 0);
    assert.equal(entranceDelay(Number.NaN), 0);
  });
});
