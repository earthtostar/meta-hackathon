import { NextResponse } from "next/server";
import { MAX_BODY_BYTES } from "../../../lib/clarify";
import {
  matchRequest,
  validateMatchInput,
  type MatchResult,
} from "../../../lib/match";
import type { ClarifyErrorCode } from "../../../lib/clarify";

export const runtime = "nodejs";

// Local-prototype throttle only: one request per client every 15 seconds.
// Production use requires real authentication and durable quotas.
const THROTTLE_WINDOW_MS = 15_000;
const lastSeen = new Map<string, number>();

const STATUS_FOR_CODE: Record<ClarifyErrorCode, number> = {
  bad_input: 400,
  missing_config: 503,
  provider_error: 502,
  rate_limited: 429,
  timeout: 504,
  refused: 502,
  invalid_output: 502,
  incomplete: 502,
};

const MESSAGE_FOR_CODE: Record<ClarifyErrorCode, string> = {
  bad_input: "The request was malformed or outside the allowed limits.",
  missing_config:
    "Matching is not configured on this server. Add MODEL_API_KEY to .env.local and restart.",
  provider_error: "The AI provider returned an error. Try again later.",
  rate_limited: "Too many AI requests right now. Wait a moment and retry.",
  timeout: "The AI request timed out. Try again.",
  refused: "The AI provider declined this request. Edit the draft and retry.",
  invalid_output: "The AI response could not be used. Try again.",
  incomplete: "The matching response was cut off before it finished. Try again.",
};

export async function POST(request: Request) {
  const client =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const previous = lastSeen.get(client) ?? 0;
  if (now - previous < THROTTLE_WINDOW_MS) {
    return NextResponse.json(
      { ok: false, code: "rate_limited", message: MESSAGE_FOR_CODE.rate_limited },
      { status: 429 },
    );
  }
  lastSeen.set(client, now);

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return NextResponse.json(
      { ok: false, code: "bad_input", message: MESSAGE_FOR_CODE.bad_input },
      { status: 400 },
    );
  }
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json(
      { ok: false, code: "bad_input", message: MESSAGE_FOR_CODE.bad_input },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { ok: false, code: "bad_input", message: MESSAGE_FOR_CODE.bad_input },
      { status: 400 },
    );
  }

  const checked = validateMatchInput(body);
  if (!checked.ok) {
    return NextResponse.json(
      { ok: false, code: "bad_input", message: MESSAGE_FOR_CODE.bad_input },
      { status: 400 },
    );
  }

  const result: MatchResult = await matchRequest(checked.value.draft, {
    apiKey: process.env.MODEL_API_KEY,
    localStories: checked.value.localStories,
  });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code, message: MESSAGE_FOR_CODE[result.code] },
      { status: STATUS_FOR_CODE[result.code] },
    );
  }
  // Application data only; credentials are never included.
  return NextResponse.json({ ok: true, matches: result.matches });
}
