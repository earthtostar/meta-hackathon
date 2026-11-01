"use client";

import { useEffect, useRef, useState } from "react";
import { CARD_BY_ID, FICTIONAL_NOTICE, PROFILE_BY_ID } from "../data/profiles";
import { sceneNodesForProfile } from "../data/profile-scene";
import {
  MATCHES_EVENT,
  POOL_CHANGED_EVENT,
  SCENE_EVENT,
  SELECT_PROFILE_EVENT,
  SHOW_NODE_EVENT,
  dispatchMatchEvent,
  listenMatchEvent,
  validateProfilePayload,
  type ScenePayload,
  type ShowNodePayload,
} from "../lib/match-events";
import {
  loadLocalStories,
  storyFieldText,
  type LocalStory,
} from "../lib/local-stories";
import {
  cardFieldText,
  draftFieldText,
  type MatchEntry,
  type MatchEvidenceField,
  type MatchOutcomeStatus,
} from "../lib/match";
import {
  DRAFT_STORE_VERSION,
  hasMeaningfulWork,
  loadStoredDraft,
  removeStoredDraft,
  saveStoredDraft,
  type StoredDraft,
} from "../lib/draft-store";

const PROBLEM_MIN = 20;
const PROBLEM_MAX = 2000;
const CONSTRAINTS_MAX = 500;
const TRIED_MAX = 1000;
const ANSWER_MAX = 1000;

interface ExampleRequest {
  label: string;
  problem: string;
  constraints: string;
  tried: string;
}

const EXAMPLES: ExampleRequest[] = [
  {
    label: "Debug a prototype",
    problem:
      "Fictional example: my balcony plant sensor stops sending readings every afternoon and only recovers after I unplug it overnight.",
    constraints: "Fictional: runs on a small solar panel; I have one weekend to work on it.",
    tried:
      "Fictional: I wiped the sensor clean and moved the panel into full sun, but the dropout still happens.",
  },
  {
    label: "Find first users",
    problem:
      "Fictional example: I made a printable weekly planner for night-shift nurses and want to find the first ten people who would try it.",
    constraints: "Fictional: no advertising budget; I can spend two evenings a week.",
    tried:
      "Fictional: I showed it to two nurse friends, who liked the layout but were unsure about printing it.",
  },
  {
    label: "Learn a new tool",
    problem:
      "Fictional example: I want to learn basic video editing so I can cut our family trip footage into a short film.",
    constraints: "Fictional: about thirty minutes a day; my laptop is five years old.",
    tried:
      "Fictional: I watched the openings of three different tutorial series but have not finished any of them.",
  },
];

type FormErrors = {
  problem?: string;
  constraints?: string;
  tried?: string;
};

interface AiDraft {
  summary: string;
  goal: string;
  constraintsKnown: string[];
  attemptsKnown: string[];
  unknowns: string[];
  questions: string[];
}

type AiState = "idle" | "clarifying" | "draft" | "confirmed" | "error";

type MatchUiState = "idle" | "matching" | "results" | "error";

// One AI request at a time per browser session (in-memory guard; the server
// also throttles). Never persisted.
let sessionInFlight = false;

function emptyDraft(): AiDraft {
  return {
    summary: "",
    goal: "",
    constraintsKnown: [],
    attemptsKnown: [],
    unknowns: [],
    questions: [],
  };
}

