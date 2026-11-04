import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CARD_BY_ID } from "../data/profiles.ts";
import {
  MAX_MATCHES,
  cardFieldText,
  draftFieldText,
  matchRequest,
  validateGroundedPoint,
  validateMatchEntry,
  validateMatchInput,
  validateMatchResult,
} from "./match.ts";

const VALID_DRAFT = {
  summary: "ESP32 restarts when Wi-Fi starts.",
  goal: "Find why it restarts and fix it.",
  constraintsKnown: ["Battery powered"],
  attemptsKnown: ["Tried a larger USB supply"],
  resourcesKnown: [],
  unknowns: ["Brownout or heat"],
  questions: [],
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function validEntry() {
  return {
    profileId: "profile-maya",
    cardId: "card-esp32-restart",
    overlaps: [
      {
        text: "ESP32 restarts around Wi-Fi startup",
        requestField: "summary",
        cardId: "card-esp32-restart",
        cardField: "situation",
      },
    ],
    differences: [
      {
        text: "Bench supply was never retested on battery",
        requestField: "constraints",
        cardId: "card-esp32-restart",
        cardField: "outcome",
      },
    ],
    unknowns: ["Whether brownout or heat causes it"],
    question: "Did the restarts change with a bigger supply?",
    outcomeStatus: "partial",
  };
}

function validPayload() {
  return {
    status: "completed",
    output: [
      {
        type: "message",
        role: "assistant",
        content: [
          {
            type: "output_text",
            text: JSON.stringify({ results: [validEntry()] }),
          },
        ],
      },
    ],
  };
}

function draftPayload(results: unknown) {
  return {
    status: "completed",
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(results) }],
      },
    ],
  };
}

describe("validateMatchInput", () => {
  it("accepts an approved draft and rejects anything else", () => {
    assert.equal(validateMatchInput({ draft: VALID_DRAFT }).ok, true);
    for (const bad of [null, "x", {}, { draft: null }, { draft: { summary: "s" } }]) {
      assert.equal(validateMatchInput(bad).ok, false);
    }
  });

  it("accepts enabled local stories and rejects pool misuse", () => {
    const story = {
      id: "local-abc123",
      title: "Fixed a squeaky hinge",
      situation: "The hinge squeaked every time it opened.",
      constraints: "",
      attempts: "",
      outcome: "Oiling the pin stopped the noise.",
      outcomeStatus: "resolved",
      unknowns: [],
      includeInMatching: true,
      updatedAt: 1,
    };
    const ok = validateMatchInput({ draft: VALID_DRAFT, localStories: [story] });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.deepEqual(ok.value.localStories, [story]);
    const disabled = validateMatchInput({
      draft: VALID_DRAFT,
      localStories: [{ ...story, includeInMatching: false }],
    });
    assert.equal(disabled.ok, false);
    const oversized = validateMatchInput({
      draft: VALID_DRAFT,
      localStories: [{ ...story, title: "x".repeat(121) }],
    });
    assert.equal(oversized.ok, false);
    const tooMany = validateMatchInput({
      draft: VALID_DRAFT,
      localStories: Array.from({ length: 6 }, (_, i) => ({
        ...story,
        id: `local-${i}`,
      })),
    });
    assert.equal(tooMany.ok, false);
    const dupes = validateMatchInput({
      draft: VALID_DRAFT,
      localStories: [story, { ...story }],
    });
    assert.equal(dupes.ok, false);
  });
});

