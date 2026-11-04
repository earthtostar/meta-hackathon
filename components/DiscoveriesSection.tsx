"use client";

import { useState } from "react";
import { EXPERIENCE_BY_ID } from "../data/experiences";
import { PROFILE_BY_ID } from "../data/profiles";
import {
  useDiscoveries,
  type DiscoveryItem,
} from "../lib/discoveries";
import type { LocalStory } from "../lib/local-stories";

/**
 * My Discoveries — a personal, browser-local collection.
 * Bookmarks and explicitly saved insight quotes only; request text is
 * never stored. Entries whose case left the dataset degrade to a
 * labeled row with a remove action instead of breaking.
 */
export default function DiscoveriesSection({
  stories,
}: {
  stories: Map<string, LocalStory>;
}) {
  const { items, remove, clear } = useDiscoveries();
  const [confirmingClear, setConfirmingClear] = useState(false);

  function resolveTitle(item: DiscoveryItem): string | null {
    if (item.refKind === "experience") {
      return EXPERIENCE_BY_ID[item.refId]?.title ?? null;
    }
    if (item.refKind === "profile") {
      const profile = PROFILE_BY_ID[item.refId];
      return profile ? profile.name : null;
    }
    const storyId = item.refId.startsWith("local:")
      ? item.refId.slice("local:".length)
      : item.refId;
    return stories.get(storyId)?.title ?? null;
  }

  return (
    <section aria-labelledby="discoveries-heading" className="pane discoveries-pane">
      <h2 id="discoveries-heading">
        My Discoveries{" "}
        <span className="fine-print" aria-live="polite">
          {items.length === 0
            ? "nothing saved yet"
            : `${items.length} saved`}
        </span>
      </h2>
      {items.length === 0 ? (
        <p className="fine-print">
          Bookmark cases and save insights from any result card or explorer
          node. Everything stays in this browser — no account, no uploads.
        </p>
      ) : (
        <>
          <ul className="draft-list discoveries-list">
            {items.map((item) => {
              const liveTitle = resolveTitle(item);
              const key = `${item.refKind}:${item.refId}:${item.insight ?? ""}:${item.savedAt}`;
              if (liveTitle === null) {
                return (
                  <li key={key} className="discovery-missing">
                    <span>
                      <strong>{item.title}</strong>{" "}
                      <span className="fine-print">
                        No longer available in the dataset.
                      </span>
                    </span>
                    <button
                      type="button"
                      className="secondary small"
                      onClick={() => remove(item)}
                    >
                      Remove
                    </button>
                  </li>
                );
              }
              return (
                <li key={key}>
                  <span>
                    <strong>{liveTitle}</strong>
                    {item.insight && (
                      <span className="support-quote">“{item.insight}”</span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="secondary small"
                    onClick={() => remove(item)}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="actions">
            {confirmingClear ? (
              <>
                <button
                  type="button"
                  className="primary small"
                  onClick={() => {
                    clear();
                    setConfirmingClear(false);
                  }}
                >
                  Confirm clear
                </button>
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => setConfirmingClear(false)}
                >
                  Keep collection
                </button>
              </>
            ) : (
              <button
                type="button"
                className="secondary small"
                onClick={() => setConfirmingClear(true)}
              >
                Clear collection
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
