/**
 * Core domain types for RealDoor Application-Readiness Copilot.
 * Model-proposed, user-corrected, and confirmed values are STRICTLY separated.
 * Only `confirmed` state feeds calculations and the packet.
 */

export type SourceRegion = {
  page: number;
  /** normalized fixture coordinates or backend PDF points. */
  bbox: { x: number; y: number; w: number; h: number };
  space?: "normalized" | "pdf_points";
  /** short label describing the region, e.g. "Gross pay row" */
  label: string;
};

export type FieldName =
  | "gross_pay"
  | "pay_period_start"
  | "pay_period_end"
  | "pay_frequency"
  | "benefit_amount"
  | "benefit_frequency"
  | "document_date"
  | "document_type"
  | "employer_name"
  | "gross_pay_period"
  | "pay_period"
  | "pay_date"
  | "annual_gross_income"
  | "benefit_monthly_amount"
  | "benefit_effective_date"
  | "benefit_expiry_date"
  | "household_member_name"
  | "lease_monthly_rent"
  | "id_expiry_date";

export const ALLOWLISTED_FIELDS: FieldName[] = [
  "gross_pay",
  "pay_period_start",
  "pay_period_end",
  "pay_frequency",
  "benefit_amount",
  "benefit_frequency",
  "document_date",
  "document_type",
  "employer_name",
  "gross_pay_period",
  "pay_period",
  "pay_date",
  "annual_gross_income",
  "benefit_monthly_amount",
  "benefit_effective_date",
  "benefit_expiry_date",
  "household_member_name",
  "lease_monthly_rent",
  "id_expiry_date",
];

export type DocumentKind = "paystub" | "benefit_letter" | "id" | "lease" | "other";

export type SyntheticDocument = {
  id: string;
  kind: DocumentKind;
  displayName: string;
  synthetic: boolean;
  backendSessionId?: string;
  pageImages: string[]; // SVG data URLs
  /** raw text of the document — always treated as UNTRUSTED */
  rawText: string;
  /** simulated extraction proposals for this doc */
  proposedFields: ExtractedField[];
  /** optional embedded prompt injection payload, for the safety demo */
  injection?: string;
  issuedOn?: string; // ISO date
  expiresOn?: string; // ISO date
};

export type ProposedValue = string | number;

export type ExtractedField = {
  id: string;
  docId: string;
  name: FieldName;
  label: string;
  proposedValue: ProposedValue | null;
  rawText?: string | null;
  modelProposedValue?: ProposedValue | null;
  normalizedValue?: ProposedValue | null;
  unit?: string;
  confidence: number | null; // 0..1
  confidenceTier?: "high" | "medium" | "none";
  state?: "unresolved" | "proposed" | "corrected" | "confirmed" | "superseded";
  abstentionReason?: string | null;
  extractionVersion?: string;
  source: SourceRegion | null;
};

export type ConfirmationStatus = "unreviewed" | "confirmed" | "corrected" | "rejected";

export type ConfirmedField = {
  fieldId: string;
  docId: string;
  name: FieldName;
  status: ConfirmationStatus;
  /** value at time of confirmation — either proposed or corrected */
  value: ProposedValue;
  correctedFromProposed: boolean;
  confirmedAt: string; // ISO
};

export type ProgramConfig = {
  program: string;
  metro: string;
  year: string;
  ruleVersion: string;
  effectiveDate: string;
  simulated: true;
  simulatedNotice: string;
};

export type RuleRecord = {
  id: string;
  program: string;
  year: string;
  ruleVersion: string;
  section: string;
  title: string;
  bodyText: string;
  sourceUrl: string;
  effectiveDate: string;
  simulated: true;
  /** for numeric thresholds */
  threshold?: {
    /** e.g. income limit table keyed by household size */
    tableName: string;
    values: Record<string, number>;
    unit: string;
  };
  formulaVersion?: string;
  limitations: string[];
};

export type ChecklistStatus =
  "confirmed" | "needs_confirmation" | "missing" | "expired" | "conflicting" | "rule_unavailable";

export type ChecklistItemDef = {
  id: string;
  label: string;
  description: string;
  requiredFieldNames: FieldName[];
  requiredDocKinds: DocumentKind[];
  ruleRefId?: string;
};

export type ChecklistItemResult = {
  def: ChecklistItemDef;
  status: ChecklistStatus;
  reasonText: string;
  evidenceFieldIds: string[];
  ruleRefId?: string;
};

export type CalculationResult = {
  id: string;
  label: string;
  formulaVersion: string;
  inputs: { name: FieldName; value: ProposedValue; fieldId: string }[];
  steps: string[];
  result: { value: number; unit: string };
  ruleRefIds: string[];
  simulated: true;
};

export type InjectionAttempt = {
  id: string;
  docId: string;
  detectedText: string;
  detectedAt: string;
  action: "ignored";
};

export type RefusalEvent = {
  id: string;
  prompt: string;
  reason: string;
  redirectedTo: string;
  at: string;
};