describe("validateMatchResult", () => {
  it("accepts empty results", () => {
    assert.deepEqual(validateMatchResult({ results: [] }), []);
  });

  it("rejects unknown profile and card IDs", () => {
    const unknownProfile = { results: [validEntry()] };
    unknownProfile.results[0].profileId = "profile-nobody";
    assert.equal(validateMatchResult(unknownProfile), null);
    const unknownCard = { results: [validEntry()] };
    unknownCard.results[0].cardId = "card-nothing";
    assert.equal(validateMatchResult(unknownCard), null);
  });

  it("rejects cards that do not belong to the profile", () => {
    const mismatch = { results: [validEntry()] };
    mismatch.results[0].profileId = "profile-tomas";
    assert.equal(validateMatchResult(mismatch), null);
  });

  it("rejects one-sided or invalid point references", () => {
    const base = validEntry();
    const bareString = structuredClone(base);
    (bareString.overlaps as unknown[])[0] = "ESP32 restarts around Wi-Fi startup";
    assert.equal(validateMatchEntry(bareString), null);
    const badRequestField = structuredClone(base);
    (badRequestField.overlaps[0] as { requestField: string }).requestField = "owner";
    assert.equal(validateMatchEntry(badRequestField), null);
    const badCardField = structuredClone(base);
    (badCardField.overlaps[0] as { cardField: string }).cardField = "owner";
    assert.equal(validateMatchEntry(badCardField), null);
    const foreignCard = structuredClone(base);
    (foreignCard.overlaps[0] as { cardId: string }).cardId = "card-soil-drift";
    assert.equal(validateMatchEntry(foreignCard), null);
    const emptyText = structuredClone(base);
    (emptyText.overlaps[0] as { text: string }).text = "  ";
    assert.equal(validateGroundedPoint(emptyText.overlaps[0], "profile-maya"), null);
  });

  it("rejects bad outcome statuses", () => {
    const base = validEntry();
    (base as { outcomeStatus: string }).outcomeStatus = "solved";
    assert.equal(validateMatchEntry(base), null);
    const missing = validEntry();
    delete (missing as Partial<typeof missing>).outcomeStatus;
    assert.equal(validateMatchEntry(missing), null);
  });

  it("rejects duplicate people and more than three results", () => {
    const dup = { results: [validEntry(), validEntry()] };
    assert.equal(validateMatchResult(dup), null);
    const many = { results: [] as unknown[] };
    for (let i = 0; i < MAX_MATCHES + 1; i++) {
      many.results.push(validEntry());
    }
    assert.equal(validateMatchResult(many), null);
  });

  it("rejects missing overlaps, questions, and malformed shapes", () => {
    assert.equal(validateMatchEntry(null), null);
    const noOverlap = validEntry();
    noOverlap.overlaps = [];
    assert.equal(validateMatchEntry(noOverlap), null);
    const noQuestion = validEntry();
    noQuestion.question = "  ";
    assert.equal(validateMatchEntry(noQuestion), null);
    const emptyDifferences = validEntry();
    emptyDifferences.differences = [];
    assert.notEqual(validateMatchEntry(emptyDifferences), null);
    assert.equal(validateMatchResult({}), null);
    assert.equal(validateMatchResult({ results: "yes" }), null);
  });
});

describe("support text resolvers", () => {
  it("resolve verbatim text from the actual inputs", () => {
    assert.equal(draftFieldText(VALID_DRAFT, "summary"), VALID_DRAFT.summary);
    assert.equal(
      draftFieldText(VALID_DRAFT, "attempts"),
      VALID_DRAFT.attemptsKnown.join(" | "),
    );
    const card = CARD_BY_ID["card-esp32-restart"];
    assert.equal(cardFieldText(card, "situation"), card.situation);
    assert.equal(cardFieldText(card, "unknowns"), card.unknowns.join(" | "));
  });
});

