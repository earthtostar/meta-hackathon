import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildComparison,
  compareKey,
  resolveCompareRecord,
  toggleCompareSlot,
  validateCompareSlots,
  MAX_COMPARE_SLOTS,
  type CompareContext,
  type CompareSource,
} from "./compare.ts";
import type { MatchEntry } from "./match.ts";
import type { LocalStory } from "./local-stories.ts";

function storyFixture(overrides: Partial<LocalStory> = {}): LocalStory {
  return {
    id: "local-compare-1",
    title: "Fixed the squeaky hinge",
    situation: "The office door hinge squeaked every time it opened.",
    constraints: "No replacement parts on hand.",
    attempts: "Oiled the hinge pin with a drop of machine oil.",
    outcome: "The squeak stopped and stayed silent for months.",
    outcomeStatus: "resolved",
    unknowns: ["Whether the oil attracts dust over a year."],
    includeInMatching: true,
    updatedAt: 1,
    ...overrides,
  };
}

function matchFixture(
  profileId: string,
  cardId: string,
  transfers: { text: string; cardId: string; cardField: "attempts" }[] = [],
): MatchEntry {
  return {
    profileId,
    cardId,
    overlaps: [
      {
        text: "Shared wording",
        requestField: "summary",
        cardId,
        cardField: "situation",
      },
    ],
    differences: [],
    unknowns: [],
    question: "Does this fit?",
    outcomeStatus: "partial",
    transfers,
  };
}

const EMPTY_CTX: CompareContext = { matches: [], stories: new Map() };

describe("compare selection", () => {
  it("toggles slots with a maximum of two", () => {
    assert.equal(MAX_COMPARE_SLOTS, 2);
    const a: CompareSource = { kind: "node", nodeId: "esp32-restart" };
    const b: CompareSource = { kind: "node", nodeId: "soil-drift" };
    const c: CompareSource = { kind: "node", nodeId: "print-warp" };
    let slots: CompareSource[] = [];
    slots = toggleCompareSlot(slots, a);
    assert.equal(slots.length, 1);
    slots = toggleCompareSlot(slots, b);
    assert.equal(slots.length, 2);
    // A third distinct case is ignored, never swapped in silently.
    slots = toggleCompareSlot(slots, c);
    assert.equal(slots.length, 2);
    assert.ok(!slots.some((s) => compareKey(s) === "node:print-warp"));
    // Tapping a selected case removes it.
    slots = toggleCompareSlot(slots, a);
    assert.deepEqual(
      slots.map((s) => compareKey(s)),
      ["node:soil-drift"],
    );
  });

  it("validates slot payloads and rejects duplicates", () => {
    const ok = validateCompareSlots([
      { kind: "node", nodeId: "esp32-restart" },
      { kind: "card", profileId: "profile-tomas", cardId: "card-soil-drift" },
    ]);
    assert.ok(ok && ok.length === 2);
    assert.equal(validateCompareSlots([]), null);
    assert.equal(
      validateCompareSlots([
        { kind: "node", nodeId: "a" },
        { kind: "node", nodeId: "b" },
        { kind: "node", nodeId: "c" },
      ]),
      null,
    );
    assert.equal(
      validateCompareSlots([
        { kind: "node", nodeId: "a" },
        { kind: "node", nodeId: "a" },
      ]),
      null,
    );
    assert.equal(validateCompareSlots([{ kind: "node" }]), null);
    assert.equal(validateCompareSlots("nope"), null);
  });
});

describe("compare resolution", () => {
  it("resolves nodes, cards, and stories to record fields", () => {
    const node = resolveCompareRecord(
      { kind: "node", nodeId: "soil-drift" },
      EMPTY_CTX,
    );
    assert.ok(node);
    assert.equal(node.nodeId, "soil-drift");
    assert.equal(node.kindLabel, "Fictional case");
    assert.ok(node.situation.length > 0);

    const card = resolveCompareRecord(
      { kind: "card", profileId: "profile-maya", cardId: "card-esp32-restart" },
      EMPTY_CTX,
    );
    assert.ok(card);
    assert.equal(card.resultProfileId, null);

    const ctx: CompareContext = {
      matches: [],
      stories: new Map([["local-compare-1", storyFixture()]]),
    };
    const story = resolveCompareRecord(
      { kind: "story", storyId: "local-compare-1" },
      ctx,
    );
    assert.ok(story);
    assert.equal(story.kindLabel, "Your local experience");
    assert.equal(story.nodeId, null);
  });

  it("returns null for unknown or mismatched references", () => {
    assert.equal(
      resolveCompareRecord({ kind: "node", nodeId: "nope" }, EMPTY_CTX),
      null,
    );
    assert.equal(
      resolveCompareRecord(
        { kind: "card", profileId: "profile-maya", cardId: "card-soil-drift" },
        EMPTY_CTX,
      ),
      null,
    );
    assert.equal(
      resolveCompareRecord({ kind: "story", storyId: "missing" }, EMPTY_CTX),
      null,
    );
  });
});

describe("buildComparison honesty", () => {
  it("uses the documented link reason when nodes are connected", () => {
    const a = resolveCompareRecord(
      { kind: "node", nodeId: "esp32-restart" },
      EMPTY_CTX,
    );
    const b = resolveCompareRecord(
      { kind: "node", nodeId: "print-warp" },
      EMPTY_CTX,
    );
    assert.ok(a && b);
    const cmp = buildComparison(a, b, EMPTY_CTX);
    // These two workshop cases share documented workshop practice;
    // either a real link reason or an explicit limitation must appear.
    assert.ok(
      (cmp.sharedLink && cmp.sharedLink.length > 0) || cmp.limitation,
    );
    if (!cmp.sharedLink && !cmp.bothReturned) {
      assert.ok(cmp.limitation && cmp.limitation.length > 0);
    }
  });

  it("carries over validated overlaps and transfers, nothing invented", () => {
    const matches = [
      matchFixture("profile-maya", "card-esp32-restart", [
        { text: "Re-test on battery", cardId: "card-esp32-restart", cardField: "attempts" },
      ]),
      matchFixture("profile-tomas", "card-soil-drift"),
    ];
    const ctx: CompareContext = { matches, stories: new Map() };
    const a = resolveCompareRecord(
      { kind: "card", profileId: "profile-maya", cardId: "card-esp32-restart" },
      ctx,
    );
    const b = resolveCompareRecord(
      { kind: "card", profileId: "profile-tomas", cardId: "card-soil-drift" },
      ctx,
    );
    assert.ok(a && b);
    assert.equal(a.resultProfileId, "profile-maya");
    const cmp = buildComparison(a, b, ctx);
    assert.equal(cmp.bothReturned, true);
    assert.equal(cmp.sharedInsights.length, 2);
    assert.equal(cmp.transferInsights.length, 1);
    assert.equal(cmp.transferInsights[0].basis, "attempts");
  });

  it("labels thin comparisons explicitly", () => {
    const a = resolveCompareRecord(
      { kind: "node", nodeId: "soap-stall" },
      EMPTY_CTX,
    );
    const b = resolveCompareRecord(
      { kind: "node", nodeId: "blender-first" },
      EMPTY_CTX,
    );
    assert.ok(a && b);
    const cmp = buildComparison(a, b, EMPTY_CTX);
    if (!cmp.sharedLink) {
      assert.ok(cmp.limitation);
      assert.match(cmp.limitation ?? "", /your own judgment/);
    }
    assert.equal(cmp.sharedInsights.length, 0);
    assert.equal(cmp.transferInsights.length, 0);
  });
});
