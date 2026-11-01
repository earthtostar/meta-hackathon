import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EXPERIENCE_BY_ID } from "./experiences.ts";
import { PROFILE_BY_ID } from "./profiles.ts";
import { profileForSceneNode, sceneNodesForProfile } from "./profile-scene.ts";

describe("profile-to-scene mapping", () => {
  it("maps only to existing nodes and profiles", () => {
    for (const profileId of Object.keys(PROFILE_BY_ID)) {
      for (const nodeId of sceneNodesForProfile(profileId)) {
        assert.ok(
          EXPERIENCE_BY_ID[nodeId],
          `${profileId} maps to missing node ${nodeId}`,
        );
      }
    }
    for (const nodeId of Object.keys(EXPERIENCE_BY_ID)) {
      const profileId = profileForSceneNode(nodeId);
      if (profileId !== null) {
        assert.ok(PROFILE_BY_ID[profileId]);
        assert.ok(sceneNodesForProfile(profileId).includes(nodeId));
      }
    }
  });

  it("resolves the ESP32 case and leaves novel cards unmapped", () => {
    assert.deepEqual(sceneNodesForProfile("profile-maya"), ["esp32-restart"]);
    assert.equal(profileForSceneNode("esp32-restart"), "profile-maya");
    assert.deepEqual(sceneNodesForProfile("profile-priya"), []);
    assert.deepEqual(sceneNodesForProfile("profile-leo"), []);
    assert.deepEqual(sceneNodesForProfile("profile-nobody"), []);
    assert.equal(profileForSceneNode("unknown-node"), null);
  });

  it("supports multi-node profiles without duplicates", () => {
    const nodes = sceneNodesForProfile("profile-jonas");
    assert.deepEqual([...nodes].sort(), ["print-warp", "quad-jello"]);
    assert.equal(profileForSceneNode("print-warp"), "profile-jonas");
    assert.equal(profileForSceneNode("quad-jello"), "profile-jonas");
  });
});
