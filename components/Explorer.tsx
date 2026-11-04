"use client";

import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  EXPERIENCES,
  EXPERIENCE_BY_ID,
  GROUPS,
  linkKey,
  relatedTo,
  sourceLabelForExperience,
} from "../data/experiences";
import { PROFILE_BY_ID } from "../data/profiles";
import { profileForSceneNode, sceneNodesForProfile } from "../data/profile-scene";
import type { SceneLink } from "./ExperienceScene";
import {
  COMPARE_SELECT_EVENT,
  MATCHES_EVENT,
  NOTICE_EVENT,
  RETURN_TO_RESULTS_EVENT,
  SCENE_EVENT,
  SELECT_PROFILE_EVENT,
  SHOW_NODE_EVENT,
  dispatchMatchEvent,
  listenMatchEvent,
  validateMatchesPayload,
  validateProfilePayload,
  type SelectProfilePayload,
} from "../lib/match-events";
import { useDiscoveries } from "../lib/discoveries";

const ExperienceScene = dynamic(() => import("./ExperienceScene"), {
  ssr: false,
  loading: () => (
    <p className="fine-print" role="status">
      Loading the 3D view; the list below already works.
    </p>
  ),
});

class SceneErrorBoundary extends Component<
  { children: ReactNode; onFail: () => void },
  { failed: boolean }
> {
  constructor(props: { children: ReactNode; onFail: () => void }) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return (
      canvas.getContext("webgl") !== null ||
      canvas.getContext("experimental-webgl") !== null
    );
  } catch {
    return false;
  }
}

const ZOOM_STEPS = [0.8, 1, 1.25, 1.6];

