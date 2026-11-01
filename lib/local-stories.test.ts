import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_STORIES,
  STORY_STORE_KEY,
  STORY_STORE_VERSION,
  loadLocalStories,
  newStoryId,
  removeStoryCollection,
  saveLocalStories,
  storyFieldText,
  validateLocalStory,
  validateStoryCollection,
  type LocalStory,
} from "./local-stories.ts";

const BASE: LocalStory = {
  id: "local-abc123",
  title: "Fixed a squeaky hinge",
  situation: "The kitchen cupboard hinge squeaked every time it opened.",
  constraints: "Only basic tools.",
  attempts: "Tried tightening the screws.",
  outcome: "Oiling the pin stopped the noise.",
  outcomeStatus: "resolved",
  unknowns: ["How long the fix lasts"],
  includeInMatching: false,
  updatedAt: 1700000000000,
};

function fakeStorage(initial: Record<string, string> = {}): Storage {
  const data = { ...initial };
  return {
    get length() {
      return Object.keys(data).length;
    },
    clear: () => {
      throw new Error("must not clear shared storage in tests");
    },
    getItem: (key: string) => (key in data ? data[key] : null),
    key: (index: number) => Object.keys(data)[index] ?? null,
    removeItem: (key: string) => {
      delete data[key];
    },
    setItem: (key: string, value: string) => {
      data[key] = String(value);
    },
  };
}

function envelope(stories: unknown) {
  return JSON.stringify({ version: STORY_STORE_VERSION, stories });
}

describe("story validation", () => {
  it("accepts a clean story and generates stable namespaced IDs", () => {
    assert.deepEqual(validateLocalStory({ ...BASE }), BASE);
    const a = newStoryId();
    const b = newStoryId();
    assert.ok(a.startsWith("local-") && a.length <= 64);
    assert.notEqual(a, b);
  });

  it("requires understandable content and known enums", () => {
    for (const bad of [
      null,
      "x",
      [],
      { ...BASE, title: "  " },
      { ...BASE, situation: "" },
      { ...BASE, outcome: "" },
      { ...BASE, outcomeStatus: "solved" },
      { ...BASE, title: "x".repeat(121) },
      { ...BASE, id: "has spaces" },
      { ...BASE, includeInMatching: "yes" },
      { ...BASE, unknowns: ["a", "b", "c", "d", "e", "f"] },
    ]) {
      assert.equal(validateLocalStory(bad), null);
    }
  });

  it("keeps optional fields optional", () => {
    const bare = validateLocalStory({
      ...BASE,
      constraints: "",
      attempts: "",
      unknowns: [],
    });
    assert.notEqual(bare, null);
  });

  it("bounds collections and rejects duplicate IDs", () => {
    assert.deepEqual(validateStoryCollection([]), []);
    assert.equal(validateStoryCollection([BASE, { ...BASE }]), null);
    const many = Array.from({ length: MAX_STORIES + 1 }, (_, i) => ({
      ...BASE,
      id: `local-${i}`,
    }));
    assert.equal(validateStoryCollection(many), null);
  });
});

describe("story field resolution", () => {
  it("returns verbatim story text", () => {
    assert.equal(storyFieldText(BASE, "situation"), BASE.situation);
    assert.equal(storyFieldText(BASE, "outcome"), BASE.outcome);
    assert.equal(storyFieldText(BASE, "unknowns"), "How long the fix lasts");
  });
});

describe("story storage wrappers", () => {
  it("round-trips and touches only its own key", () => {
    const storage = fakeStorage({ other: "keep" });
    assert.equal(saveLocalStories(storage, [BASE]), "ok");
    assert.deepEqual(loadLocalStories(storage), [BASE]);
    assert.equal(storage.getItem("other"), "keep");
    assert.equal(removeStoryCollection(storage), true);
    assert.equal(loadLocalStories(storage), null);
    assert.equal(storage.getItem("other"), "keep");
  });

  it("treats malformed, versioned, and failing storage as absent", () => {
    assert.equal(
      loadLocalStories(fakeStorage({ [STORY_STORE_KEY]: "not json{" })),
      null,
    );
    assert.equal(
      loadLocalStories(
        fakeStorage({ [STORY_STORE_KEY]: envelope([{ ...BASE, title: "" }]) }),
      ),
      null,
    );
    assert.equal(
      loadLocalStories(
        fakeStorage({ [STORY_STORE_KEY]: JSON.stringify({ version: 999, stories: [] }) }),
      ),
      null,
    );
    assert.equal(loadLocalStories(null), null);
    const throwing = {
      getItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
    };
    assert.equal(loadLocalStories(throwing), null);
    assert.equal(saveLocalStories(null, []), "unavailable");
    assert.equal(removeStoryCollection(null), false);
  });

  it("reports quota exhaustion distinctly", () => {
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
      removeItem: () => {},
    };
    assert.equal(saveLocalStories(full, [BASE]), "quota");
  });
});
