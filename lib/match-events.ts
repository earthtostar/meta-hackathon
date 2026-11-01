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
