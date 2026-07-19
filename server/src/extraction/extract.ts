// Provider-agnostic extraction call: request -> zod validate -> retry exactly
// once with the validation error -> abstain. The schema is never loosened.
//
// Run-to-run stability: when the FIRST response is schema-valid but omits
// fields its own classification says the document normally shows, make one
// targeted completeness follow-up for just those fields. Matching and
// normalization still gate every added value, so abstention is not loosened —
// unreadable stays unreadable. At most two provider calls per document either way.
import { provider } from "./provider.ts";
import {
  EXPECTED_FIELDS,
  ExtractionAbstained,
  LlmExtractionSchema,
  type LlmExtraction,
  type ProviderPage,
} from "./schema.ts";

function missingExpected(llm: LlmExtraction): string[] {
  const have = new Set(llm.fields.map((f) => f.field_name));
  return (EXPECTED_FIELDS[llm.document_type] ?? []).filter((f) => !have.has(f));
}

async function completenessFollowUp(
  pages: ProviderPage[],
  firstResult: LlmExtraction,
): Promise<LlmExtraction> {
  const missing = missingExpected(firstResult);
  if (missing.length === 0) return firstResult;

  const second = await provider.requestExtraction(pages, {
    previousOutput: JSON.stringify(firstResult),
    validationError:
      `The output omitted fields a ${firstResult.document_type} normally shows: ` +
      `${missing.join(", ")}. Add each of these ONLY if its value is clearly readable ` +
      `in the page image; keep it omitted if it is genuinely absent or unreadable.`,
  });
  const reparsed = LlmExtractionSchema.safeParse(second);
  if (!reparsed.success) return firstResult; // keep the valid first answer

  // Adopt only the previously-missing fields; the first answer stays the base.
  const additions = reparsed.data.fields.filter((f) => missing.includes(f.field_name));
  return { ...firstResult, fields: [...firstResult.fields, ...additions] };
}

export async function extractFields(pages: ProviderPage[]): Promise<LlmExtraction> {
  const first = await provider.requestExtraction(pages);
  const parsed = LlmExtractionSchema.safeParse(first);
  if (parsed.success) return completenessFollowUp(pages, parsed.data);

  // Schema-invalid: one retry with the validation error, then abstain.
  // (No completeness pass here — two provider calls per document is the cap.)
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
