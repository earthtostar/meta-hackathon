"use client";

import { useMemo, useState } from "react";
import type { MatchEntry } from "../lib/match";
import type {
  RankDelta,
  WhatIfChange,
  WhatIfField,
} from "../lib/whatif";

export interface WhatIfResult {
  change: WhatIfChange;
  matches: MatchEntry[];
  deltas: RankDelta[];
  fallback: boolean;
  summary: string;
}

/**
 * What If? — relevance exploration, not prediction.
 *
 * One constraint or resource is rewritten, the same matching pipeline
 * re-runs against the same candidate pool, and the new ranking is
 * diffed against the original. Movement reflects the edited constraint
 * only; it never invents experiences or promises a better outcome.
 * The original comparison stays intact until the user promotes the
 * re-ranking or discards it.
 */
export default function WhatIfSection({
  constraints,
  resources,
  running,
  error,
  result,
  resolveTitle,
  onRun,
  onPromote,
  onDiscard,
}: {
  constraints: string[];
  resources: string[];
  running: boolean;
  error: string | null;
  result: WhatIfResult | null;
  resolveTitle: (profileId: string) => { title: string; kind: string };
  onRun: (field: WhatIfField, index: number, to: string) => void;
  onPromote: () => void;
  onDiscard: () => void;
}) {
  const options = useMemo(
    () => [
      ...constraints.map((text, index) => ({
        field: "constraintsKnown" as WhatIfField,
        group: "Constraint",
        index,
        text,
      })),
      ...resources.map((text, index) => ({
        field: "resourcesKnown" as WhatIfField,
        group: "Resource",
        index,
        text,
      })),
    ],
    [constraints, resources],
  );
  const [selKey, setSelKey] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [touched, setTouched] = useState(false);

  const activeKey = selKey;
  const active =
    options.find((_, i) =>
      activeKey === null
        ? i === 0
        : `${options[i].index}:${options[i].field}` === activeKey,
    ) ?? null;
  const currentText = touched ? text : (active?.text ?? "");

  function select(key: string, value: string) {
    setSelKey(key);
    setText(value);
    setTouched(true);
  }

  const changed =
    active !== null && currentText.trim() !== "" && currentText.trim() !== active.text.trim();

  const byId = useMemo(
    () => new Map((result?.matches ?? []).map((m) => [m.profileId, m])),
    [result],
  );
  const dropped = (result?.deltas ?? []).filter((d) => d.direction === "dropped");

  return (
    <section aria-labelledby="whatif-heading" className="pane compare-pane">
      <h2 id="whatif-heading">What if?</h2>
      <p className="fine-print">
        Change one constraint or resource and re-rank the same experiences.
        This explores relevance — it never invents new cases and never
        promises a better outcome.
      </p>
      {options.length === 0 && (
        <p className="fine-print" role="note">
          The draft lists no constraints or resources to vary. Add some in
          the draft above, then return here.
        </p>
      )}
      {options.length > 0 && result === null && (
        <>
          <div className="field" role="radiogroup" aria-label="Choose one item to vary">
            {options.map((opt, i) => {
              const key = `${opt.index}:${opt.field}`;
              const checked = activeKey === null ? i === 0 : activeKey === key;
              return (
                <label key={key} className="whatif-option">
                  <input
                    type="radio"
                    name="whatif-item"
                    checked={checked}
                    onChange={() => select(key, opt.text)}
                  />
                  <span>
                    <span className="ai-badge">{opt.group}</span> {opt.text}
                  </span>
                </label>
              );
            })}
          </div>
          <div className="field">
            <label htmlFor="whatif-text">What if it were…</label>
            <input
              id="whatif-text"
              type="text"
              value={currentText}
              onChange={(e) => {
                setText(e.target.value);
                setTouched(true);
              }}
              maxLength={250}
              placeholder="Rewrite the selected item"
              autoComplete="off"
            />
          </div>
          {error && (
            <p className="error-text" role="alert">
              {error}{" "}
              <button
                type="button"
                className="link-button"
                onClick={() =>
                  active && onRun(active.field, active.index, currentText.trim())
                }
              >
                Try again
              </button>
            </p>
          )}
          <div className="actions">
            <button
              type="button"
              className="primary small"
              disabled={!changed || running}
              onClick={() =>
                active && onRun(active.field, active.index, currentText.trim())
              }
            >
              {running ? "Re-ranking…" : "Re-rank with this change"}
            </button>
          </div>
        </>
      )}
      {running && result === null && (
        <div className="status-note">
          <span className="pulse" aria-hidden="true" />
          <p className="fine-print" role="status">
            Re-running the same comparison with your edited constraint…
          </p>
        </div>
      )}
      {result && (
        <div role="status">
          <p className="confirm-note">
            Changed {result.change.field === "constraintsKnown" ? "constraint" : "resource"}:
            “{result.change.from}” → “{result.change.to}”
          </p>
          <p className="fine-print">{result.summary}</p>
          {result.fallback && (
            <p className="fine-print" role="note">
              Keyword fallback produced this re-ranking — wording overlaps,
              not AI analysis.
            </p>
          )}
          <ul className="draft-list">
            {result.deltas
              .filter((d) => d.direction !== "dropped")
              .map((d) => {
                const m = byId.get(d.profileId);
                if (!m) return null;
                const source = resolveTitle(d.profileId);
                const move =
                  d.direction === "new"
                    ? "New in top results"
                    : d.direction === "same"
                      ? `#${(d.to ?? 0) + 1} — unchanged`
                      : d.direction === "up"
                        ? `↑ #${(d.to ?? 0) + 1} (was #${(d.from ?? 0) + 1})`
                        : `↓ #${(d.to ?? 0) + 1} (was #${(d.from ?? 0) + 1})`;
                return (
                  <li key={d.profileId}>
                    <strong>{move}</strong> — {source.title}{" "}
                    <span className="ai-badge">{source.kind}</span>
                    {m.overlaps[0] && (
                      <span className="support-quote">
                        Still relevant: {m.overlaps[0].text}
                      </span>
                    )}
                    {m.differences[0] && (
                      <span className="support-quote">
                        Still differs: {m.differences[0].text}
                      </span>
                    )}
                  </li>
                );
              })}
          </ul>
          {dropped.length > 0 && (
            <p className="fine-print">
              Left the top results:{" "}
              {dropped
                .map((d) => resolveTitle(d.profileId).title)
                .join("; ")}
            </p>
          )}
          <div className="actions">
            <button
              type="button"
              className="primary small"
              onClick={onPromote}
            >
              Use these results
            </button>
            <button
              type="button"
              className="secondary small"
              onClick={onDiscard}
            >
              Back to original
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
