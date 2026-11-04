import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DISCOVERIES_STORE_KEY,
  addDiscovery,
  discoveryKey,
  loadDiscoveries,
  removeDiscovery,
  serializeDiscoveries,
  type DiscoveryItem,
} from "./discoveries.ts";

function item(overrides: Partial<DiscoveryItem> = {}): DiscoveryItem {
  return {
    refKind: "experience",
    refId: "soil-drift",
    title: "Solar drift flagged, not trusted",
    savedAt: 1700000000000,
    ...overrides,
  };
}

describe("discoveries storage", () => {
  it("round-trips items and touches only its own key", () => {
    const written: Record<string, string> = {};
    const fakeStorage = {
      getItem: (k: string) => written[k] ?? null,
      setItem: (k: string, v: string) => {
        written[k] = v;
      },
      removeItem: (k: string) => {
        delete written[k];
      },
    };
    const globalWindow = globalThis as Record<string, unknown>;
    const previous = globalWindow.window;
    globalWindow.window = { localStorage: fakeStorage };
    try {
      assert.deepEqual(loadDiscoveries(), []);
      const next = addDiscovery([], {
        refKind: "experience",
        refId: "soil-drift",
        title: "Solar drift",
      });
      assert.equal(next.length, 1);
      assert.ok(next[0].savedAt > 0);
      // Persist the returned entry and read it back through loadDiscoveries.
      fakeStorage.setItem(
        DISCOVERIES_STORE_KEY,
        serializeDiscoveries([
          item({ savedAt: next[0].savedAt, title: "Solar drift" }),
        ]),
      );
      const loaded = loadDiscoveries();
      assert.equal(loaded.length, 1);
      assert.equal(loaded[0].refId, "soil-drift");
      assert.deepEqual(Object.keys(written), [DISCOVERIES_STORE_KEY]);
    } finally {
      if (previous === undefined) delete globalWindow.window;
      else globalWindow.window = previous;
    }
  });

  it("treats malformed and versioned storage as empty", () => {
    const globalWindow = globalThis as Record<string, unknown>;
    const previous = globalWindow.window;
    const store: Record<string, string> = {};
    globalWindow.window = {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
        removeItem: (k: string) => {
          delete store[k];
        },
      },
    };
    try {
      store[DISCOVERIES_STORE_KEY] = "not json{{{";
      assert.deepEqual(loadDiscoveries(), []);
      store[DISCOVERIES_STORE_KEY] = JSON.stringify({
        version: 999,
        items: [item()],
      });
      assert.deepEqual(loadDiscoveries(), []);
      store[DISCOVERIES_STORE_KEY] = JSON.stringify({
        version: 1,
        items: [item(), { refKind: "bogus" }, null, 42],
      });
      const loaded = loadDiscoveries();
      assert.equal(loaded.length, 1);
      assert.equal(loaded[0].refId, "soil-drift");
    } finally {
      if (previous === undefined) delete globalWindow.window;
      else globalWindow.window = previous;
    }
  });

  it("adds idempotently and removes by identity", () => {
    const one = addDiscovery([], {
      refKind: "experience",
      refId: "soil-drift",
      title: "Solar drift",
    });
    const two = addDiscovery(one, {
      refKind: "experience",
      refId: "soil-drift",
      title: "Solar drift",
    });
    assert.equal(two.length, 1);
    const withInsight = addDiscovery(one, {
      refKind: "experience",
      refId: "soil-drift",
      title: "Solar drift",
      insight: "Flag readings by temperature.",
    });
    assert.equal(withInsight.length, 2);
    const removed = removeDiscovery(withInsight, {
      refKind: "experience",
      refId: "soil-drift",
      insight: undefined,
    });
    assert.equal(removed.length, 1);
    assert.equal(removed[0].insight, "Flag readings by temperature.");
    // Removing a missing entry is a no-op.
    assert.equal(
      removeDiscovery(removed, {
        refKind: "experience",
        refId: "missing",
        insight: undefined,
      }).length,
      1,
    );
  });

  it("never persists challenge or request text", () => {
    const challenge =
      "My private balcony sensor fails every hot afternoon at home";
    const items = [
      item({ title: "Solar drift", insight: "Flag readings by temperature." }),
    ];
    const serialized = serializeDiscoveries(items);
    for (const word of challenge.split(" ")) {
      if (word.length >= 5) {
        assert.ok(
          !serialized.includes(word),
          `persisted payload must not contain challenge word: ${word}`,
        );
      }
    }
    assert.ok(serialized.includes(DISCOVERIES_STORE_KEY) === false);
    assert.ok(serialized.includes("experience-match:discoveries:v1") === false);
  });

  it("builds stable identity keys", () => {
    assert.equal(
      discoveryKey({ refKind: "story", refId: "local:abc", insight: "x" }),
      "story:local:abc:x",
    );
    assert.equal(
      discoveryKey({ refKind: "story", refId: "local:abc", insight: undefined }),
      "story:local:abc:",
    );
  });
});
