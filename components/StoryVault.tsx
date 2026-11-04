"use client";

import { useEffect, useRef, useState } from "react";
import {
  MAX_STORIES,
  STORY_OUTCOME_MAX,
  STORY_TITLE_MAX,
  loadLocalStories,
  newStoryId,
  saveLocalStories,
  validateLocalStory,
  type LocalStory,
  type StoryOutcomeStatus,
} from "../lib/local-stories";
import {
  POOL_CHANGED_EVENT,
  dispatchMatchEvent,
} from "../lib/match-events";
import { CONSTRAINTS_MAX, PROBLEM_MAX, TRIED_MAX } from "../lib/clarify";

const OUTCOME_OPTIONS: { value: StoryOutcomeStatus; label: string }[] = [
  { value: "resolved", label: "Resolved" },
  { value: "partial", label: "Partly improved" },
  { value: "did-not-work", label: "Did not work" },
  { value: "unknown", label: "Not yet known" },
];

const OUTCOME_BADGE: Record<StoryOutcomeStatus, string> = {
  resolved: "Resolved",
  partial: "Partly improved",
  "did-not-work": "Did not work",
  unknown: "Not yet known",
};

interface StoryForm {
  title: string;
  situation: string;
  constraints: string;
  attempts: string;
  outcome: string;
  outcomeStatus: StoryOutcomeStatus;
  unknownsText: string;
}

const EMPTY_FORM: StoryForm = {
  title: "",
  situation: "",
  constraints: "",
  attempts: "",
  outcome: "",
  outcomeStatus: "unknown",
  unknownsText: "",
};

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function parseUnknowns(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .slice(0, 5);
}

