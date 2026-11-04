import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clarifyRequest,
  extractOutputText,
  validateDraft,
  validateInput,
} from "./clarify.ts";

const VALID_INPUT = {
  problem:
    "My balcony plant sensor stops sending readings every afternoon in the sun.",
  constraints: "Battery powered, one weekend to fix it.",
  tried: "I wiped the sensor and moved the panel into full sun.",
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function validPayload(questions: string[] = ["What powers it at night?"]) {
  return {
    status: "completed",
    output: [
      {
        type: "message",
        role: "assistant",
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              summary: "Sensor drops out on sunny afternoons.",
              goal: "Find why readings stop and fix it.",
              constraintsKnown: ["Battery powered"],
              attemptsKnown: ["Wiped the sensor"],
              resourcesKnown: [],
              unknowns: ["Whether heat or power causes it"],
              questions,
            }),
          },
        ],
      },
    ],
  };
}

describe("validateInput", () => {
  it("rejects non-objects and wrong types", () => {
    for (const bad of [null, "x", 42, [], { problem: 1 }]) {
      assert.equal(validateInput(bad).ok, false);
    }
  });

  it("rejects too-short and too-long fields", () => {
    assert.equal(
      validateInput({ ...VALID_INPUT, problem: "too short" }).ok,
      false,
    );
    assert.equal(
      validateInput({ ...VALID_INPUT, problem: "x".repeat(2001) }).ok,
      false,
    );
    assert.equal(
      validateInput({ ...VALID_INPUT, constraints: "x".repeat(501) }).ok,
      false,
    );
    assert.equal(
      validateInput({ ...VALID_INPUT, tried: "x".repeat(1001) }).ok,
      false,
    );
  });

  it("rejects malformed answers", () => {
    assert.equal(
      validateInput({ ...VALID_INPUT, answers: ["a", "b", "c", "d"] }).ok,
      false,
    );
    assert.equal(
      validateInput({ ...VALID_INPUT, answers: ["x".repeat(1001)] }).ok,
      false,
    );
  });

  it("accepts a valid body with and without answers", () => {
    assert.equal(validateInput(VALID_INPUT).ok, true);
    assert.equal(
      validateInput({ ...VALID_INPUT, answers: ["On a small solar panel."] })
        .ok,
      true,
    );
  });
});

describe("validateDraft", () => {
  it("accepts resources the user stated and keeps unknowns unknown", () => {
    const draft = validateDraft({
      summary: "s",
      goal: "g",
      constraintsKnown: ["One weekend"],
      attemptsKnown: [],
      resourcesKnown: ["A spare sensor", "A soldering iron"],
      unknowns: ["Whether heat or power causes it"],
      questions: [],
    });
    assert.deepEqual(draft?.resourcesKnown, [
      "A spare sensor",
      "A soldering iron",
    ]);
    assert.deepEqual(draft?.unknowns, ["Whether heat or power causes it"]);
  });

  it("rejects off-schema payloads", () => {
    assert.equal(validateDraft(null), null);
    assert.equal(validateDraft({ summary: "s" }), null);
    assert.equal(
      validateDraft({
        summary: "s",
        goal: "g",
        constraintsKnown: [],
        attemptsKnown: [],
        resourcesKnown: [],
        unknowns: [],
        questions: ["a", "b", "c", "d"],
      }),
      null,
    );
  });
});

describe("extractOutputText", () => {
  it("concatenates output_text blocks and flags refusals", () => {
    const text = extractOutputText({
      status: "completed",
      output: [
        {
          type: "message",
          content: [
            { type: "output_text", text: '{"a":' },
            { type: "output_text", text: "1}" },
          ],
        },
      ],
    });
    assert.deepEqual(text, { kind: "text", text: '{"a":1}' });
    assert.deepEqual(
      extractOutputText({
        status: "completed",
        output: [{ type: "refusal", refusal: "no" }],
      }),
      { kind: "refused" },
    );
    assert.deepEqual(extractOutputText({ status: "incomplete" }), {
      kind: "incomplete",
    });
    assert.equal(extractOutputText({ nope: true }), null);
  });
});

