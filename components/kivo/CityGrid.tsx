"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { KIVO_THEME } from "../../lib/kivo-theme";

/**
 * CityGrid — the aerial atlas floor beneath the hero routes and the
 * experience towers.
 *
 * A street lattice (faint minor streets, brighter avenues), extruded
 * city blocks with lit rooftop windows, and a ground haze that melts
 * into the scene fog. Deterministic layout (seeded RNG) so every
 * render builds the same city; fully static geometry, zero per-frame
 * cost, and nothing to animate under reduced motion.
 *
 * The center plaza stays open sky: routes cross above it, and nothing
 * sits at the middle of the frame.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const UP = new THREE.Object3D();

export default function CityGrid({
  extent = 9,
  step = 1.5,
  blocks = 46,
  windows = 130,
  groundY = -1.6,
  seed = 20261103,
}: {
  extent?: number;
  step?: number;
  blocks?: number;
  windows?: number;
  groundY?: number;
  seed?: number;
}) {
  const streets = useMemo(() => {
    const minor: number[] = [];
    const avenues: number[] = [];
    let i = 0;
    for (let c = -extent; c <= extent + 1e-6; c += step, i += 1) {
      const target = i % 4 === 0 ? avenues : minor;
      target.push(-extent, groundY, c, extent, groundY, c);
      target.push(c, groundY, -extent, c, groundY, extent);
    }
    const toGeom = (pts: number[]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      return g;
    };
    return { minor: toGeom(minor), avenues: toGeom(avenues) };
  }, [extent, step, groundY]);

  useEffect(
    () => () => {
      streets.minor.dispose();
      streets.avenues.dispose();
    },
    [streets],
  );

  const city = useMemo(() => {
    const rand = mulberry32(seed);
    const blockGeo = new THREE.BoxGeometry(1, 1, 1);
    const blockMat = new THREE.MeshStandardMaterial({
      color: KIVO_THEME.city.block,
      roughness: 0.85,
      metalness: 0.15,
    });
    const blockMesh = new THREE.InstancedMesh(blockGeo, blockMat, blocks);
    const tops: THREE.Vector3[] = [];
    let placed = 0;
    let guard = 0;
    while (placed < blocks && guard < blocks * 40) {
      guard += 1;
      const cx = (Math.floor(rand() * ((extent * 2) / step)) * step - extent) + step / 2;
      const cz = (Math.floor(rand() * ((extent * 2) / step)) * step - extent) + step / 2;
      // Keep the central plaza open sky.
      if (Math.abs(cx) < 2.4 && Math.abs(cz) < 2.4) continue;
      const w = step * (0.42 + rand() * 0.2);
      const d = step * (0.42 + rand() * 0.2);
      const h = 0.25 + rand() * rand() * 1.5;
      UP.position.set(cx, groundY + h / 2, cz);
      UP.scale.set(w, h, d);
      UP.rotation.set(0, 0, 0);
      UP.updateMatrix();
      blockMesh.setMatrixAt(placed, UP.matrix);
      placed += 1;
      if (rand() < 0.75) tops.push(new THREE.Vector3(cx, groundY + h + 0.02, cz));
    }
    blockMesh.count = placed;
    blockMesh.instanceMatrix.needsUpdate = true;

    const winGeo = new THREE.BoxGeometry(0.09, 0.05, 0.09);
    const winMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const winMesh = new THREE.InstancedMesh(winGeo, winMat, windows);
    const warm = new THREE.Color(KIVO_THEME.city.windowWarm);
    const cool = new THREE.Color(KIVO_THEME.city.windowCool);
    const lavender = new THREE.Color(KIVO_THEME.accent);
    let lit = 0;
    guard = 0;
    while (lit < windows && guard < windows * 30 && tops.length > 0) {
      guard += 1;
      const top = tops[Math.floor(rand() * tops.length)];
      UP.position.set(
        top.x + (rand() - 0.5) * step * 0.4,
        top.y,
        top.z + (rand() - 0.5) * step * 0.4,
      );
      UP.scale.setScalar(0.7 + rand() * 0.9);
      UP.rotation.set(0, 0, 0);
      UP.updateMatrix();
      winMesh.setMatrixAt(lit, UP.matrix);
      const pick = rand();
      winMesh.setColorAt(lit, pick < 0.55 ? warm : pick < 0.85 ? cool : lavender);
      lit += 1;
    }
    winMesh.count = lit;
    winMesh.instanceMatrix.needsUpdate = true;
    if (winMesh.instanceColor) winMesh.instanceColor.needsUpdate = true;
    return { blockMesh, winMesh };
  }, [blocks, windows, extent, step, groundY, seed]);

  useEffect(
    () => () => {
      city.blockMesh.geometry.dispose();
      (city.blockMesh.material as THREE.Material).dispose();
      city.winMesh.geometry.dispose();
      (city.winMesh.material as THREE.Material).dispose();
    },
    [city],
  );

  return (
    <group>
      {/* Ground haze melting into the fog. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, groundY - 0.02, 0]}>
        <planeGeometry args={[extent * 7, extent * 7]} />
        <meshBasicMaterial color={KIVO_THEME.backgroundDeep} />
      </mesh>
      <lineSegments geometry={streets.minor}>
        <lineBasicMaterial color={KIVO_THEME.link.idle} transparent opacity={0.5} />
      </lineSegments>
      <lineSegments geometry={streets.avenues}>
        <lineBasicMaterial color={KIVO_THEME.borderStrong} transparent opacity={0.85} />
      </lineSegments>
      <primitive object={city.blockMesh} />
      <primitive object={city.winMesh} />
    </group>
  );
}
