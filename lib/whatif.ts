import type { ClarifyDraft } from "./clarify.ts";
import type { MatchEntry } from "./match.ts";

/**
 * What If? — relevance exploration, not prediction.
 *
 * One user constraint (or resource) is rewritten, the same matching
 * pipeline re-runs against the same candidate pool, and the new ranking
 * is diffed against the original. Everything here is pure and
 * deterministic: no model calls, no invented experiences, no outcome
 * claims. A changed constraint re-ranks the same records; it never
 * guarantees a better result.
 */

export type WhatIfField = "constraintsKnown" | "resourcesKnown";

export interface WhatIfChange {
  field: WhatIfField;
  index: number;
  from: string;
  to: string;
}

/** Rewrite one list item; null when the target does not exist. */
export function applyWhatIf(
  draft: ClarifyDraft,
  field: WhatIfField,
  index: number,
  to: string,
): ClarifyDraft | null {
  const list = draft[field];
  if (index < 0 || index >= list.length) return null;
  const next = [...list];
  next[index] = to;
  return { ...draft, [field]: next };
}

export type RankDirection = "up" | "down" | "same" | "new" | "dropped";

export interface RankDelta {
  profileId: string;
  from: number | null;
  to: number | null;
  direction: RankDirection;
}

/** Diff two rankings by profile ID. Order-only; never invents content. */
export function compareMatchOrders(
  before: MatchEntry[],
  after: MatchEntry[],
): RankDelta[] {
  const beforeIndex = new Map(before.map((m, i) => [m.profileId, i]));
  const afterIndex = new Map(after.map((m, i) => [m.profileId, i]));
  const ids = new Set([...beforeIndex.keys(), ...afterIndex.keys()]);
  const deltas: RankDelta[] = [];
  for (const id of ids) {
    const from = beforeIndex.has(id) ? (beforeIndex.get(id) as number) : null;
    const to = afterIndex.has(id) ? (afterIndex.get(id) as number) : null;
    let direction: RankDirection;
    if (from === null) direction = "new";
    else if (to === null) direction = "dropped";
    else if (to < from) direction = "up";
    else if (to > from) direction = "down";
    else direction = "same";
    deltas.push({ profileId: id, from, to, direction });
  }
  // New arrivals first, then by new rank; dropped records last.
  const rank = (d: RankDelta) => (d.to === null ? Number.MAX_SAFE_INTEGER : d.to);
  deltas.sort((a, b) => rank(a) - rank(b));
  return deltas;
}

/**
 * One honest sentence about what changed. No causal claims beyond the
 * re-ranking itself: movement means the model weighed the edited
 * constraint differently, nothing more.
 */
export function describeDelta(deltas: RankDelta[]): string {
  const moved = deltas.filter(
    (d) => d.direction === "up" || d.direction === "down",
  ).length;
  const fresh = deltas.filter((d) => d.direction === "new").length;
  const gone = deltas.filter((d) => d.direction === "dropped").length;
  if (moved === 0 && fresh === 0 && gone === 0) {
    return "Same order — the same experiences stay most relevant under this change.";
  }
  const parts: string[] = [];
  if (moved > 0) parts.push(`${moved} changed position`);
  if (fresh > 0) parts.push(`${fresh} entered the top results`);
  if (gone > 0) parts.push(`${gone} left the top results`);
  return `Re-ranked: ${parts.join(", ")}. Movement reflects the edited constraint only — not a better outcome.`;
}
