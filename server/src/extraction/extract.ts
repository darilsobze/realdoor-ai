// Provider-agnostic extraction call: request -> zod validate -> retry exactly
// once with the validation error -> abstain. The schema is never loosened.
import { provider } from "./provider.ts";
import {
  ExtractionAbstained,
  LlmExtractionSchema,
  type LlmExtraction,
  type ProviderPage,
} from "./schema.ts";

export async function extractFields(pages: ProviderPage[]): Promise<LlmExtraction> {
  const first = await provider.requestExtraction(pages);
  const parsed = LlmExtractionSchema.safeParse(first);
  if (parsed.success) return parsed.data;

  const second = await provider.requestExtraction(pages, {
    previousOutput: JSON.stringify(first),
    validationError: parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; "),
  });
  const reparsed = LlmExtractionSchema.safeParse(second);
  if (reparsed.success) return reparsed.data;

  throw new ExtractionAbstained(
    "Extraction output failed schema validation twice; abstaining rather than loosening the schema.",
  );
}
