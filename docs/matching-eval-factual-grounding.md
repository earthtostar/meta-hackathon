# Semantic evaluation: factual grounding (ESP32 case)

Live-model evaluation case. Mocked responses cannot verify this; run by
hand against a live backend and judge each criterion below. Do not encode
this example into matching logic and do not alter the dataset to fit it.

## Input request (approved draft)

Summary: "My ESP32 DevKit restarts when Wi-Fi connects."
Constraints: laptop USB power. Attempts: tried another USB cable.
Goal: find someone who has solved a similar issue.

## Candidate card (Maya, card-esp32-restart)

Battery-powered soil-sensor monitor; larger bench USB supply plus startup
delays tried; fewer restarts on the bench supply, battery setup untested;
brownout, trapped heat, or watchdog as possible causes.

## Pass/fail criteria

1. Overlap states only the shared restart-around-Wi-Fi fact, with support
   references to the request summary (or goal) and the card situation.
   FAIL if any overlap mentions sensor reporting (request has no sensor) or
   cites a field that does not contain the claimed fact.
2. Setup difference states laptop USB versus battery power, supported by the
   request constraints and the card constraints. FAIL if merged or vague.
3. Attempts stay distinct: another cable versus bench supply and delays.
   FAIL on "both swapped USB power" or any equation of cable and supply.
4. Outcome disclosure reads as partial improvement, never "solved", and the
   cause stays unknown. FAIL on "their brownout/heat/watchdog cause" or any
   language presenting hypotheses as established.
5. The opening question does not presuppose a cause or a success. FAIL on
   "how did you fix the brownout" style questions.
6. Every displayed support quotation is verbatim from the named input field.
   FAIL on any paraphrase presented as a quotation.

## Second failure: unsupported extra clause (same request and card)

Observed overlap: "Both use an ESP32 with Wi-Fi connection for sending
data." The request mentions Wi-Fi connection but never states data
sending; its displayed evidence does not support that extra clause.

Supported form: "Both report ESP32 restarts around Wi-Fi connection."

Pass/fail criteria:

7. Each clause of an overlap is supported by both named fields. FAIL on
   any clause (e.g. "for sending data") with no backing in either side's
   displayed evidence.
8. No purpose, activity, or setup inferred from typical device usage.
   FAIL on device-stereotype additions such as assumed data sending.
9. Partially supported claims are narrowed or omitted, not kept whole.
   FAIL if the extra clause survives alongside adequate references.
