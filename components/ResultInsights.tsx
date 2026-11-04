"use client";

import { useState } from "react";
import KivoMark from "./KivoMark";
import { CARD_BY_ID } from "../data/profiles";
import { useDiscoveries } from "../lib/discoveries";
import { NOTICE_EVENT, dispatchMatchEvent } from "../lib/match-events";
import type {
  MatchEntry,
  MatchEvidenceField,
  NextMove,
} from "../lib/match";
import type { LocalStory } from "../lib/local-stories";

export interface MoveRef {
  refKind: "experience" | "story" | "profile";
  refId: string;
  title: string;
}

const FIELD_LABEL: Record<MatchEvidenceField, string> = {
  situation: "Same situation",
  constraints: "Same constraints",
  attempts: "Same attempts",
  outcome: "Same outcome",
  unknowns: "Shared unknowns",
};

function sourceOf(
  m: MatchEntry,
  stories: Map<string, LocalStory>,
): { title: string; kind: string } {
  const story = stories.get(m.profileId);
  if (story) return { title: story.title, kind: "Your local experience" };
  const card = CARD_BY_ID[m.cardId];
  return { title: card?.title ?? m.profileId, kind: "Fictional example" };
}

/**
 * Honest, data-derived reading aids for a match set. Every number is a
 * count of validated notes the model returned — never a score, a ranking,
 * or a claim the model did not make.
 */
