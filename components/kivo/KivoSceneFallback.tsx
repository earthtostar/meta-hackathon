"use client";

import KivoMark from "../KivoMark";

/**
 * KivoSceneFallback — the symbol when WebGL is unavailable.
 *
 * Same convergence mark as the brand lockup at hero scale, on the same
 * backdrop treatment as the live scene. Static by definition; the
 * product copy beside it already explains what the symbol means.
 */
export default function KivoSceneFallback() {
  return (
    <div
      className="discover-fallback kivo-fallback"
      role="img"
      aria-label="KIVO convergence symbol: two paths meeting at one shared point"
    >
      <KivoMark size={120} className="kivo-fallback-mark" />
    </div>
  );
}
