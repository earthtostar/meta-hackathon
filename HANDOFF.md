# Experience Match — Handoff (2026-11-01, evening checkpoint)

Local prototype only. No live paid API calls were made during this work.
No secrets or personal draft contents are recorded in this file.

## Implemented features

- **Request form + AI clarification** (`components/Composer.tsx`, `lib/clarify.ts`,
  `app/api/clarify/route.ts`): validated form, local preview, mocked-or-live
  clarify returning a structured draft (summary, goal, constraints, attempts,
  unknowns, questions), one refinement round, explicit confirm.
- **Local draft persistence** (`lib/draft-store.ts`): versioned namespaced
  localStorage record, recovery screen (Continue saved draft / Start fresh),
  no network on restore, confirmed reset only, never `localStorage.clear()`.
- **Evidence-grounded matching** (`lib/match.ts`, `app/api/match/route.ts`):
  one bounded request (muse-spark-1.3, low effort) over 12 fictional profiles
  (`data/profiles.ts`, `data/experiences.ts`); server-validated IDs, evidence
  references, max 3 results; grounding rules (no fact migration, unknowns stay
  unknown, partial outcomes disclosed). Semantic eval cases in
  `docs/matching-eval-factual-grounding.md` and `docs/matching-manual-cases.md`.
- **3D experience explorer** (`components/ExperienceScene.tsx`,
  `components/Explorer.tsx`, `data/profile-scene.ts`): illustrative scene,
  deterministic profile-to-node mapping, bidirectional card/node selection,
  highlights cleared on invalidation/reset/recovery.
- **Local "Share your experience" (current milestone, COMPLETE)**:
  `components/StoryVault.tsx` + `lib/local-stories.ts` — user-authored stories
  (title, situation, constraints, attempts, outcome + resolved / partly improved
  / did not work / not yet known, unknowns) with preview/save/edit/confirmed
  delete, max 5, separate versioned key `experience-match:stories:v1`,
  OFF-by-default per-story inclusion sent to Meta only on explicit matching.
  Local result cards labeled "Your local experience / self-reported", no 3D
  nodes, no contact actions. Pool edits broadcast `POOL_CHANGED_EVENT`
  (`lib/match-events.ts`) and invalidate results.

## Check results

Passed (final code; `npm test` re-ran this session, the rest on identical code
with no source edits since):
- `npm test` — 49/49 pass, 16 suites, 0 fail.
- `npx tsc --noEmit` — exit 0.
- `npm run lint` — exit 0.
- `npm run build` — exit 0.
- Isolated Playwright session (`storytest`, mocked clarify/match, viewport +
  keyboard): enable→match sends only the enabled story and renders the local
  card with dual-source evidence; toggle alone sends nothing; disabled story
  excluded (`localStories:[]`) with clean no-match state; edit-save and
  delete-confirm invalidate results; 360px viewport usable; demo map selection
  still works.

Failed: none.

Not run: live-model ranking quality (by design — mocked responses do not prove
model accuracy); blocked-storage/quota paths in a real browser (unit-tested
with fake storage only).

## Remaining issues and next step

- No open defects in the local-stories milestone. Queued verification debt:
  server-side invalid/oversized candidate rejection covered by unit tests only.
- Next concrete step: decide the milestone after this checkpoint (e.g. live
  end-to-end match against the real model in a throwaway session, or the next
  agreed feature). Do not auto-start implementation; wait for instruction.

## Installed skills

| Skill | Installed path | Source | How to use |
|---|---|---|---|
| react-best-practices | `.agents/skills/react-best-practices/` | `https://github.com/vercel-labs/agent-skills` (exact revision unrecorded) | Read `SKILL.md` + `rules/` before React edits; complements built-in review. |
| playwright-cli | `.agents/skills/playwright-cli/` | `https://github.com/microsoft/playwright-cli` (exact revision unrecorded) | `playwright-cli -s <session>` against `http://localhost:3000` in an isolated session; mock `/api/*` via `eval` fetch stub; never touch the user's browser profile. |

Discovery status: project-scoped under `.agents/skills/`; usable by direct
file read. If skill auto-discovery needs a reload/new session, follow the
documented procedure before the next task.

## Local state notes

- Dev server last ran on `http://localhost:3000` (long-lived process, may need
  restart next session; port conflicts: use the existing process, do not kill
  user processes).
- Test artifacts (`.playwright-cli/`, `.skill-stage/`, `.verify/`) and
  `.env.local` / credentials are intentionally NOT committed.
