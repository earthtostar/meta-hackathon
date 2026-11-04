/**
 * KivoSymbolMotion — the convergence state machine and its easing.
 *
 * Pure math, no Three.js imports, so the phase transitions behind the
 * signature symbol are unit-testable. The scene component owns one
 * `SymbolMotionState`, retargets it from application events, and steps
 * it every frame.
 */

export type SymbolPhase = "idle" | "searching" | "converged" | "departing";

/** Application moments the symbol listens to. */
export type SymbolEvent = "search-started" | "results" | "cleared" | "depart";

export interface SymbolMotionState {
  /** 0 = paths apart, 1 = fully converged. Eased toward `target`. */
  progress: number;
  /** 0..1 target for `progress`. */
  target: number;
  /** Rays/ring settle amount, 0..1. */
  settle: number;
  /** One-shot pulse on convergence, decays to 0. */
  pulse: number;
  /** Current phase (drives targets and speeds). */
  phase: SymbolPhase;
  /** Reduced-motion: transitions snap instead of easing. */
  reduceMotion: boolean;
  /**
   * Scroll-linked drift, 0..1, written externally (never animated here).
   * Lets page scroll deepen the scene without touching product state.
   */
  scroll: number;
}

export function createMotionState(reduceMotion: boolean): SymbolMotionState {
  return {
    progress: 0,
    target: 0,
    settle: 0,
    pulse: 0,
    phase: "idle",
    reduceMotion,
    scroll: 0,
  };
}

/**
 * Phase transitions. Departing locks: once the symbol leaves for the
 * explorer, late search/result traffic cannot pull it back. Cleared
 * results return a searching or converged symbol to its stable pose.
 */
export function nextSymbolPhase(
  phase: SymbolPhase,
  event: SymbolEvent,
): SymbolPhase {
  if (phase === "departing") return "departing";
  switch (event) {
    case "depart":
      return "departing";
    case "search-started":
      return "searching";
    case "results":
      return "converged";
    case "cleared":
      return "idle";
  }
}

/** Convergence is slow and deliberate; everything else settles quickly. */
function lerpRate(phase: SymbolPhase): number {
  switch (phase) {
    case "searching":
      return 0.55;
    case "converged":
    case "departing":
      return 2.4;
    case "idle":
      return 1.6;
  }
}

/** Advance the motion state by `dt` seconds (clamped by callers). */
export function stepMotion(state: SymbolMotionState, dt: number): void {
  if (state.reduceMotion) {
    state.progress = state.target;
    state.settle = state.target >= 1 ? 1 : 0;
    if (state.phase === "converged") state.pulse = 0;
    return;
  }
  const rate = lerpRate(state.phase);
  const k = 1 - Math.exp(-rate * dt);
  state.progress += (state.target - state.progress) * k;
  if (Math.abs(state.target - state.progress) < 0.0005) {
    state.progress = state.target;
  }
  const settleTarget = state.phase === "converged" || state.phase === "departing" ? 1 : 0;
  state.settle += (settleTarget - state.settle) * (1 - Math.exp(-3 * dt));
  state.pulse = Math.max(0, state.pulse - dt * 1.4);
}

/** Retarget a state for a phase; fires the converge pulse on arrival. */
export function applyPhase(state: SymbolMotionState, phase: SymbolPhase): void {
  state.phase = phase;
  state.target = phase === "idle" ? 0 : 1;
  if (phase === "converged" && !state.reduceMotion) {
    state.pulse = 1;
  }
  if (state.reduceMotion) {
    state.progress = state.target;
    state.settle = state.target >= 1 ? 1 : 0;
    state.pulse = 0;
  }
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Traveler position along its path: eased progress with a per-path lead. */
export function travelerT(progress: number, lead: number): number {
  const t = Math.min(1, Math.max(0, progress * (1 + lead) - lead * 0.2));
  return easeOutCubic(t);
}
