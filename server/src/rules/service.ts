import type { RulesFile } from "../../../web/src/contracts/index.ts";
import { getRulesCorpus } from "./corpus.ts";
import { RulesLlmOutputSchema, type RulesRetryContext } from "./schema.ts";

export interface ConfirmedRulesContext {
  program_id?: string;
  metro_id?: string;
  rule_year?: number;
}

export const DEFAULT_RULES_CONTEXT: Required<ConfirmedRulesContext> = {
  program_id: "LIHTC",
  metro_id: "boston_cambridge_quincy_ma_nh_hmfa",
  rule_year: 2026,
};

export interface RulesQuestionProvider {
  readonly name: string;
  isConfigured(): boolean;
  requestAnswer(
    question: string,
    corpus: RulesFile,
    retry?: RulesRetryContext,
  ): Promise<unknown>;
}

export interface RulesCitation {
  rule_id: string;
  authority: string;
  program_id: string;
  metro_id: string;
  rule_year: number;
  rule_version: string;
  effective_date: string;
  official_source: string;
  page: number | string | null;
  section: string | null;
  table_id: string | null;
}

export interface RulesAnswer {
  answer: string;
  citation: RulesCitation | null;
  abstained: boolean;
  refusal: boolean;
}

const ABSTENTION =
  "No authoritative rule in the frozen corpus supports this question, so no conclusion was generated.";

function abstain(): RulesAnswer {
  return { answer: ABSTENTION, citation: null, abstained: true, refusal: false };
}

const SUPPORTED_METRO_ID = "boston_cambridge_quincy_ma_nh_hmfa";
const SUPPORTED_METRO_NAMES = /\b(?:Boston|Cambridge|Quincy)(?:[-\s,]+(?:Cambridge|Quincy|MA|NH))*\b/i;

function requestedYearFromQuestion(question: string): number | null {
  const years = [...question.matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1]));
  const uniqueYears = [...new Set(years)];
  if (uniqueYears.length > 1) return -1;
  return uniqueYears[0] ?? null;
}

function requestedProgramFromQuestion(question: string): string | null {
  const supported = /\b(?:LIHTC|low[-\s]income housing tax credit)\b/i.test(question);
  const unsupported = /\b(?:section\s*8|housing choice voucher|public housing)\b/i.test(question);
  if (supported && unsupported) return "conflicting_housing_programs";
  if (supported) return "LIHTC";
  if (unsupported) {
    return "unsupported_housing_program";
  }
  return null;
}

function requestedMetroFromQuestion(question: string): string | null {
  const comparison = question.match(
    /\b([a-z][a-z-]*(?:\s+[a-z][a-z-]*){0,3})\s+(?:vs\.?|versus|and)\s+([a-z][a-z-]*(?:\s+[a-z][a-z-]*){0,3})(?=\s+(?:income\s+)?limits?\b)/i,
  );
  if (comparison) {
    const leftSupported = SUPPORTED_METRO_NAMES.test(comparison[1]);
    const rightSupported = SUPPORTED_METRO_NAMES.test(comparison[2]);
    if (leftSupported && rightSupported) return SUPPORTED_METRO_ID;
    return "conflicting_or_unsupported_metros";
  }
  if (SUPPORTED_METRO_NAMES.test(question)) return SUPPORTED_METRO_ID;
  const leadingFor = question.match(
    /^\s*for\s+([a-z][a-z-]*(?:\s+[a-z][a-z-]*){0,3})\s*,/i,
  );
  const afterMetric = question.match(
    /\b(?:threshold|income limit|limit)\s+(?:in|for)\s+([a-z][a-z-]*(?:\s+[a-z][a-z-]*){0,3})(?=\s*(?:[?.!,]|$))/i,
  );
  const beforeMetric = question.match(
    /\b([a-z][a-z-]*(?:\s+[a-z][a-z-]*){0,5})\s+(?:metro|hmfa|threshold|income limit)\b/i,
  );
  const beforeHousehold = question.match(
    /\b([a-z][a-z-]*(?:\s+[a-z][a-z-]*){0,3})\s+(?:household|resident|applicant|family)\b/i,
  );
  const raw = leadingFor?.[1] ?? afterMetric?.[1] ?? beforeMetric?.[1] ?? beforeHousehold?.[1];
  if (!raw) return null;
  const leadingStopWords = new Set([
    "what", "which", "how", "much", "can", "could", "would", "is", "are", "the", "a", "an", "for",
  ]);
  const nonLocationWords = new Set([
    "household", "size", "frozen", "percent", "income", "ami", "mtsp", "lihtc", "my", "our", "this",
  ]);
  const words = raw.toLowerCase().split(/\s+/).filter(Boolean);
  while (words.length > 0 && leadingStopWords.has(words[0])) words.shift();
  if (words.length === 0 || words.some((word) => nonLocationWords.has(word))) return null;
  return words.join("_").replace(/[^a-z0-9_]+/g, "");
}

