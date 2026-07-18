// Deterministic normalization. The LLM only reads verbatim text off the page;
// ALL value parsing happens here in plain code (CLAUDE.md: the LLM never
// performs arithmetic or supplies numbers).
import type { FieldName, Frequency } from "../../../web/src/contracts/index.ts";
import { DocumentTypeSchema, FrequencySchema } from "../../../web/src/contracts/index.ts";

const MONEY_FIELDS: FieldName[] = ["gross_pay", "benefit_amount"];
const DATE_FIELDS: FieldName[] = ["pay_period_start", "pay_period_end", "document_date"];
const FREQUENCY_FIELDS: FieldName[] = ["pay_frequency", "benefit_frequency"];

/** "$1,580.00" → 1580 (number). Returns null when not parseable as money. */
export function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Known date shapes → ISO "YYYY-MM-DD". US-style M/D/Y for slashed dates. */
export function parseDate(raw: string): string | null {
  const t = raw.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return isoOrNull(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return isoOrNull(+m[3], +m[1], +m[2]);
  m = t.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const month = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (month) return isoOrNull(+m[3], month, +m[2]);
  }
  return null;
}

function isoOrNull(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "Bi-Weekly", "biweekly", "every two weeks" → "biweekly"; unknown otherwise. */
export function parseFrequency(raw: string): Frequency {
  const t = raw.toLowerCase().replace(/[^a-z ]/g, "");
  if (/semi\s*monthly|twice a month/.test(t)) return "semimonthly";
  if (/bi\s*weekly|every two weeks|fortnight/.test(t)) return "biweekly";
  if (/weekly|per week/.test(t)) return "weekly";
  if (/monthly|per month/.test(t)) return "monthly";
  if (/annual|yearly|per year/.test(t)) return "annual";
  return "unknown";
}

export interface Normalized {
  value: string | number | null;
  unit: string | null;
}

/**
 * Field-aware normalization of the verbatim raw_text. A null value means the
 * text could not be normalized deterministically — the caller abstains rather
 * than guessing.
 */
export function normalizeField(field: FieldName, rawText: string): Normalized {
  if (MONEY_FIELDS.includes(field)) {
    return { value: parseMoney(rawText), unit: "USD/pay_period" };
  }
  if (DATE_FIELDS.includes(field)) {
    return { value: parseDate(rawText), unit: null };
  }
  if (FREQUENCY_FIELDS.includes(field)) {
    const f = parseFrequency(rawText);
    // "unknown" is a legal value: it blocks annualization downstream instead of guessing.
    return { value: f, unit: null };
  }
  if (field === "document_type") {
    const parsed = DocumentTypeSchema.safeParse(rawText.trim().toLowerCase().replace(/[\s-]+/g, "_"));
    return { value: parsed.success ? parsed.data : null, unit: null };
  }
  // employer_name: free text, trimmed
  const trimmed = rawText.trim();
  return { value: trimmed.length > 0 ? trimmed : null, unit: null };
}

export { FrequencySchema };
