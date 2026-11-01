/**
 * Explicit, deterministic mapping between match profile IDs and 3D scene
 * node IDs, derived from the existing demo data (profile cards adapted
 * from these experience cases). Matched only by stable IDs here — never
 * by display name, array position, or model-generated text.
 *
 * Profiles without a genuine scene counterpart (different setups or new
 * content) are intentionally unmapped: their cards stay fully usable
 * without inventing a node or relationship.
 */

import { EXPERIENCE_BY_ID } from "./experiences.ts";

const NODES_FOR_PROFILE: Record<string, string[]> = {
  "profile-maya": ["esp32-restart"],
  "profile-tomas": ["soil-drift"],
  "profile-jonas": ["print-warp", "quad-jello"],
  "profile-amara": ["soap-stall"],
  "profile-elif": ["tutor-flyers"],
  "profile-diego": ["preset-pack"],
  "profile-hana": ["news-sponsors"],
  "profile-sofie": ["blender-first"],
  "profile-rasmus": ["guitar-daily"],
  "profile-nadia": ["sheet-budget"],
};

/** Scene node IDs for a matched profile; empty when unmapped. */
export function sceneNodesForProfile(profileId: string): string[] {
  const nodes = NODES_FOR_PROFILE[profileId];
  if (!nodes) return [];
  return nodes.filter((id) => EXPERIENCE_BY_ID[id]);
}

/** Profile ID owning a scene node, or null when no profile maps to it. */
export function profileForSceneNode(nodeId: string): string | null {
  for (const profileId of Object.keys(NODES_FOR_PROFILE)) {
    const nodes = NODES_FOR_PROFILE[profileId];
    if (nodes.includes(nodeId) && EXPERIENCE_BY_ID[nodeId]) {
      return profileId;
    }
  }
  return null;
}
