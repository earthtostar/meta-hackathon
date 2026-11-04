# KIVO — Project Status

Report date: 2026-11-04. Method: source inspection plus executed
verification gates (`npm test`, `tsc --noEmit`, `eslint`, `npm run build`).
No live paid model calls were made for this report beyond prior
spot-checks; no browser end-to-end run was possible in this environment.

## 1. What KIVO is

KIVO is an AI experience-intelligence prototype. A user describes a
challenge; KIVO extracts its structure into an editable draft, compares
it against documented attempts, and explains what may transfer — with
every AI claim tied to the exact record it rests on. Demo data is
fictional and self-reported, never verified. Local stories stay in the
user's browser and are never published.

User journey: Discover (challenge → DNA draft → matching) → Evidence
Lens → What If? → Next Move → Explore (atlas) / save → Contribute
(local route). Each step is optional and navigable; the core flow works
without AI clarification.

## 2. Implemented features

| Area | Behavior | Evidence |
|---|---|---|
| Experience DNA | Structured draft (summary, goal, constraints, attempts, **resources**, unknowns, questions); visual DNA profile; every field editable, clearable, extendable; blank rows stripped on confirm | `lib/clarify.ts`, `components/Composer.tsx` |
| Evidence-grounded matching | One bounded request (muse-spark-1.3, low effort) over 12 fictional records; max 3 results with overlaps, differences, unknowns, outcomes; server-validated IDs | `lib/match.ts`, `app/api/match/route.ts` |
| Evidence Lens | Model-inference vs Source-fact vs Unknown badges; one-click jump to the full source record; source labels preserved | `components/Composer.tsx` |
| What If? | Rewrite one constraint/resource, re-rank the same pool, honest rank deltas; original preserved until promoted/discarded | `lib/whatif.ts`, `components/WhatIfSection.tsx` |
| Next Move | One suggested first step plus alternatives, each citing its sources and savable to My Discoveries | `components/ResultInsights.tsx`, `lib/discoveries.ts` |
| Experience Atlas | Night-atlas 3D (district spires, routes, tethers) synced with match and What If results; full 2D fallback, reduced-motion support | `components/ExperienceScene.tsx`, `components/Explorer.tsx`, `components/kivo/` |
| Compare + Discoveries | Side-by-side comparison with map jumps; bookmarked insights in versioned localStorage | `components/CompareSection.tsx`, `lib/compare.ts` |
| Contribute | Up to 5 local routes, private by default, per-story opt-in, edit/delete; pool edits invalidate results | `components/StoryVault.tsx`, `lib/local-stories.ts` |
| Privacy + fallback | Explicit consent before any send; keyword fallback labeled as such; 15 s server throttle | `app/api/*/route.ts` |

## 3. Verification

- `npm test` — **108/108 pass**, 0 fail.
- `npx tsc --noEmit` — clean.
- `npx eslint` — 0 errors, 0 warnings.
- `npm run build` — production build succeeds (`/`, `/api/clarify`, `/api/match`).
- Browser end-to-end — **not observed** (sandbox has no browser); run `docs/demo-script.md` on a real machine.
- Live-model ranking quality — spot-checked with one live call, not a full eval; grounding is structural (validated references), not semantic proof.

## 4. Prototype limitations (honest)

- Corpus: 12 fictional records — relevant mechanics, not real coverage.
- Storage is local-only; no accounts, no shared data, no publishing.
- Throttling is prototype-grade (in-memory per instance).
- Suggested moves appear only when the model supplies validated ones.
- Multi-user trust (identity, moderation, contact) does not exist and
  is not claimed.

## 5. Remaining work

Before presenting: one real-browser pass of the demo script (desktop +
mobile, reduced motion, no-WebGL). For production: hosting with
server-side `MODEL_API_KEY`, real quotas/auth, and a recorded live-model
eval. No new product features are required for submission.
