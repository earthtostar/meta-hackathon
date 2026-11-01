/**
 * User-authored local experiences for Experience Match.
 *
 * A small collection (at most five) stored under its own namespaced,
 * versioned localStorage key — separate from the request-draft key, which
 * this module never touches. Stories are user-authored demo data: saved in
 * this browser only, never published, and never implying another person.
 *
 * Only stories with includeInMatching may be sent to the model, and only
 * as part of an explicit matching request. Story text is untrusted data.
 */

import { CONSTRAINTS_MAX, PROBLEM_MAX, TRIED_MAX } from "./clarify.ts";

export const STORY_STORE_KEY = "experience-match:stories:v1";
export const STORY_STORE_VERSION = 1;
export const MAX_STORIES = 5;
export const STORY_TITLE_MAX = 120;
export const STORY_OUTCOME_MAX = 1000;
export const STORY_UNKNOWNS_MAX = 5;
export const STORY_UNKNOWN_LEN = 250;
export const STORY_ID_MAX = 64;

export type StoryOutcomeStatus =
  | "resolved"
  | "partial"
  | "did-not-work"
  | "unknown";

const STORY_OUTCOMES: readonly StoryOutcomeStatus[] = [
  "resolved",
  "partial",
  "did-not-work",
  "unknown",
];

/** Card fields addressable by evidence references. */
export type StoryField =
  | "situation"
  | "constraints"
  | "attempts"
  | "outcome"
  | "unknowns";

export interface LocalStory {
  id: string;
  title: string;
  situation: string;
  constraints: string;
  attempts: string;
  outcome: string;
  outcomeStatus: StoryOutcomeStatus;
  unknowns: string[];
  includeInMatching: boolean;
  updatedAt: number;
}

/** Stable generated IDs, namespaced away from demo profile IDs. */
export function newStoryId(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `local-${Date.now().toString(36)}-${random}`;
}

function isString(value: unknown, minLen: number, maxLen: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length >= minLen &&
    value.length <= maxLen
  );
}

function isOptionalText(value: unknown, maxLen: number): value is string {
  return typeof value === "string" && value.length <= maxLen;
}

/** Validate one story record; unknown fields are dropped on success. */
export function validateLocalStory(data: unknown): LocalStory | null {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return null;
  }
  const v = data as Record<string, unknown>;
  if (
    typeof v["id"] !== "string" ||
    v["id"].length < 1 ||
    v["id"].length > STORY_ID_MAX ||
    !/^[A-Za-z0-9_-]+$/.test(v["id"])
  ) {
    return null;
  }
  if (!isString(v["title"], 1, STORY_TITLE_MAX)) return null;
  if (!isString(v["situation"], 1, PROBLEM_MAX)) return null;
  if (!isOptionalText(v["constraints"], CONSTRAINTS_MAX)) return null;
  if (!isOptionalText(v["attempts"], TRIED_MAX)) return null;
  if (!isString(v["outcome"], 1, STORY_OUTCOME_MAX)) return null;
  if (
    typeof v["outcomeStatus"] !== "string" ||
    !(STORY_OUTCOMES as readonly string[]).includes(v["outcomeStatus"])
  ) {
    return null;
  }
  if (
    !Array.isArray(v["unknowns"]) ||
    v["unknowns"].length > STORY_UNKNOWNS_MAX ||
    v["unknowns"].some(
      (u) => typeof u !== "string" || u.length > STORY_UNKNOWN_LEN,
    )
  ) {
    return null;
  }
  if (typeof v["includeInMatching"] !== "boolean") return null;
  if (typeof v["updatedAt"] !== "number" || !Number.isFinite(v["updatedAt"])) {
    return null;
  }
  return {
    id: v["id"],
    title: v["title"],
    situation: v["situation"],
    constraints: v["constraints"],
    attempts: v["attempts"],
    outcome: v["outcome"],
    outcomeStatus: v["outcomeStatus"] as StoryOutcomeStatus,
    unknowns: v["unknowns"] as string[],
    includeInMatching: v["includeInMatching"],
    updatedAt: v["updatedAt"],
  };
}

/** Validate a stored collection: an array of at most five valid stories. */
export function validateStoryCollection(data: unknown): LocalStory[] | null {
  if (!Array.isArray(data) || data.length > MAX_STORIES) return null;
  const out: LocalStory[] = [];
  const seen = new Set<string>();
  for (const item of data) {
    const story = validateLocalStory(item);
    if (!story || seen.has(story.id)) return null;
    seen.add(story.id);
    out.push(story);
  }
  return out;
}

/** Resolve a story-side evidence reference to verbatim story text. */
export function storyFieldText(story: LocalStory, field: StoryField): string {
  switch (field) {
    case "situation":
      return story.situation;
    case "constraints":
      return story.constraints;
    case "attempts":
      return story.attempts;
    case "outcome":
      return story.outcome;
    case "unknowns":
      return story.unknowns.join(" | ");
  }
}

export type StoryStoreReader = Pick<Storage, "getItem">;
export type StoryStoreWriter = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function readEnvelope(
  storage: StoryStoreReader | null,
): { version: unknown; stories: unknown } | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORY_STORE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    return { version: record["version"], stories: record["stories"] };
  } catch {
    return null;
  }
}

/** Load and validate the saved collection. Never throws; null means none. */
export function loadLocalStories(storage: StoryStoreReader | null): LocalStory[] | null {
  const envelope = readEnvelope(storage);
  if (!envelope || envelope.version !== STORY_STORE_VERSION) return null;
  return validateStoryCollection(envelope.stories);
}

export type StorySaveOutcome = "ok" | "unavailable" | "quota";

/** Persist the collection. Never throws; failures are reported. */
export function saveLocalStories(
  storage: StoryStoreWriter | null,
  stories: LocalStory[],
): StorySaveOutcome {
  if (!storage) return "unavailable";
  try {
    storage.setItem(
      STORY_STORE_KEY,
      JSON.stringify({ version: STORY_STORE_VERSION, stories }),
    );
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

/** Remove only this app's stories key. Never touches other keys. */
export function removeStoryCollection(storage: StoryStoreWriter | null): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(STORY_STORE_KEY);
    return true;
  } catch {
    return false;
  }
}
