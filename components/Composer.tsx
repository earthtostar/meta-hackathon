"use client";

import { useEffect, useRef, useState } from "react";
import {
  CARD_BY_ID,
  FICTIONAL_NOTICE,
  PROFILE_BY_ID,
  type ProfileCard,
} from "../data/profiles";
import { sceneNodesForProfile } from "../data/profile-scene";
import {
  COMPARE_SELECT_EVENT,
  MATCHES_EVENT,
  NOTICE_EVENT,
  POOL_CHANGED_EVENT,
  SCENE_EVENT,
  SEARCH_STARTED_EVENT,
  SELECT_PROFILE_EVENT,
  SHOW_NODE_EVENT,
  dispatchMatchEvent,
  listenMatchEvent,
  validateCompareSelectPayload,
  validateProfilePayload,
  type ScenePayload,
  type ShowNodePayload,
} from "../lib/match-events";
import ResultInsights from "./ResultInsights";
import CompareSection from "./CompareSection";
import DiscoveriesSection from "./DiscoveriesSection";
import WhatIfSection, { type WhatIfResult } from "./WhatIfSection";
import {
  applyWhatIf,
  compareMatchOrders,
  describeDelta,
  type WhatIfField,
} from "../lib/whatif";
import {
  compareKey,
  toggleCompareSlot,
  type CompareSource,
} from "../lib/compare";
import { useDiscoveries, type DiscoveryItem } from "../lib/discoveries";
import {
  loadLocalStories,
  storyFieldText,
  type LocalStory,
} from "../lib/local-stories";
import {
  cardFieldText,
  draftFieldText,
  selectValidMoves,
  type MatchEntry,
  type MatchEvidenceField,
  type MatchOutcomeStatus,
  type NextMove,
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

export interface ExampleRequest {
  label: string;
  problem: string;
  constraints: string;
  tried: string;
}

export const TRY_SCENARIO_EVENT = "experience-match:try-scenario";

export const EXAMPLES: ExampleRequest[] = [
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
  resourcesKnown: string[];
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
    resourcesKnown: [],
    unknowns: [],
    questions: [],
  };
}

/**
 * Experience DNA strip: a compact visual profile of the extracted
 * challenge structure. Each segment shows whether the field is filled
 * and how many items it holds; unknowns stay visibly open. It mirrors
 * the editable draft below — correcting a field updates the strip.
 */
