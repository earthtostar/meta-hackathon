# KIVO Demo Script (Release Candidate)

Three reproducible scenarios. Each uses only existing experience records.
Fictional demo cases are labeled in the product — repeat that label aloud.

Setup: `npm run dev`, open http://localhost:3000 in a browser.
Needs `MODEL_API_KEY` in `.env.local` for AI matching; without it (or if
the provider fails) the app automatically serves labeled keyword leads
instead — never present those as AI analysis.

Flow for every scenario: Discover → type the challenge → Review my request
→ Clarify with AI (optional) → Confirm draft → Find relevant experience.

3-minute video plan: 0:00–0:20 intro (what KIVO is + fictional-data
label) → 0:20–1:00 scenario A → 1:00–1:40 scenario B → 1:40–2:20
scenario C (limits check) → 2:20–2:50 What If? + Next Move save →
2:50–3:00 Contribute privacy walkthrough and close.

## A. Student struggling with a project

Challenge input:

- Problem: "Struggling to finish a difficult video editing project for my
  software course."
- Goal: "Submit a working short film before the deadline."
- Constraints: "Thirty minutes a day, five-year-old laptop."
- Tried: "Watched tutorial videos but did not finish a series."
- Unknowns: "Whether my laptop can run the editing tools."

Observe:

- Matches from learning-theme cases (e.g. the Blender or first-film case).
- Transferability Lens: what matches, what differs, what worked (verbatim
  record), what may transfer (if the AI names any), what remains unknown.
- Suggested next moves when the AI supplies validated ones; otherwise the
  "What you can do next" questions.
- Show on map: the matched spire highlights in the Atlas; Back to
  results returns to Discover with the challenge intact.

## B. Founder with limited resources

Challenge input:

- Problem: "Trying to find the first paying customers for a handmade soap
  gift box I make at home."
- Goal: "Get ten repeat buyers without spending on ads."
- Constraints: "No advertising budget, weekends only."
- Tried: "Showed samples to friends at a weekend fair."
- Unknowns: "Whether online listings would work."

Observe:

- Matches from first-customer cases (market stall, presets, tutoring).
- Each card carries overlaps with exact supporting quotes — read one aloud
  to show evidence grounding, then the reported outcome with its
  self-reported, unverified label.
- Atlas: matched spires ringed; selecting one shows the full fictional
  record and related cases.

## C. Different context (honest-limits check)

Challenge input:

- Problem: "My laptop battery drains in an hour during video calls."
- Goal: "Make the battery last a full workday."
- Constraints: "Five-year-old laptop."
- Tried: "Lowered screen brightness."
- Unknowns: "Whether the battery itself is degraded."

Observe:

- AI path: at most three results or an honest "no close matches" state.
- Fallback path: keyword leads each carrying "not assessed by AI" caveats,
  or no leads at all — both are correct outcomes.
- A top result may have no 3D node (e.g. the balcony-dropout case): the
  card stays fully usable and no node is invented. Say so explicitly.

## Contribute (optional, 2 minutes)

Add a local story, leave matching disabled, run a comparison, confirm the
story is absent. Enable it, re-run, confirm it appears labeled "Your local
experience / Self-reported". Disable or delete it afterwards.

Privacy (say aloud): disabled stories never leave this browser and never
appear on the shared map. An *enabled* story is sent to Meta only as part
of an explicit matching request you start — turning the toggle on alone
sends nothing.