export default function Explorer() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoomIndex, setZoomIndex] = useState(1);
  const [resetSignal, setResetSignal] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [open, setOpen] = useState(true);
  const [matchedProfiles, setMatchedProfiles] = useState<string[]>([]);
  const [selectedLink, setSelectedLink] = useState<SceneLink | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const discoveries = useDiscoveries();
  const sceneFrameRef = useRef<HTMLDivElement | null>(null);

  // One-time read of browser-only environment (WebGL, motion preference,
  // viewport) after mount; values cannot be known during server prerender.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time environment sync, runs once
    setWebgl(webglAvailable());
    setReduceMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    if (window.matchMedia("(max-width: 860px)").matches) {
      setOpen(false);
    }
  }, []);

  // Match highlights arrive from the results pane; anything invalid clears them.
  useEffect(() => {
    return listenMatchEvent(window, MATCHES_EVENT, (detail: unknown) => {
      const ids = validateMatchesPayload(detail);
      setMatchedProfiles(ids ? ids.filter((id) => PROFILE_BY_ID[id]) : []);
    });
  }, []);

  // "Show on map" selects the profile's first scene node. Read-only: no AI call.
  useEffect(() => {
    return listenMatchEvent(window, SHOW_NODE_EVENT, (detail: unknown) => {
      const profileId = validateProfilePayload(detail);
      if (!profileId) return;
      const nodes = sceneNodesForProfile(profileId);
      if (nodes.length === 0) return;
      setSelectedId(nodes[0]);
      sceneFrameRef.current?.scrollIntoView({ block: "nearest" });
    });
  }, []);

  // Tell the results pane whether highlighting can actually be seen.
  useEffect(() => {
    if (webgl === null) return;
    dispatchMatchEvent(window, SCENE_EVENT, {
      available: webgl && !sceneFailed,
    });
  }, [webgl, sceneFailed]);

  const matchedNodes = useMemo(() => {
    return new Set(matchedProfiles.flatMap((p) => sceneNodesForProfile(p)));
  }, [matchedProfiles]);

  function selectNode(id: string | null) {
    setSelectedId(id);
    if (id === null) return;
    setSelectedLink(null);
    const profileId = profileForSceneNode(id);
    if (profileId && matchedProfiles.includes(profileId)) {
      const payload: SelectProfilePayload = { profileId };
      dispatchMatchEvent(window, SELECT_PROFILE_EVENT, payload);
    }
  }

  function returnToOverview() {
    setSelectedId(null);
    setSelectedLink(null);
    setZoomIndex(1);
    setResetSignal((n) => n + 1);
  }

  function backToResults() {
    dispatchMatchEvent(window, RETURN_TO_RESULTS_EVENT, {});
  }

  function toggleDiscovery(exp: { id: string; title: string }) {
    const target = {
      refKind: "experience" as const,
      refId: exp.id,
      insight: undefined,
    };
    if (discoveries.has(target)) {
      discoveries.remove(target);
      dispatchMatchEvent(window, NOTICE_EVENT, {
        message: "Removed from My Discoveries.",
        tone: "info",
      });
    } else {
      discoveries.add({ ...target, title: exp.title });
      dispatchMatchEvent(window, NOTICE_EVENT, {
        message: "Saved to My Discoveries.",
        tone: "confirm",
      });
    }
  }

  const selected = selectedId ? EXPERIENCE_BY_ID[selectedId] : null;
  const related = selectedId ? relatedTo(selectedId) : [];
  const showScene = webgl === true && !sceneFailed;

  function zoomIn() {
    setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1));
  }
  function zoomOut() {
    setZoomIndex((i) => Math.max(0, i - 1));
  }
  function resetView() {
    setZoomIndex(1);
    setResetSignal((n) => n + 1);
  }

  return (
    <section
      aria-labelledby="explorer-heading"
      className={reduceMotion ? "reduce-motion" : ""}
    >
      <div className="explorer-head">
        <div>
          <h2 id="explorer-heading">Experience Atlas</h2>
          <p className="fine-print">
            A night atlas of the fictional example cases. Lit spires are
            documented attempts, rooted into districts of shared
            circumstance; glowing routes mark what those cases have in
            common. After a comparison, returned cases are ringed here —
            select any spire or list entry to read the full case. The
            layout and links are illustrative, not computed matches.
          </p>
        </div>
        <button
          type="button"
          className="secondary small explorer-toggle"
          aria-expanded={open}
          aria-controls="explorer-body"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide examples" : "Explore examples"}
        </button>
      </div>

      {open && (
        <div id="explorer-body">
          {showScene ? (
            <div className="scene-frame" ref={sceneFrameRef}>
              <SceneErrorBoundary onFail={() => setSceneFailed(true)}>
                <ExperienceScene
                  selectedId={selectedId}
                  onSelect={selectNode}
                  onHover={(id) => setHoveredNodeId(id)}
                  zoom={ZOOM_STEPS[zoomIndex]}
                  resetSignal={resetSignal}
                  matchedIds={matchedNodes}
                  reduceMotion={reduceMotion}
                  selectedLinkKey={
                    selectedLink
                      ? linkKey(selectedLink.from, selectedLink.to)
                      : null
                  }
                  onSelectLink={setSelectedLink}
                />
              </SceneErrorBoundary>
              <p className="fine-print scene-hint">
                Drag to orbit, scroll over the atlas to zoom, select a spire
                or a route marker to read it. The list below selects the
                same cases.
              </p>
              <p className="fine-print" role="status" aria-live="polite">
                {hoveredNodeId && EXPERIENCE_BY_ID[hoveredNodeId]
                  ? `Viewing: ${EXPERIENCE_BY_ID[hoveredNodeId].title} — select to open the full record.`
                  : "Hover a spire to preview its record."}
              </p>
            </div>
          ) : (
            webgl !== null && (
              <p className="fine-print" role="status">
                The 3D view is unavailable here; the full list below works the
                same way.
              </p>
            )
          )}

          <div
            className="toolbar"
            role="group"
            aria-label="Explorer view controls"
          >
            <button
              type="button"
              className="secondary small"
              onClick={zoomOut}
              disabled={zoomIndex === 0 || !showScene}
            >
              Zoom out
            </button>
            <button
              type="button"
              className="secondary small"
              onClick={zoomIn}
              disabled={zoomIndex === ZOOM_STEPS.length - 1 || !showScene}
            >
              Zoom in
            </button>
            <button
              type="button"
              className="secondary small"
              onClick={resetView}
              disabled={!showScene}
            >
              Reset view
            </button>
            <button
              type="button"
              className="secondary small"
              aria-pressed={reduceMotion}
              onClick={() => setReduceMotion((v) => !v)}
            >
              {reduceMotion ? "Motion reduced" : "Reduce motion"}
            </button>
          </div>

          <div className="legend" aria-label="Scene groups">
            {(Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((g) => (
              <span key={g} className={`legend-chip legend-${g}`}>
                {GROUPS[g].label}
              </span>
            ))}
            {matchedNodes.size > 0 && (
              <span className="legend-chip legend-match">
                Returned in your comparison
              </span>
            )}
          </div>
          {matchedNodes.size > 0 && (
            <p className="fine-print" role="status">
              Ringed spires were returned in your latest comparison — not
              verified expertise, availability, or a guaranteed solution.
            </p>
          )}

          {selectedLink && (
            <div className="link-note" role="status">
              <p>
                <strong>
                  {EXPERIENCE_BY_ID[selectedLink.from]?.title ?? selectedLink.from}
                </strong>{" "}
                ↔{" "}
                <strong>
                  {EXPERIENCE_BY_ID[selectedLink.to]?.title ?? selectedLink.to}
                </strong>
              </p>
              <p className="fine-print">
                Connected because: {selectedLink.shared} Overlap is partial;
                each case&apos;s differences still apply. These links are
                illustrative, not AI-discovered findings.
              </p>
              <div className="actions">
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => setSelectedLink(null)}
                >
                  Close connection
                </button>
              </div>
            </div>
          )}

          <div className="detail" aria-live="polite">
            {selected ? (
              <article aria-labelledby="detail-title">
                <p className="fine-print">
                  {sourceLabelForExperience(selected.id) ??
                    "Fictional case — self-reported, not verified."}
                </p>
                {matchedNodes.has(selected.id) && (
                  <p className="fine-print" role="status">
                    Returned in your comparison — the matching result card
                    has the evidence-based explanation.
                  </p>
                )}
                <h3 id="detail-title">{selected.title}</h3>
                <dl className="preview-list compact">
                  <div>
                    <dt>Situation</dt>
                    <dd>{selected.situation}</dd>
                  </div>
                  <div>
                    <dt>Attempted approach</dt>
                    <dd>{selected.attempted}</dd>
                  </div>
                  <div>
                    <dt>Self-reported outcome</dt>
                    <dd>{selected.outcome}</dd>
                  </div>
                  {matchedNodes.has(selected.id) && (
                    <div>
                      <dt>Why it may be relevant</dt>
                      <dd>
                        Your comparison returned this case: its overlaps are
                        listed on the result card, with the exact supporting
                        quotes. Treat it as a lead to inspect, not a verified
                        solution.
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt>Relevant differences</dt>
                    <dd>{selected.differences}</dd>
                  </div>
                  <div>
                    <dt>Constraints</dt>
                    <dd>{selected.constraints}</dd>
                  </div>
                  <div>
                    <dt>Tools and context</dt>
                    <dd>{selected.tools}</dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd>
                      Fictional example — self-reported, not verified. Your
                      own local stories never appear on this map.
                    </dd>
                  </div>
                </dl>
                {related.length > 0 && (
                  <>
                    <h4>Related experiences</h4>
                    <ul className="related-list">
                      {related.map(({ experience, shared }) => (
                        <li key={experience.id}>
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => selectNode(experience.id)}
                          >
                            {experience.title}
                          </button>
                          <span>
                            {" "}
                            — related because: {shared}. Overlap is partial;
                            differences above still apply.
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <div className="actions">
                  {matchedNodes.has(selected.id) && (
                    <button
                      type="button"
                      className="primary small"
                      onClick={backToResults}
                    >
                      Back to results
                    </button>
                  )}
                  <button
                    type="button"
                    className="secondary small"
                    onClick={() => {
                      dispatchMatchEvent(window, COMPARE_SELECT_EVENT, {
                        kind: "node",
                        nodeId: selected.id,
                      });
                    }}
                  >
                    Compare this case
                  </button>
                  <button
                    type="button"
                    className="secondary small"
                    aria-pressed={discoveries.has({
                      refKind: "experience",
                      refId: selected.id,
                      insight: undefined,
                    })}
                    onClick={() => toggleDiscovery(selected)}
                  >
                    {discoveries.has({
                      refKind: "experience",
                      refId: selected.id,
                      insight: undefined,
                    })
                      ? "Saved ✓"
                      : "Save case"}
                  </button>
                  <button
                    type="button"
                    className="secondary small"
                    onClick={returnToOverview}
                  >
                    Return to overview
                  </button>
                </div>
              </article>
            ) : (
              <p>
                Select a spire in the atlas or a case in the list to read
                what happened, what is still uncertain, and which other
                cases share something specific with it.
              </p>
            )}
          </div>

          <nav aria-label="Fictional experience cases">
            {(Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((group) => (
              <div key={group}>
                <h3 className="list-group-title">
                  {GROUPS[group].label}{" "}
                  <span className="fine-print">{GROUPS[group].blurb}</span>
                </h3>
                <ul className="case-list">
                  {EXPERIENCES.filter((e) => e.group === group).map((exp) => (
                    <li key={exp.id}>
                      <button
                        type="button"
                        className={
                          exp.id === selectedId
                            ? "case-button selected"
                            : "case-button"
                        }
                        aria-pressed={exp.id === selectedId}
                        onClick={() =>
                          selectNode(exp.id === selectedId ? null : exp.id)
                        }
                      >
                        <span className="case-title">{exp.title}</span>
                        <span className="fine-print">
                          {exp.situation}
                          {matchedNodes.has(exp.id) &&
                            " — Returned in your comparison."}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      )}
    </section>
  );
}
