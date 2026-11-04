"use client";

import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import KivoSceneFallback from "./kivo/KivoSceneFallback";

const KivoSymbolScene = dynamic(() => import("./kivo/KivoSymbolScene"), {
  ssr: false,
});

function environment(): { webgl: boolean; reducedMotion: boolean } {
  try {
    const canvas = document.createElement("canvas");
    const webgl =
      canvas.getContext("webgl") !== null ||
      canvas.getContext("experimental-webgl") !== null;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    return { webgl, reducedMotion };
  } catch {
    return { webgl: false, reducedMotion: true };
  }
}

/**
 * Discover hero: the night-city band.
 *
 * A full-width cinematic scene — a living atlas of streets, lit routes
 * and traveling signals — with the headline overlaid and the product
 * caption plus atlas entry alongside. Children render as the overlaid
 * headline block (owned by the page shell for focus control).
 * The scene mirrors real search traffic; the full atlas is one click away.
 */
export default function DiscoverVisual({
  onExplore,
  children,
}: {
  onExplore: () => void;
  children: ReactNode;
}) {
  const [live, setLive] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [departing, setDeparting] = useState(false);

  useEffect(() => {
    const { webgl, reducedMotion } = environment();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time environment sync, runs once
    setLive(webgl && !reducedMotion);
    setReduceMotion(reducedMotion);
  }, []);

  function handleExplore() {
    if (departing) return;
    setDeparting(true);
    if (reduceMotion) {
      onExplore();
      return;
    }
    // Let the city complete its signal beat before handing off.
    window.setTimeout(onExplore, 400);
  }

  return (
    <div className="discover-visual discover-hero">
      <div
        className={`discover-scene discover-hero-scene${departing ? " is-departing" : ""}`}
        aria-hidden="true"
      >
        {live ? (
          <KivoSymbolScene
            reduceMotion={reduceMotion}
            departing={departing}
          />
        ) : (
          <KivoSceneFallback />
        )}
        <div className="discover-veil" />
      </div>
      <div className="discover-hero-copy">
        <div className="discover-hero-headline">{children}</div>
        <div className="discover-hero-side">
          <p className="discover-visual-title">The living city</p>
          <p className="fine-print">
            Lit routes cross the districts — each one an attempt someone
            recorded. Describe your challenge and watch the relevant
            paths light up.
          </p>
          <button
            type="button"
            className="secondary small"
            onClick={handleExplore}
          >
            Open the atlas
          </button>
        </div>
      </div>
    </div>
  );
}
