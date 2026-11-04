import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyWhatIf,
  compareMatchOrders,
  describeDelta,
} from "./whatif.ts";
import type { MatchEntry } from "./match.ts";

function entry(profileId: string): MatchEntry {
  return {
    profileId,
    cardId: `${profileId}:card`,
    overlaps: [],
    differences: [],
    unknowns: [],
    question: "",
    outcomeStatus: "partial",
    transfers: [],
  };
}

const DRAFT = {
  summary: "s",
  goal: "g",
  constraintsKnown: ["One weekend", "No budget"],
  attemptsKnown: [],
  resourcesKnown: ["A soldering iron"],
  unknowns: [],
  questions: [],
};

describe("applyWhatIf", () => {
  it("rewrites exactly one list item", () => {
    const next = applyWhatIf(DRAFT, "constraintsKnown", 1, "Small budget");
    assert.deepEqual(next?.constraintsKnown, ["One weekend", "Small budget"]);
    // Original untouched.
    assert.deepEqual(DRAFT.constraintsKnown, ["One weekend", "No budget"]);
  });

  it("supports resources and rejects bad indexes", () => {
    const next = applyWhatIf(DRAFT, "resourcesKnown", 0, "Borrowed scope");
    assert.deepEqual(next?.resourcesKnown, ["Borrowed scope"]);
    assert.equal(applyWhatIf(DRAFT, "constraintsKnown", 9, "x"), null);
    assert.equal(applyWhatIf(DRAFT, "constraintsKnown", -1, "x"), null);
  });
});

describe("compareMatchOrders", () => {
  it("detects movement, arrivals, and drops", () => {
    const before = [entry("a"), entry("b"), entry("c")];
    const after = [entry("c"), entry("d"), entry("a")];
    const deltas = compareMatchOrders(before, after);
    const byId = new Map(deltas.map((d) => [d.profileId, d]));
    assert.equal(byId.get("c")?.direction, "up");
    assert.equal(byId.get("a")?.direction, "down");
    assert.equal(byId.get("d")?.direction, "new");
    assert.equal(byId.get("b")?.direction, "dropped");
  });

  it("marks identical rankings as same", () => {
    const before = [entry("a"), entry("b")];
    const deltas = compareMatchOrders(before, [entry("a"), entry("b")]);
    assert.ok(deltas.every((d) => d.direction === "same"));
  });

  it("handles an empty original set", () => {
    const deltas = compareMatchOrders([], [entry("a")]);
    assert.equal(deltas.length, 1);
    assert.equal(deltas[0].direction, "new");
  });
});

describe("describeDelta", () => {
  it("states plainly when nothing changed", () => {
    assert.match(
      describeDelta(compareMatchOrders([entry("a")], [entry("a")])),
      /Same order/,
    );
  });

  it("counts moves without causal claims", () => {
    const text = describeDelta(
      compareMatchOrders(
        [entry("a"), entry("b"), entry("c")],
        [entry("c"), entry("d"), entry("a")],
      ),
    );
    assert.match(text, /2 changed position/);
    assert.match(text, /1 entered/);
    assert.match(text, /1 left/);
    assert.match(text, /not a better outcome/);
  });
});
