"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { KIVO_THEME } from "../../lib/kivo-theme";
import { KIVO_SYMBOL_TOKENS } from "./tokens";
import {
  stepMotion,
  type SymbolMotionState,
} from "./KivoSymbolMotion";

/**
 * NightCity — the hero environment.
 *
 * There is no centerpiece. The frame holds a living night city seen
 * from above: a street lattice with lit blocks, luminous route lines
 * arcing between districts, and small signal pulses traveling the
 * routes — people trying things, getting stuck, finding a way through.
 *
 * Product state drives the light, never the geometry: a search quickens
 * the signals and brightens the routes; arriving results settle the
 * city into a steady glow; a cleared search returns it to calm.
 * Purely presentational — matching logic never depends on it.
 */

interface RouteDef {
  color: string;
  width: number;
  speed: number;
  offset: number;
  pts: [number, number, number][];
}

const ROUTES: RouteDef[] = [
  {
    color: KIVO_THEME.accent,
    width: 0.035,
    speed: 0.05,
    offset: 0.0,
    pts: [
      [-7.5, 0.5, -4],
      [-3, 1.2, -2],
      [1, 0.9, 0.5],
      [5, 1.4, 2.5],
      [8, 0.8, 4],
    ],
  },
  {
    color: KIVO_THEME.teal,
    width: 0.03,
    speed: 0.065,
    offset: 0.45,
    pts: [
      [-8, 0.9, 3.5],
      [-4, 0.6, 1.5],
      [0, 1.1, -0.5],
      [4, 0.7, -2.5],
      [7.5, 1.0, -4],
    ],
  },
  {
    color: KIVO_THEME.city.windowWarm,
    width: 0.025,
    speed: 0.04,
    offset: 0.7,
    pts: [
      [-6, 1.5, -6],
      [-2, 1.0, -3],
      [2, 1.3, -1],
      [6, 0.9, 1],
    ],
  },
  {
    color: KIVO_THEME.accent,
    width: 0.022,
    speed: 0.055,
    offset: 0.25,
    pts: [
      [-7, 0.4, 6],
      [-3, 1.4, 4],
      [1, 0.8, 2],
      [5, 1.2, 0],
    ],
  },
  {
    color: KIVO_THEME.teal,
    width: 0.022,
    speed: 0.045,
    offset: 0.9,
    pts: [
      [6.5, 1.6, -6.5],
      [3, 1.0, -3.5],
      [0, 0.7, -1],
      [-3, 1.1, 1.5],
    ],
  },
  {
    color: KIVO_THEME.city.windowWarm,
    width: 0.025,
    speed: 0.06,
    offset: 0.55,
    pts: [
      [-1, 0.5, -7],
      [0, 1.5, -3],
      [1, 1.0, 1],
      [2, 0.6, 5],
    ],
  },
  {
    color: KIVO_THEME.accent,
    width: 0.028,
    speed: 0.05,
    offset: 0.15,
    pts: [
      [-4, 1.1, 6.5],
      [0, 0.8, 3],
      [4, 1.2, -0.5],
      [7, 0.7, -3],
    ],
  },
];

interface TowerDef {
  at: [number, number, number];
  h: number;
  lamp: string;
}

const TOWERS: TowerDef[] = [
  { at: [-6, -1.6, -5.5], h: 1.8, lamp: KIVO_THEME.city.windowWarm },
  { at: [-4.5, -1.6, 4.5], h: 1.2, lamp: KIVO_THEME.teal },
  { at: [5.5, -1.6, -4.5], h: 2.2, lamp: KIVO_THEME.city.windowWarm },
  { at: [6.5, -1.6, 3.5], h: 1.5, lamp: KIVO_THEME.accent },
  { at: [-1.5, -1.6, -6], h: 1.0, lamp: KIVO_THEME.teal },
  { at: [3, -1.6, 6], h: 1.7, lamp: KIVO_THEME.city.windowWarm },
  { at: [-7, -1.6, 0.5], h: 1.3, lamp: KIVO_THEME.accent },
  { at: [7.5, -1.6, -0.5], h: 1.1, lamp: KIVO_THEME.teal },
  { at: [-3, -1.6, 2.5], h: 0.9, lamp: KIVO_THEME.city.windowWarm },
];

/** Two signals ride every route: attempts in progress. */
const SIGNALS_PER_ROUTE = 2;

