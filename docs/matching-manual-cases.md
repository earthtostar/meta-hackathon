# Matching manual cases (quality evaluation, not automated)

These cases probe ranking quality with live reasoning. Mocked responses
cannot verify quality, so run each by hand against the demo and judge
whether the returned people, overlaps, and differences make sense.

Case 1 — ESP32 restarts (direct wording).
Draft summary: "My ESP32 restarts every time Wi-Fi starts connecting."
Goal: "Find why it restarts and fix it on battery power."
Known constraints: battery powered, small sealed enclosure.
Previous attempts: tried a larger USB supply on the bench.
Expect: Maya via card-esp32-restart, naming bench-vs-battery as a
difference and brownout-vs-heat as unknown. Same-symptom cards with
different causes (soil drift, balcony dropout) are acceptable only when
the difference in cause is stated.

Case 2 — differently worded equivalent.
Draft summary: "The little wireless board in my planter reboots as soon
as it tries to get online."
Expect: the same ESP32 restart card as Case 1. Keyword-only matching
would miss this; situation-first matching should not.

Case 3 — unrelated request.
Draft summary: "I want to fit sourdough baking around office hours."
Expect: zero results, with the clear no-match state. Baking around a
workday loosely resembles Leo's card only if the draft mentions video
editing or learning pace; a bread-only draft should match nobody.
