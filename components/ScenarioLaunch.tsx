"use client";

import { EXAMPLES, TRY_SCENARIO_EVENT } from "./Composer";

const BLURBS: Record<string, string> = {
  "Debug a prototype":
    "A sensor that drops readings every afternoon — a good test of cause-vs-symptom matching.",
  "Find first users":
    "A planner for night-shift nurses — tests matching when nothing technical overlaps.",
  "Learn a new tool":
    "Cutting family footage into a short film — a low-stakes first comparison.",
};

/**
 * Guided demo entry points. Each fills the mission form with a showcase
 * scenario (fictional, clearly labeled) and scrolls to it. Nothing is
 * sent anywhere; the normal consent flow still applies.
 */
export default function ScenarioLaunch() {
  function launch(index: number) {
    window.dispatchEvent(
      new CustomEvent(TRY_SCENARIO_EVENT, { detail: { index } }),
    );
    const problem = document.getElementById("problem");
    if (!problem) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    problem.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "center",
    });
    (problem as HTMLElement).focus({ preventScroll: true });
  }

  return (
    <div className="scenario-grid">
      {EXAMPLES.map((example, index) => (
        <button
          key={example.label}
          type="button"
          className="scenario-card"
          onClick={() => launch(index)}
        >
          <span className="scenario-index" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="scenario-title">{example.label}</span>
          <span className="scenario-blurb">
            {BLURBS[example.label] ?? "A guided showcase scenario."}
          </span>
          <span className="scenario-cta">Try this scenario</span>
        </button>
      ))}
    </div>
  );
}
