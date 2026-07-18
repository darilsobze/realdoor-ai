// Anthropic implementation of the extraction provider (the original C2 path,
// kept so switching back is a one-line change in provider.ts). Forced strict
// tool use against the shared allowlist schema; OCR text only.
import Anthropic from "@anthropic-ai/sdk";
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

const MODEL = "claude-sonnet-4-6";

// `strict` is a GA API field not yet in this SDK version's Tool type.
const EXTRACTION_TOOL = {
  name: "record_extraction",
  description:
    "Record the fields found in the document. Only the listed field names are allowed. " +
    "raw_text must be copied verbatim from the document text. Omit any field that is " +
    "not clearly legible — never guess.",
  strict: true,
  input_schema: EXTRACTION_JSON_SCHEMA,
} as unknown as Anthropic.Tool;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
  return client;
}

export const anthropicProvider: ExtractionProvider = {
  name: `anthropic:${MODEL}`,
  configurationHint: "Set ANTHROPIC_API_KEY in server/.env (see server/.env.example).",
  isConfigured: () => Boolean(process.env.ANTHROPIC_API_KEY),

  async requestExtraction(pages: ProviderPage[], retry?: RetryContext): Promise<unknown> {
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: buildUserText(pages) },
    ];
    if (retry) {
      messages.push({ role: "user", content: buildRetryText(retry) });
    }
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: "tool", name: "record_extraction" },
      messages,
    });
    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (!toolUse) throw new ExtractionAbstained("Model returned no structured extraction.");
    return toolUse.input;
  },
};
