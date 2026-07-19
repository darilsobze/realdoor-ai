// OpenAI implementation of the extraction provider: chat completions with
// Structured Outputs (strict: true) against the shared allowlist schema.
// Sends each page image (base64 data URL) alongside the OCR text.
import OpenAI from "openai";
import {
  buildRetryText,
  buildUserText,
  EXTRACTION_JSON_SCHEMA,
  ExtractionAbstained,
  SYSTEM_PROMPT,
  type ExtractionProvider,
  type ProviderPage,
  type RetryContext,
} from "../schema.ts";

const MODEL = "gpt-5-mini";

let client: OpenAI | null = null;
function getClient(): OpenAI {
  client ??= new OpenAI(); // reads OPENAI_API_KEY from the environment (server/.env)
  return client;
}

function userContent(
  pages: ProviderPage[],
): OpenAI.Chat.ChatCompletionContentPart[] {
  return [
    { type: "text", text: buildUserText(pages) },
    ...pages.map(
      (p): OpenAI.Chat.ChatCompletionContentPart => ({
        type: "image_url",
        image_url: {
          url: `data:image/png;base64,${p.png.toString("base64")}`,
          detail: "high",
        },
      }),
    ),
  ];
}

export const openaiProvider: ExtractionProvider = {
  name: `openai:${MODEL}`,
  configurationHint: "Set OPENAI_API_KEY in server/.env (see server/.env.example).",
  isConfigured: () => Boolean(process.env.OPENAI_API_KEY),

  async requestExtraction(pages: ProviderPage[], retry?: RetryContext): Promise<unknown> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent(pages) },
    ];
    if (retry) {
      messages.push({ role: "user", content: buildRetryText(retry) });
    }

    const completion = await getClient().chat.completions.create({
      model: MODEL,
      // Reasoning tokens count toward this cap — keep headroom above the JSON.
      max_completion_tokens: 8192,
      // "medium": low-effort runs mis-transcribed hard glyph regions
      // inconsistently (e.g. a garbled date), breaking run-to-run stability.
      reasoning_effort: "medium",
      // Best-effort determinism: identical requests should yield identical
      // outputs so the same document extracts the same way on every run.
      seed: 20260718,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "record_extraction",
          strict: true,
          schema: EXTRACTION_JSON_SCHEMA as unknown as Record<string, unknown>,
        },
      },
      messages,
    });

    const message = completion.choices[0]?.message;
    if (!message || message.refusal || !message.content) {
      throw new ExtractionAbstained("Model returned no structured extraction.");
    }
    try {
      return JSON.parse(message.content);
    } catch {
      throw new ExtractionAbstained("Model output was not valid JSON.");
    }
  },
};
