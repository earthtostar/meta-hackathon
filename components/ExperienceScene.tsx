"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EXPERIENCES, LINKS, linkKey } from "../data/experiences";
import { KIVO_THEME } from "../lib/kivo-theme";
import CityGrid from "./kivo/CityGrid";

/** Group shells resolve through the shared product theme. */
const GROUP_COLORS: Record<string, string> = {
  workshop: KIVO_THEME.group.workshop.base,
  market: KIVO_THEME.group.market.base,
  learning: KIVO_THEME.group.learning.base,
};

const NODE_COLORS: Record<string, string> = {
  workshop: KIVO_THEME.group.workshop.deep,
  market: KIVO_THEME.group.market.deep,
  learning: KIVO_THEME.group.learning.deep,
};

const LINK_BASE = KIVO_THEME.link.idle;
const LINK_ACTIVE = KIVO_THEME.link.active;
const MATCH_HALO = KIVO_THEME.halo;
const MARKER_BASE = KIVO_THEME.marker.idle;
const MARKER_ACTIVE = KIVO_THEME.marker.active;

const AZIMUTH_LIMIT = 0.85;
const POLAR_MIN = 0.65;
const POLAR_MAX = 1.35;
const BASE_DISTANCE = 7.4;
const MIN_DISTANCE = 3.4;
const MAX_DISTANCE = 12;
const FOCUS_PULL = 0.82;

export interface SceneLink {
  from: string;
  to: string;
  shared: string;
}

interface SceneProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  zoom: number;
  resetSignal: number;
  matchedIds: Set<string>;
  /** Ambient hero mode: slow idle drift until the user first drags. */
  ambient?: boolean;
  reduceMotion?: boolean;
  selectedLinkKey?: string | null;
  onSelectLink?: (link: SceneLink | null) => void;
  /** Hover preview: reports the node id under the pointer, if any. */
  onHover?: (id: string | null) => void;
}

