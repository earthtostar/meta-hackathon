/**
 * Local draft persistence for Experience Match.
 *
 * One current draft per browser, stored under a namespaced key. Only
 * user-authored work is persisted: form fields, the latest successful
 * clarified draft (including manual edits), clarification answers, and the
 * one-round flag. Never persisted: consent, confirmed snapshots, in-flight
 * operations, loading states, errors, or match results.
 *
 * Storage is treated as untrusted: records are validated on load, writes
 * report failure instead of throwing, and removal touches only this key.
 */

import {
  ANSWER_MAX,
  CONSTRAINTS_MAX,
  PROBLEM_MAX,
  TRIED_MAX,
  type ClarifyDraft,
} from "./clarify.ts";

export const DRAFT_STORE_KEY = "experience-match:draft:v1";
export const DRAFT_STORE_VERSION = 1;

/** UI-level bounds (inputs allow slightly more than the AI schema). */
const MAX_SUMMARY_LEN = 700;
const MAX_GOAL_LEN = 400;
const MAX_LIST_ITEM_LEN = 300;
const MAX_LIST_ITEMS = 5;
const MAX_ANSWERS = 3;

export interface StoredDraft {
  version: number;
  savedAt: number;
  problem: string;
  constraints: string;
  tried: string;
  draft: ClarifyDraft | null;
  answers: string[];
  roundUsed: boolean;
  submitted: boolean;
}

function isString(value: unknown, maxLen: number): value is string {
  return typeof value === "string" && value.length <= maxLen;
}

function isStringList(
  value: unknown,
  maxItems: number,
  maxLen: number,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) => typeof item === "string" && item.length <= maxLen)
  );
}

function validateDraftShape(data: unknown): ClarifyDraft | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (!isString(d["summary"], MAX_SUMMARY_LEN)) return null;
  if (!isString(d["goal"], MAX_GOAL_LEN)) return null;
  if (!isStringList(d["constraintsKnown"], MAX_LIST_ITEMS, MAX_LIST_ITEM_LEN)) {
    return null;
  }
  if (!isStringList(d["attemptsKnown"], MAX_LIST_ITEMS, MAX_LIST_ITEM_LEN)) {
    return null;
  }
  // Additive field: records saved before resources existed read as empty.
  const resourcesKnown =
    d["resourcesKnown"] === undefined ? [] : d["resourcesKnown"];
  if (!isStringList(resourcesKnown, MAX_LIST_ITEMS, MAX_LIST_ITEM_LEN)) {
    return null;
  }
  if (!isStringList(d["unknowns"], MAX_LIST_ITEMS, MAX_LIST_ITEM_LEN)) return null;
  if (!isStringList(d["questions"], MAX_ANSWERS, MAX_LIST_ITEM_LEN)) return null;
  return {
    summary: d["summary"],
    goal: d["goal"],
    constraintsKnown: d["constraintsKnown"],
    attemptsKnown: d["attemptsKnown"],
    resourcesKnown,
    unknowns: d["unknowns"],
    questions: d["questions"],
  };
}

/** True when there is user work worth recovering. */
export function hasMeaningfulWork(state: {
  problem: string;
  constraints: string;
  tried: string;
  draft: ClarifyDraft | null;
  answers: string[];
}): boolean {
  if (
    state.problem.trim() !== "" ||
    state.constraints.trim() !== "" ||
    state.tried.trim() !== ""
  ) {
    return true;
  }
  const draft = state.draft;
  if (
    draft &&
    (draft.summary.trim() !== "" ||
      draft.goal.trim() !== "" ||
      draft.constraintsKnown.some((s) => s.trim() !== "") ||
      draft.attemptsKnown.some((s) => s.trim() !== "") ||
      draft.resourcesKnown.some((s) => s.trim() !== "") ||
      draft.unknowns.some((s) => s.trim() !== "") ||
      draft.questions.some((s) => s.trim() !== ""))
  ) {
    return true;
  }
  return state.answers.some((s) => s.trim() !== "");
}

/** Validate an untrusted parsed value into a clean record, or reject it. */
export function validateStoredDraft(value: unknown): StoredDraft | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const v = value as Record<string, unknown>;
  if (v["version"] !== DRAFT_STORE_VERSION) return null;
  if (typeof v["savedAt"] !== "number" || !Number.isFinite(v["savedAt"])) {
    return null;
  }
  if (!isString(v["problem"], PROBLEM_MAX + 100)) return null;
  if (!isString(v["constraints"], CONSTRAINTS_MAX + 100)) return null;
  if (!isString(v["tried"], TRIED_MAX + 100)) return null;
  let draft: ClarifyDraft | null = null;
  if (v["draft"] !== null && v["draft"] !== undefined) {
    draft = validateDraftShape(v["draft"]);
    if (!draft) return null;
  }
  if (
    !Array.isArray(v["answers"]) ||
    v["answers"].length > MAX_ANSWERS ||
    v["answers"].some(
      (a) => typeof a !== "string" || a.length > ANSWER_MAX + 100,
    )
  ) {
    return null;
  }
  if (typeof v["roundUsed"] !== "boolean") return null;
  if (typeof v["submitted"] !== "boolean") return null;
  return {
    version: DRAFT_STORE_VERSION,
    savedAt: v["savedAt"],
    problem: v["problem"],
    constraints: v["constraints"],
    tried: v["tried"],
    draft,
    answers: v["answers"] as string[],
    roundUsed: v["roundUsed"],
    submitted: v["submitted"],
  };
}

export type StoreReader = Pick<Storage, "getItem">;
export type StoreWriter = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Read and validate the saved record. Never throws; null means none. */
export function loadStoredDraft(storage: StoreReader | null): StoredDraft | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(DRAFT_STORE_KEY);
    if (!raw) return null;
    return validateStoredDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

export type SaveOutcome = "ok" | "unavailable" | "quota";

/** Persist one record. Never throws; quota and blocked storage are reported. */
export function saveStoredDraft(
  storage: StoreWriter | null,
  record: StoredDraft,
): SaveOutcome {
  if (!storage) return "unavailable";
  try {
    storage.setItem(DRAFT_STORE_KEY, JSON.stringify(record));
    return "ok";
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === "QuotaExceededError" ||
        error.name === "NS_ERROR_DOM_QUOTA_REACHED")
    ) {
      return "quota";
    }
    return "unavailable";
  }
}

/** Remove only this app's draft key. Never touches other keys. */
export function removeStoredDraft(storage: StoreWriter | null): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(DRAFT_STORE_KEY);
    return true;
  } catch {
    return false;
  }
}
