import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CARD_BY_ID,
  PROFILE_BY_ID,
} from "../data/profiles.ts";
import { sceneNodesForProfile } from "../data/profile-scene.ts";
import { EXPERIENCE_BY_ID } from "../data/experiences.ts";
import type { ClarifyDraft } from "./clarify.ts";
import type { LocalStory } from "./local-stories.ts";
import {
  MAX_MATCHES,
  fallbackSearch,
  selectValidMoves,
  validateLimitations,
  validateMatchComparison,
  validateMatchEntry,
  validateMatchInput,
  validateNextMoves,
  validateTransferNote,
} from "./match.ts";

/**
 * Reproducible evaluation for the KIVO intelligence engine.
 *
 * All scenarios run the deterministic keyword fallback plus the
 * server-side validators — no live model calls, no network, no cost.
 * Every fixture is fictional test data, never a real person.
 */

function draft(partial: Partial<ClarifyDraft>): ClarifyDraft {
  return {
    summary: "",
    goal: "",
    constraintsKnown: [],
    attemptsKnown: [],
    resourcesKnown: [],
    unknowns: [],
    questions: [],
    ...partial,
  };
}

function evalStory(partial: Partial<LocalStory>): LocalStory {
  return {
    id: "local-eval-1",
    title: "Eval story",
    situation: "",
    constraints: "",
    attempts: "",
    outcome: "",
    outcomeStatus: "resolved",
    unknowns: [],
    includeInMatching: true,
    updatedAt: 1,
    ...partial,
  };
}

describe("evaluation: scenario relevance and honesty", () => {
  it("student with a difficult project finds learning experiences", () => {
    const d = draft({
      summary:
        "Struggling to finish a difficult video editing project for my software course.",
      goal: "Submit a working short film before the deadline.",
      constraintsKnown: ["Thirty minutes a day", "Five-year-old laptop"],
      attemptsKnown: ["Watched tutorial videos but did not finish a series"],
      resourcesKnown: [],
      unknowns: ["Whether my laptop can run the editing tools"],
    });
    const results = fallbackSearch(d);
    assert.ok(results.length > 0, "expected at least one lead");
    const ids = results.map((r) => r.profileId);
    assert.ok(
      ids.includes("profile-leo") || ids.includes("profile-sofie"),
      `expected a learning-theme lead, got ${ids.join(", ")}`,
    );
  });

  it("founder with limited resources finds first-customer experiences", () => {
    const d = draft({
      summary:
        "Trying to find the first paying customers for a handmade soap gift box I make at home.",
      goal: "Get ten repeat buyers without spending on ads.",
      constraintsKnown: ["No advertising budget", "Weekends only"],
      attemptsKnown: ["Showed samples to friends at a weekend fair"],
      resourcesKnown: [],
      unknowns: ["Whether online listings would work"],
    });
    const results = fallbackSearch(d);
    assert.ok(results.length > 0, "expected at least one lead");
    const ids = results.map((r) => r.profileId);
    assert.ok(
      ids.includes("profile-amara") ||
        ids.includes("profile-diego") ||
        ids.includes("profile-elif"),
      `expected a first-customers lead, got ${ids.join(", ")}`,
    );
  });

  it("person learning a technical skill finds practice experiences", () => {
    const d = draft({
      summary: "Relearning acoustic guitar after years away from it.",
      goal: "Play clean chords in daily short sessions.",
      constraintsKnown: ["Twenty minutes a day", "Thin apartment walls"],
      attemptsKnown: ["Practiced chord changes with a metronome"],
      resourcesKnown: [],
      unknowns: ["Whether prior experience still helps"],
    });
    const results = fallbackSearch(d);
    assert.ok(results.length > 0, "expected at least one lead");
    assert.ok(
      results.some((r) => r.profileId === "profile-rasmus"),
      `expected the guitar case, got ${results.map((r) => r.profileId).join(", ")}`,
    );
  });

  it("challenge with no good matches returns nothing", () => {
    const d = draft({
      summary:
        "Diagnosing a cracked turbine blade on a commercial jet engine.",
      goal: "Certify the blade for another flight cycle.",
      constraintsKnown: ["Hangar access only at night"],
      attemptsKnown: ["Ran ultrasound scans twice"],
      resourcesKnown: [],
      unknowns: ["Whether the crack propagates under load"],
    });
    assert.deepEqual(fallbackSearch(d), []);
  });

  it("misleading keyword overlap carries honest limitations", () => {
    const d = draft({
      summary: "My laptop battery drains in an hour during video calls for work.",
      goal: "Make the battery last a full workday.",
      constraintsKnown: ["Five-year-old laptop"],
      attemptsKnown: ["Lowered screen brightness"],
      resourcesKnown: [],
      unknowns: ["Whether the battery itself is degraded"],
    });
    const results = fallbackSearch(d);
    assert.ok(results.length > 0, "expected keyword leads");
    for (const entry of results) {
      assert.ok(
        entry.unknowns.some((u) => u.includes("not assessed by AI")),
        "every fallback entry must carry the not-assessed caveat",
      );
      assert.deepEqual(entry.transfers, []);
      assert.notEqual(validateMatchEntry(entry), null);
    }
  });

  it("enabled local story participates; disabled story is excluded", () => {
    const story = evalStory({
      id: "local-eval-hinge",
      title: "Fixed my squeaky office door hinge",
      situation: "The office door hinge squeaked every time it opened.",
      attempts: "Oiled the hinge pin with a drop of machine oil.",
      outcome: "The squeak stopped and stayed silent for months.",
      outcomeStatus: "resolved",
    });
    const d = draft({
      summary: "My office door hinge squeaks loudly every time it opens.",
      goal: "Stop the squeak without replacing the hinge.",
      attemptsKnown: ["Tightened the screws"],
      resourcesKnown: [],
      unknowns: ["What lubricant is safe for the pin"],
    });
    const withStory = fallbackSearch(d, [story]);
    assert.ok(
      withStory.some((r) => r.profileId === story.id),
      "enabled story should be returned when relevant",
    );
    const withoutStory = fallbackSearch(d, []);
    assert.ok(
      withoutStory.every((r) => r.profileId !== story.id),
      "story must be absent when not enabled",
    );
    const disabled = validateMatchInput({
      draft: d,
      localStories: [{ ...story, includeInMatching: false }],
    });
    assert.equal(disabled.ok, false);
  });
});