export default function NightCity({
  motion,
  hovered,
}: {
  motion: { current: SymbolMotionState | null };
  hovered: boolean;
}) {
  const routes = useMemo(
    () =>
      ROUTES.map((r) => ({
        def: r,
        curve: new THREE.CatmullRomCurve3(
          r.pts.map((p) => new THREE.Vector3(...p)),
          false,
          "centripetal",
          0.5,
        ),
      })),
    [],
  );

  const geo = useMemo(
    () => ({
      tubes: routes.map(
        (r) => new THREE.TubeGeometry(r.curve, 72, r.def.width, 6, false),
      ),
      pulse: new THREE.OctahedronGeometry(0.07),
      tower: new THREE.BoxGeometry(0.22, 1, 0.22),
      lamp: new THREE.BoxGeometry(0.1, 0.07, 0.1),
    }),
    [routes],
  );

  useEffect(
    () => () => {
      for (const t of geo.tubes) t.dispose();
      geo.pulse.dispose();
      geo.tower.dispose();
      geo.lamp.dispose();
    },
    [geo],
  );

  const pulseRefs = useRef<(THREE.Mesh | null)[]>([]);
  const routeMats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const group = useRef<THREE.Group>(null);

  // Scroll drift deepens the city as the hero scrolls away. Purely
  // presentational; product state never depends on it.
  useFrame(({ clock }, delta) => {
    const m = motion.current;
    if (!m) return;
    stepMotion(m, Math.min(delta, 0.05));
    const reduceMotion = m.reduceMotion;
    const t = clock.elapsedTime;
    const g = group.current;
    const drift = reduceMotion ? 0 : m.scroll;
    if (g && !reduceMotion) {
      g.position.y = Math.sin(t * 0.5) * 0.04 - drift * 0.35;
      g.rotation.y = Math.sin(t * 0.18) * 0.04 + drift * 0.3;
    } else if (g) {
      g.position.y = 0;
      g.rotation.y = 0;
    }

    const searching = m.progress > 0.001 && m.progress < 0.999;
    const speed = reduceMotion ? 0 : searching ? 2.2 : 1;
    const glow = Math.min(
      1,
      0.5 + m.progress * 0.3 + m.pulse * 0.5 + (hovered ? 0.12 : 0),
    );
    routeMats.current.forEach((mat) => {
      if (mat) mat.opacity = glow;
    });

    let k = 0;
    for (let r = 0; r < routes.length; r += 1) {
      const { curve, def } = routes[r];
      for (let s = 0; s < SIGNALS_PER_ROUTE; s += 1) {
        const mesh = pulseRefs.current[k];
        k += 1;
        if (!mesh) continue;
        const u =
          (def.offset + (s / SIGNALS_PER_ROUTE + t * def.speed * speed)) % 1;
        mesh.position.copy(curve.getPointAt(u));
        mesh.visible = true;
      }
    }
  });

  const signalColors = useMemo(
    () => [KIVO_SYMBOL_TOKENS.traveler, KIVO_THEME.accent, "#f4f1ea"],
    [],
  );

  return (
    <group ref={group}>
      {routes.map((r, i) => (
        <mesh key={i} geometry={geo.tubes[i]}>
          <meshBasicMaterial
            ref={(mat) => {
              routeMats.current[i] = mat;
            }}
            color={r.def.color}
            transparent
            opacity={0.5}
          />
        </mesh>
      ))}
      {routes.flatMap((r, i) =>
        Array.from({ length: SIGNALS_PER_ROUTE }, (_, s) => {
          const k = i * SIGNALS_PER_ROUTE + s;
          return (
            <mesh
              key={k}
              ref={(mesh) => {
                pulseRefs.current[k] = mesh;
              }}
              geometry={geo.pulse}
              position={r.curve.getPointAt(r.def.offset)}
            >
              <meshBasicMaterial
                color={signalColors[(i + s) % signalColors.length]}
              />
            </mesh>
          );
        }),
      )}
      {TOWERS.map((b, i) => (
        <group key={i} position={b.at}>
          <mesh geometry={geo.tower} scale={[1, b.h, 1]} position={[0, b.h / 2, 0]}>
            <meshStandardMaterial
              color={KIVO_THEME.borderStrong}
              roughness={0.7}
              metalness={0.3}
            />
          </mesh>
          <mesh geometry={geo.lamp} position={[0, b.h + 0.04, 0]}>
            <meshBasicMaterial color={b.lamp} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
