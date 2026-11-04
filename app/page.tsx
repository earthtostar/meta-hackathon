"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Composer from "../components/Composer";
import DiscoverVisual from "../components/DiscoverVisual";
import Explorer from "../components/Explorer";
import ScenarioLaunch from "../components/ScenarioLaunch";
import KivoMark from "../components/KivoMark";
import StoryVault from "../components/StoryVault";
import {
  COMPARE_SELECT_EVENT,
  MATCHES_EVENT,
  NOTICE_EVENT,
  RETURN_TO_RESULTS_EVENT,
  SHOW_NODE_EVENT,
  listenMatchEvent,
  validateMatchesPayload,
  validateNoticePayload,
  type NoticePayload,
} from "../lib/match-events";
import { prefersReducedMotion, scrollProgress } from "../lib/motion";

interface Toast extends NoticePayload {
  id: number;
}

let toastSeq = 0;

type Mode = "discover" | "explore" | "contribute";

const MODES: { id: Mode; label: string; hash: string }[] = [
  { id: "discover", label: "Discover", hash: "#/discover" },
  { id: "explore", label: "Atlas", hash: "#/explore" },
  { id: "contribute", label: "Contribute", hash: "#/contribute" },
];

function modeFromHash(): Mode {
  if (typeof window === "undefined") return "discover";
  const hash = window.location.hash;
  if (hash.startsWith("#/explore")) return "explore";
  if (hash.startsWith("#/contribute")) return "contribute";
  return "discover";
}

/**
 * KIVO app shell: three connected modes over one preserved workspace.
 * All panes stay mounted (hidden when inactive) so the challenge draft,
 * match results, and local stories survive mode switches unchanged.
 */
