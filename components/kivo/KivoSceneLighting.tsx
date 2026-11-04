"use client";

import { KIVO_SYMBOL_TOKENS } from "./tokens";

/**
 * KivoSceneLighting — the night-city stage light.
 *
 * Twilight rig: cool moonlit key, mist-blue rim to carve silhouettes,
 * faint pearl hemisphere fill so shadow sides never crush, and one
 * lavender wash over the districts. Depth-matched to the backdrop.
 * Deliberately modest: four lights, no shadow maps, no post-processing.
 */
export default function KivoSceneLighting() {
  return (
    <>
      <hemisphereLight
        args={[KIVO_SYMBOL_TOKENS.key, KIVO_SYMBOL_TOKENS.background, 0.35]}
      />
      <directionalLight
        position={[3.5, 4, 2.5]}
        intensity={0.85}
        color={KIVO_SYMBOL_TOKENS.key}
      />
      <directionalLight
        position={[-4, 1.5, -3]}
        intensity={0.9}
        color={KIVO_SYMBOL_TOKENS.rim}
      />
      <pointLight
        position={[0, 2.6, 0.5]}
        intensity={2.4}
        distance={11}
        color={KIVO_SYMBOL_TOKENS.core}
      />
    </>
  );
}
