# KIVO — Release Handoff

> Point-in-time release note. For the current product status, see
> [PROJECT_STATUS.md](PROJECT_STATUS.md).

Release commit: `7b28fd1` — "Release KIVO hackathon submission source"
(56 files, application + tests + docs; tooling dirs and local
credentials excluded).

## Verified gates (observed on the release tree)

- `npm test` — 108/108 pass, 0 fail.
- `npx tsc --noEmit` — clean.
- `npx eslint` — 0 errors, 0 warnings.
- `npm run build` — production build succeeds.

## Security

Full-history and working-tree audit: no API keys, tokens, or private
keys committed. `.env.local`, `auth.json`, `.vercel`, and
`node_modules` are git-ignored. `MODEL_API_KEY` is read only in server
routes; no `NEXT_PUBLIC_` usage. Never print secret values.

## Publishing (if not yet done)

```bash
git push origin main
git fetch origin main
git rev-parse HEAD origin/main   # both must print 7b28fd1...
```

Confirm on GitHub: README renders, key sources present, no secrets
visible. Then set server-side `MODEL_API_KEY` in the hosting project
and deploy (`npm run build`).

## Still to do by hand

- Real-browser pass of `docs/demo-script.md` (desktop + mobile,
  reduced motion, no-WebGL fallback).
- Recorded live-model spot check before presenting.
- Demo video / submission text per hackathon track rules.

## Local notes

- Dev: `npm run dev` → http://localhost:3000; needs `.env.local`
  with `MODEL_API_KEY` (copy from `.env.example`, never commit it).
- Test artifacts and credentials stay out of git.