function relatedIds(selectedId: string | null): Set<string> {
  const set = new Set<string>();
  if (!selectedId) return set;
  for (const link of LINKS) {
    if (link.from === selectedId) set.add(link.to);
    else if (link.to === selectedId) set.add(link.from);
  }
  return set;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Bounded orbit rig with wheel/pinch zoom and smooth focus transitions.
 * Drag orbits; wheel over the canvas zooms (page scroll is untouched
 * outside the canvas, and vertical touch scroll still scrolls the page).
 * Selecting a node eases the view toward it; reset always returns home.
 */
function CameraRig({
  resetSignal,
  zoom,
  ambient,
  reduceMotion,
  focusPoint,
}: {
  resetSignal: number;
  zoom: number;
  ambient: boolean;
  reduceMotion: boolean;
  focusPoint: [number, number, number] | null;
}) {
  const { camera, gl } = useThree();
  const state = useRef({
    azimuth: 0,
    polar: 1.02,
    wheel: 1,
    dragging: false,
    interacted: false,
    x: 0,
    y: 0,
    pinch: new Map<number, { x: number; y: number }>(),
    pinchDist: 0,
    // Transition blending: 0 = at rest, 1 = animating toward goal.
    blend: 0,
    blendFrom: {
      azimuth: 0,
      polar: 1.02,
      target: new THREE.Vector3(0, 0, 0),
    },
    goal: {
      azimuth: 0,
      polar: 1.02,
      target: new THREE.Vector3(0, 0, 0),
    },
  });

  const goalTarget = useMemo(() => {
    if (!focusPoint) return new THREE.Vector3(0, 0, 0);
    return new THREE.Vector3(
      focusPoint[0] * 0.45,
      focusPoint[1] * 0.45,
      focusPoint[2] * 0.45,
    );
  }, [focusPoint]);

  // New selection starts a transition; reset always returns to the
  // default overview. Reduced motion jumps instead of animating.
  const resetSeen = useRef(resetSignal);
  useEffect(() => {
    const s = state.current;
    const isReset = resetSeen.current !== resetSignal;
    resetSeen.current = resetSignal;
    if (reduceMotion) {
      if (isReset) {
        s.azimuth = 0;
        s.polar = 1.02;
        s.wheel = 1;
        s.goal.target.set(0, 0, 0);
      } else {
        s.goal.target.copy(goalTarget);
      }
      s.blend = 1;
      applyView();
      return;
    }
    s.blendFrom.azimuth = s.azimuth;
    s.blendFrom.polar = s.polar;
    s.blendFrom.target.copy(currentTarget());
    if (isReset) {
      s.wheel = 1;
      s.goal.azimuth = 0;
      s.goal.polar = 1.02;
      s.goal.target.set(0, 0, 0);
    } else {
      s.goal.azimuth = THREE.MathUtils.clamp(s.azimuth, -0.45, 0.45);
      s.goal.polar = THREE.MathUtils.clamp(s.polar, 0.8, 1.2);
      s.goal.target.copy(goalTarget);
    }
    s.blend = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalTarget, resetSignal, reduceMotion]);

  function currentTarget(): THREE.Vector3 {
    const s = state.current;
    if (s.blend <= 0 || s.blend >= 1) return s.goal.target.clone();
    return s.blendFrom.target
      .clone()
      .lerp(s.goal.target, easeInOutCubic(s.blend));
  }

  function distance(): number {
    const s = state.current;
    // Toolbar zoom (prop) times gesture zoom (wheel/pinch), clamped so the
    // camera can never leave the usable range.
    const d = (BASE_DISTANCE / (zoom * s.wheel)) * (focusPoint ? FOCUS_PULL : 1);
    return THREE.MathUtils.clamp(d, MIN_DISTANCE, MAX_DISTANCE);
  }

  function applyView() {
    const s = state.current;
    const d = distance();
    const target = currentTarget();
    camera.position.set(
      target.x + d * Math.sin(s.polar) * Math.sin(s.azimuth),
      target.y + d * Math.cos(s.polar),
      target.z + d * Math.sin(s.polar) * Math.cos(s.azimuth),
    );
    camera.lookAt(target);
  }

  // Idle drift (ambient only) plus transition blending, eased.
  useFrame((frame, delta) => {
    const s = state.current;
    if (ambient && !s.interacted && !s.dragging && !reduceMotion) {
      const t = frame.clock.elapsedTime;
      s.azimuth = AZIMUTH_LIMIT * 0.7 * Math.sin(t * 0.1);
      s.polar = 1.02 + 0.06 * Math.sin(t * 0.083);
    }
    if (s.blend < 1 && !reduceMotion) {
      s.blend = Math.min(1, s.blend + delta / 0.9);
      const k = easeInOutCubic(s.blend);
      s.azimuth = THREE.MathUtils.lerp(s.blendFrom.azimuth, s.goal.azimuth, k);
      s.polar = THREE.MathUtils.lerp(s.blendFrom.polar, s.goal.polar, k);
    }
    applyView();
  });

  useEffect(() => {
    const el = gl.domElement;
    const s = state.current;

    function down(e: PointerEvent) {
      s.pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (s.pinch.size === 2) {
        const [a, b] = [...s.pinch.values()];
        s.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        s.dragging = false;
        return;
      }
      s.dragging = true;
      s.interacted = true;
      s.x = e.clientX;
      s.y = e.clientY;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Pointer already released; orbit simply does not start.
      }
    }

    function move(e: PointerEvent) {
      if (s.pinch.has(e.pointerId)) {
        s.pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      if (s.pinch.size === 2) {
        const [a, b] = [...s.pinch.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (s.pinchDist > 0 && dist > 0) {
          s.wheel = THREE.MathUtils.clamp(
            s.wheel * (s.pinchDist / dist),
            0.55,
            2.4,
          );
        }
        s.pinchDist = dist;
        return;
      }
      if (!s.dragging) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      s.x = e.clientX;
      s.y = e.clientY;
      s.blend = 1;
      s.azimuth = Math.max(
        -AZIMUTH_LIMIT,
        Math.min(AZIMUTH_LIMIT, s.azimuth + dx * 0.005),
      );
      s.polar = Math.max(POLAR_MIN, Math.min(POLAR_MAX, s.polar + dy * 0.004));
    }

    function up(e: PointerEvent) {
      s.pinch.delete(e.pointerId);
      if (s.pinch.size < 2) s.pinchDist = 0;
      if (s.pinch.size === 0) s.dragging = false;
    }

    function wheel(e: WheelEvent) {
      // Zoom stays inside the canvas; the page never scrolls from here.
      e.preventDefault();
      e.stopPropagation();
      s.interacted = true;
      s.wheel = THREE.MathUtils.clamp(
        s.wheel * Math.exp(e.deltaY * 0.0012),
        0.55,
        2.4,
      );
    }

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
    };
  }, [gl, ambient, reduceMotion, focusPoint, zoom]);

  return null;
}

/**
 * SignalRing — a flat arrival ring on the atlas floor beneath the
 * selected spire. Eases in once per selection, then rests.
 */
function SignalRing({ at }: { at: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  const reduceMotion = useThree((s) => s.gl.domElement.dataset.reduceMotion);

  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m || reduceMotion === "true") return;
    const t = Math.min(1, clock.elapsedTime * 1.4);
    const k = easeOutCubic(t);
    m.scale.setScalar(THREE.MathUtils.lerp(1.5, 1, k));
    (m.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.65 * k;
  });

  return (
    <mesh ref={ref} position={at} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.5, 0.56, 56]} />
      <meshBasicMaterial
        color={LINK_ACTIVE}
        transparent
        opacity={0.9}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Match echo: a floor ring under each matched spire. Settles once per
 * result set, then rests (no looping). */
