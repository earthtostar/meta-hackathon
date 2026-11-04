"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const ExperienceScene = dynamic(() => import("./ExperienceScene"), {
  ssr: false,
});

const EMPTY_MATCHES = new Set<string>();

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
 * Cinematic hero: an ambient drift through the experience universe behind
 * the product statement. Decorative only — the working explorer lives
 * further down the page. Degrades to a static field when WebGL or motion
 * is unavailable.
 */
export default function HeroUniverse() {
  const [live, setLive] = useState(false);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const copyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const { webgl, reducedMotion } = environment();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time environment sync, runs once
    setLive(webgl && !reducedMotion);
  }, []);

  // Subtle cursor-reactive depth for fine pointers; skipped otherwise.
  useEffect(() => {
    const frameEl = frameRef.current;
    const copyEl = copyRef.current;
    if (!frameEl || !copyEl) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    function onMove(event: PointerEvent) {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const frame = frameRef.current;
        const copy = copyRef.current;
        if (!frame || !copy) return;
        const rect = frame.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        copy.style.transform = `translate3d(${x * 10}px, ${y * 8}px, 0)`;
      });
    }
    function onLeave() {
      cancelAnimationFrame(raf);
      const copy = copyRef.current;
      if (copy) copy.style.transform = "";
    }
    frameEl.addEventListener("pointermove", onMove);
    frameEl.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      frameEl.removeEventListener("pointermove", onMove);
      frameEl.removeEventListener("pointerleave", onLeave);
    };
  }, [live]);

  return (
    <div className="universe" ref={frameRef}>
      <div className="universe-scene" aria-hidden="true">
        {live ? (
          <ExperienceScene
            ambient
            selectedId={null}
            onSelect={() => {}}
            zoom={1}
            resetSignal={0}
            matchedIds={EMPTY_MATCHES}
          />
        ) : (
          <div className="universe-fallback" />
        )}
        <div className="universe-veil" />
      </div>
      <div className="universe-copy" ref={copyRef}>
        <p className="universe-kicker">Before you try.</p>
        <h1>
          Someone has been <em>where you are.</em>
        </h1>
        <p className="universe-sub">
          Describe what you are facing. KIVO compares it with documented
          attempts — what worked, what differed — so you see what
          transfers before you try.
        </p>
        <div className="actions universe-cta">
          <a className="cta-primary" href="#mission">
            Start your search
          </a>
          <a className="cta-ghost" href="#explore">
            Explore the universe
          </a>
        </div>
        <p className="hero-note">
          Fictional demo cases · your stories stay in this browser · nothing
          is sent without your explicit action
        </p>
      </div>
    </div>
  );
}
