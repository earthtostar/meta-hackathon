import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DRAFT_STORE_KEY,
  DRAFT_STORE_VERSION,
  hasMeaningfulWork,
  loadStoredDraft,
  removeStoredDraft,
  saveStoredDraft,
  validateStoredDraft,
  type StoredDraft,
} from "./draft-store.ts";

const BASE: StoredDraft = {
  version: DRAFT_STORE_VERSION,
  savedAt: 1700000000000,
  problem: "My ESP32 restarts when Wi-Fi connects.",
  constraints: "Laptop USB power.",
  tried: "Tried another USB cable.",
  draft: {
    summary: "ESP32 restarts when Wi-Fi starts.",
    goal: "Find why it restarts.",
    constraintsKnown: ["Laptop USB power"],
    attemptsKnown: ["Tried another USB cable"],
    resourcesKnown: [],
    unknowns: ["Brownout or heat"],
    questions: ["What changed with the other cable?"],
  },
  answers: ["No change at all."],
  roundUsed: true,
  submitted: false,
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

describe("hasMeaningfulWork", () => {
  it("detects form text, drafts, and answers", () => {
    assert.equal(hasMeaningfulWork({ ...BASE, problem: "  ", constraints: "", tried: "", draft: null, answers: [] }), false);
    assert.equal(
      hasMeaningfulWork({ ...BASE, problem: "", constraints: "", tried: "", draft: null, answers: [] }),
      false,
    );
    assert.equal(
      hasMeaningfulWork({ ...BASE, problem: "hi", draft: null, answers: [] }),
      true,
    );
    assert.equal(
      hasMeaningfulWork({ ...BASE, problem: "", constraints: "", tried: "", answers: [] }),
      true,
    );
  });
});

describe("validateStoredDraft", () => {
  it("accepts a clean record", () => {
    assert.deepEqual(validateStoredDraft({ ...BASE }), BASE);
  });

  it("rejects malformed, versioned, and over-limit records", () => {
    for (const bad of [null, "x", 42, [], { ...BASE, version: 999 }]) {
      assert.equal(validateStoredDraft(bad), null);
    }
    assert.equal(
      validateStoredDraft({ ...BASE, problem: "x".repeat(2200) }),
      null,
    );
    assert.equal(
      validateStoredDraft({ ...BASE, answers: ["a", "b", "c", "d"] }),
      null,
    );
    assert.equal(
      validateStoredDraft({ ...BASE, submitted: "yes" }),
      null,
    );
    assert.equal(
      validateStoredDraft({ ...BASE, draft: { summary: "s" } }),
      null,
    );
  });

  it("accepts a record without a draft", () => {
    const bare = validateStoredDraft({ ...BASE, draft: null, answers: [] });
    assert.notEqual(bare, null);
    assert.equal(bare?.draft, null);
  });

  it("migrates records saved before resources existed", () => {
    const legacy = {
      ...BASE,
      draft: {
        summary: "ESP32 restarts when Wi-Fi starts.",
        goal: "Find why it restarts.",
        constraintsKnown: ["Laptop USB power"],
        attemptsKnown: ["Tried another USB cable"],
        unknowns: ["Brownout or heat"],
        questions: [],
      },
    };
    const loaded = validateStoredDraft(legacy);
    assert.notEqual(loaded, null);
    assert.deepEqual(loaded?.draft?.resourcesKnown, []);
  });
});

describe("storage wrappers", () => {
  it("round-trips through a storage object", () => {
    const storage = fakeStorage();
    assert.equal(saveStoredDraft(storage, BASE), "ok");
    assert.deepEqual(loadStoredDraft(storage), BASE);
    assert.equal(removeStoredDraft(storage), true);
    assert.equal(loadStoredDraft(storage), null);
  });

  it("only ever touches this app's key", () => {
    const storage = fakeStorage({ other: "keep" });
    saveStoredDraft(storage, BASE);
    assert.equal(storage.getItem("other"), "keep");
    assert.equal(storage.getItem(DRAFT_STORE_KEY)?.includes("ESP32"), true);
    removeStoredDraft(storage);
    assert.equal(storage.getItem("other"), "keep");
  });

  it("treats malformed JSON and failures as absent", () => {
    const storage = fakeStorage({ [DRAFT_STORE_KEY]: "not json{" });
    assert.equal(loadStoredDraft(storage), null);
    assert.equal(loadStoredDraft(null), null);
    const throwing = {
      getItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
    };
    assert.equal(loadStoredDraft(throwing), null);
    assert.equal(saveStoredDraft(null, BASE), "unavailable");
    assert.equal(removeStoredDraft(null), false);
  });

  it("reports quota exhaustion distinctly", () => {
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
      removeItem: () => {},
    };
    assert.equal(saveStoredDraft(full, BASE), "quota");
  });
});
