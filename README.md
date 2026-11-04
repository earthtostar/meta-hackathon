# KIVO — Experience Match

KIVO helps people understand a challenge through relevant experiences
shared by others. Describe what you are facing; KIVO compares it with
documented attempts — what worked, what differed — so you see what may
transfer before you try.

> Demo data is fictional and self-reported, never verified. Local stories
> stay in this browser and are never published.

## Main innovation

Structured experience intelligence instead of a chatbot: an approved
situation draft is compared against real local records, and every claim
the AI makes must cite the exact request field and record field it rests
on. References are validated server-side; unsupported claims are rejected,
not shown.

## Product features

- **Discover** — challenge input, optional AI clarification (editable
  draft with resources extraction and a visual DNA profile, explicit
  consent), evidence-grounded matching (up to 3 results).
- **Transferability Lens** — per result: what matches, what differs, what
  worked (verbatim record), what may transfer, what remains unknown.
- **Evidence Lens** — every insight labeled Model inference vs Source
  fact vs Unknown, with one-click jump to the full source record.
- **What If?** — rewrite one constraint or resource and re-rank the same
  pool; shows rank movement honestly, original comparison preserved until
  promoted.
- **Next Move** — one suggested first step plus alternatives, each citing
  the results it builds on and savable to My Discoveries; honestly
  absent when evidence is insufficient.
- **Explore (Experience Atlas)** — interactive 3D night-atlas of the 12
  fictional cases (district spires, routes, tethers), bidirectionally
  synced with match and What If results; works without WebGL via the
  full 2D list.
- **Contribute** — up to 5 local stories, private by default, explicit
  per-story opt-in for matching, edit/delete, pool changes invalidate
  results.
- **Keyword fallback** — when the AI is unavailable, deterministic labeled
  leads (never presented as AI analysis); rate limits still error.

## Technical architecture

- Next.js 16 (App Router) + React 19 + TypeScript. No database, no auth.
- 3D: React Three Fiber 9 + three 0.187, custom bounded rig, lazy-loaded
  scene with error boundary and reduced-motion support.
- AI: server routes (`app/api/clarify`, `app/api/match`) call the Meta
  Model API; browsers never see the key. `lib/` holds validation,
  fallback search, and cross-pane events; `data/` holds the fictional
  corpus and the profile↔scene ID map.

## Meta AI tools actually used

- Meta Responses API (`POST https://api.meta.ai/v1/responses`).
- Model `muse-spark-1.3`, low reasoning effort, bounded output.
- `json_schema` structured output; every ID and reference re-validated
  against the supplied candidate set.

## Installation

Requires Node 20+.

```bash
npm install
cp .env.example .env.local
# put your key in .env.local (server-only, never committed)
```

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `MODEL_API_KEY` | For AI matching | Server-only Meta API key |

Without it (or on provider failure) matching degrades to the labeled
keyword fallback; everything else works.

## Local development

```bash
npm run dev      # open http://localhost:3000 in a browser
npm test         # unit + evaluation suites
npm run lint
npm run typecheck
npm run build
```

## Production setup

- Framework: Next.js — Vercel is the natural host (zero-config build:
  `npm run build`), any Node host works.
- Set `MODEL_API_KEY` as a server environment variable (no `NEXT_PUBLIC_`
  prefix, never in client code or git).
- API routes are production-compatible; throttling is in-memory per
  instance (add real auth/quotas before open public use).

## Demo instructions

See [docs/demo-script.md](docs/demo-script.md): three reproducible
scenarios (student, founder, different-context) plus a local-story
privacy walkthrough.

## Known limitations

- Browser end-to-end has not been observed in the sandbox environment;
  run the demo script on a real machine before presenting.
- AI quality was spot-checked with one live call, not a full eval;
  grounding is structural (validated references), not semantic proof.
- Throttling is prototype-grade; no accounts, no shared storage, no
  publishing — multi-user use needs the trust layer described in
  `PROJECT_STATUS.md`.
- Suggested moves appear only when the model supplies validated ones.
