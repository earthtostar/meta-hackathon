import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EXPERIENCES,
  EXPERIENCE_BY_ID,
  LINKS,
  NODE_SOURCE_LABEL,
  linkKey,
  sharedReason,
  sourceLabelForExperience,
} from "./experiences.ts";
import { PROFILE_BY_ID } from "./profiles.ts";
import { profileForSceneNode, sceneNodesForProfile } from "./profile-scene.ts";
import {
  MATCHES_EVENT,
  RETURN_TO_RESULTS_EVENT,
  SHOW_NODE_EVENT,
  validateMatchesPayload,
} from "../lib/match-events.ts";

describe("KIVO Space data connections", () => {
  it("syncs match results to scene nodes without inventing nodes", () => {
    for (const profileId of Object.keys(PROFILE_BY_ID)) {
      const nodes = sceneNodesForProfile(profileId);
      assert.ok(Array.isArray(nodes));
      for (const nodeId of nodes) {
        assert.ok(
          EXPERIENCE_BY_ID[nodeId],
          `${profileId} maps to missing node ${nodeId}`,
        );
      }
    }
    // Profiles with no scene counterpart stay fully usable without a node.
    assert.deepEqual(sceneNodesForProfile("profile-priya"), []);
    assert.deepEqual(sceneNodesForProfile("profile-leo"), []);
    assert.deepEqual(sceneNodesForProfile("profile-nobody"), []);
  });

  it("syncs scene nodes back to their result profiles", () => {
    for (const exp of EXPERIENCES) {
      const profileId = profileForSceneNode(exp.id);
      if (profileId !== null) {
        assert.ok(PROFILE_BY_ID[profileId]);
        assert.ok(sceneNodesForProfile(profileId).includes(exp.id));
      }
    }
    assert.equal(profileForSceneNode("unknown-node"), null);
  });

  it("never maps private local stories to shared nodes", () => {
    for (const id of [
      "local-abc123",
      `local-${Date.now().toString(36)}-zz99`,
    ]) {
      assert.deepEqual(sceneNodesForProfile(id), []);
      assert.equal(sourceLabelForExperience(id), null);
    }
    for (const nodeId of Object.keys(EXPERIENCE_BY_ID)) {
      const owner = profileForSceneNode(nodeId);
      assert.ok(owner === null || !owner.startsWith("local-"));
    }
  });

  it("classifies every node source honestly", () => {
    assert.match(NODE_SOURCE_LABEL, /Fictional/);
    assert.match(NODE_SOURCE_LABEL, /not verified/);
    for (const exp of EXPERIENCES) {
      assert.equal(sourceLabelForExperience(exp.id), NODE_SOURCE_LABEL);
    }
    assert.equal(sourceLabelForExperience("unknown-node"), null);
  });

  it("derives connections only from documented link metadata", () => {
    assert.ok(LINKS.length > 0);
    for (const link of LINKS) {
      assert.ok(
        EXPERIENCE_BY_ID[link.from],
        `link from missing node ${link.from}`,
      );
      assert.ok(EXPERIENCE_BY_ID[link.to], `link to missing node ${link.to}`);
      assert.notEqual(link.from, link.to);
      assert.ok(
        link.shared.trim().length > 0,
        `link ${link.from}→${link.to} needs a reason`,
      );
      // Symmetric lookup: either order resolves the same documented reason.
      assert.equal(sharedReason(link.from, link.to), link.shared);
      assert.equal(sharedReason(link.to, link.from), link.shared);
    }
    assert.equal(sharedReason("esp32-restart", "soap-stall"), null);
    assert.equal(sharedReason("esp32-restart", "unknown-node"), null);
    assert.match(linkKey("a", "b"), /a.*b/);
    assert.notEqual(linkKey("a", "b"), linkKey("b", "a"));
  });

  it("keeps match-highlight payloads node-addressable", () => {
    const ids = validateMatchesPayload({ profileIds: ["profile-maya"] });
    assert.deepEqual(ids, ["profile-maya"]);
    const nodes = (ids ?? []).flatMap(sceneNodesForProfile);
    assert.deepEqual(nodes, ["esp32-restart"]);
    // Invalid payloads clear highlights instead of guessing.
    assert.equal(validateMatchesPayload({ profileIds: "profile-maya" }), null);
    assert.equal(validateMatchesPayload(null), null);
  });

  it("uses distinct event channels for map and results navigation", () => {
    assert.notEqual(MATCHES_EVENT, SHOW_NODE_EVENT);
    assert.notEqual(SHOW_NODE_EVENT, RETURN_TO_RESULTS_EVENT);
    assert.notEqual(MATCHES_EVENT, RETURN_TO_RESULTS_EVENT);
  });
});