export default function Home() {
  const [mode, setMode] = useState<Mode>("discover");
  const [matchCount, setMatchCount] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const panelTitleRef = useRef<HTMLHeadingElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);

  // Deep-linkable modes; back/forward buttons work via hash.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time hash sync, runs once
    setMode(modeFromHash());
    function onHash() {
      setMode(modeFromHash());
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function go(next: Mode) {
    const target = MODES.find((m) => m.id === next);
    if (target) {
      window.history.replaceState(null, "", target.hash);
    }
    setMode(next);
  }

  // Track live result count so Explore can offer a way back.
  useEffect(() => {
    return listenMatchEvent(window, MATCHES_EVENT, (detail: unknown) => {
      const ids = validateMatchesPayload(detail);
      setMatchCount(ids ? ids.length : 0);
    });
  }, []);

  // Hero scroll progress for the cinematic typography drift. One passive
  // listener writes a CSS variable — no re-renders, no scroll hijacking.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let queued = false;
    let raf = 0;
    function update() {
      queued = false;
      const main = mainRef.current;
      if (!main || typeof window === "undefined") return;
      const vh = window.innerHeight || 1;
      main.style.setProperty(
        "--hero-scroll",
        String(scrollProgress(-window.scrollY, 0, vh, 0.6)),
      );
    }
    function onScroll() {
      if (queued) return;
      queued = true;
      raf = requestAnimationFrame(update);
    }
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // "Show on map" from a result card opens the Explorer on that node.
  useEffect(() => {
    return listenMatchEvent(window, SHOW_NODE_EVENT, () => {
      window.history.replaceState(null, "", "#/explore");
      setMode("explore");
    });
  }, []);

  // Compare requests land in Discover, where the comparison lives.
  useEffect(() => {
    return listenMatchEvent(window, COMPARE_SELECT_EVENT, () => {
      window.history.replaceState(null, "", "#/discover");
      setMode("discover");
    });
  }, []);

  // Product feedback toasts: short, honest, auto-dismissed.
  useEffect(() => {
    return listenMatchEvent(window, NOTICE_EVENT, (detail: unknown) => {
      const notice = validateNoticePayload(detail);
      if (!notice) return;
      const id = (toastSeq += 1);
      setToasts((current) => [...current.slice(-2), { ...notice, id }]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== id));
      }, 3500);
    });
  }, []);

  // "Back to results" from the Explorer detail panel returns to Discover.
  useEffect(() => {
    return listenMatchEvent(window, RETURN_TO_RESULTS_EVENT, () => {
      window.history.replaceState(null, "", "#/discover");
      setMode("discover");
      requestAnimationFrame(() => panelTitleRef.current?.focus());
      requestAnimationFrame(() => {
        document
          .getElementById("match-heading")
          ?.focus({ preventScroll: false });
      });
    });
  }, []);

  // Mode switches move focus to the new panel heading once.
  const focusPanel = useCallback(() => {
    requestAnimationFrame(() => panelTitleRef.current?.focus());
  }, []);

  function switchMode(next: Mode) {
    if (next === mode) return;
    go(next);
    focusPanel();
  }

  function backToResults() {
    go("discover");
    focusPanel();
    requestAnimationFrame(() => {
      document
        .getElementById("match-heading")
        ?.focus({ preventScroll: false });
    });
  }

  return (
    <div className="page app">
      <header className="site-header app-header">
        <p className="wordmark">
          <KivoMark size={22} />
          <span className="brand-name">KIVO</span>
          <span className="wordmark-divider" aria-hidden="true" />
          <span className="wordmark-product">Experience Match</span>{" "}
          <span className="prototype-tag">Prototype</span>
        </p>
        <nav className="mode-tabs" aria-label="Primary">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={m.id === mode ? "mode-tab is-active" : "mode-tab"}
              aria-current={m.id === mode ? "page" : undefined}
              onClick={() => switchMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </nav>
      </header>

      <main ref={mainRef}>
        <section
          aria-labelledby="discover-heading"
          hidden={mode !== "discover"}
          className="mode-panel"
        >
          <DiscoverVisual onExplore={() => switchMode("explore")}>
            <p className="section-kicker enter enter-1">
              <KivoMark size={13} /> KIVO · Experience intelligence
            </p>
            <h1
              id="discover-heading"
              className="enter enter-2"
              tabIndex={-1}
              ref={mode === "discover" ? panelTitleRef : undefined}
            >
              Find what <em>transfers.</em>
            </h1>
            <p className="discover-sub enter enter-3">
              See what others tried. Describe a challenge — KIVO compares
              it with documented attempts, surfacing what worked, what
              differed, and what may carry over to you.
            </p>
          </DiscoverVisual>
          <div className="discover-grid">
            <div className="discover-main">
              <div className="composer-pane enter enter-4">
                <Composer />
              </div>
              <p className="fine-print privacy-line enter enter-5">
                Fictional demo cases · your stories stay in this browser ·
                nothing is sent without your explicit action.
              </p>
              <div className="quick-start enter enter-5">
                <h2>Start from a scenario</h2>
                <ScenarioLaunch />
              </div>
            </div>
            <div className="discover-side">
              <div className="mini-guide enter enter-5">
                <h2>How a search goes</h2>
                <ol>
                  <li>
                    <strong>Describe</strong> your situation below.
                  </li>
                  <li>
                    <strong>Clarify</strong> it with AI — optional, you
                    approve every word.
                  </li>
                  <li>
                    <strong>Compare</strong> it with relevant experiences.
                  </li>
                </ol>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => switchMode("contribute")}
                >
                  Or chart your own route first
                </button>
              </div>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="explore-heading"
          hidden={mode !== "explore"}
          className="mode-panel"
        >
          <p className="section-kicker">
            <KivoMark size={13} /> Atlas · a living map
          </p>
          <h1
            id="explore-heading"
            tabIndex={-1}
            ref={mode === "explore" ? panelTitleRef : undefined}
            className="panel-title"
          >
            Walk the paths others took
          </h1>
          {matchCount > 0 && (
            <div className="match-banner" role="status">
              <span>
                {matchCount} {matchCount === 1 ? "result" : "results"} from
                your latest comparison {matchCount === 1 ? "is" : "are"}{" "}
                ringed below.
              </span>{" "}
              <button
                type="button"
                className="secondary small"
                onClick={backToResults}
              >
                Back to results
              </button>
            </div>
          )}
          <div className="explorer-pane">
            <Explorer />
          </div>
        </section>

        <section
          aria-labelledby="contribute-heading"
          hidden={mode !== "contribute"}
          className="mode-panel"
        >
          <p className="section-kicker">
            <KivoMark size={13} /> Contribute · add your route
          </p>
          <h1
            id="contribute-heading"
            tabIndex={-1}
            ref={mode === "contribute" ? panelTitleRef : undefined}
            className="panel-title"
          >
            Add your route to the atlas
          </h1>
          <p className="fine-print privacy-line">
            Your routes stay in this browser. They join comparisons only if
            you explicitly include them — never published, never sent to
            any person.
          </p>
          <div className="mission pane">
            <StoryVault />
          </div>
        </section>
      </main>

      <div className="toast-stack">
        {toasts.map((toast) => (
          <p key={toast.id} role="status" className={`toast toast-${toast.tone}`}>
            {toast.message}
          </p>
        ))}
      </div>

      <footer className="page-footer">
        <span>
          KIVO · Experience Match prototype. Demo stories are fictional
          and self-reported experience is never treated as verified.
        </span>
        <span>Your stories never leave this browser.</span>
      </footer>
    </div>
  );
}