export default function ResultInsights({
  matches,
  stories,
  fallback,
  nextMoves,
  limitations,
  resolveMoveRef,
}: {
  matches: MatchEntry[];
  stories: LocalStory[];
  fallback: boolean;
  nextMoves: NextMove[];
  limitations: string[];
  resolveMoveRef: (sourceId: string) => MoveRef | null;
}) {
  const [copied, setCopied] = useState(false);
  const discoveries = useDiscoveries();
  if (matches.length === 0) return null;
  const byId = new Map(stories.map((s) => [s.id, s]));
  const titleById = new Map(
    matches.map((m) => [m.profileId, sourceOf(m, byId).title] as const),
  );

  const overlapCounts = new Map<MatchEvidenceField, number>();
  let differenceCount = 0;
  let unknownCount = 0;
  for (const m of matches) {
    for (const point of m.overlaps) {
      overlapCounts.set(
        point.cardField,
        (overlapCounts.get(point.cardField) ?? 0) + 1,
      );
    }
    differenceCount += m.differences.length;
    unknownCount += m.unknowns.length;
  }

  const questions = matches
    .flatMap((m) => {
      const source = sourceOf(m, byId);
      return [{ question: m.question, ...source }];
    })
    .slice(0, 3);
  const openUnknowns = matches
    .flatMap((m) => {
      const source = sourceOf(m, byId);
      return m.unknowns
        .slice(0, 2)
        .map((text) => ({ text, title: source.title }));
    })
    .slice(0, 3);

  async function copySummary() {
    const lines = [
      "Experience Match — comparison summary (local prototype)",
      fallback ? "Produced by keyword fallback, not AI analysis." : "",
      "",
      ...matches.flatMap((m, i) => {
        const source = sourceOf(m, byId);
        return [
          `${i + 1}. ${source.title} [${source.kind}]`,
          ...m.overlaps.map((p) => `   Overlap: ${p.text}`),
          ...m.differences.map((p) => `   Difference: ${p.text}`),
          ...m.transfers.map((t) => `   May transfer: ${t.text}`),
          `   Suggested question: ${m.question}`,
          "",
        ];
      }),
      ...nextMoves.map(
        (move) => `Next move (suggestion): ${move.text}`,
      ),
      ...limitations.map((item) => `Limitation: ${item}`),
      "Demo profiles are fictional; local stories are self-reported and unverified.",
    ];
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="insights">
      <p className="section-kicker">
        <KivoMark size={13} /> Now you know.
      </p>
      <div className="insights-head">
        <h3>Reading these results</h3>
        <button
          type="button"
          className="secondary small"
          onClick={() => void copySummary()}
        >
          {copied ? "Copied" : "Copy summary"}
        </button>
      </div>
      {fallback && (
        <p className="fine-print" role="status">
          Keyword fallback active — counts below reflect wording overlaps,
          not AI analysis.
        </p>
      )}
      <p className="fine-print">
        Counts of the evidence notes above — a reading aid, not a score.
        More notes in one place does not mean a better answer.
      </p>
      <ul className="overlap-chips" aria-label="Overlap notes by theme">
        {(Object.keys(FIELD_LABEL) as MatchEvidenceField[]).map((field) => {
          const count = overlapCounts.get(field) ?? 0;
          return (
            <li
              key={field}
              className={count === 0 ? "chip chip-empty" : "chip"}
              aria-label={`${FIELD_LABEL[field]}: ${count} notes`}
            >
              {FIELD_LABEL[field]} <span aria-hidden="true">×{count}</span>
            </li>
          );
        })}
      </ul>
      <p className="fine-print">
        {differenceCount} differences and {unknownCount} open unknowns bound
        what transfers — read them before acting on any overlap.
      </p>
      {nextMoves.length > 0 &&
        (() => {
          const [primary, ...alternatives] = nextMoves;
          const supportedBy = (move: NextMove) =>
            move.sourceIds
              .map((id) => titleById.get(id) ?? id)
              .join(", ");
          const saveTarget = (move: NextMove) => {
            const first = move.sourceIds.map(resolveMoveRef).find(Boolean);
            return first
              ? {
                  refKind: first.refKind,
                  refId: first.refId,
                  insight: move.text,
                }
              : null;
          };
          const toggleSave = (move: NextMove) => {
            const target = saveTarget(move);
            if (!target) return;
            if (discoveries.has(target)) {
              discoveries.remove(target);
              dispatchMatchEvent(window, NOTICE_EVENT, {
                message: "Next step removed.",
                tone: "info",
              });
            } else {
              const ref = resolveMoveRef(move.sourceIds[0]);
              discoveries.add({
                refKind: target.refKind,
                refId: target.refId,
                title: ref?.title ?? "Suggested next step",
                insight: move.text,
              });
              dispatchMatchEvent(window, NOTICE_EVENT, {
                message: "Next step saved to My Discoveries.",
                tone: "confirm",
              });
            }
          };
          const saveButton = (move: NextMove, key: string) => {
            const target = saveTarget(move);
            if (!target) return null;
            const saved = discoveries.has(target);
            return (
              <button
                key={key}
                type="button"
                className="secondary small"
                aria-pressed={saved}
                onClick={() => toggleSave(move)}
              >
                {saved ? "Saved ✓" : "Save step"}
              </button>
            );
          };
          return (
            <div className="next-steps">
              <h4>Suggested first step</h4>
              <p>
                <span className="next-kind">Next move</span> {primary.text}
              </p>
              <p className="fine-print">
                Why this step: grounded in {supportedBy(primary)}. What
                remains uncertain: the differences and unknowns listed
                above still apply — no outcome is guaranteed.
              </p>
              <div className="actions">{saveButton(primary, "primary")}</div>
              {alternatives.length > 0 && (
                <>
                  <h4>Alternatives to consider</h4>
                  <ul>
                    {alternatives.map((move, i) => (
                      <li key={`m-${i}`}>
                        <span className="next-kind">Option</span> {move.text}
                        <span className="fine-print">
                          {" "}
                          — based on {supportedBy(move)}
                        </span>{" "}
                        {saveButton(move, `alt-${i}`)}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="fine-print">
                Suggestions grounded in the matches above — not
                instructions, and no outcome is guaranteed.
              </p>
            </div>
          );
        })()}
      <div className="next-steps">
        <h4>What you can do next</h4>
        <ul>
          {questions.map((q, i) => (
            <li key={`q-${i}`}>
              <span className="next-kind">Consider asking</span> “{q.question}”
              <span className="fine-print"> — from {q.title}</span>
            </li>
          ))}
          {openUnknowns.map((u, i) => (
            <li key={`u-${i}`}>
              <span className="next-kind">Still to clarify</span> {u.text}
              <span className="fine-print"> — open in {u.title}</span>
            </li>
          ))}
        </ul>
      </div>
      {limitations.length > 0 && (
        <div className="next-steps">
          <h4>Limits of this comparison</h4>
          <ul>
            {limitations.map((item, i) => (
              <li key={`l-${i}`}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
