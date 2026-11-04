import { useCallback, useEffect, useState } from "react";

/**
 * My Discoveries — a personal, browser-local collection of bookmarked
 * experiences and saved insights.
 *
 * Privacy rules, enforced by design rather than convention:
 * - Separate versioned key from stories and drafts; clearing stories or
 *   drafts never touches discoveries and vice versa.
 * - Only references are stored: the case ID, its public title, and an
 *   insight quote the user explicitly chose to save. Challenge drafts,
 *   request text, and story bodies are never written here.
 * - Everything stays in localStorage; nothing is sent anywhere.
 */

export const DISCOVERIES_STORE_KEY = "experience-match:discoveries:v1";
export const DISCOVERIES_STORE_VERSION = 1;

export type DiscoveryRefKind = "experience" | "story" | "profile";

export interface DiscoveryItem {
  refKind: DiscoveryRefKind;
  /** Experience node ID, or `local:<storyId>` for user stories. */
  refId: string;
  /** Public case title (or the user's own story title) at save time. */
  title: string;
  /** Insight quote the user explicitly saved; absent for plain bookmarks. */
  insight?: string;
  savedAt: number;
}

interface StoredEnvelope {
  version: number;
  items: unknown;
}

function isStorageAvailable(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

function isValidItem(data: unknown): data is DiscoveryItem {
  if (typeof data !== "object" || data === null) return false;
  const item = data as Record<string, unknown>;
  if (
    item.refKind !== "experience" &&
    item.refKind !== "story" &&
    item.refKind !== "profile"
  ) {
    return false;
  }
  if (typeof item.refId !== "string" || item.refId.trim() === "") return false;
  if (typeof item.title !== "string" || item.title.trim() === "") return false;
  if (
    item.insight !== undefined &&
    (typeof item.insight !== "string" || item.insight.trim() === "")
  ) {
    return false;
  }
  if (typeof item.savedAt !== "number" || !Number.isFinite(item.savedAt)) {
    return false;
  }
  return true;
}

function parseStored(raw: string | null): DiscoveryItem[] {
  if (!raw) return [];
  try {
    const envelope = JSON.parse(raw) as StoredEnvelope;
    if (
      typeof envelope !== "object" ||
      envelope === null ||
      envelope.version !== DISCOVERIES_STORE_VERSION ||
      !Array.isArray(envelope.items)
    ) {
      return [];
    }
    return envelope.items.filter(isValidItem).map((item) => ({
      refKind: item.refKind,
      refId: item.refId,
      title: item.title,
      ...(item.insight !== undefined ? { insight: item.insight } : {}),
      savedAt: item.savedAt,
    }));
  } catch {
    return [];
  }
}

/** Read the collection. Never throws; unusable storage reads as empty. */
export function loadDiscoveries(): DiscoveryItem[] {
  if (!isStorageAvailable()) return [];
  try {
    return parseStored(window.localStorage.getItem(DISCOVERIES_STORE_KEY));
  } catch {
    return [];
  }
}

function persist(items: DiscoveryItem[]): boolean {
  if (!isStorageAvailable()) return false;
  try {
    window.localStorage.setItem(
      DISCOVERIES_STORE_KEY,
      JSON.stringify({ version: DISCOVERIES_STORE_VERSION, items }),
    );
    return true;
  } catch {
    return false;
  }
}

export function discoveryKey(item: Pick<DiscoveryItem, "refKind" | "refId" | "insight">): string {
  return `${item.refKind}:${item.refId}:${item.insight ?? ""}`;
}

/**
 * Add a discovery unless the identical entry already exists.
 * Returns the new list; identical re-saves are no-ops.
 */
export function addDiscovery(
  current: DiscoveryItem[],
  next: Omit<DiscoveryItem, "savedAt"> & { savedAt?: number },
): DiscoveryItem[] {
  const key = discoveryKey(next);
  if (current.some((item) => discoveryKey(item) === key)) return current;
  return [
    ...current,
    { ...next, savedAt: next.savedAt ?? Date.now() },
  ];
}

/** Remove one entry by identity. Removing a missing entry is a no-op. */
export function removeDiscovery(
  current: DiscoveryItem[],
  target: Pick<DiscoveryItem, "refKind" | "refId" | "insight">,
): DiscoveryItem[] {
  const key = discoveryKey(target);
  return current.filter((item) => discoveryKey(item) !== key);
}

/** Serialize exactly what gets persisted — for privacy tests. */
export function serializeDiscoveries(items: DiscoveryItem[]): string {
  return JSON.stringify({ version: DISCOVERIES_STORE_VERSION, items });
}

/**
 * React hook over the same storage. Writes through localStorage and
 * broadcasts so the Composer and Explorer panes stay in sync.
 */
export function useDiscoveries(): {
  items: DiscoveryItem[];
  add: (item: Omit<DiscoveryItem, "savedAt"> & { savedAt?: number }) => void;
  remove: (
    target: Pick<DiscoveryItem, "refKind" | "refId" | "insight">,
  ) => void;
  clear: () => void;
  has: (target: Pick<DiscoveryItem, "refKind" | "refId" | "insight">) => boolean;
} {
  const [items, setItems] = useState<DiscoveryItem[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time restore from browser storage, runs once
    setItems(loadDiscoveries());
    function refresh() {
      setItems(loadDiscoveries());
    }
    window.addEventListener(
      "experience-match:discoveries-changed",
      refresh,
    );
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(
        "experience-match:discoveries-changed",
        refresh,
      );
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const broadcast = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("experience-match:discoveries-changed"),
    );
  }, []);

  const add = useCallback(
    (item: Omit<DiscoveryItem, "savedAt"> & { savedAt?: number }) => {
      const next = addDiscovery(loadDiscoveries(), item);
      persist(next);
      setItems(next);
      broadcast();
    },
    [broadcast],
  );

  const remove = useCallback(
    (target: Pick<DiscoveryItem, "refKind" | "refId" | "insight">) => {
      const next = removeDiscovery(loadDiscoveries(), target);
      persist(next);
      setItems(next);
      broadcast();
    },
    [broadcast],
  );

  const clear = useCallback(() => {
    persist([]);
    setItems([]);
    broadcast();
  }, [broadcast]);

  const has = useCallback(
    (target: Pick<DiscoveryItem, "refKind" | "refId" | "insight">) =>
      items.some((item) => discoveryKey(item) === discoveryKey(target)),
    [items],
  );

  return { items, add, remove, clear, has };
}
