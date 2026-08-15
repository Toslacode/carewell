import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import {
  EXTRACTION_JSON_SCHEMA,
  EXTRACTION_SYSTEM_PROMPT,
} from "@/lib/ai/prompt";
import { ExtractionSchema } from "@/lib/schemas/clinical";

/**
 * The AI extraction endpoint.
 *
 * The API key is read from the server process and never leaves it — no
 * NEXT_PUBLIC_ prefix, no key in any client bundle, no key echoed in a
 * response. The browser posts a transcript and receives structured JSON.
 *
 * Every response is validated against the same Zod schema the rule-based
 * extractor is held to. A response that fails validation is reported as a
 * failure, not repaired: the caller then falls back to the deterministic
 * extractor rather than showing a half-parsed record.
 */

export const runtime = "nodejs";
/** Transcripts are patient-adjacent; nothing here is cacheable. */
export const dynamic = "force-dynamic";

const MAX_TRANSCRIPT = 20000;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Not an error condition — the deterministic extractor is a designed
    // operating mode, so the client is told plainly which engine to use.
    return NextResponse.json(
      { ok: false, reason: "no-api-key" },
      { status: 503 },
    );
  }

  let transcript: string;
  try {
    const body = (await request.json()) as { transcript?: unknown };
    if (typeof body.transcript !== "string" || !body.transcript.trim()) {
      return NextResponse.json(
        { ok: false, reason: "empty-transcript" },
        { status: 400 },
      );
    }
    transcript = body.transcript.slice(0, MAX_TRANSCRIPT);
  } catch {
    return NextResponse.json(
      { ok: false, reason: "bad-request" },
      { status: 400 },
    );
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      system: EXTRACTION_SYSTEM_PROMPT,
      output_config: {
        format: { type: "json_schema", schema: EXTRACTION_JSON_SCHEMA },
        // This runs while the doctor is still standing at the bedside, and the
        // task is extraction rather than reasoning — low effort keeps the
        // round moving. Thinking stays on (the default): disabling it on this
        // model can leak internal tags into the response, which would corrupt
        // the JSON we then have to parse.
        effort: "low",
      },
      messages: [{ role: "user", content: transcript }],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { ok: false, reason: "refused" },
        { status: 422 },
      );
    }
    if (response.stop_reason === "max_tokens") {
      // Truncated JSON is unparseable; say so rather than salvaging a fragment.
      return NextResponse.json(
        { ok: false, reason: "truncated" },
        { status: 502 },
      );
    }

    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) {
      return NextResponse.json(
        { ok: false, reason: "empty-response" },
        { status: 502 },
      );
    }

    const parsed = ExtractionSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, reason: "malformed" },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, extraction: parsed.data });
  } catch (err) {
    // Never surface the upstream error text — it can carry request details.
    const status =
      err instanceof Anthropic.APIError && err.status === 429 ? 429 : 502;
    return NextResponse.json(
      { ok: false, reason: status === 429 ? "rate-limited" : "unavailable" },
      { status },
    );
  }
}