function MatchEcho({ index, at }: { index: number; at: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  const reduceMotion = useThree((s) => s.gl.domElement.dataset.reduceMotion);

  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m || reduceMotion === "true") return;
    const t = THREE.MathUtils.clamp(clock.elapsedTime * 1.6 - index * 0.12, 0, 1);
    const k = easeOutCubic(t);
    m.scale.setScalar(THREE.MathUtils.lerp(1.45, 1, k));
    (m.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.6 * k;
  });

  return (
    <mesh ref={ref} position={at} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.42, 0.47, 48]} />
      <meshBasicMaterial
        color={MATCH_HALO}
        transparent
        opacity={0.9}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/**
 * Atlas floor level: spires hang at their data positions with tethers
 * rooting them into the city floor below.
 */
export const ATLAS_FLOOR_Y = -2.8;

/** Deterministic spire height per node index: a varied skyline, no RNG. */
function spireHeight(index: number): number {
  return 0.7 + (((index * 37) % 10) / 10) * 0.6;
}

function Nodes({
  selectedId,
  onSelect,
  matchedIds,
  onHover,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  matchedIds: Set<string>;
  onHover?: (id: string | null) => void;
}) {
  const related = useMemo(() => relatedIds(selectedId), [selectedId]);
  const hovered = useRef<string | null>(null);

  // Cursor affordance is a DOM nicety, not React state: the immutability
  // rule cannot model it, so it is contained in one justified helper.
  const setCursor = (value: string) => {
    // eslint-disable-next-line react-hooks/immutability -- body cursor is outside React state
    if (typeof document !== "undefined") document.body.style.cursor = value;
  };

  // District spires: one shared tower shaft, one shared signal lamp.
  // Group identity comes from the tinted shaft and the lamp hue.
  const spireGeo = useMemo(() => new THREE.BoxGeometry(0.26, 1, 0.26), []);
  const lampGeo = useMemo(() => new THREE.OctahedronGeometry(0.085), []);

  useEffect(
    () => () => {
      spireGeo.dispose();
      lampGeo.dispose();
    },
    [spireGeo, lampGeo],
  );

  const highlightActive = matchedIds.size > 0;
  return (
    <group>
      {EXPERIENCES.map((exp, i) => {
        const isSelected = exp.id === selectedId;
        const isRelated = related.has(exp.id);
        const isMatched = matchedIds.has(exp.id);
        const dimmed =
          selectedId !== null
            ? !isSelected && !isRelated
            : highlightActive && !isMatched;
        const h = spireHeight(i);
        const lampY = h / 2 + 0.14;
        const floor: [number, number, number] = [
          exp.position[0],
          ATLAS_FLOOR_Y + 0.03,
          exp.position[2],
        ];
        const select = () => onSelect(exp.id);
        return (
          <group key={exp.id} position={exp.position}>
            {/* Tower shaft — click target. */}
            <mesh
              geometry={spireGeo}
              scale={[isSelected ? 1.25 : 1, h, isSelected ? 1.25 : 1]}
              onClick={(e) => {
                e.stopPropagation();
                select();
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                hovered.current = exp.id;
                setCursor("pointer");
                onHover?.(exp.id);
              }}
              onPointerOut={() => {
                if (hovered.current === exp.id) hovered.current = null;
                setCursor("");
                onHover?.(null);
              }}
            >
              <meshStandardMaterial
                color={NODE_COLORS[exp.group]}
                roughness={0.6}
                metalness={0.3}
                emissive={isSelected || isMatched ? MATCH_HALO : "#000000"}
                emissiveIntensity={isSelected ? 0.4 : isMatched ? 0.22 : 0}
                transparent={dimmed}
                opacity={dimmed ? 0.3 : 1}
              />
            </mesh>
            {/* Signal lamp crowning the spire. */}
            <mesh
              geometry={lampGeo}
              position={[0, lampY, 0]}
              onClick={(e) => {
                e.stopPropagation();
                select();
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                hovered.current = exp.id;
                setCursor("pointer");
                onHover?.(exp.id);
              }}
              onPointerOut={() => {
                if (hovered.current === exp.id) hovered.current = null;
                setCursor("");
                onHover?.(null);
              }}
            >
              <meshBasicMaterial
                color={GROUP_COLORS[exp.group]}
                transparent={dimmed}
                opacity={dimmed ? 0.3 : 1}
              />
            </mesh>
            {isSelected && <SignalRing at={floor} />}
            {!isSelected && isMatched && (
              <MatchEcho key={`${exp.id}:${matchedIds.size}`} index={i} at={floor} />
            )}
          </group>
        );
      })}
    </group>
  );
}

