"use client";

import {
  buildComparison,
  compareKey,
  resolveCompareRecord,
  type CompareContext,
  type CompareSource,
} from "../lib/compare";
import {
  SHOW_NODE_EVENT,
  dispatchMatchEvent,
  type ShowNodePayload,
} from "../lib/match-events";
import { profileForSceneNode } from "../data/profile-scene";

/**
 * CompareSection — side-by-side comparison of up to two available
 * experiences, rendered entirely from their records plus already
 * validated match insights. Never invents fields; thin comparability
 * is stated outright.
 */
export default function CompareSection({
  selection,
  matches,
  stories,
  onRemove,
  onClear,
}: {
  selection: CompareSource[];
  matches: CompareContext["matches"];
  stories: CompareContext["stories"];
  onRemove: (sel: CompareSource) => void;
  onClear: () => void;
}) {
  const ctx: CompareContext = { matches, stories };
  const resolved = selection.map((sel) => ({
    sel,
    record: resolveCompareRecord(sel, ctx),
  }));
  const ready = resolved.filter(
    (r): r is { sel: CompareSource; record: NonNullable<typeof r.record> } =>
      r.record !== null,
  );

  return (
    <section aria-labelledby="compare-heading" className="pane compare-pane">
      <h2 id="compare-heading">Compare experiences</h2>
      {selection.length === 0 && (
        <p className="fine-print">
          Select up to two cases — from a result card or an explorer node —
          to compare their records side by side.
        </p>
      )}
      {selection.length === 1 && (
        <p className="fine-print">
          One case selected. Add a second from any result card or explorer
          node. Only its documented record and validated insights are used.
        </p>
      )}
      {ready.length === 2 &&
        (() => {
          const cmp = buildComparison(ready[0].record, ready[1].record, ctx);
          return (
            <div className="compare-grid">
              <div className="compare-col">
                <h3>
                  {cmp.a.title}{" "}
                  <span className="fine-print">{cmp.a.kindLabel}</span>
                </h3>
              </div>
              <div className="compare-col">
                <h3>
                  {cmp.b.title}{" "}
                  <span className="fine-print">{cmp.b.kindLabel}</span>
                </h3>
              </div>
              {cmp.fields.map((row) => (
                <div className="compare-row" key={row.field}>
                  <h4>{row.field}</h4>
                  <div className="compare-cells">
                    <p>{row.a}</p>
                    <p>{row.b}</p>
                  </div>
                </div>
              ))}
              <div className="compare-row">
                <h4>Shared patterns</h4>
                <div className="compare-cells">
                  {cmp.sharedLink ? (
                    <p className="compare-span">
                      Documented link: {cmp.sharedLink}
                    </p>
                  ) : (
                    <p className="compare-span empty-note">
                      No documented direct link between these cases.
                    </p>
                  )}
                  {cmp.sharedInsights.length > 0 ? (
                    <ul className="draft-list">
                      {cmp.sharedInsights.map((s, i) => (
                        <li key={i}>
                          <strong>{s.from}:</strong> {s.text}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="empty-note">
                      {cmp.bothReturned
                        ? "Both were returned, but the comparison named no shared wording."
                        : "They were not compared in the same result set."}
                    </p>
                  )}
                </div>
              </div>
              <div className="compare-row">
                <h4>Transferable insights</h4>
                <div className="compare-cells">
                  {cmp.transferInsights.length > 0 ? (
                    <ul className="draft-list">
                      {cmp.transferInsights.map((t, i) => (
                        <li key={i}>
                          <strong>{t.from}</strong> ({t.basis}): {t.text}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="empty-note">
                      The comparison named no transferable step for these
                      cases.
                    </p>
                  )}
                </div>
              </div>
              {cmp.limitation && (
                <p className="fine-print" role="note">
                  {cmp.limitation}
                </p>
              )}
            </div>
          );
        })()}
      {resolved.some((r) => r.record === null) && (
        <p className="fine-print" role="status">
          A selected case is no longer available and was skipped.
        </p>
      )}
      {selection.length > 0 && (
        <div className="actions">
          {resolved.map(({ sel, record }) =>
            record ? (
              <span key={compareKey(sel)} className="actions">
                {sel.kind === "node" &&
                  (() => {
                    const profileId = profileForSceneNode(sel.nodeId);
                    if (!profileId) return null;
                    return (
                      <button
                        type="button"
                        className="secondary small"
                        onClick={() => {
                          const payload: ShowNodePayload = { profileId };
                          dispatchMatchEvent(window, SHOW_NODE_EVENT, payload);
                        }}
                      >
                        Show {record.title} on map
                      </button>
                    );
                  })()}
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => onRemove(sel)}
                >
                  Remove {record.title}
                </button>
              </span>
            ) : null,
          )}
          <button type="button" className="secondary small" onClick={onClear}>
            Clear comparison
          </button>
        </div>
      )}
    </section>
  );
}
