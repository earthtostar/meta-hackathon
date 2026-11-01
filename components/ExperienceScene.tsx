"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { EXPERIENCES, LINKS } from "../data/experiences";

const GROUP_COLORS: Record<string, string> = {
  workshop: "#7FA08A",
  market: "#6E9BBE",
  learning: "#C98F5F",
};

const NODE_COLORS: Record<string, string> = {
  workshop: "#DCE8DD",
  market: "#DCEAF3",
  learning: "#F2BE98",
};

const LINK_BASE = "#8A938E";
const LINK_ACTIVE = "#1F5C54";
const MATCH_HALO = "#B3541E";

const AZIMUTH_LIMIT = 0.85;
const POLAR_MIN = 0.65;
const POLAR_MAX = 1.35;
const BASE_DISTANCE = 7.4;

interface SceneProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  zoom: number;
  resetSignal: number;
  matchedIds: Set<string>;
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

/** Custom bounded drag rotation; never touches page scroll (no wheel binding). */
function DragRig({
  resetSignal,
  zoom,
}: {
  resetSignal: number;
  zoom: number;
}) {
  const { camera, gl, invalidate } = useThree();
  const state = useRef({ azimuth: 0, polar: 1.02, dragging: false, x: 0, y: 0 });

  useEffect(() => {
    state.current.azimuth = 0;
    state.current.polar = 1.02;
    applyCamera();
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  useEffect(() => {
    applyCamera();
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom ]);

  function applyCamera() {
    const { azimuth, polar } = state.current;
    const d = BASE_DISTANCE / zoom;
    camera.position.set(
      d * Math.sin(polar) * Math.sin(azimuth),
      d * Math.cos(polar),
      d * Math.sin(polar) * Math.cos(azimuth),
    );
    camera.lookAt(0, 0, 0);
  }

  useEffect(() => {
    const el = gl.domElement;
    const s = state.current;

    function down(e: PointerEvent) {
      s.dragging = true;
      s.x = e.clientX;
      s.y = e.clientY;
      el.setPointerCapture(e.pointerId);
    }
    function move(e: PointerEvent) {
      if (!s.dragging) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      s.x = e.clientX;
      s.y = e.clientY;
      s.azimuth = Math.max(
        -AZIMUTH_LIMIT,
        Math.min(AZIMUTH_LIMIT, s.azimuth + dx * 0.005),
      );
      s.polar = Math.max(
        POLAR_MIN,
        Math.min(POLAR_MAX, s.polar + dy * 0.004),
      );
      applyCamera();
      invalidate();
    }
    function up() {
      s.dragging = false;
    }

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, invalidate]);

  return null;
}

function Nodes({
  selectedId,
  onSelect,
  matchedIds,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  matchedIds: Set<string>;
}) {
  const { invalidate } = useThree();
  const related = useMemo(() => relatedIds(selectedId), [selectedId]);

  const sphere = useMemo(() => new THREE.SphereGeometry(0.3, 28, 20), []);
  const ring = useMemo(() => new THREE.TorusGeometry(0.46, 0.035, 12, 40), []);
  const ringMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: LINK_ACTIVE,
        transparent: true,
        opacity: 0.9,
      }),
    [],
  );
  const matchMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: MATCH_HALO,
        transparent: true,
        opacity: 0.9,
      }),
    [],
  );

  useEffect(
    () => () => {
      sphere.dispose();
      ring.dispose();
      ringMaterial.dispose();
      matchMaterial.dispose();
    },
    [sphere, ring, ringMaterial, matchMaterial],
  );

  // Static halo only: no animation, no size encoding. When highlights are
  // active and nothing is selected, non-matched nodes dim but stay clickable.
  const highlightActive = matchedIds.size > 0;
  return (
    <group>
      {EXPERIENCES.map((exp) => {
        const isSelected = exp.id === selectedId;
        const isRelated = related.has(exp.id);
        const isMatched = matchedIds.has(exp.id);
        const dimmed =
          selectedId !== null
            ? !isSelected && !isRelated
            : highlightActive && !isMatched;
        return (
          <group key={exp.id} position={exp.position}>
            <mesh
              geometry={sphere}
              scale={isSelected ? 1.35 : 1}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(exp.id);
                invalidate();
              }}
            >
              <meshStandardMaterial
                attach="material"
                color={NODE_COLORS[exp.group]}
                roughness={0.55}
                metalness={0.05}
                transparent={dimmed}
                opacity={dimmed ? 0.35 : 1}
              />
            </mesh>
            {isSelected && (
              <mesh geometry={ring} material={ringMaterial} rotation={[Math.PI / 2.4, 0.2, 0]} />
            )}
            {!isSelected && isMatched && (
              <mesh geometry={ring} material={matchMaterial} rotation={[Math.PI / 2.4, 0.2, 0]} />
            )}
          </group>
        );
      })}
    </group>
  );
}

function Edges({ selectedId }: { selectedId: string | null }) {
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
      const target =
        selectedId !== null &&
        (link.from === selectedId || link.to === selectedId)
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
  }, [selectedId]);

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

function GroupMarkers() {
  const markers = useMemo(
    () => [
      { group: "workshop", position: [-1.8, 1.7, 0] as const },
      { group: "market", position: [2.1, 1.7, 0] as const },
      { group: "learning", position: [0.2, 1.7, -1.7] as const },
    ],
    [],
  );
  const dot = useMemo(() => new THREE.SphereGeometry(0.09, 16, 12), []);
  useEffect(() => () => dot.dispose(), [dot]);
  return (
    <group>
      {markers.map((m) => (
        <mesh key={m.group} geometry={dot} position={[m.position[0], m.position[1], m.position[2]]}>
          <meshBasicMaterial color={GROUP_COLORS[m.group]} />
        </mesh>
      ))}
    </group>
  );
}

export default function ExperienceScene(props: SceneProps) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ position: [0, 2.4, BASE_DISTANCE], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={() => props.onSelect(null)}
      style={{ touchAction: "pan-y" }}
    >
      <color attach="background" args={["#F1EDE2"]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 6, 5]} intensity={1.4} />
      <directionalLight position={[-5, 3, -4]} intensity={0.35} />
      <DragRig resetSignal={props.resetSignal} zoom={props.zoom} />
      <Edges selectedId={props.selectedId} />
      <Nodes selectedId={props.selectedId} onSelect={props.onSelect} matchedIds={props.matchedIds} />
      <GroupMarkers />
    </Canvas>
  );
}