function requiresDeterministicMetro(question: string): boolean {
  return /\b(?:thresholds?|income limits?|how much\b.{0,30}\bearn|household\b.{0,30}\bearn)\b/i.test(question);
}

function scopeMatches(
  rule: RulesFile["rules"][number],
  output: ReturnType<typeof RulesLlmOutputSchema.parse>,
  question: string,
  context?: ConfirmedRulesContext,
): boolean {
  const programs = [
    context?.program_id,
    output.requested_program_id,
    requestedProgramFromQuestion(question),
  ];
  const metros = [
    context?.metro_id,
    output.requested_metro_id,
    requestedMetroFromQuestion(question),
  ];
  const years = [
    context?.rule_year,
    output.requested_rule_year,
    requestedYearFromQuestion(question),
  ];
  const deterministicMetro = context?.metro_id ?? requestedMetroFromQuestion(question);
  if (requiresDeterministicMetro(question) && !deterministicMetro) return false;
  return (
    programs.every((program) => !program || program === rule.citation.program_id) &&
    metros.every((metro) => !metro || metro === rule.citation.metro_id) &&
    years.every((year) => !year || year === rule.citation.rule_year)
  );
}

function buildAnswer(
  raw: unknown,
  corpus: RulesFile,
  question: string,
  context?: ConfirmedRulesContext,
): RulesAnswer | null {
  const parsed = RulesLlmOutputSchema.safeParse(raw);
  if (!parsed.success) return null;
  const output = parsed.data;
  if (output.abstained || !output.rule_id) return abstain();
  const rule = corpus.rules.find((candidate) => candidate.rule_id === output.rule_id);
  if (!rule || !scopeMatches(rule, output, question, context)) return abstain();
  return {
    answer: output.answer,
    abstained: false,
    refusal: false,
    citation: {
      rule_id: rule.rule_id,
      authority: rule.authority,
      ...rule.citation,
      effective_date: rule.citation.effective_date ?? corpus.frozen_at,
    },
  };
}

export async function askRulesQuestion(
  question: string,
  context: ConfirmedRulesContext | undefined,
  provider: RulesQuestionProvider,
): Promise<RulesAnswer> {
  const corpus = getRulesCorpus();
  const effectiveContext = context ?? DEFAULT_RULES_CONTEXT;
  const firstRaw = await provider.requestAnswer(question, corpus);
  const first = buildAnswer(firstRaw, corpus, question, effectiveContext);
  if (first) return first;

  const validation = RulesLlmOutputSchema.safeParse(firstRaw);
  const retryRaw = await provider.requestAnswer(question, corpus, {
    previousOutput: JSON.stringify(firstRaw),
    validationError: validation.success
      ? "The response could not be tied to a supported corpus rule."
      : validation.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
  });
  return buildAnswer(retryRaw, corpus, question, effectiveContext) ?? abstain();
}