/** Tethers rooting every spire into the atlas floor: one static segment
 * set, built once from data positions. */
function Tethers() {
  const geom = useMemo(() => {
    const pts: number[] = [];
    EXPERIENCES.forEach((exp, i) => {
      const h = spireHeight(i);
      pts.push(
        exp.position[0],
        exp.position[1] - h / 2,
        exp.position[2],
        exp.position[0],
        ATLAS_FLOOR_Y,
        exp.position[2],
      );
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  useEffect(() => () => geom.dispose(), [geom]);
  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial color={KIVO_THEME.link.idle} transparent opacity={0.4} />
    </lineSegments>
  );
}

/** District washes: soft glows on the atlas floor under each group's
 * centroid, tinted by district hue. Pure orientation, no interaction. */
function Districts() {
  const discs = useMemo(() => {
    const acc: Record<string, { x: number; z: number; n: number }> = {};
    for (const exp of EXPERIENCES) {
      const a = acc[exp.group] ?? { x: 0, z: 0, n: 0 };
      a.x += exp.position[0];
      a.z += exp.position[2];
      a.n += 1;
      acc[exp.group] = a;
    }
    return Object.entries(acc).map(([group, a]) => ({
      group,
      at: [a.x / a.n, ATLAS_FLOOR_Y + 0.015, a.z / a.n] as [number, number, number],
    }));
  }, []);
  return (
    <group>
      {discs.map((d) => (
        <mesh key={d.group} position={d.at} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.9, 48]} />
          <meshBasicMaterial
            color={NODE_COLORS[d.group]}
            transparent
            opacity={0.16}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function Edges({
  selectedId,
  selectedLinkKey,
}: {
  selectedId: string | null;
  selectedLinkKey: string | null;
}) {
  const { base, active } = useMemo(() => {
    const byId = Object.fromEntries(
      EXPERIENCES.map((e) => [e.id, new THREE.Vector3(...e.position)]),
    );
    const basePts: number[] = [];
    const activePts: number[] = [];
    for (const link of LINKS) {
      const a = byId[link.from];
      const b = byId[link.to];
      if (!a || !b) continue;
      const key = linkKey(link.from, link.to);
      const target =
        key === selectedLinkKey ||
        (selectedId !== null &&
          (link.from === selectedId || link.to === selectedId))
          ? activePts
          : basePts;
      target.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    const toGeom = (pts: number[]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      return g;
    };
    return { base: toGeom(basePts), active: toGeom(activePts) };
  }, [selectedId, selectedLinkKey]);

  useEffect(
    () => () => {
      base.dispose();
      active.dispose();
    },
    [base, active],
  );

  return (
    <group>
      <lineSegments geometry={base}>
        <lineBasicMaterial color={LINK_BASE} transparent opacity={0.55} />
      </lineSegments>
      <lineSegments geometry={active}>
        <lineBasicMaterial color={LINK_ACTIVE} transparent opacity={0.95} />
      </lineSegments>
    </group>
  );
}

/** Selectable midpoints that explain each connection. Hidden in ambient. */
function LinkMarkers({
  selectedLinkKey,
  onSelectLink,
}: {
  selectedLinkKey: string | null;
  onSelectLink?: (link: SceneLink | null) => void;
}) {
  const markerGeo = useMemo(() => new THREE.OctahedronGeometry(0.085), []);
  useEffect(() => () => markerGeo.dispose(), [markerGeo]);

  const markers = useMemo(() => {
    const byId = Object.fromEntries(
      EXPERIENCES.map((e) => [e.id, new THREE.Vector3(...e.position)]),
    );
    return LINKS.flatMap((link) => {
      const a = byId[link.from];
      const b = byId[link.to];
      if (!a || !b) return [];
      const mid: [number, number, number] = [
        (a.x + b.x) / 2,
        (a.y + b.y) / 2,
        (a.z + b.z) / 2,
      ];
      return [{ ...link, key: linkKey(link.from, link.to), mid }];
    });
  }, []);

  if (!onSelectLink) return null;

  return (
    <group>
      {markers.map((m) => {
        const active = m.key === selectedLinkKey;
        return (
          <mesh
            key={m.key}
            geometry={markerGeo}
            position={m.mid}
            scale={active ? 1.5 : 1}
            onClick={(e) => {
              e.stopPropagation();
              onSelectLink(active ? null : { from: m.from, to: m.to, shared: m.shared });
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              if (typeof document !== "undefined") document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              if (typeof document !== "undefined") document.body.style.cursor = "";
            }}
          >
            <meshBasicMaterial
              color={active ? MARKER_ACTIVE : MARKER_BASE}
              transparent
              opacity={active ? 1 : 0.85}
            />
          </mesh>
        );
      })}
    </group>
  );
}

export default function ExperienceScene(props: SceneProps) {
  const reduceMotion = props.reduceMotion ?? false;
  const focusPoint = useMemo<[number, number, number] | null>(() => {
    if (!props.selectedId) return null;
    const exp = EXPERIENCES.find((e) => e.id === props.selectedId);
    return exp ? [...exp.position] as [number, number, number] : null;
  }, [props.selectedId]);

  return (
    <Canvas
      frameloop="always"
      dpr={[1, 1.5]}
      camera={{ position: [0, 2.4, BASE_DISTANCE], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={() => {
        props.onSelect(null);
        props.onSelectLink?.(null);
      }}
      onCreated={({ gl }) => {
        // Read by in-scene animation helpers; avoids prop drilling into
        // every frame hook while keeping reduced-motion jumps consistent.
        gl.domElement.dataset.reduceMotion = reduceMotion ? "true" : "false";
      }}
      style={{ touchAction: "pan-y" }}
    >
      <color attach="background" args={[KIVO_THEME.surfaceSunken]} />
      <fog attach="fog" args={[KIVO_THEME.surfaceSunken, 13, 26]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 6, 5]} intensity={1.4} />
      <directionalLight position={[-5, 3, -4]} intensity={0.35} color={KIVO_THEME.teal} />
      <CameraRig
        resetSignal={props.resetSignal}
        zoom={props.zoom}
        ambient={props.ambient ?? false}
        reduceMotion={reduceMotion}
        focusPoint={focusPoint}
      />
      <Edges selectedId={props.selectedId} selectedLinkKey={props.selectedLinkKey ?? null} />
      <LinkMarkers
        selectedLinkKey={props.selectedLinkKey ?? null}
        onSelectLink={props.ambient ? undefined : props.onSelectLink}
      />
      <Nodes selectedId={props.selectedId} onSelect={props.onSelect} matchedIds={props.matchedIds} onHover={props.onHover} />
      <Tethers />
      <Districts />
      <CityGrid extent={5.5} step={1.4} blocks={26} windows={70} groundY={ATLAS_FLOOR_Y} seed={7} />
    </Canvas>
  );
}
