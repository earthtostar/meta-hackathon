"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import CityGrid from "./CityGrid";
import NightCity from "./NightCity";
import KivoSceneLighting from "./KivoSceneLighting";
import { KIVO_SYMBOL_TOKENS } from "./tokens";
import {
  applyPhase,
  createMotionState,
  nextSymbolPhase,
  type SymbolEvent,
  type SymbolMotionState,
  type SymbolPhase,
} from "./KivoSymbolMotion";
import { scrollProgress } from "../../lib/motion";
import {
  MATCHES_EVENT,
  SEARCH_STARTED_EVENT,
  listenMatchEvent,
  validateMatchesPayload,
} from "../../lib/match-events";

const CAM_HOME: [number, number, number] = [0.4, 0.5, 6.4];
const CAM_START_Z = 7.4;
const LOOK_AT: [number, number, number] = [0.1, 0, 0];

/**
 * Framing rig: controlled entrance dolly plus pointer-reactive depth.
 * No user orbit — the symbol is a hero, not a viewport. Parallax is
 * subtle and dies entirely under reduced motion.
 */
function CameraRig({
  hovered,
  reduceMotion,
  motion,
}: {
  hovered: boolean;
  reduceMotion: boolean;
  motion: { current: SymbolMotionState | null };
}) {
  const { camera, gl } = useThree();
  const pointer = useRef({ x: 0, y: 0 });
  const entered = useRef(false);

  useEffect(() => {
    const el = gl.domElement;
    function move(e: PointerEvent) {
      const rect = el.getBoundingClientRect();
      pointer.current.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      pointer.current.y = -((e.clientY - rect.top) / rect.height - 0.5) * 2;
    }
    function leave() {
      pointer.current.x = 0;
      pointer.current.y = 0;
    }
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [gl]);

  useFrame(({ clock }) => {
    const look = new THREE.Vector3(...LOOK_AT);
    if (reduceMotion) {
      camera.position.set(...CAM_HOME);
      camera.lookAt(look);
      return;
    }
    // Controlled entrance: one dolly-in, never replayed.
    const t = Math.min(1, clock.elapsedTime / 0.9);
    const k = 1 - Math.pow(1 - t, 3);
    const amp = hovered ? 1.6 : 1;
    // Scroll drift pulls the camera back and lifts the gaze as the hero
    // leaves the viewport — the origin beat of the scroll story.
    const drift = motion.current?.scroll ?? 0;
    camera.position.set(
      CAM_HOME[0] + pointer.current.x * 0.22 * amp,
      CAM_HOME[1] + pointer.current.y * 0.14 * amp + drift * 0.25,
      CAM_HOME[2] + (CAM_START_Z - CAM_HOME[2]) * (1 - k) + drift * 1.2,
    );
    look.y += drift * 0.2;
    camera.lookAt(look);
    if (!entered.current && t >= 1) entered.current = true;
  });

  return null;
}

/**
 * KivoSymbolScene — the reusable hero-environment stage.
 *
 * A distributed night city with no centerpiece: streets, blocks, lit
 * routes and traveling signals. Listens to real application traffic
 * (search started, match results) and drives the light state machine.
 * Never invents progress: routes brighten while a search runs and the
 * city settles only when results actually arrive; a failed or cleared
 * comparison returns it to calm.
 */
export default function KivoSymbolScene({
  reduceMotion,
  departing,
}: {
  reduceMotion: boolean;
  departing: boolean;
}) {
  const [visible, setVisible] = useState(true);
  const [hovered, setHovered] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const motion = useRef<SymbolMotionState | null>(null);
  if (motion.current === null) {
    motion.current = createMotionState(reduceMotion);
  }
  const phaseRef = useRef<SymbolPhase>("idle");

  const transition = useCallback((event: SymbolEvent) => {
    phaseRef.current = nextSymbolPhase(phaseRef.current, event);
    if (motion.current) applyPhase(motion.current, phaseRef.current);
  }, []);

  useEffect(() => {
    return listenMatchEvent(window, SEARCH_STARTED_EVENT, () =>
      transition("search-started"),
    );
  }, [transition]);

  useEffect(() => {
    return listenMatchEvent(window, MATCHES_EVENT, (detail: unknown) => {
      const ids = validateMatchesPayload(detail);
      transition(ids && ids.length > 0 ? "results" : "cleared");
    });
  }, [transition]);

  useEffect(() => {
    if (departing) transition("depart");
  }, [departing, transition]);

  // Pause rendering while the stage scrolls out of view: the hero must
  // never burn GPU for an audience of nobody.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Scroll-linked drift (Scene A: origin). A single rAF-throttled passive
  // listener writes a 0..1 progress straight into motion state — no React
  // re-renders, no scroll hijacking, native scrolling stays untouched.
  useEffect(() => {
    if (reduceMotion) {
      if (motion.current) motion.current.scroll = 0;
      return;
    }
    let startTop = -1;
    let queued = false;
    let raf = 0;
    function update() {
      queued = false;
      const el = wrapRef.current;
      if (!el || !motion.current) return;
      if (typeof window === "undefined") return;
      const rect = el.getBoundingClientRect();
      if (startTop < 0) startTop = rect.top;
      const vh = window.innerHeight || 1;
      motion.current.scroll = scrollProgress(rect.top, startTop, vh);
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
  }, [reduceMotion]);

  const frameloop: "always" | "never" = visible ? "always" : "never";

  return (
    <div ref={wrapRef} className="kivo-scene-wrap">
      <Canvas
        frameloop={frameloop}
        dpr={[1, 1.75]}
        camera={{ position: [CAM_HOME[0], CAM_HOME[1], CAM_START_Z], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        style={{ touchAction: "pan-y" }}
      >
        <color attach="background" args={[KIVO_SYMBOL_TOKENS.background]} />
        <fog attach="fog" args={[KIVO_SYMBOL_TOKENS.background, 9, 18]} />
        <KivoSceneLighting />
        <CityGrid />
        <CameraRig
          hovered={hovered}
          reduceMotion={reduceMotion}
          motion={motion}
        />
        <NightCity motion={motion} hovered={hovered} />
      </Canvas>
    </div>
  );
}
