import {
  EXPERIENCE_BY_ID,
  sharedReason,
  type Experience,
} from "../data/experiences.ts";
import { CARD_BY_ID } from "../data/profiles.ts";
import type { LocalStory } from "./local-stories.ts";
import type { MatchEntry } from "./match.ts";

/**
 * Compare Experiences — side-by-side comparison built only from
 * available records plus already-validated AI insights.
 *
 * Nothing here calls a provider and nothing invents fields: every row
 * renders record text, match overlaps/transfers when the compared cases
 * were actually returned together, or an honest limitation note.
 */

export type CompareSource =
  | { kind: "card"; profileId: string; cardId: string }
  | { kind: "node"; nodeId: string }
  | { kind: "story"; storyId: string };

export interface CompareRecord {
  /** Stable key: `card:<cardId>`, `node:<nodeId>`, or `story:<storyId>`. */
  key: string;
  title: string;
  kindLabel: string;
  situation: string;
  constraints: string;
  attempts: string;
  outcome: string;
  differences: string[];
  unknowns: string[];
  /** Scene node when the case appears on the shared map, else null. */
  nodeId: string | null;
  /** Profile ID when the case came from a match result, else null. */
  resultProfileId: string | null;
}

export interface CompareContext {
  matches: MatchEntry[];
  stories: Map<string, LocalStory>;
}

function storyLabel(): string {
  return "Your local experience";
}

export function compareKey(sel: CompareSource): string {
  switch (sel.kind) {
    case "card":
      return `card:${sel.cardId}`;
    case "node":
      return `node:${sel.nodeId}`;
    case "story":
      return `story:${sel.storyId}`;
  }
}

/** Resolve a selection to record fields. Returns null when unavailable. */
export function resolveCompareRecord(
  sel: CompareSource,
  ctx: CompareContext,
): CompareRecord | null {
  if (sel.kind === "card") {
    const card = CARD_BY_ID[sel.cardId];
    if (!card || card.profileId !== sel.profileId) return null;
    const match = ctx.matches.find(
      (m) => m.profileId === sel.profileId && m.cardId === sel.cardId,
    );
    return {
      key: compareKey(sel),
      title: card.title,
      kindLabel: "Fictional case",
      situation: card.situation,
      constraints: card.constraints,
      attempts: card.attempts,
      outcome: card.outcome,
      differences: [],
      unknowns: [...card.unknowns],
      nodeId: null,
      resultProfileId: match ? match.profileId : null,
    };
  }
  if (sel.kind === "node") {
    const exp: Experience | undefined = EXPERIENCE_BY_ID[sel.nodeId];
    if (!exp) return null;
    return {
      key: compareKey(sel),
      title: exp.title,
      kindLabel: "Fictional case",
      situation: exp.situation,
      constraints: exp.constraints,
      attempts: exp.attempted,
      outcome: exp.outcome,
      differences: [...exp.differences],
      unknowns: [],
      nodeId: exp.id,
      resultProfileId: null,
    };
  }
  const story = ctx.stories.get(sel.storyId);
  if (!story) return null;
  return {
    key: compareKey(sel),
    title: story.title,
    kindLabel: storyLabel(),
    situation: story.situation,
    constraints: story.constraints.trim() !== "" ? story.constraints : "None recorded.",
    attempts: story.attempts.trim() !== "" ? story.attempts : "None recorded.",
    outcome: story.outcome,
    differences: [],
    unknowns: [...story.unknowns],
    nodeId: null,
    resultProfileId: null,
  };
}

export interface CompareFieldRow {
  field: "Situation" | "Constraints" | "Attempts" | "Outcome";
  a: string;
  b: string;
}

export interface Comparison {
  a: CompareRecord;
  b: CompareRecord;
  fields: CompareFieldRow[];
  /** Documented link reason, when the two nodes are directly connected. */
  sharedLink: string | null;
  /** True when both cases were returned in the same comparison. */
  bothReturned: boolean;
  /** Overlap notes carried over from the validated match results. */
  sharedInsights: { from: string; text: string }[];
  /** Transfer notes carried over from the validated match results. */
  transferInsights: { from: string; text: string; basis: string }[];
  /** Honest limitation when comparability is thin. Null when solid. */
  limitation: string | null;
}