function DnaStrip({ draft }: { draft: AiDraft }) {
  const segments: { label: string; state: string; open?: boolean }[] = [
    {
      label: "Challenge",
      state: draft.summary.trim() !== "" ? "captured" : "missing",
    },
    {
      label: "Goal",
      state: draft.goal.trim() !== "" ? "captured" : "missing",
    },
    {
      label: "Constraints",
      state:
        draft.constraintsKnown.filter((s) => s.trim() !== "").length > 0
          ? `${draft.constraintsKnown.filter((s) => s.trim() !== "").length}`
          : "none",
    },
    {
      label: "Attempts",
      state:
        draft.attemptsKnown.filter((s) => s.trim() !== "").length > 0
          ? `${draft.attemptsKnown.filter((s) => s.trim() !== "").length}`
          : "none",
    },
    {
      label: "Resources",
      state:
        draft.resourcesKnown.filter((s) => s.trim() !== "").length > 0
          ? `${draft.resourcesKnown.filter((s) => s.trim() !== "").length}`
          : "none",
    },
    {
      label: "Unknowns",
      state:
        draft.unknowns.filter((s) => s.trim() !== "").length > 0
          ? `${draft.unknowns.filter((s) => s.trim() !== "").length} open`
          : "none",
      open: true,
    },
  ];
  return (
    <ul className="dna-strip" aria-label="Challenge structure profile">
      {segments.map((seg) => (
        <li
          key={seg.label}
          className={[
            "dna-seg",
            seg.state === "missing" || seg.state === "none"
              ? "dna-empty"
              : null,
            seg.open ? "dna-open" : null,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <span className="dna-label">{seg.label}</span>
          <span className="dna-state">{seg.state}</span>
        </li>
      ))}
    </ul>
  );
}

const JOURNEY_STEPS = ["Describe", "Clarify", "Compare"] as const;

function JourneySteps({ step }: { step: 1 | 2 | 3 }) {
  return (
    <ol className="journey" aria-label="Progress">
      {JOURNEY_STEPS.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        return (
          <li
            key={label}
            aria-current={n === step ? "step" : undefined}
            className={n < step ? "is-done" : undefined}
          >
            <span className="j-n" aria-hidden="true">
              {n}
            </span>
            <span>{label}</span>
          </li>
        );
      })}
    </ol>
  );
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
  const [matchFallback, setMatchFallback] = useState(false);
  const [matchNextMoves, setMatchNextMoves] = useState<NextMove[]>([]);
  const [matchLimitations, setMatchLimitations] = useState<string[]>([]);
  // What If? keeps the original comparison intact: the re-ranking lives
  // in separate state until the user promotes or discards it.
  const [whatIfUi, setWhatIfUi] = useState<"idle" | "matching" | "results" | "error">("idle");
  const [whatIfError, setWhatIfError] = useState<string | null>(null);
  const [whatIfResult, setWhatIfResult] = useState<WhatIfResult | null>(null);
  const [whatIfMoves, setWhatIfMoves] = useState<NextMove[]>([]);
  const [whatIfLimits, setWhatIfLimits] = useState<string[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [sceneAvailable, setSceneAvailable] = useState<boolean | null>(null);
  const [compareSel, setCompareSel] = useState<CompareSource[]>([]);
  const discoveries = useDiscoveries();
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
      value.resourcesKnown.length === 0 &&
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
    setMatchFallback(false);
    setMatchNextMoves([]);
    setMatchLimitations([]);
    setCompareSel([]);
    discardWhatIf();
  }

  function discardWhatIf() {
    setWhatIfUi("idle");
    setWhatIfError(null);
    setWhatIfResult(null);
    setWhatIfMoves([]);
    setWhatIfLimits([]);
  }

  // Pool edits (content or membership) invalidate current results.
  // clearMatches only touches refs and stable setters (including the
  // What If? reset), so the mount-time subscription stays correct
  // without resubscribing.
  useEffect(() => {
    return listenMatchEvent(window, POOL_CHANGED_EVENT, () => {
      clearMatches();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable-setter helper, same as neighboring subscriptions
  }, []);

  // Guided demo entry: fill a fresh request form with a showcase scenario.
  // Ignored whenever real work is in progress so it can never clobber it.
  useEffect(() => {
    return listenMatchEvent(window, TRY_SCENARIO_EVENT, (detail: unknown) => {
      if (typeof detail !== "object" || detail === null) return;
      const index = (detail as { index?: unknown }).index;
      if (typeof index !== "number") return;
      const example = EXAMPLES[index];
      if (!example) return;
      if (aiState !== "idle" || submitted || pendingRecovery) return;
      insertExample(example);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- insertExample reads live form state; listed state deps cover it
  }, [aiState, submitted, pendingRecovery, problem, constraints, tried]);

  // Broadcast the current valid results so the explorer can highlight them.
  // Anything else (idle, loading, error, cleared) broadcasts no highlights,
  // so stale results can never linger on the map. An active What If?
  // re-ranking temporarily highlights its own order instead.
  useEffect(() => {
    const whatIfActive =
      whatIfUi === "results" && whatIfResult !== null;
    const payload = whatIfActive
      ? { profileIds: whatIfResult.matches.map((m) => m.profileId) }
      : matchUi === "results"
        ? { profileIds: matches.map((m) => m.profileId) }
        : { profileIds: [] as string[] };
    dispatchMatchEvent(window, MATCHES_EVENT, payload);
  }, [matches, matchUi, whatIfResult, whatIfUi]);

  // A matched scene node was selected: select its card and bring it into view.
  useEffect(() => {
    return listenMatchEvent(window, SELECT_PROFILE_EVENT, (detail: unknown) => {
      const profileId = validateProfilePayload(detail);
      if (!profileId) return;
      setSelectedMatchId((current) => {
        queueMicrotask(() => {
          // The results pane may be hidden behind another app mode; only
          // steal focus when the card is actually visible.
          const el = document.getElementById(`match-card-${profileId}`);
          if (el && el.offsetParent !== null) {
            el.focus({ preventScroll: false });
          }
        });
        return profileId === current ? current : profileId;
      });
    });
  }, [matches]);

  // An explorer node (or another card) asked to join the comparison.
  // Side effects stay outside setState so StrictMode never double-notifies.
  function applyCompareSelect(next: CompareSource): void {
    const updated = toggleCompareSlot(compareSel, next);
    if (updated === compareSel) {
      dispatchMatchEvent(window, NOTICE_EVENT, {
        message: "Comparison holds two — remove one to change it.",
        tone: "info",
      });
      return;
    }
    setCompareSel(updated);
    if (updated.length > compareSel.length) {
      dispatchMatchEvent(window, NOTICE_EVENT, {
        message:
          updated.length === 2
            ? "Comparison ready below."
            : "Added to comparison — pick one more.",
        tone: "confirm",
      });
    }
  }

  // Bookmark identity for a result card. Local stories keep their own
  // namespaced reference; demo cards resolve to their scene node when
  // one exists, otherwise to the profile itself.
  function discoveryRefFor(
    m: MatchEntry,
    isLocal: boolean,
    story: LocalStory | undefined,
    card: ProfileCard | undefined,
    insight?: string,
  ): Omit<DiscoveryItem, "savedAt"> {
    const base = insight !== undefined ? { insight } : {};
    if (isLocal && story) {
      return {
        refKind: "story",
        refId: `local:${story.id}`,
        title: story.title,
        ...base,
      };
    }
    const nodes = sceneNodesForProfile(m.profileId);
    if (nodes.length > 0) {
      return {
        refKind: "experience",
        refId: nodes[0],
        title: card?.title ?? m.cardId,
        ...base,
      };
    }
    return {
      refKind: "profile",
      refId: m.profileId,
      title: PROFILE_BY_ID[m.profileId]?.name ?? m.profileId,
      ...base,
    };
  }

  function hasDiscoveryFor(
    m: MatchEntry,
    isLocal: boolean,
    story: LocalStory | undefined,
  ): boolean {
    const ref = discoveryRefFor(
      m,
      isLocal,
      story,
      CARD_BY_ID[m.cardId],
    );
    return discoveries.has({
      refKind: ref.refKind,
      refId: ref.refId,
      insight: undefined,
    });
  }

  function toggleDiscoveryFor(
    m: MatchEntry,
    isLocal: boolean,
    story: LocalStory | undefined,
    card: ProfileCard | undefined,
    insight?: string,
  ): void {
    const ref = discoveryRefFor(m, isLocal, story, card, insight);
    const target = {
      refKind: ref.refKind,
      refId: ref.refId,
      insight: ref.insight,
    };
    if (discoveries.has(target)) {
      discoveries.remove(target);
      dispatchMatchEvent(window, NOTICE_EVENT, {
        message: insight ? "Insight removed." : "Removed from My Discoveries.",
        tone: "info",
      });
    } else {
      discoveries.add(ref);
      dispatchMatchEvent(window, NOTICE_EVENT, {
        message: insight ? "Insight saved." : "Saved to My Discoveries.",
        tone: "confirm",
      });
    }
  }

  function compareSelectFromPayload(detail: unknown): void {
    const payload = validateCompareSelectPayload(detail);
    if (!payload) return;
    if (payload.kind === "card" && payload.profileId && payload.cardId) {
      applyCompareSelect({
        kind: "card",
        profileId: payload.profileId,
        cardId: payload.cardId,
      });
    } else if (payload.kind === "node" && payload.nodeId) {
      applyCompareSelect({ kind: "node", nodeId: payload.nodeId });
    } else if (payload.kind === "story" && payload.storyId) {
      applyCompareSelect({ kind: "story", storyId: payload.storyId });
    }
  }

  useEffect(() => {
    return listenMatchEvent(window, COMPARE_SELECT_EVENT, (detail: unknown) => {
      compareSelectFromPayload(detail);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resubscribes on selection change so notices fire exactly once
  }, [compareSel]);

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

  /** Evidence Lens: jump from an insight to the full source record below. */
  function openSourceRecord(profileId: string) {
    const el = document.getElementById(`source-${profileId}`);
    if (!(el instanceof HTMLDetailsElement)) return;
    el.open = true;
    el.scrollIntoView({ block: "nearest" });
    const summary = el.querySelector("summary");
    if (summary instanceof HTMLElement) summary.focus({ preventScroll: true });
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
    // The signature symbol begins its convergence on real search traffic.
    dispatchMatchEvent(window, SEARCH_STARTED_EVENT, { at: Date.now() });
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
        nextMoves?: NextMove[];
        limitations?: string[];
        fallback?: boolean;
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
      const validIds = new Set(resolved.map((m) => m.profileId));
      const moves = selectValidMoves(payload.nextMoves, validIds);
      const limits = Array.isArray(payload.limitations)
        ? payload.limitations.filter(
            (item) => typeof item === "string" && item.trim().length > 0,
          )
        : [];
      setMatches(resolved);
      setMatchFallback(payload.fallback === true);
      setMatchNextMoves(moves);
      setMatchLimitations(limits);
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

  /**
   * What If? re-ranking: one constraint rewritten, same endpoint, same
   * candidate pool, results kept separate so the original comparison
   * survives until the user promotes or discards the re-ranking.
   */
  async function runWhatIf(field: WhatIfField, index: number, to: string) {
    if (whatIfUi === "matching" || matchUi !== "results") return;
    const base = draft;
    const modified = applyWhatIf(base, field, index, to);
    if (!modified || to.trim() === "") return;
    const from = base[field][index] ?? "";
    if (from.trim() === to.trim()) return;
    setWhatIfUi("matching");
    setWhatIfError(null);
    setWhatIfResult(null);
    const controller = new AbortController();
    matchAbortRef.current?.abort();
    matchAbortRef.current = controller;
    const pool = (loadLocalStories(safeStorage()) ?? []).filter(
      (s) => s.includeInMatching,
    );
    dispatchMatchEvent(window, SEARCH_STARTED_EVENT, { at: Date.now() });
    try {
      const response = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: modified, localStories: pool }),
        signal: controller.signal,
      });
      const payload = (await response.json()) as {
        ok: boolean;
        matches?: MatchEntry[];
        nextMoves?: NextMove[];
        limitations?: string[];
        fallback?: boolean;
        message?: string;
      };
      if (!response.ok || !payload.ok || !payload.matches) {
        setWhatIfError(
          payload.message ?? "Re-ranking failed. The original results are unchanged.",
        );
        setWhatIfUi("error");
        return;
      }
      const storyById = new Map(pool.map((s) => [s.id, s]));
      const resolved = payload.matches.filter((m) => {
        if (PROFILE_BY_ID[m.profileId] && CARD_BY_ID[m.cardId]) return true;
        const story = storyById.get(m.profileId);
        return !!story && m.cardId === story.id;
      });
      const validIds = new Set(resolved.map((m) => m.profileId));
      const deltas = compareMatchOrders(matches, resolved);
      setWhatIfResult({
        change: { field, index, from, to: to.trim() },
        matches: resolved,
        deltas,
        fallback: payload.fallback === true,
        summary: describeDelta(deltas),
      });
      setWhatIfMoves(selectValidMoves(payload.nextMoves, validIds));
      setWhatIfLimits(
        Array.isArray(payload.limitations)
          ? payload.limitations.filter(
              (item) => typeof item === "string" && item.trim().length > 0,
            )
          : [],
      );
      setWhatIfUi("results");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setWhatIfError("The re-ranking was cancelled. The original results are unchanged.");
      } else {
        setWhatIfError(
          "Could not reach the matching service. The original results are unchanged.",
        );
      }
      setWhatIfUi("error");
    } finally {
      if (matchAbortRef.current === controller) matchAbortRef.current = null;
    }
  }

  function promoteWhatIf() {
    if (!whatIfResult) return;
    setMatches(whatIfResult.matches);
    setMatchFallback(whatIfResult.fallback);
    setMatchNextMoves(whatIfMoves);
    setMatchLimitations(whatIfLimits);
    setSelectedMatchId(null);
    setCompareSel([]);
    discardWhatIf();
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

  type DraftListKey = "constraintsKnown" | "attemptsKnown" | "resourcesKnown" | "unknowns";

  function updateListField(key: DraftListKey, index: number, value: string) {
    const list = [...draft[key]];
    list[index] = value;
    updateDraftField(key, list);
  }

  /** Add missing context the extraction missed: append one editable row. */
  function addListItem(key: DraftListKey) {
    if (draft[key].length >= 5) return;
    updateDraftField(key, [...draft[key], ""]);
  }

  function handleConfirm() {
    // Drop blank rows so cleared assumptions stay removed, not sent as noise.
    const cleaned: AiDraft = {
      ...draft,
      constraintsKnown: draft.constraintsKnown.filter((s) => s.trim() !== ""),
      attemptsKnown: draft.attemptsKnown.filter((s) => s.trim() !== ""),
      resourcesKnown: draft.resourcesKnown.filter((s) => s.trim() !== ""),
      unknowns: draft.unknowns.filter((s) => s.trim() !== ""),
    };
    setDraft(cleaned);
    setConfirmedSnapshot(JSON.stringify(cleaned));
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
        <JourneySteps step={1} />
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
        <JourneySteps step={1} />
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
        <JourneySteps step={aiState === "confirmed" ? 3 : 2} />
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

        <DnaStrip draft={draft} />
        <p className="fine-print">
          Your challenge profile — correct any field, clear a wrong
          assumption, or add what the extraction missed.
        </p>

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
                ["resourcesKnown", "Available resources"],
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
                {draft[key].length < 5 && (
                  <div className="actions">
                    <button
                      type="button"
                      className="secondary small"
                      onClick={() => addListItem(key)}
                    >
                      Add {label.toLowerCase().replace(/^(known |available |important )/, "")}
                    </button>
                  </div>
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
                    <div className="status-note">
                      <span className="pulse" aria-hidden="true" />
                      <p
                        className="fine-print"
                        role="status"
                        tabIndex={-1}
                        ref={matchLoadingRef}
                      >
                        Comparing your approved draft with the demo profiles
                        and your enabled local stories…
                      </p>
                    </div>
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
                {matchUi === "results" && matchFallback && (
                  <p className="confirm-note" role="status">
                    Keyword fallback — the AI comparison is unavailable, so
                    these are wording overlaps, not an AI analysis. Treat them
                    as rough leads and compare the records yourself.
                  </p>
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
                        const workedOutcome =
                          isLocal && story ? story.outcome : (card?.outcome ?? "");
                        const workedAttempts =
                          isLocal && story
                            ? story.attempts.trim() !== ""
                              ? story.attempts
                              : "None recorded."
                            : (card?.attempts ?? "");
                        return (
                          <article
                            key={m.profileId}
                            id={`match-card-${m.profileId}`}
                            tabIndex={-1}
                            aria-labelledby={`match-${m.profileId}`}
                            aria-current={
                              selectedMatchId === m.profileId ? "true" : undefined
                            }
                            className={[
                              "match-card",
                              isLocal ? "match-local" : null,
                              selectedMatchId === m.profileId
                                ? "match-selected"
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            <h4 id={`match-${m.profileId}`}>
                              {isLocal ? (
                                <>
                                  Your local experience{" "}
                                  <span className="ai-badge badge-self">
                                    Self-reported
                                  </span>
                                </>
                              ) : (
                                <>
                                  {profile?.name}{" "}
                                  <span className="ai-badge badge-demo">
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
                            <div className="actions">
                              <button
                                type="button"
                                className="secondary small"
                                aria-pressed={compareSel.some(
                                  (s) =>
                                    compareKey(s) ===
                                    `card:${m.cardId}`,
                                )}
                                onClick={() =>
                                  applyCompareSelect({
                                    kind: "card",
                                    profileId: m.profileId,
                                    cardId: m.cardId,
                                  })
                                }
                              >
                                {compareSel.some(
                                  (s) =>
                                    compareKey(s) === `card:${m.cardId}`,
                                )
                                  ? "Remove from compare"
                                  : "Compare this case"}
                              </button>
                              <button
                                type="button"
                                className="secondary small"
                                onClick={() => openSourceRecord(m.profileId)}
                              >
                                Open source record
                              </button>
                              <button
                                type="button"
                                className="secondary small"
                                aria-pressed={hasDiscoveryFor(m, isLocal, story)}
                                onClick={() => toggleDiscoveryFor(m, isLocal, story, card)}
                              >
                                {hasDiscoveryFor(m, isLocal, story)
                                  ? "Saved ✓"
                                  : "Save"}
                              </button>
                            </div>
                            <dl className="preview-list compact evidence">
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
                                <dd className="outcome-line">
                                  <strong>{OUTCOME_LABEL[m.outcomeStatus]}</strong>
                                  <span className="fine-print">
                                    as reported by the source — not verified.
                                  </span>
                                </dd>
                              </div>
                              <div>
                                <dt>What overlaps</dt>
                                <dd>
                                  <ul className="draft-list">
                                    {m.overlaps.map((point, i) => (
                                      <li key={i}>
                                        <span className="ai-badge badge-infer">
                                          Model inference
                                        </span>{" "}
                                        {point.text}
                                        <span className="support-quote">
                                          <span className="ai-badge badge-fact">
                                            Source fact
                                          </span>{" "}
                                          Your request ({point.requestField}):
                                          “{excerpt(draftFieldText(draft, point.requestField))}”
                                        </span>
                                        <span className="support-quote">
                                          <span className="ai-badge badge-fact">
                                            Source fact
                                          </span>{" "}
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
                                          <span className="ai-badge badge-infer">
                                            Model inference
                                          </span>{" "}
                                          {point.text}
                                          <span className="support-quote">
                                            <span className="ai-badge badge-fact">
                                              Source fact
                                            </span>{" "}
                                            Your request ({point.requestField}):
                                            “{excerpt(draftFieldText(draft, point.requestField))}”
                                          </span>
                                          <span className="support-quote">
                                            <span className="ai-badge badge-fact">
                                              Source fact
                                            </span>{" "}
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
                                          <span className="ai-badge badge-unknown">
                                            Unknown
                                          </span>{" "}
                                          {item}
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
                            <details
                              className="context-details"
                              id={`source-${m.profileId}`}
                            >
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
                            <details className="context-details">
                              <summary>Transferability lens</summary>
                              <dl className="preview-list compact">
                                <div>
                                  <dt>What matches</dt>
                                  <dd>
                                    {m.overlaps.length} supporting note
                                    {m.overlaps.length === 1 ? "" : "s"} —
                                    shown above with exact quotes.
                                  </dd>
                                </div>
                                <div>
                                  <dt>What differs</dt>
                                  <dd>
                                    {m.differences.length > 0
                                      ? `${m.differences.length} difference note${m.differences.length === 1 ? "" : "s"} — shown above with exact quotes.`
                                      : "No material differences were named."}
                                  </dd>
                                </div>
                                <div>
                                  <dt>What worked</dt>
                                  <dd>
                                    {workedOutcome}{" "}
                                    <span className="support-quote">
                                      Tried: “{excerpt(workedAttempts)}”
                                    </span>
                                  </dd>
                                </div>
                                <div>
                                  <dt>What may transfer</dt>
                                  <dd>
                                    {m.transfers.length > 0 ? (
                                      <ul className="draft-list">
                                        {m.transfers.map((t, i) => (
                                          <li key={i}>
                                            {t.text}{" "}
                                            <span className="support-quote">
                                              From this case ({t.cardField}):
                                              “{excerpt(sourceText(t))}”
                                            </span>{" "}
                                            <button
                                              type="button"
                                              className="link-button"
                                              onClick={() =>
                                                toggleDiscoveryFor(
                                                  m,
                                                  isLocal,
                                                  story,
                                                  card,
                                                  t.text,
                                                )
                                              }
                                            >
                                              Save insight
                                            </button>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : matchFallback ? (
                                      <span className="empty-note">
                                        Keyword fallback did not assess
                                        transferability — compare the record
                                        above yourself.
                                      </span>
                                    ) : (
                                      <span className="empty-note">
                                        The comparison named no transferable
                                        step for this case.
                                      </span>
                                    )}
                                  </dd>
                                </div>
                                <div>
                                  <dt>What remains unknown</dt>
                                  <dd>
                                    {m.unknowns.length > 0
                                      ? m.unknowns.join(" ")
                                      : "None listed — unknown stays unknown."}
                                  </dd>
                                </div>
                              </dl>
                              <p className="fine-print">
                                Suggestions, not instructions — no outcome is
                                guaranteed.
                              </p>
                            </details>
                          </article>
                        );
                      })}
                    </div>
                  ))}
              </div>
            )}
            {matchUi === "results" && matches.length > 0 && (
              <WhatIfSection
                constraints={draft.constraintsKnown}
                resources={draft.resourcesKnown}
                running={whatIfUi === "matching"}
                error={whatIfUi === "error" ? whatIfError : null}
                result={whatIfUi === "results" ? whatIfResult : null}
                resolveTitle={(profileId) => {
                  const story = matchStoryById[profileId];
                  if (story)
                    return { title: story.title, kind: "Your local experience" };
                  const card = CARD_BY_ID[
                    matches.find((m) => m.profileId === profileId)?.cardId ??
                      whatIfResult?.matches.find((m) => m.profileId === profileId)?.cardId ??
                      ""
                  ];
                  return {
                    title: card?.title ?? profileId,
                    kind: "Fictional example",
                  };
                }}
                onRun={runWhatIf}
                onPromote={promoteWhatIf}
                onDiscard={discardWhatIf}
              />
            )}
            {matchUi === "results" && matches.length > 0 && (
              <ResultInsights
                matches={matches}
                stories={matchStories}
                fallback={matchFallback}
                nextMoves={matchNextMoves}
                limitations={matchLimitations}
                resolveMoveRef={(sourceId) => {
                  const story = matchStoryById[sourceId];
                  if (story) {
                    return {
                      refKind: "story" as const,
                      refId: `local:${story.id}`,
                      title: story.title,
                    };
                  }
                  const profile = PROFILE_BY_ID[sourceId];
                  if (!profile) return null;
                  const entry = matches.find((m) => m.profileId === sourceId);
                  const card = entry ? CARD_BY_ID[entry.cardId] : undefined;
                  const nodes = sceneNodesForProfile(sourceId);
                  if (nodes.length > 0) {
                    return {
                      refKind: "experience" as const,
                      refId: nodes[0],
                      title: card?.title ?? sourceId,
                    };
                  }
                  return {
                    refKind: "profile" as const,
                    refId: sourceId,
                    title: profile.name,
                  };
                }}
              />
            )}
            {matchUi === "results" && matches.length > 0 && (
              <CompareSection
                selection={compareSel}
                matches={matches}
                stories={new Map(matchStories.map((s) => [s.id, s]))}
                onRemove={(sel) => applyCompareSelect(sel)}
                onClear={() => setCompareSel([])}
              />
            )}
            {(matchUi === "results" || discoveries.items.length > 0) && (
              <DiscoveriesSection
                stories={new Map(matchStories.map((s) => [s.id, s]))}
              />
            )}
          </>
        )}
      </section>
    );
  }

  return (
    <form onSubmit={handleReview} noValidate>
      <JourneySteps step={1} />
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