describe("clarifyRequest", () => {
  it("reports missing configuration without calling the provider", async () => {
    let called = false;
    const result = await clarifyRequest(VALID_INPUT, {
      apiKey: undefined,
      fetchFn: (async () => {
        called = true;
        return jsonResponse({});
      }) as typeof fetch,
    });
    assert.deepEqual(result, { ok: false, code: "missing_config" });
    assert.equal(called, false);
  });

  it("maps provider errors and rate limits", async () => {
    const err = await clarifyRequest(VALID_INPUT, {
      apiKey: "k",
      fetchFn: (async () => jsonResponse({}, 500)) as typeof fetch,
    });
    assert.deepEqual(err, { ok: false, code: "provider_error" });
    const limited = await clarifyRequest(VALID_INPUT, {
      apiKey: "k",
      fetchFn: (async () => jsonResponse({}, 429)) as typeof fetch,
    });
    assert.deepEqual(limited, { ok: false, code: "rate_limited" });
  });

  it("maps timeouts without retrying", async () => {
    let calls = 0;
    const hanging = ((url: unknown, init?: { signal?: AbortSignal }) => {
      calls += 1;
      return new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation timed out.", "TimeoutError"));
        });
      });
    }) as unknown as typeof fetch;
    const result = await clarifyRequest(VALID_INPUT, {
      apiKey: "k",
      fetchFn: hanging,
      timeoutMs: 50,
    });
    assert.deepEqual(result, { ok: false, code: "timeout" });
    assert.equal(calls, 1);
  });

  it("maps refusals, cut-offs, and unusable output", async () => {
    const refused = await clarifyRequest(VALID_INPUT, {
      apiKey: "k",
      fetchFn: (async () =>
        jsonResponse({
          status: "completed",
          output: [{ type: "refusal" }],
        })) as typeof fetch,
    });
    assert.deepEqual(refused, { ok: false, code: "refused" });

    const cut = await clarifyRequest(VALID_INPUT, {
      apiKey: "k",
      fetchFn: (async () => jsonResponse({ status: "incomplete" })) as typeof fetch,
    });
    assert.deepEqual(cut, { ok: false, code: "incomplete" });

    const budgetCutoff = await clarifyRequest(VALID_INPUT, {
      apiKey: "k",
      fetchFn: (async () =>
        jsonResponse({
          status: "incomplete",
          incomplete_details: { reason: "max_output_tokens" },
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: '{"summary": "partial' }],
            },
          ],
        })) as typeof fetch,
    });
    assert.deepEqual(budgetCutoff, { ok: false, code: "incomplete" });

    const garbage = await clarifyRequest(VALID_INPUT, {
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

    const tooMany = await clarifyRequest(VALID_INPUT, {
      apiKey: "k",
      fetchFn: (async () => jsonResponse(validPayload(["1", "2", "3", "4"]))) as typeof fetch,
    });
    assert.deepEqual(tooMany, { ok: false, code: "invalid_output" });
  });

  it("returns the validated draft and never the credential", async () => {
    const result = await clarifyRequest(VALID_INPUT, {
      apiKey: "secret-key-value",
      fetchFn: (async () => jsonResponse(validPayload())) as typeof fetch,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.draft.questions.length, 1);
      assert.equal(
        JSON.stringify(result).includes("secret-key-value"),
        false,
      );
    }
  });

  it("caps reasoning effort and bounds the output budget", async () => {
    let sentBody = "";
    const capture = (async (_url: unknown, init?: RequestInit) => {
      sentBody = String(init?.body ?? "");
      return jsonResponse(validPayload());
    }) as unknown as typeof fetch;
    const result = await clarifyRequest(VALID_INPUT, {
      apiKey: "k",
      fetchFn: capture,
    });
    assert.equal(result.ok, true);
    const sent = JSON.parse(sentBody) as {
      reasoning?: { effort?: string };
      max_output_tokens?: number;
    };
    assert.deepEqual(sent.reasoning, { effort: "low" });
    assert.equal(sent.max_output_tokens, 2500);
  });

  it("strips follow-up questions after the answers round", async () => {
    const result = await clarifyRequest(
      { ...VALID_INPUT, answers: ["On a small solar panel."] },
      {
        apiKey: "k",
        fetchFn: (async () => jsonResponse(validPayload(["Another?"]))) as typeof fetch,
      },
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.draft.questions, []);
  });
});