export default function StoryVault() {
  const [stories, setStories] = useState<LocalStory[]>([]);
  const [form, setForm] = useState<StoryForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<"saved" | "failed" | null>(null);
  const sectionTitleRef = useRef<HTMLHeadingElement | null>(null);
  const formTitleRef = useRef<HTMLInputElement | null>(null);
  const situationRef = useRef<HTMLTextAreaElement | null>(null);
  const outcomeRef = useRef<HTMLTextAreaElement | null>(null);
  const deleteConfirmRef = useRef<HTMLButtonElement | null>(null);

  const showForm = adding || editingId !== null;

  // Restore the collection once, client-side only.
  useEffect(() => {
    const saved = loadLocalStories(safeStorage());
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time restore from browser storage, runs once
      setStories(saved);
    }
  }, []);

  useEffect(() => {
    if (deleteId) deleteConfirmRef.current?.focus();
  }, [deleteId]);

  function persist(next: LocalStory[], poolTouched: boolean) {
    setStories(next);
    const outcome = saveLocalStories(safeStorage(), next);
    setSaveNotice(outcome === "ok" ? "saved" : "failed");
    if (poolTouched) {
      dispatchMatchEvent(window, POOL_CHANGED_EVENT, {
        included: next.filter((s) => s.includeInMatching).length,
      });
    }
  }

  function startAdd() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setAdding(true);
    setFormErrors([]);
    setDeleteId(null);
    requestAnimationFrame(() => formTitleRef.current?.focus());
  }

  function startEdit(story: LocalStory) {
    setForm({
      title: story.title,
      situation: story.situation,
      constraints: story.constraints,
      attempts: story.attempts,
      outcome: story.outcome,
      outcomeStatus: story.outcomeStatus,
      unknownsText: story.unknowns.join("\n"),
    });
    setEditingId(story.id);
    setAdding(false);
    setFormErrors([]);
    setDeleteId(null);
    requestAnimationFrame(() => formTitleRef.current?.focus());
  }

  function cancelForm() {
    setAdding(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErrors([]);
  }

  function validateForm(): string[] {
    const errors: string[] = [];
    if (form.title.trim() === "") {
      errors.push("Give the route a short title.");
    } else if (form.title.length > STORY_TITLE_MAX) {
      errors.push(`Keep the title within ${STORY_TITLE_MAX} characters.`);
    }
    if (form.situation.trim() === "") {
      errors.push("Describe the situation so someone else can follow it.");
    } else if (form.situation.length > PROBLEM_MAX) {
      errors.push(`Keep the situation within ${PROBLEM_MAX} characters.`);
    }
    if (form.constraints.length > CONSTRAINTS_MAX) {
      errors.push(`Keep constraints within ${CONSTRAINTS_MAX} characters.`);
    }
    if (form.attempts.length > TRIED_MAX) {
      errors.push(`Keep previous attempts within ${TRIED_MAX} characters.`);
    }
    if (form.outcome.trim() === "") {
      errors.push("Say what happened, even if nothing worked.");
    } else if (form.outcome.length > STORY_OUTCOME_MAX) {
      errors.push(`Keep the outcome within ${STORY_OUTCOME_MAX} characters.`);
    }
    return errors;
  }

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateForm();
    setFormErrors(errors);
    if (errors.length > 0) {
      if (errors[0].includes("title")) formTitleRef.current?.focus();
      else if (errors[0].includes("situation")) situationRef.current?.focus();
      else outcomeRef.current?.focus();
      return;
    }
    const now = Date.now();
    if (editingId) {
      const previous = stories.find((s) => s.id === editingId);
      const updated: LocalStory = {
        id: editingId,
        title: form.title,
        situation: form.situation,
        constraints: form.constraints,
        attempts: form.attempts,
        outcome: form.outcome,
        outcomeStatus: form.outcomeStatus,
        unknowns: parseUnknowns(form.unknownsText),
        includeInMatching: previous?.includeInMatching ?? false,
        updatedAt: now,
      };
      if (!validateLocalStory(updated)) {
        setFormErrors(["That story could not be saved. Check the limits and retry."]);
        return;
      }
      persist(
        stories.map((s) => (s.id === editingId ? updated : s)),
        updated.includeInMatching,
      );
      setAdding(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      requestAnimationFrame(() =>
        document.getElementById(`story-${editingId}`)?.focus(),
      );
    } else {
      const created: LocalStory = {
        id: newStoryId(),
        title: form.title,
        situation: form.situation,
        constraints: form.constraints,
        attempts: form.attempts,
        outcome: form.outcome,
        outcomeStatus: form.outcomeStatus,
        unknowns: parseUnknowns(form.unknownsText),
        includeInMatching: false,
        updatedAt: now,
      };
      if (!validateLocalStory(created)) {
        setFormErrors(["That story could not be saved. Check the limits and retry."]);
        return;
      }
      persist([...stories, created], false);
      setAdding(false);
      setForm(EMPTY_FORM);
      requestAnimationFrame(() =>
        document.getElementById(`story-${created.id}`)?.focus(),
      );
    }
  }

  function handleToggle(story: LocalStory, enabled: boolean) {
    persist(
      stories.map((s) =>
        s.id === story.id ? { ...s, includeInMatching: enabled, updatedAt: Date.now() } : s,
      ),
      true,
    );
  }

  function handleDelete(story: LocalStory) {
    persist(
      stories.filter((s) => s.id !== story.id),
      story.includeInMatching,
    );
    setDeleteId(null);
    requestAnimationFrame(() => sectionTitleRef.current?.focus());
  }

  return (
    <section aria-labelledby="story-vault-heading">
      <h2 id="story-vault-heading" tabIndex={-1} ref={sectionTitleRef}>
        Add your route
      </h2>
      <p className="fine-print">
        Chart a route others can learn from — what you faced, what you
        tried, where it led. Saved in this browser. Not published or
        shared with other people. Adding a route never creates a public
        profile and never contacts anyone.
      </p>
      {saveNotice === "saved" && (
        <p className="fine-print" role="status">
          Saved in this browser.
        </p>
      )}
      {saveNotice === "failed" && (
        <p className="error-text" role="alert">
          Saving isn&apos;t working in this browser — routes may be lost
          when the page closes. What you typed above is still on screen.
        </p>
      )}

      {stories.length === 0 && !showForm && (
        <p className="fine-print">No charted routes yet.</p>
      )}

      <div className="field">
        {stories.map((story) => (
          <article
            key={story.id}
            aria-labelledby={`story-title-${story.id}`}
            className="story-card"
          >
            <h3 id={`story-${story.id}`} tabIndex={-1}>
              <span id={`story-title-${story.id}`}>{story.title}</span>{" "}
              <span className="ai-badge">{OUTCOME_BADGE[story.outcomeStatus]}</span>
            </h3>
            <dl className="preview-list compact">
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
                  <dt>What was tried</dt>
                  <dd>{story.attempts}</dd>
                </div>
              )}
              <div>
                <dt>What happened</dt>
                <dd>{story.outcome}</dd>
              </div>
              {story.unknowns.length > 0 && (
                <div>
                  <dt>Remaining unknowns</dt>
                  <dd>
                    <ul className="draft-list">
                      {story.unknowns.map((item, i) => (
                        <li key={i}>Unknown: {item}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}
            </dl>
            <div className="include-row">
              <label htmlFor={`include-${story.id}`}>
                <input
                  id={`include-${story.id}`}
                  type="checkbox"
                  checked={story.includeInMatching}
                  onChange={(event) => handleToggle(story, event.target.checked)}
                />{" "}
                Include this route in my local comparisons
              </label>
              <p className="fine-print">
                Enabled routes are sent to Meta alongside your approved
                request when you explicitly start matching. Turning this on
                alone sends nothing.
              </p>
            </div>
            <div className="actions">
              <button type="button" className="secondary small" onClick={() => startEdit(story)}>
                Edit
              </button>
              {deleteId === story.id ? (
                <span role="group" aria-label={`Confirm deleting ${story.title}`}>
                  <span className="fine-print">Delete this route? </span>
                  <button
                    type="button"
                    className="secondary small"
                    onClick={() => handleDelete(story)}
                    ref={deleteConfirmRef}
                  >
                    Yes, delete
                  </button>{" "}
                  <button
                    type="button"
                    className="secondary small"
                    onClick={() => setDeleteId(null)}
                  >
                    Keep it
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => setDeleteId(story.id)}
                >
                  Delete
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      {!showForm &&
        (stories.length >= MAX_STORIES ? (
          <p className="limit-note" role="status">
            This prototype keeps at most {MAX_STORIES} experiences. Delete
            one to add another.
          </p>
        ) : (
          <div className="actions">
            <button type="button" className="secondary" onClick={startAdd}>
              Add an experience
            </button>
          </div>
        ))}

      {showForm && (
        <form
          onSubmit={handleSave}
          noValidate
          aria-label={editingId ? "Edit experience" : "Add experience"}
        >
          <h3>{editingId ? "Edit route" : "Chart a route"}</h3>
          {formErrors.length > 0 && (
            <div className="error-summary" role="alert">
              <ul>
                {formErrors.map((message, i) => (
                  <li key={i}>{message}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="field">
            <label htmlFor="story-title">Short title</label>
            <input
              id="story-title"
              name="story-title"
              type="text"
              ref={formTitleRef}
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              maxLength={STORY_TITLE_MAX + 20}
            />
          </div>
          <div className="field">
            <label htmlFor="story-situation">Situation: what were you trying to do?</label>
            <textarea
              id="story-situation"
              name="story-situation"
              ref={situationRef}
              value={form.situation}
              onChange={(event) => setForm({ ...form, situation: event.target.value })}
              maxLength={PROBLEM_MAX + 100}
              rows={4}
            />
          </div>
          <div className="field">
            <label htmlFor="story-constraints">Constraints and context (optional)</label>
            <input
              id="story-constraints"
              name="story-constraints"
              type="text"
              value={form.constraints}
              onChange={(event) => setForm({ ...form, constraints: event.target.value })}
              maxLength={CONSTRAINTS_MAX + 100}
            />
          </div>
          <div className="field">
            <label htmlFor="story-attempts">What did you try? (optional)</label>
            <textarea
              id="story-attempts"
              name="story-attempts"
              value={form.attempts}
              onChange={(event) => setForm({ ...form, attempts: event.target.value })}
              maxLength={TRIED_MAX + 100}
              rows={3}
            />
          </div>
          <div className="field">
            <label htmlFor="story-outcome">What happened?</label>
            <textarea
              id="story-outcome"
              name="story-outcome"
              ref={outcomeRef}
              value={form.outcome}
              onChange={(event) => setForm({ ...form, outcome: event.target.value })}
              maxLength={STORY_OUTCOME_MAX + 100}
              rows={3}
            />
          </div>
          <div className="field">
            <label htmlFor="story-status">Outcome</label>
            <select
              id="story-status"
              name="story-status"
              value={form.outcomeStatus}
              onChange={(event) =>
                setForm({
                  ...form,
                  outcomeStatus: event.target.value as StoryOutcomeStatus,
                })
              }
            >
              {OUTCOME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="story-unknowns">
              Remaining unknowns (optional, one per line)
            </label>
            <textarea
              id="story-unknowns"
              name="story-unknowns"
              value={form.unknownsText}
              onChange={(event) => setForm({ ...form, unknownsText: event.target.value })}
              maxLength={5 * (250 + 1) + 100}
              rows={3}
            />
          </div>
          <div className="actions">
            <button type="submit" className="primary">
              {editingId ? "Save changes" : "Save experience"}
            </button>
            <button type="button" className="secondary" onClick={cancelForm}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
