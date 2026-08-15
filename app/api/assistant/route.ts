import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * The ward assistant endpoint.
 *
 * The key is read from the server process and never leaves it — no
 * NEXT_PUBLIC_ prefix, no key in any client bundle, no key echoed back.
 *
 * The model's job here is deliberately narrow: given the ward's own chart
 * lines, decide which patients answer the question and write one summary
 * sentence. It returns patient ids, not prose about patients. The client then
 * builds every row from its own records, so a hallucinated name or a
 * hallucinated lab value has nowhere to enter — an id that does not exist is
 * dropped, and the quotes come from the chart either way.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUESTION = 400;
const MAX_DIGEST = 60000;

const AnswerSchema = z.object({
  headline: z.string().min(1).max(400),
  patientIds: z.array(z.string().min(1).max(64)).max(64),
  note: z.string().max(400).nullable(),
});

const ANSWER_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "patientIds", "note"],
  properties: {
    headline: {
      type: "string",
      description:
        "משפט אחד בעברית שעונה על השאלה. מותר לספור ולסכם, אסור להוסיף מידע קליני שאינו מופיע ברשומות.",
    },
    patientIds: {
      type: "array",
      items: { type: "string" },
      description:
        "מזהי המטופלים שעונים על השאלה, בסדר הרלוונטיות. רק מזהים שמופיעים ברשומות שסופקו.",
    },
    note: {
      type: ["string", "null"],
      description:
        "הסתייגות קצרה אם השאלה עמומה או אם המידע חלקי. null כשאין מה להסתייג.",
    },
  },
} as const;

const SYSTEM = `אתה עוזר מחלקה באפליקציה קלינית. אתה מקבל את רשומות המחלקה — כל שורה שמופיעה בהן — ושאלה של רופא.

חוקים:
1. ענה רק ממה שכתוב ברשומות שסופקו. אין לך ידע אחר על המטופלים האלה.
2. אל תמציא ערכים, שמות, תרופות או אבחנות. אם המידע לא מופיע — אמור זאת ב-headline.
3. patientIds חייב להכיל רק מזהים שמופיעים ברשומות. אל תמציא מזהה.
4. headline הוא משפט אחד. ספירה וסיכום מותרים; פרשנות קלינית או המלצת טיפול — לא.
5. אם השאלה אינה על המחלקה, אמור זאת ב-headline והחזר patientIds ריק.

הנתונים בדיוניים לחלוטין ומיועדים להדגמה.`;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // A designed operating mode, not an error: the client falls back to the
    // deterministic retrieval engine and says so.
    return NextResponse.json({ ok: false, reason: "no-api-key" }, { status: 503 });
  }

  let question: string;
  let digest: string;
  try {
    const body = (await request.json()) as { question?: unknown; digest?: unknown };
    if (typeof body.question !== "string" || !body.question.trim()) {
      return NextResponse.json({ ok: false, reason: "empty-question" }, { status: 400 });
    }
    if (typeof body.digest !== "string" || !body.digest.trim()) {
      return NextResponse.json({ ok: false, reason: "bad-request" }, { status: 400 });
    }
    question = body.question.slice(0, MAX_QUESTION);
    digest = body.digest.slice(0, MAX_DIGEST);
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 4000,
      system: SYSTEM,
      output_config: {
        format: { type: "json_schema", schema: ANSWER_JSON_SCHEMA },
        // The doctor is waiting on this mid-round; selecting patients from
        // supplied text does not need deep reasoning. Thinking stays on (the
        // default) — disabling it on this model can leak internal tags into
        // the response and corrupt the JSON.
        effort: "low",
      },
      messages: [
        {
          role: "user",
          content: `רשומות המחלקה:\n\n${digest}\n\n---\n\nשאלה: ${question}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ ok: false, reason: "refused" }, { status: 422 });
    }
    if (response.stop_reason === "max_tokens") {
      return NextResponse.json({ ok: false, reason: "truncated" }, { status: 502 });
    }

    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) {
      return NextResponse.json({ ok: false, reason: "empty-response" }, { status: 502 });
    }

    const parsed = AnswerSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, reason: "malformed" }, { status: 502 });
    }

    return NextResponse.json({ ok: true, answer: parsed.data });
  } catch (err) {
    // Never surface upstream error text — it can carry request details.
    const status = err instanceof Anthropic.APIError && err.status === 429 ? 429 : 502;
    return NextResponse.json(
      { ok: false, reason: status === 429 ? "rate-limited" : "unavailable" },
      { status },
    );
  }
}