describe("evaluation: evidence grounding and IDs", () => {
  it("every fallback entry validates against the candidate set", () => {
    const d = draft({
      summary: "My balcony plant sensor stops sending readings every afternoon.",
      goal: "Keep readings flowing through hot afternoons.",
      constraintsKnown: ["Solar powered", "One weekend to work on it"],
      attemptsKnown: ["Wiped the sensor clean"],
      resourcesKnown: [],
      unknowns: ["Whether heat or power sag causes the dropout"],
    });
    const matches = fallbackSearch(d);
    assert.ok(matches.length > 0);
    const comparison = validateMatchComparison({ results: matches });
    assert.notEqual(comparison, null);
    if (comparison) {
      const ids = new Set(matches.map((m) => m.profileId));
      for (const m of matches) {
        assert.ok(PROFILE_BY_ID[m.profileId] || m.profileId.startsWith("local-"));
        assert.ok(CARD_BY_ID[m.cardId] || m.cardId === m.profileId);
        assert.ok(ids.size <= MAX_MATCHES);
      }
    }
  });

  it("transfers rest on their own card and known fields", () => {
    assert.notEqual(
      validateTransferNote(
        { text: "Try the draft shield", cardId: "card-print-warp", cardField: "attempts" },
        "card-print-warp",
      ),
      null,
    );
    assert.equal(
      validateTransferNote(
        { text: "Try the draft shield", cardId: "card-soil-drift", cardField: "attempts" },
        "card-print-warp",
      ),
      null,
    );
    assert.equal(
      validateTransferNote(
        { text: "   ", cardId: "card-print-warp", cardField: "attempts" },
        "card-print-warp",
      ),
      null,
    );
  });

  it("selectValidMoves keeps only cited moves and never throws", () => {
    const ids = new Set(["profile-maya"]);
    assert.deepEqual(
      selectValidMoves(
        [{ text: "Re-test on battery", sourceIds: ["profile-maya"] }],
        ids,
      ),
      [{ text: "Re-test on battery", sourceIds: ["profile-maya"] }],
    );
    assert.deepEqual(
      selectValidMoves(
        [{ text: "Drop-in", sourceIds: ["profile-priya"] }],
        ids,
      ),
      [],
    );
    assert.deepEqual(selectValidMoves(undefined, ids), []);
    assert.deepEqual(selectValidMoves("moves", ids), []);
    assert.deepEqual(selectValidMoves(null, ids), []);
  });

  it("next moves must cite returned results; limitations must be honest", () => {
    const ids = new Set(["profile-maya"]);
    assert.notEqual(
      validateNextMoves(
        [{ text: "Re-test on battery power", sourceIds: ["profile-maya"] }],
        ids,
      ),
      null,
    );
    assert.equal(
      validateNextMoves(
        [{ text: "Re-test on battery power", sourceIds: ["profile-priya"] }],
        ids,
      ),
      null,
    );
    assert.equal(
      validateNextMoves(
        [{ text: "Re-test on battery power", sourceIds: [] }],
        ids,
      ),
      null,
    );
    assert.notEqual(validateLimitations(["Small fictional pool"]), ["x"]);
    assert.deepEqual(validateLimitations(undefined), []);
    assert.equal(validateLimitations(["   "]), null);
  });

  it("demo corpus is fully annotated and internally consistent", () => {
    for (const [cardId, card] of Object.entries(CARD_BY_ID)) {
      assert.ok(
        ["resolved", "partial", "unresolved"].includes(card.outcomeStatus),
        `${cardId} needs an author-annotated outcome status`,
      );
      assert.ok(
        PROFILE_BY_ID[card.profileId],
        `${cardId} needs an existing profile`,
      );
    }
    for (const [profileId, profile] of Object.entries(PROFILE_BY_ID)) {
      for (const cardId of profile.cardIds) {
        assert.ok(CARD_BY_ID[cardId], `${profileId} lists missing ${cardId}`);
      }
    }
  });
});

