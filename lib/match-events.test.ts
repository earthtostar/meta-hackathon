import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MATCHES_EVENT,
  POOL_CHANGED_EVENT,
  SHOW_NODE_EVENT,
  dispatchMatchEvent,
  listenMatchEvent,
  validateMatchesPayload,
  validateProfilePayload,
} from "./match-events.ts";

describe("match event bridge", () => {
  it("delivers payloads between panes and unsubscribes", () => {
    const target = new EventTarget();
    const seen: unknown[] = [];
    const stop = listenMatchEvent(target, MATCHES_EVENT, (detail: unknown) => {
      seen.push(detail);
    });
    dispatchMatchEvent(target, MATCHES_EVENT, { profileIds: ["profile-maya"] });
    assert.deepEqual(seen, [{ profileIds: ["profile-maya"] }]);
    stop();
    dispatchMatchEvent(target, SHOW_NODE_EVENT, { profileId: "profile-maya" });
    assert.equal(seen.length, 1);
    const pool: unknown[] = [];
    const stopPool = listenMatchEvent(target, POOL_CHANGED_EVENT, (detail: unknown) => {
      pool.push(detail);
    });
    dispatchMatchEvent(target, POOL_CHANGED_EVENT, { included: 1 });
    assert.deepEqual(pool, [{ included: 1 }]);
    stopPool();
  });

  it("validates inbound payloads", () => {
    assert.deepEqual(validateMatchesPayload({ profileIds: ["a", "a", "b"] }), [
      "a",
      "b",
    ]);
    for (const bad of [null, "x", {}, { profileIds: "a" }, { profileIds: [1] }]) {
      assert.equal(validateMatchesPayload(bad), null);
    }
    assert.equal(validateProfilePayload({ profileId: "profile-maya" }), "profile-maya");
    for (const bad of [null, {}, { profileId: "" }, { profileId: 3 }]) {
      assert.equal(validateProfilePayload(bad), null);
    }
  });
});
