/**
 * Typed cross-pane event bridge between the match results (Composer) and
 * the 3D experience explorer. Both panes stay independent components; this
 * module is the only shared protocol. Payloads are validated by receivers.
 */

export const MATCHES_EVENT = "experience-match:matches";
export const SELECT_PROFILE_EVENT = "experience-match:select-profile";
export const SHOW_NODE_EVENT = "experience-match:show-node";
export const SCENE_EVENT = "experience-match:scene";
export const POOL_CHANGED_EVENT = "experience-match:pool-changed";
export const RETURN_TO_RESULTS_EVENT = "experience-match:return-to-results";
export const SEARCH_STARTED_EVENT = "experience-match:search-started";
export const COMPARE_SELECT_EVENT = "experience-match:compare-select";
export const NOTICE_EVENT = "experience-match:notice";

export interface MatchesPayload {
  profileIds: string[];
}

export interface SelectProfilePayload {
  profileId: string;
}

export interface ShowNodePayload {
  profileId: string;
}

export interface ScenePayload {
  available: boolean;
}

export type CompareSelectKind = "card" | "node" | "story";

export interface CompareSelectPayload {
  kind: CompareSelectKind;
  profileId?: string;
  cardId?: string;
  nodeId?: string;
  storyId?: string;
}

export type NoticeTone = "confirm" | "info" | "warn";

export interface NoticePayload {
  message: string;
  tone: NoticeTone;
}

export type MatchEventTarget = Pick<
  Window,
  "addEventListener" | "removeEventListener" | "dispatchEvent"
>;

export function dispatchMatchEvent(
  target: MatchEventTarget,
  type: string,
  detail: unknown,
): void {
  target.dispatchEvent(new CustomEvent(type, { detail }));
}

export function listenMatchEvent<T>(
  target: MatchEventTarget,
  type: string,
  listener: (detail: T) => void,
): () => void {
  const handler = (event: Event) => {
    listener((event as CustomEvent).detail as T);
  };
  target.addEventListener(type, handler as EventListener);
  return () => {
    target.removeEventListener(type, handler as EventListener);
  };
}

function isStringList(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

/** Validate an inbound matches payload; invalid data yields no highlights. */
export function validateMatchesPayload(data: unknown): string[] | null {
  if (typeof data !== "object" || data === null) return null;
  const ids = (data as Record<string, unknown>)["profileIds"];
  if (!isStringList(ids)) return null;
  return [...new Set(ids)];
}

/** Validate an inbound single-profile payload. */
export function validateProfilePayload(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const id = (data as Record<string, unknown>)["profileId"];
  return typeof id === "string" && id !== "" ? id : null;
}

/** Validate an inbound compare-selection payload. */
export function validateCompareSelectPayload(
  data: unknown,
): CompareSelectPayload | null {
  if (typeof data !== "object" || data === null) return null;
  const rec = data as Record<string, unknown>;
  if (rec.kind === "card") {
    if (typeof rec.profileId !== "string" || typeof rec.cardId !== "string") {
      return null;
    }
    return { kind: "card", profileId: rec.profileId, cardId: rec.cardId };
  }
  if (rec.kind === "node") {
    if (typeof rec.nodeId !== "string" || rec.nodeId === "") return null;
    return { kind: "node", nodeId: rec.nodeId };
  }
  if (rec.kind === "story") {
    if (typeof rec.storyId !== "string" || rec.storyId === "") return null;
    return { kind: "story", storyId: rec.storyId };
  }
  return null;
}

/** Validate an inbound notice payload; unknown tones fall back to info. */
export function validateNoticePayload(data: unknown): NoticePayload | null {
  if (typeof data !== "object" || data === null) return null;
  const rec = data as Record<string, unknown>;
  if (typeof rec.message !== "string" || rec.message.trim() === "") return null;
  const tone: NoticeTone =
    rec.tone === "confirm" || rec.tone === "warn" ? rec.tone : "info";
  return { message: rec.message, tone };
}