function matchFor(
  record: CompareRecord,
  matches: MatchEntry[],
): MatchEntry | undefined {
  if (!record.resultProfileId) return undefined;
  return matches.find((m) => m.profileId === record.resultProfileId);
}

/**
 * Build the comparison. Shared patterns come from (in order):
 * documented scene links, then validated match overlaps when both cases
 * were returned together. Transfer notes come only from validated
 * results. Anything missing becomes an explicit limitation.
 */
export function buildComparison(
  a: CompareRecord,
  b: CompareRecord,
  ctx: CompareContext,
): Comparison {
  const fields: CompareFieldRow[] = [
    { field: "Situation", a: a.situation, b: b.situation },
    { field: "Constraints", a: a.constraints, b: b.constraints },
    { field: "Attempts", a: a.attempts, b: b.attempts },
    { field: "Outcome", a: a.outcome, b: b.outcome },
  ];
  const sharedLink =
    a.nodeId && b.nodeId ? sharedReason(a.nodeId, b.nodeId) : null;
  const matchA = matchFor(a, ctx.matches);
  const matchB = matchFor(b, ctx.matches);
  const bothReturned = Boolean(matchA && matchB);
  const sharedInsights: Comparison["sharedInsights"] = [];
  if (bothReturned && matchA && matchB) {
    for (const p of matchA.overlaps.slice(0, 3)) {
      sharedInsights.push({ from: a.title, text: p.text });
    }
    for (const p of matchB.overlaps.slice(0, 3)) {
      sharedInsights.push({ from: b.title, text: p.text });
    }
  }
  const transferInsights: Comparison["transferInsights"] = [];
  if (matchA) {
    for (const t of matchA.transfers.slice(0, 3)) {
      transferInsights.push({ from: a.title, text: t.text, basis: t.cardField });
    }
  }
  if (matchB) {
    for (const t of matchB.transfers.slice(0, 3)) {
      transferInsights.push({ from: b.title, text: t.text, basis: t.cardField });
    }
  }
  const thin =
    !sharedLink && !bothReturned && transferInsights.length === 0;
  return {
    a,
    b,
    fields,
    sharedLink,
    bothReturned,
    sharedInsights,
    transferInsights,
    limitation: thin
      ? "No documented direct link between these cases, and they were not compared in the same result set — treat any resemblance as your own judgment, not a finding."
      : null,
  };
}

export const MAX_COMPARE_SLOTS = 2;

/**
 * Toggle a selection into at most two slots: tapping a selected case
 * removes it, a third distinct case is ignored. Pure and total.
 */
export function toggleCompareSlot(
  current: CompareSource[],
  next: CompareSource,
): CompareSource[] {
  const key = compareKey(next);
  if (current.some((s) => compareKey(s) === key)) {
    return current.filter((s) => compareKey(s) !== key);
  }
  if (current.length >= MAX_COMPARE_SLOTS) return current;
  return [...current, next];
}

/** Validate raw slot payloads back into selections. */
export function validateCompareSlots(data: unknown): CompareSource[] | null {
  if (!Array.isArray(data) || data.length === 0 || data.length > MAX_COMPARE_SLOTS) {
    return null;
  }
  const out: CompareSource[] = [];
  const seen = new Set<string>();
  for (const item of data) {
    if (typeof item !== "object" || item === null) return null;
    const rec = item as Record<string, unknown>;
    let sel: CompareSource | null = null;
    if (
      rec.kind === "card" &&
      typeof rec.profileId === "string" &&
      typeof rec.cardId === "string"
    ) {
      sel = { kind: "card", profileId: rec.profileId, cardId: rec.cardId };
    } else if (rec.kind === "node" && typeof rec.nodeId === "string") {
      sel = { kind: "node", nodeId: rec.nodeId };
    } else if (rec.kind === "story" && typeof rec.storyId === "string") {
      sel = { kind: "story", storyId: rec.storyId };
    }
    if (!sel) return null;
    const key = compareKey(sel);
    if (seen.has(key)) return null;
    seen.add(key);
    out.push(sel);
  }
  return out;
}
