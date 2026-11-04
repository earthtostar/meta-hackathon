/**
 * Small pure motion helpers for the cinematic layer.
 *
 * Kept framework-free and unit-tested: scroll mapping, easing inputs,
 * and the reduced-motion gate. Frame loops and R3F scenes consume these
 * values but never define them.
 */

/** Clamp any finite number into 0..1; non-finite input maps to 0. */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

/**
 * Scroll progress of an element that starts at `startTop` (viewport
 * coordinates) and moves to `currentTop` as the page scrolls.
 * Reaches 1 after `spanRatio` viewports of travel. Returns 0 when the
 * element has not moved yet or the inputs are unusable.
 */
export function scrollProgress(
  currentTop: number,
  startTop: number,
  viewportHeight: number,
  spanRatio = 0.75,
): number {
  if (
    !Number.isFinite(currentTop) ||
    !Number.isFinite(startTop) ||
    !Number.isFinite(viewportHeight) ||
    viewportHeight <= 0 ||
    spanRatio <= 0
  ) {
    return 0;
  }
  return clamp01((startTop - currentTop) / (viewportHeight * spanRatio));
}

/**
 * Whether the user (or the environment) asks for reduced motion.
 * Safe during server prerender: unknown means false, and CSS still
 * carries the final guarantee via its own media query.
 */
export function prefersReducedMotion(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  } catch {
    return false;
  }
}

/** Stagger delay for entrance choreography; negative steps clamp to 0. */
export function entranceDelay(index: number, stepMs = 90): number {
  if (!Number.isFinite(index) || index <= 0) return 0;
  return Math.floor(index) * Math.max(0, stepMs);
}
