import OpenAI from "openai";
import type { RulesFile } from "../../../../web/src/contracts/index.ts";
import {
  buildRulesRetryText,
  buildRulesUserText,
  RULES_OUTPUT_JSON_SCHEMA,
  RULES_SYSTEM_PROMPT,
  type RulesRetryContext,
} from "../schema.ts";
import type { RulesQuestionProvider } from "../service.ts";

const MODEL = "gpt-5-mini";

let client: OpenAI | null = null;
function getClient(): OpenAI {
  client ??= new OpenAI();
  return client;
}

export const openaiRulesProvider: RulesQuestionProvider = {
  name: `openai:${MODEL}`,
  isConfigured: () => Boolean(process.env.OPENAI_API_KEY),

  async requestAnswer(
    question: string,
    corpus: RulesFile,
    retry?: RulesRetryContext,
  ): Promise<unknown> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: RULES_SYSTEM_PROMPT },
      { role: "user", content: buildRulesUserText(question, corpus) },
    ];
    if (retry) messages.push({ role: "user", content: buildRulesRetryText(retry) });

    const completion = await getClient().chat.completions.create({
      model: MODEL,
      max_completion_tokens: 4096,
      reasoning_effort: "medium",
      seed: 20260718,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "rules_answer",
          strict: true,
          schema: RULES_OUTPUT_JSON_SCHEMA as unknown as Record<string, unknown>,
        },
      },
      messages,
    });

    const message = completion.choices[0]?.message;
    if (!message || message.refusal || !message.content) return null;
    try {
      return JSON.parse(message.content);
    } catch {
      return null;
    }
  },
};