export default function Composer() {
  const [problem, setProblem] = useState("");
  const [constraints, setConstraints] = useState("");
  const [tried, setTried] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [exampleNote, setExampleNote] = useState<string | null>(null);

  const [aiState, setAiState] = useState<AiState>("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const [draft, setDraft] = useState<AiDraft>(emptyDraft);
  const [answers, setAnswers] = useState<string[]>([]);
  const [roundUsed, setRoundUsed] = useState(false);
  const [confirmedSnapshot, setConfirmedSnapshot] = useState<string | null>(
    null,
  );
  const abortRef = useRef<AbortController | null>(null);
  const matchAbortRef = useRef<AbortController | null>(null);
  const matchSeqRef = useRef(0);
  const matchTitleRef = useRef<HTMLHeadingElement | null>(null);
  const matchLoadingRef = useRef<HTMLParagraphElement | null>(null);
  const matchErrorTitleRef = useRef<HTMLHeadingElement | null>(null);
  const prevMatchUiRef = useRef<MatchUiState>("idle");
  const [matchUi, setMatchUi] = useState<MatchUiState>("idle");
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [matchStories, setMatchStories] = useState<LocalStory[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [sceneAvailable, setSceneAvailable] = useState<boolean | null>(null);
  const problemRef = useRef<HTMLTextAreaElement | null>(null);
  const constraintsRef = useRef<HTMLInputElement | null>(null);
  const triedRef = useRef<HTMLTextAreaElement | null>(null);
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const previewTitleRef = useRef<HTMLHeadingElement | null>(null);
  const draftTitleRef = useRef<HTMLHeadingElement | null>(null);
  const draftErrorTitleRef = useRef<HTMLHeadingElement | null>(null);
  const confirmNoteRef = useRef<HTMLParagraphElement | null>(null);
  const loadingRef = useRef<HTMLParagraphElement | null>(null);
  const prevSubmittedRef = useRef(false);
  const prevAiStateRef = useRef<AiState>("idle");
  const storeGenRef = useRef(0);
  const recoveryTitleRef = useRef<HTMLHeadingElement | null>(null);
  const startOverRef = useRef<HTMLButtonElement | null>(null);
  const confirmResetRef = useRef<HTMLButtonElement | null>(null);
  const [pendingRecovery, setPendingRecovery] = useState<StoredDraft | null>(null);
  const [storeReady, setStoreReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "failed" | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);

  function safeStorage(): Storage | null {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  function isEmptyDraft(value: AiDraft): boolean {
    return (
      value.summary === "" &&
      value.goal === "" &&
      value.constraintsKnown.length === 0 &&
      value.attemptsKnown.length === 0 &&
      value.unknowns.length === 0 &&
      value.questions.length === 0
    );
  }

  // Load once, client-side only. Autosave stays off until the recovery
  // choice resolves, so initial empty state can never overwrite saved work.
  useEffect(() => {
    const saved = loadStoredDraft(safeStorage());
    if (saved && hasMeaningfulWork(saved)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time restore from browser storage, runs once
      setPendingRecovery(saved);
    } else {
      setStoreReady(true);
    }
  }, []);

  useEffect(() => {
    if (pendingRecovery) recoveryTitleRef.current?.focus();
  }, [pendingRecovery]);

  useEffect(() => {
    if (confirmingReset) confirmResetRef.current?.focus();
  }, [confirmingReset]);

  // Save synchronously on every change, so recent typing survives a refresh
  // without relying on unmount. Clears the key when nothing is left to save.
  useEffect(() => {
    if (!storeReady || pendingRecovery) return;
    if (!hasMeaningfulWork({ problem, constraints, tried, draft, answers })) {
      removeStoredDraft(safeStorage());
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing the save indicator alongside the stored key
      setSaveStatus(null);
      return;
    }
    const outcome = saveStoredDraft(safeStorage(), {
      version: DRAFT_STORE_VERSION,
      savedAt: Date.now(),
      problem,
      constraints,
      tried,
      draft: isEmptyDraft(draft) ? null : draft,
      answers,
      roundUsed,
      submitted,
    });
    setSaveStatus(outcome === "ok" ? "saved" : "failed");
  }, [storeReady, pendingRecovery, problem, constraints, tried, draft, answers, roundUsed, submitted]);

  // Every view swap (preview, draft, error) replaces the form in place.
  // Move focus to the new heading so the result lands in view instead of
  // leaving focus where the clicked button just unmounted.
  useEffect(() => {
    const wasSubmitted = prevSubmittedRef.current;
    prevSubmittedRef.current = submitted;
    if (submitted) {
      previewTitleRef.current?.focus();
    } else if (wasSubmitted) {
      problemRef.current?.focus();
    }
  }, [submitted]);

  useEffect(() => {
    const prev = prevAiStateRef.current;
    prevAiStateRef.current = aiState;
    if (aiState === "clarifying" && prev !== "clarifying") {
      loadingRef.current?.focus();
    } else if (
      prev === "clarifying" &&
      (aiState === "draft" || aiState === "confirmed" || aiState === "error")
    ) {
      if (aiState === "error") {
        draftErrorTitleRef.current?.focus();
      } else {
        draftTitleRef.current?.focus();
      }
    } else if (
      aiState === "confirmed" &&
      prev === "draft"
    ) {
      confirmNoteRef.current?.focus();
    } else if (
      aiState === "idle" &&
      (prev === "draft" || prev === "confirmed" || prev === "error")
    ) {
      problemRef.current?.focus();
    }
  }, [aiState]);

  // Match results replace nothing but arrive below the fold; bring each
  // outcome into view exactly once, on arrival.
  useEffect(() => {
    const prev = prevMatchUiRef.current;
    prevMatchUiRef.current = matchUi;
    if (matchUi === "matching" && prev !== "matching") {
      matchLoadingRef.current?.focus();
    } else if (matchUi === "results" && prev === "matching") {
      matchTitleRef.current?.focus();
    } else if (matchUi === "error" && prev === "matching") {
      matchErrorTitleRef.current?.focus();
    }
  }, [matchUi]);

  // Editing the approved draft invalidates old matches: drop them and ignore
  // any response still in flight.
  function clearMatches() {
    matchSeqRef.current += 1;
    matchAbortRef.current?.abort();
    matchAbortRef.current = null;
    setMatches([]);
    setMatchError(null);
    setMatchUi("idle");
    setSelectedMatchId(null);
    setMatchStories([]);
  }

  // Pool edits (content or membership) invalidate current results.
  // clearMatches only touches refs and stable setters, so the mount-time
  // subscription stays correct without resubscribing.
  useEffect(() => {
    return listenMatchEvent(window, POOL_CHANGED_EVENT, () => {
      clearMatches();
    });
  }, []);

  // Broadcast the current valid results so the explorer can highlight them.
  // Anything else (idle, loading, error, cleared) broadcasts no highlights,
  // so stale results can never linger on the map.
  useEffect(() => {
    const payload =
      matchUi === "results"
        ? { profileIds: matches.map((m) => m.profileId) }
        : { profileIds: [] as string[] };
    dispatchMatchEvent(window, MATCHES_EVENT, payload);
  }, [matches, matchUi]);

  // A matched scene node was selected: select its card and bring it into view.
  useEffect(() => {
    return listenMatchEvent(window, SELECT_PROFILE_EVENT, (detail: unknown) => {
      const profileId = validateProfilePayload(detail);
      if (!profileId) return;
      setSelectedMatchId((current) => {
        queueMicrotask(() => {
          document
            .getElementById(`match-card-${profileId}`)
            ?.focus({ preventScroll: false });
        });
        return profileId === current ? current : profileId;
      });
    });
  }, [matches]);

  // Track whether the 3D scene can actually show a highlight.
  useEffect(() => {
    return listenMatchEvent(window, SCENE_EVENT, (detail: unknown) => {
      if (
        typeof detail === "object" &&
        detail !== null &&
        typeof (detail as ScenePayload).available === "boolean"
      ) {
        setSceneAvailable((detail as ScenePayload).available);
      }
    });
  }, []);

  function handleShowOnMap(profileId: string) {
    const payload: ShowNodePayload = { profileId };
    dispatchMatchEvent(window, SHOW_NODE_EVENT, payload);
    setSelectedMatchId(profileId);
  }

  async function runMatch() {
    if (matchUi === "matching") return;
    const seq = matchSeqRef.current + 1;
    matchSeqRef.current = seq;
    matchAbortRef.current?.abort();
    const controller = new AbortController();
    matchAbortRef.current = controller;
    const approved = JSON.stringify(draft);
    // Read the enabled pool straight from storage so the request always
    // carries the current opt-ins; enabling alone never sends anything.
    const pool = (loadLocalStories(safeStorage()) ?? []).filter(
      (s) => s.includeInMatching,
    );
    setMatchStories(pool);
    setMatchUi("matching");
    setMatchError(null);
    try {
      const response = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, localStories: pool }),
        signal: controller.signal,
      });
      if (matchSeqRef.current !== seq) return;
      const payload = (await response.json()) as {
        ok: boolean;
        matches?: MatchEntry[];
        message?: string;
      };
      if (!response.ok || !payload.ok || !payload.matches) {
        setMatchError(
          payload.message ?? "Matching failed. Your draft is unchanged; try again.",
        );
        setMatchUi("error");
        return;
      }
      if (JSON.stringify(draft) !== approved) return;
      // Resolve locally; drop anything the server did not validate.
      const storyById = new Map(pool.map((s) => [s.id, s]));
      const resolved = payload.matches.filter((m) => {
        if (PROFILE_BY_ID[m.profileId] && CARD_BY_ID[m.cardId]) return true;
        const story = storyById.get(m.profileId);
        return !!story && m.cardId === story.id;
      });
      setMatches(resolved);
      setMatchUi("results");
    } catch (error) {
      if (matchSeqRef.current !== seq) return;
      if (error instanceof DOMException && error.name === "AbortError") {
        setMatchError("The matching request was cancelled. Your draft is unchanged.");
      } else {
        setMatchError(
          "Could not reach the matching service. Your draft is unchanged; try again.",
        );
      }
      setMatchUi("error");
    } finally {
      if (matchAbortRef.current === controller) matchAbortRef.current = null;
    }
  }

  // Validation errors render at the top of a long form while the buttons sit
  // at the bottom. Focus the first invalid field so the error is visible and
  // the user can fix it immediately.
  function focusFirstInvalid(next: FormErrors) {
    if (next.problem) {
      problemRef.current?.focus();
      return;
    }
    if (next.constraints || next.tried) {
      if (detailsRef.current) detailsRef.current.open = true;
      if (next.constraints) {
        constraintsRef.current?.focus();
      } else {
        triedRef.current?.focus();
      }
    }
  }

  function validate(): FormErrors {
    const next: FormErrors = {};
    const trimmedProblem = problem.trim();

    if (trimmedProblem.length === 0) {
      next.problem = "Describe your question before reviewing the request.";
    } else if (trimmedProblem.length < PROBLEM_MIN) {
      next.problem = `Please add a little more detail (at least ${PROBLEM_MIN} characters).`;
    } else if (problem.length > PROBLEM_MAX) {
      next.problem = `Keep the description under ${PROBLEM_MAX} characters.`;
    }

    if (constraints.length > CONSTRAINTS_MAX) {
      next.constraints = `Keep constraints under ${CONSTRAINTS_MAX} characters.`;
    }

    if (tried.length > TRIED_MAX) {
      next.tried = `Keep previous attempts under ${TRIED_MAX} characters.`;
    }

    return next;
  }

  function handleReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setSubmitted(false);
      focusFirstInvalid(nextErrors);
      return;
    }
    setSubmitted(true);
  }

  function handleEdit() {
    setSubmitted(false);
  }

  function handleContinueSaved() {
    const saved = pendingRecovery;
    if (!saved) return;
    setProblem(saved.problem);
    setConstraints(saved.constraints);
    setTried(saved.tried);
    setDraft(saved.draft ?? emptyDraft());
    setAnswers(saved.answers);
    setRoundUsed(saved.roundUsed);
    setErrors({});
    setExampleNote(null);
    setSubmitted(saved.submitted);
    setConfirmedSnapshot(null);
    setAiError(null);
    setAiState(saved.draft ? "draft" : "idle");
    clearMatches();
    setConfirmingReset(false);
    setPendingRecovery(null);
    setStoreReady(true);
  }

  function handleStartFresh() {
    removeStoredDraft(safeStorage());
    setPendingRecovery(null);
    setStoreReady(true);
    requestAnimationFrame(() => problemRef.current?.focus());
  }

  function handleReset() {
    if (
      !submitted &&
      !hasMeaningfulWork({ problem, constraints, tried, draft, answers })
    ) {
      doReset();
      return;
    }
    setConfirmingReset(true);
  }

  function handleCancelReset() {
    setConfirmingReset(false);
    startOverRef.current?.focus();
  }

  function doReset() {
    // Bumping the generation ignores late API responses so a discarded
    // draft cannot be recreated after this point.
    storeGenRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    removeStoredDraft(safeStorage());
    setProblem("");
    setConstraints("");
    setTried("");
    setErrors({});
    setExampleNote(null);
    setSubmitted(false);
    setDraft(emptyDraft());
    setAnswers([]);
    setRoundUsed(false);
    setConfirmedSnapshot(null);
    setAiState("idle");
    setAiError(null);
    clearMatches();
    setConfirmingReset(false);
    setSaveStatus(null);
  }

  function insertExample(example: ExampleRequest) {
    const kept: string[] = [];
    const fillProblem = problem.trim().length === 0;
    const fillConstraints = constraints.trim().length === 0;
    const fillTried = tried.trim().length === 0;
    if (fillProblem) {
      setProblem(example.problem);
    } else {
      kept.push("your question");
    }
    if (fillConstraints) {
      setConstraints(example.constraints);
    } else {
      kept.push("constraints");
    }
    if (fillTried) {
      setTried(example.tried);
    } else {
      kept.push("previous attempts");
    }
    setExampleNote(
      kept.length === 0
        ? "Fictional sample text inserted. Edit it into your own words."
        : `Sample added to the empty fields; kept ${kept.join(" and ")} untouched.`,
    );
    setErrors({});
    // Show where the sample landed: the populated fields may be above the
    // buttons or inside the collapsed context section.
    if (fillProblem) {
      problemRef.current?.focus();
    } else if (fillConstraints || fillTried) {
      if (detailsRef.current) detailsRef.current.open = true;
      if (fillConstraints) {
        constraintsRef.current?.focus();
      } else {
        triedRef.current?.focus();
      }
    }
  }

  async function runClarify(withAnswers: string[] | null) {
    if (sessionInFlight) return;
    sessionInFlight = true;
    const gen = storeGenRef.current;
    abortRef.current = new AbortController();
    setAiState("clarifying");
    setAiError(null);
    try {
      const response = await fetch("/api/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem,
          constraints,
          tried,
          ...(withAnswers ? { answers: withAnswers } : {}),
        }),
        signal: abortRef.current.signal,
      });
      if (storeGenRef.current !== gen) return;
      const payload = (await response.json()) as {
        ok: boolean;
        draft?: AiDraft;
        message?: string;
      };
      if (!response.ok || !payload.ok || !payload.draft) {
        setAiError(
          payload.message ?? "The AI request failed. Your text is unchanged.",
        );
        setAiState("error");
        return;
      }
      setDraft(payload.draft);
      setAnswers((payload.draft.questions ?? []).map(() => ""));
      setConfirmedSnapshot(null);
      setAiState("draft");
      clearMatches();
    } catch (error) {
      if (storeGenRef.current !== gen) return;
      if (error instanceof DOMException && error.name === "AbortError") {
        setAiError("The AI request was cancelled. Your text is unchanged.");
      } else {
        setAiError(
          "Could not reach the AI service. Your text is unchanged; try again.",
        );
      }
      setAiState("error");
    } finally {
      sessionInFlight = false;
      abortRef.current = null;
    }
  }

  function handleClarify() {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalid(nextErrors);
      return;
    }
    void runClarify(null);
  }

  function handleAnswerRound() {
    void runClarify(answers);
    setRoundUsed(true);
  }

  function updateDraftField<K extends keyof AiDraft>(key: K, value: AiDraft[K]) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    if (
      confirmedSnapshot !== null &&
      JSON.stringify(next) !== confirmedSnapshot
    ) {
      // Edited after confirming: approval and old matches no longer apply.
      setConfirmedSnapshot(null);
      setAiState("draft");
      clearMatches();
    }
  }

  function updateListField(key: "constraintsKnown" | "attemptsKnown" | "unknowns", index: number, value: string) {
    const list = [...draft[key]];
    list[index] = value;
    updateDraftField(key, list);
  }

  function handleConfirm() {
    setConfirmedSnapshot(JSON.stringify(draft));
    setAiState("confirmed");
  }

  function handleBackToForm() {
    setAiState("idle");
    setAiError(null);
    setConfirmedSnapshot(null);
    clearMatches();
  }

  const errorList = Object.values(errors).filter(Boolean);
  const clarifying = aiState === "clarifying";
  const matching = matchUi === "matching";

  const OUTCOME_LABEL: Record<MatchOutcomeStatus, string> = {
    resolved: "They report this as resolved.",
    partial: "Partial improvement only — not a confirmed fix.",
    unresolved: "No resolution reported — the problem is still open.",
  };

  function excerpt(value: string, max = 120): string {
    const flat = value.replace(/\s+/g, " ").trim();
    return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
  }

  const matchStoryById: Record<string, LocalStory> = {};
  for (const story of matchStories) matchStoryById[story.id] = story;

  // Verbatim support text from the actual inputs: demo cards resolve from
  // local data, local results from the snapshot sent with the request.
  function sourceText(point: { cardId: string; cardField: MatchEvidenceField }): string {
    const card = CARD_BY_ID[point.cardId];
    if (card) return cardFieldText(card, point.cardField);
    const story = matchStoryById[point.cardId];
    if (story) return storyFieldText(story, point.cardField);
    return "";
  }

  if (pendingRecovery) {
    return (
      <section aria-labelledby="recovery-heading">
        <h2 id="recovery-heading" tabIndex={-1} ref={recoveryTitleRef}>
          Saved draft found
        </h2>
        <p className="fine-print">
          Your previous work is saved in this browser. Nothing has been
          sent anywhere. Continue to restore it without any AI request,
          or start fresh to discard the saved draft. Clearing browser
          data removes the saved draft.
        </p>
        <div className="actions">
          <button type="button" className="primary" onClick={handleContinueSaved}>
            Continue saved draft
          </button>
          <button type="button" className="secondary" onClick={handleStartFresh}>
            Start fresh
          </button>
        </div>
      </section>
    );
  }

  if (submitted) {
    return (
      <section aria-labelledby="preview-heading" aria-live="polite">
        <h2 id="preview-heading" tabIndex={-1} ref={previewTitleRef}>
          Request preview
        </h2>
        <p className="fine-print">
          Local preview only — this text has not been sent anywhere yet.
        </p>
        <dl className="preview-list">
          <div>
            <dt>Your question</dt>
            <dd>{problem.trim()}</dd>
          </div>
          <div>
            <dt>Constraints</dt>
            <dd>
              {constraints.trim() ? (
                constraints.trim()
              ) : (
                <span className="empty-note">Not provided.</span>
              )}
            </dd>
          </div>
          <div>
            <dt>Previous attempts</dt>
            <dd>
              {tried.trim() ? (
                tried.trim()
              ) : (
                <span className="empty-note">Not provided.</span>
              )}
            </dd>
          </div>
        </dl>
        <div className="actions">
          <button type="button" className="primary" onClick={handleEdit}>
            Edit
          </button>
          {!confirmingReset ? (
            <button
              type="button"
              className="secondary"
              onClick={handleReset}
              ref={startOverRef}
            >
              Start over
            </button>
          ) : (
            <span role="group" aria-label="Confirm clearing everything">
              <span className="fine-print">
                Clear all fields and the saved draft?{" "}
              </span>
              <button
                type="button"
                className="secondary small"
                onClick={doReset}
                ref={confirmResetRef}
              >
                Yes, clear everything
              </button>{" "}
              <button
                type="button"
                className="secondary small"
                onClick={handleCancelReset}
              >
                Keep editing
              </button>
            </span>
          )}
        </div>
      </section>
    );
  }

  if (aiState === "draft" || aiState === "confirmed" || aiState === "error") {
    return (
      <section aria-labelledby="ai-draft-heading" aria-live="polite">
        <h2 id="ai-draft-heading" tabIndex={-1} ref={draftTitleRef}>
          Clarified draft
        </h2>
        {aiState === "confirmed" ? (
          <p className="confirm-note" role="status" tabIndex={-1} ref={confirmNoteRef}>
            Approved locally only. Not published, matched, or sent to
            anyone. Saved in this browser only. Editing any field below
            requires confirming again.
          </p>
        ) : (
          <p className="fine-print">
            AI-suggested wording is marked and editable. Your original text is
            quoted below for comparison. Confirming means local approval only.
          </p>
        )}

        {aiState === "error" && aiError && (
          <div className="error-summary" role="alert">
            <h2 tabIndex={-1} ref={draftErrorTitleRef}>
              AI clarification failed
            </h2>
            <p>{aiError}</p>
            <div className="actions">
              <button
                type="button"
                className="secondary small"
                onClick={handleBackToForm}
              >
                Back to form
              </button>
            </div>
          </div>
        )}

        {aiState !== "error" && (
          <>
            <blockquote className="user-quote">
              <p className="fine-print">Your words (unchanged):</p>
              <p>{problem.trim()}</p>
              {constraints.trim() && <p>Constraints: {constraints.trim()}</p>}
              {tried.trim() && <p>Tried: {tried.trim()}</p>}
            </blockquote>

            <div className="field">
              <label htmlFor="ai-summary">
                Summary <span className="ai-badge">AI draft</span>
              </label>
              <textarea
                id="ai-summary"
                value={draft.summary}
                onChange={(e) => updateDraftField("summary", e.target.value)}
                rows={3}
                maxLength={700}
              />
            </div>

            <div className="field">
              <label htmlFor="ai-goal">
                Goal <span className="ai-badge">AI draft</span>
              </label>
              <textarea
                id="ai-goal"
                value={draft.goal}
                onChange={(e) => updateDraftField("goal", e.target.value)}
                rows={2}
                maxLength={400}
              />
            </div>

            {(
              [
                ["constraintsKnown", "Known constraints"],
                ["attemptsKnown", "Previous attempts"],
                ["unknowns", "Important unknowns"],
              ] as const
            ).map(([key, label]) => (
              <div className="field" key={key}>
                <label>
                  {label} <span className="ai-badge">AI draft</span>
                </label>
                {draft[key].length === 0 ? (
                  <p className="empty-note">None listed — unknown stays unknown.</p>
                ) : (
                  <ul className="draft-list">
                    {draft[key].map((item, i) => (
                      <li key={i}>
                        <input
                          type="text"
                          aria-label={`${label} ${i + 1}`}
                          value={item}
                          onChange={(e) =>
                            updateListField(key, i, e.target.value)
                          }
                          maxLength={300}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            {draft.questions.length > 0 && !roundUsed && (
              <div className="field">
                <h3>Clarification questions</h3>
                <p className="fine-print">
                  Optional. Answer any of these to refine the draft once; the
                  rest stays unknown.
                </p>
                {draft.questions.map((q, i) => (
                  <div className="field" key={i}>
                    <label htmlFor={`answer-${i}`}>{q}</label>
                    <input
                      id={`answer-${i}`}
                      type="text"
                      value={answers[i] ?? ""}
                      onChange={(e) => {
                        const next = [...answers];
                        next[i] = e.target.value;
                        setAnswers(next);
                      }}
                      maxLength={ANSWER_MAX + 100}
                      autoComplete="off"
                    />
                  </div>
                ))}
                <div className="actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={handleAnswerRound}
                  >
                    Update with answers
                  </button>
                </div>
              </div>
            )}

            <div className="actions">
              {aiState === "confirmed" ? (
                <p className="fine-print" role="status">
                  Draft approved locally.
                </p>
              ) : (
                <button
                  type="button"
                  className="primary"
                  onClick={handleConfirm}
                >
                  Confirm draft
                </button>
              )}
              <button
                type="button"
                className="secondary"
                onClick={handleBackToForm}
              >
                Edit
              </button>
            </div>

            {aiState === "confirmed" && (
              <div className="ai-consent">
                <h3 id="match-heading" tabIndex={-1} ref={matchTitleRef}>
                  Relevant experience
                </h3>
                <p className="fine-print">
                  This sends the approved draft to Meta to compare it with 12
                  fictional demo profiles and your enabled local stories,
                  and only when you click below. {FICTIONAL_NOTICE}{" "}
                  Nothing is published or sent to any person; opening
                  questions are suggestions only. Matches come from these
                  demo profiles and your enabled local stories, not from
                  the 3D explorer links. Disabled stories are never sent.
                </p>
                {(matchUi === "idle" || matchUi === "error") && (
                  <div className="actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={runMatch}
                      disabled={matching}
                    >
                      Find relevant experience
                    </button>
                  </div>
                )}
                {matchUi === "matching" && (
                  <>
                    <div className="actions">
                      <button
                        type="button"
                        className="secondary"
                        disabled
                        aria-busy="true"
                      >
                        Comparing with fictional profiles…
                      </button>
                    </div>
                    <p
                      className="fine-print"
                      role="status"
                      tabIndex={-1}
                      ref={matchLoadingRef}
                    >
                      Waiting for the matching response…
                    </p>
                  </>
                )}
                {matchUi === "error" && matchError && (
                  <div className="error-summary" role="alert">
                    <h2 tabIndex={-1} ref={matchErrorTitleRef}>
                      Matching failed
                    </h2>
                    <p>{matchError}</p>
                    <div className="actions">
                      <button
                        type="button"
                        className="secondary small"
                        onClick={runMatch}
                      >
                        Try again
                      </button>
                    </div>
                  </div>
                )}
                {matchUi === "results" &&
                  (matches.length === 0 ? (
                    <p role="status">
                      No close matches in this small fictional set. Your draft
                      is unchanged — editing it and confirming again runs a fresh
                      comparison.
                    </p>
                  ) : (
                    <div className="field">
                      {matches.map((m) => {
                        const profile = PROFILE_BY_ID[m.profileId];
                        const card = CARD_BY_ID[m.cardId];
                        const story = matchStoryById[m.profileId];
                        if ((!profile || !card) && !story) return null;
                        const isLocal = !!story;
                        return (
                          <article
                            key={m.profileId}
                            id={`match-card-${m.profileId}`}
                            tabIndex={-1}
                            aria-labelledby={`match-${m.profileId}`}
                            aria-current={
                              selectedMatchId === m.profileId ? "true" : undefined
                            }
                            className={
                              selectedMatchId === m.profileId
                                ? "match-selected"
                                : undefined
                            }
                          >
                            <h4 id={`match-${m.profileId}`}>
                              {isLocal ? (
                                <>
                                  Your local experience{" "}
                                  <span className="ai-badge">
                                    Self-reported
                                  </span>
                                </>
                              ) : (
                                <>
                                  {profile?.name}{" "}
                                  <span className="ai-badge">
                                    Fictional profile
                                  </span>
                                </>
                              )}
                            </h4>
                            {sceneNodesForProfile(m.profileId).length > 0 &&
                              (sceneAvailable === false ? (
                                <p className="fine-print">
                                  3D map unavailable in this browser — the
                                  card above works the same way.
                                </p>
                              ) : (
                                <div className="actions">
                                  <button
                                    type="button"
                                    className="secondary small"
                                    onClick={() => handleShowOnMap(m.profileId)}
                                  >
                                    Show on map
                                  </button>
                                </div>
                              ))}
                            <dl className="preview-list compact">
                              <div>
                                <dt>Relevant experience</dt>
                                <dd>
                                  {isLocal && story
                                    ? `${story.title} — ${story.situation}`
                                    : `${card?.title} — ${card?.situation}`}
                                </dd>
                              </div>
                              <div>
                                <dt>Reported outcome</dt>
                                <dd>{OUTCOME_LABEL[m.outcomeStatus]}</dd>
                              </div>
                              <div>
                                <dt>What overlaps</dt>
                                <dd>
                                  <ul className="draft-list">
                                    {m.overlaps.map((point, i) => (
                                      <li key={i}>
                                        {point.text}{" "}
                                        <span className="fine-print">
                                          Your request ({point.requestField}):
                                          “{excerpt(draftFieldText(draft, point.requestField))}”
                                          Source ({point.cardField}):
                                          “{excerpt(sourceText(point))}”
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </dd>
                              </div>
                              <div>
                                <dt>Important differences and unknowns</dt>
                                <dd>
                                  {m.differences.length > 0 ? (
                                    <ul className="draft-list">
                                      {m.differences.map((point, i) => (
                                        <li key={i}>
                                          {point.text}{" "}
                                          <span className="fine-print">
                                            Your request ({point.requestField}):
                                            “{excerpt(draftFieldText(draft, point.requestField))}”
                                            Source ({point.cardField}):
                                            “{excerpt(sourceText(point))}”
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <span className="empty-note">
                                      None listed.
                                    </span>
                                  )}
                                  {m.unknowns.length > 0 && (
                                    <ul className="draft-list">
                                      {m.unknowns.map((item, i) => (
                                        <li key={i}>
                                          Unknown: {item}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </dd>
                              </div>
                              <div>
                                <dt>Suggested opening question</dt>
                                <dd>
                                  {m.question}{" "}
                                  <span className="fine-print">
                                    Suggestion only — nothing is sent.
                                  </span>
                                </dd>
                              </div>
                            </dl>
                            <details className="context-details">
                              <summary>Source experience</summary>
                              {isLocal && story ? (
                                <dl className="preview-list compact">
                                  <div>
                                    <dt>Title</dt>
                                    <dd>{story.title}</dd>
                                  </div>
                                  <div>
                                    <dt>Situation</dt>
                                    <dd>{story.situation}</dd>
                                  </div>
                                  {story.constraints.trim() !== "" && (
                                    <div>
                                      <dt>Constraints</dt>
                                      <dd>{story.constraints}</dd>
                                    </div>
                                  )}
                                  {story.attempts.trim() !== "" && (
                                    <div>
                                      <dt>Attempts</dt>
                                      <dd>{story.attempts}</dd>
                                    </div>
                                  )}
                                  <div>
                                    <dt>Outcome</dt>
                                    <dd>{story.outcome}</dd>
                                  </div>
                                  <div>
                                    <dt>Unknowns</dt>
                                    <dd>
                                      {story.unknowns.length > 0
                                        ? story.unknowns.join(" ")
                                        : "None listed."}
                                    </dd>
                                  </div>
                                </dl>
                              ) : (
                                <dl className="preview-list compact">
                                  <div>
                                    <dt>Situation</dt>
                                    <dd>{card?.situation}</dd>
                                  </div>
                                  <div>
                                    <dt>Constraints</dt>
                                    <dd>{card?.constraints}</dd>
                                  </div>
                                  <div>
                                    <dt>Attempts</dt>
                                    <dd>{card?.attempts}</dd>
                                  </div>
                                  <div>
                                    <dt>Outcome</dt>
                                    <dd>{card?.outcome}</dd>
                                  </div>
                                  <div>
                                    <dt>Unknowns</dt>
                                    <dd>
                                      {card && card.unknowns.length > 0
                                        ? card.unknowns.join(" ")
                                        : "None listed."}
                                    </dd>
                                  </div>
                                </dl>
                              )}
                            </details>
                          </article>
                        );
                      })}
                    </div>
                  ))}
              </div>
            )}
          </>
        )}
      </section>
    );
  }

  return (
    <form onSubmit={handleReview} noValidate>
      {errorList.length > 0 && (
        <div
          className="error-summary"
          role="alert"
          tabIndex={-1}
          aria-labelledby="error-summary-heading"
        >
          <h2 id="error-summary-heading">
            Please fix {errorList.length === 1 ? "this" : "these"} before
            continuing
          </h2>
          <ul>
            {errorList.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="field">
        <label htmlFor="problem">What are you trying to figure out?</label>
        <textarea
          id="problem"
          name="problem"
          className="composer-main"
          ref={problemRef}
          value={problem}
          onChange={(event) => setProblem(event.target.value)}
          aria-describedby="problem-count"
          aria-invalid={Boolean(errors.problem)}
          aria-required="true"
          maxLength={PROBLEM_MAX + 100}
          rows={7}
        />
        <div className="meta">
          <span>
            {errors.problem ? (
              <span className="error-text" role="alert">
                {errors.problem}
              </span>
            ) : (
              <span>
                Minimum {PROBLEM_MIN} characters so a helper has context.
              </span>
            )}
          </span>
          <span id="problem-count">
            {problem.length} / {PROBLEM_MAX}
          </span>
        </div>
      </div>

      <details className="context-details" ref={detailsRef}>
        <summary>Add context (optional)</summary>
        <div className="field">
          <label htmlFor="constraints">Constraints</label>
          <span className="hint" id="constraints-hint">
            Time, budget, location, tools, or other limits.
          </span>
          <input
            id="constraints"
            name="constraints"
            type="text"
            ref={constraintsRef}
            value={constraints}
            onChange={(event) => setConstraints(event.target.value)}
            aria-describedby="constraints-hint constraints-count"
            aria-invalid={Boolean(errors.constraints)}
            maxLength={CONSTRAINTS_MAX + 100}
            autoComplete="off"
          />
          <div className="meta">
            <span>
              {errors.constraints && (
                <span className="error-text" role="alert">
                  {errors.constraints}
                </span>
              )}
            </span>
            <span id="constraints-count">
              {constraints.length} / {CONSTRAINTS_MAX}
            </span>
          </div>
        </div>

        <div className="field">
          <label htmlFor="tried">What have you already tried?</label>
          <span className="hint" id="tried-hint">
            Approaches, resources, or dead ends worth knowing.
          </span>
          <textarea
            id="tried"
            name="tried"
            ref={triedRef}
            value={tried}
            onChange={(event) => setTried(event.target.value)}
            aria-describedby="tried-hint tried-count"
            aria-invalid={Boolean(errors.tried)}
            maxLength={TRIED_MAX + 100}
            rows={4}
          />
          <div className="meta">
            <span>
              {errors.tried && (
                <span className="error-text" role="alert">
                  {errors.tried}
                </span>
              )}
            </span>
            <span id="tried-count">
              {tried.length} / {TRIED_MAX}
            </span>
          </div>
        </div>
      </details>

      <div className="examples">
        <p className="fine-print" id="examples-label">
          Try a fictional sample:
        </p>
        <div
          className="actions"
          role="group"
          aria-labelledby="examples-label"
        >
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              className="secondary small"
              onClick={() => insertExample(example)}
            >
              {example.label}
            </button>
          ))}
        </div>
        {exampleNote && (
          <p className="fine-print" role="status">
            {exampleNote}
          </p>
        )}
      </div>

      {saveStatus === "saved" && (
        <p className="fine-print" role="status">
          Your draft is saved in this browser. AI processing happens only
          when you choose it. Clearing browser data removes the saved draft.
        </p>
      )}
      {saveStatus === "failed" && (
        <p className="error-text" role="alert">
          Saving isn&apos;t working in this browser — your work may be lost
          when the page closes.
        </p>
      )}

      <div className="actions review-row">
        <button type="submit" className="primary">
          Review my request
        </button>
        <p className="fine-print">Preview only. Your text is not sent anywhere.</p>
      </div>

      <div className="ai-consent">
        <h3>Clarify with AI (optional)</h3>
        <p className="fine-print">
          This sends the text above to Meta for AI processing and returns a
          structured draft you review locally. Nothing is published,
          matched, or shared with people. Draft state stays in this browser
          until you clear it.
        </p>
        <div className="actions">
          <button
            type="button"
            className="secondary"
            onClick={handleClarify}
            disabled={clarifying}
            aria-busy={clarifying}
          >
            {clarifying ? "Asking Meta AI…" : "Clarify with AI"}
          </button>
          {clarifying && (
            <p className="fine-print" role="status" tabIndex={-1} ref={loadingRef}>
              Waiting for the AI response…
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