describe("matchRequest", () => {
  it("returns validated matches and never the credential", async () => {
    const result = await matchRequest(VALID_DRAFT, {
      apiKey: "secret-key-value",
      fetchFn: (async () => jsonResponse(validPayload())) as typeof fetch,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.matches.length, 1);
      assert.equal(result.matches[0].profileId, "profile-maya");
      assert.equal(result.matches[0].outcomeStatus, "partial");
      assert.equal(
        JSON.stringify(result).includes("secret-key-value"),
        false,
      );
    }
  });

  it("sends one bounded low-effort request", async () => {
    let sentBody = "";
    let calls = 0;
    const capture = (async (_url: string, init?: RequestInit) => {
      calls += 1;
      sentBody = String(init?.body ?? "");
      return jsonResponse(validPayload());
    }) as unknown as typeof fetch;
    const result = await matchRequest(VALID_DRAFT, {
      apiKey: "k",
      fetchFn: capture,
    });
    assert.equal(result.ok, true);
    assert.equal(calls, 1);
    const sent = JSON.parse(sentBody) as {
      model?: string;
      reasoning?: { effort?: string };
      max_output_tokens?: number;
      input?: string;
    };
    assert.equal(sent.model, "muse-spark-1.3");
    assert.deepEqual(sent.reasoning, { effort: "low" });
    assert.equal(sent.max_output_tokens, 3000);
    assert.ok((sent.input ?? "").includes("card-esp32-restart"));
  });

  it("includes enabled stories and validates against the supplied pool", async () => {
    const story = {
      id: "local-abc123",
      title: "Fixed a squeaky hinge",
      situation: "The hinge squeaked every time it opened.",
      constraints: "",
      attempts: "",
      outcome: "Oiling the pin stopped the noise.",
      outcomeStatus: "resolved" as const,
      unknowns: [],
      includeInMatching: true,
      updatedAt: 1,
    };
    let sentBody = "";
    const capture = (async (_url: string, init?: RequestInit) => {
      sentBody = String(init?.body ?? "");
      return jsonResponse(
        draftPayload({
          results: [
            {
              profileId: "local-abc123",
              cardId: "local-abc123",
              overlaps: [
                {
                  text: "Hinge noise fixed with oil",
                  requestField: "attempts",
                  cardId: "local-abc123",
                  cardField: "outcome",
                },
              ],
              differences: [],
              unknowns: [],
              question: "How long did the fix last?",
              outcomeStatus: "resolved",
            },
          ],
        }),
      );
    }) as unknown as typeof fetch;
    const result = await matchRequest(VALID_DRAFT, {
      apiKey: "k",
      fetchFn: capture,
      localStories: [story],
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.matches[0].profileId, "local-abc123");
    }
    const sent = JSON.parse(sentBody) as { input?: string; instructions?: string };
    assert.ok((sent.input ?? "").includes("local-abc123"));
    assert.ok((sent.input ?? "").includes("untrusted"));
    // Local stories are framed as the user's own examples, never as people.
    assert.ok((sent.instructions ?? "").includes("never as people"));

    const unsupplied = await matchRequest(VALID_DRAFT, {
      apiKey: "k",
      fetchFn: (async () =>
        jsonResponse(
          draftPayload({
            results: [
              {
                profileId: "local-other",
                cardId: "local-other",
                overlaps: [
                  {
                    text: "Something overlaps",
                    requestField: "summary",
                    cardId: "local-other",
                    cardField: "situation",
                  },
                ],
                differences: [],
                unknowns: [],
                question: "What happened?",
                outcomeStatus: "resolved",
              },
            ],
          }),
        )) as typeof fetch,
      localStories: [story],
    });
    assert.deepEqual(unsupplied, { ok: false, code: "invalid_output" });

    const mixedIds = await matchRequest(VALID_DRAFT, {
      apiKey: "k",
      fetchFn: (async () =>
        jsonResponse(
          draftPayload({
            results: [
              {
                profileId: "local-abc123",
                cardId: "card-esp32-restart",
                overlaps: [
                  {
                    text: "Something overlaps",
                    requestField: "summary",
                    cardId: "card-esp32-restart",
                    cardField: "situation",
                  },
                ],
                differences: [],
                unknowns: [],
                question: "What happened?",
                outcomeStatus: "resolved",
              },
            ],
          }),
        )) as typeof fetch,
      localStories: [story],
    });
    assert.deepEqual(mixedIds, { ok: false, code: "invalid_output" });
  });

  it("maps empty results as success", async () => {
    const empty = await matchRequest(VALID_DRAFT, {
      apiKey: "k",
      fetchFn: (async () => jsonResponse(draftPayload({ results: [] }))) as typeof fetch,
    });
    assert.deepEqual(empty, {
      ok: true,
      matches: [],
      nextMoves: [],
      limitations: [],
    });
  });

  it("maps provider failures without retrying", async () => {
    const missing = await matchRequest(VALID_DRAFT, {
      apiKey: undefined,
      fetchFn: (async () => jsonResponse({})) as typeof fetch,
    });
    assert.deepEqual(missing, { ok: false, code: "missing_config" });
    const err = await matchRequest(VALID_DRAFT, {
      apiKey: "k",
      fetchFn: (async () => jsonResponse({}, 500)) as typeof fetch,
    });
    assert.deepEqual(err, { ok: false, code: "provider_error" });
    const limited = await matchRequest(VALID_DRAFT, {
      apiKey: "k",
      fetchFn: (async () => jsonResponse({}, 429)) as typeof fetch,
    });
    assert.deepEqual(limited, { ok: false, code: "rate_limited" });
    const cut = await matchRequest(VALID_DRAFT, {
      apiKey: "k",
      fetchFn: (async () => jsonResponse({ status: "incomplete" })) as typeof fetch,
    });
    assert.deepEqual(cut, { ok: false, code: "incomplete" });
    const garbage = await matchRequest(VALID_DRAFT, {
      apiKey: "k",
      fetchFn: (async () =>
        jsonResponse({
          status: "completed",
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: "not json" }],
            },
          ],
        })) as typeof fetch,
    });
    assert.deepEqual(garbage, { ok: false, code: "invalid_output" });
    const badRefs = await matchRequest(VALID_DRAFT, {
      apiKey: "k",
      fetchFn: (async () =>
        jsonResponse(
          draftPayload({
            results: [
              {
                profileId: "profile-maya",
                cardId: "card-esp32-restart",
                overlaps: ["Both cases involve sensor reporting"],
                differences: [],
                unknowns: [],
                question: "Hi?",
                outcomeStatus: "solved",
              },
            ],
          }),
        )) as typeof fetch,
    });
    assert.deepEqual(badRefs, { ok: false, code: "invalid_output" });
  });
});