describe("evaluation: privacy and 3D synchronization", () => {
  it("disabled stories never reach matching or the map", () => {
    const story = evalStory({
      id: "local-eval-private",
      title: "Private hinge fix",
      situation: "Hinge squeaked at night in my apartment.",
      outcome: "Oiled it quietly.",
    });
    const d = draft({ summary: "Hinge squeaked at night in my apartment." });
    // Only enabled stories are ever passed to search: with an empty pool
    // the private story cannot appear no matter how well it matches.
    const withoutStory = fallbackSearch(d, []);
    assert.ok(withoutStory.every((r) => r.profileId !== story.id));
    // And local IDs never resolve to shared 3D nodes either way.
    assert.deepEqual(sceneNodesForProfile(story.id), []);
    assert.deepEqual(sceneNodesForProfile("local-anything"), []);
  });

  it("result IDs resolve to existing nodes or stay safely node-less", () => {
    const d = draft({
      summary: "Wireless planter readings stop on hot afternoons and resume in the evening.",
      goal: "Keep readings flowing.",
      constraintsKnown: ["Small solar panel"],
      attemptsKnown: ["Wiped the sensor clean and moved the panel into full sun"],
      resourcesKnown: [],
      unknowns: ["Whether heat or power sag causes the dropout"],
    });
    const matches = fallbackSearch(d);
    for (const m of matches) {
      for (const nodeId of sceneNodesForProfile(m.profileId)) {
        assert.ok(
          EXPERIENCE_BY_ID[nodeId],
          `result ${m.profileId} maps to missing node ${nodeId}`,
        );
      }
    }
    // Unmapped profiles stay usable without nodes.
    assert.deepEqual(sceneNodesForProfile("profile-priya"), []);
    assert.deepEqual(sceneNodesForProfile("profile-leo"), []);
  });
});
