import type { ProgramConfig, RuleRecord, ChecklistItemDef } from "./types";

/**
 * PLACEHOLDER program configuration — all values are SIMULATED and marked as such.
 * Swap this file to change metro/program/rule year in one place.
 */
export const PROGRAM_CONFIG: ProgramConfig = {
  program: "Example Affordable Housing Program",
  metro: "Example Metro Area",
  year: "2025",
  ruleVersion: "2025.v1",
  effectiveDate: "2025-04-01",
  simulated: true,
  simulatedNotice:
    "Simulated program data for prototype demo only. Replace with authoritative source before any real use.",
};

/** Simulated rule corpus. Every record is explicitly flagged simulated. */
export const RULES: RuleRecord[] = [
  {
    id: "rule.income_limits",
    program: PROGRAM_CONFIG.program,
    year: PROGRAM_CONFIG.year,
    ruleVersion: PROGRAM_CONFIG.ruleVersion,
    section: "§ 3.2 — Household Income Limits (Simulated)",
    title: "Household income limits by household size",
    bodyText:
      "The published table below lists maximum annual household income by household size for the frozen rule year. This is a simulated table for prototype demonstration; it does not reflect any real program's published limits.",
    sourceUrl: "https://example.gov/simulated/affordable-housing/2025/income-limits",
    effectiveDate: PROGRAM_CONFIG.effectiveDate,
    simulated: true,
    threshold: {
      tableName: "Annual Household Income Limit",
      values: {
        "1": 42000,
        "2": 48000,
        "3": 54000,
        "4": 60000,
        "5": 65000,
        "6": 70000,
      },
      unit: "USD/year",
    },
    formulaVersion: "annualize_pay@v1",
    limitations: [
      "Values are simulated placeholders, not the real 2025 program limits.",
      "Displayed only to demonstrate the citation and traceability pattern.",
      "This copilot does not decide whether any household is eligible.",
    ],
  },
  {
    id: "rule.required_documents",
    program: PROGRAM_CONFIG.program,
    year: PROGRAM_CONFIG.year,
    ruleVersion: PROGRAM_CONFIG.ruleVersion,
    section: "§ 5.1 — Required Documents (Simulated)",
    title: "Documents typically required at application",
    bodyText:
      "Applicants generally must provide proof of identity, current income (pay stub or benefit letter), and current housing information. This checklist is a simulated reference for prototype demonstration and does not replace the program's own instructions.",
    sourceUrl: "https://example.gov/simulated/affordable-housing/2025/required-docs",
    effectiveDate: PROGRAM_CONFIG.effectiveDate,
    simulated: true,
    limitations: [
      "Simulated reference list — verify against the real program before applying.",
      "Presence of a document does not indicate eligibility.",
    ],
  },
  {
    id: "rule.document_currency",
    program: PROGRAM_CONFIG.program,
    year: PROGRAM_CONFIG.year,
    ruleVersion: PROGRAM_CONFIG.ruleVersion,
    section: "§ 5.4 — Document Currency (Simulated)",
    title: "Documents must be current at time of submission",
    bodyText:
      "Pay stubs are typically expected to be from within the last 60 days; benefit letters and IDs must not be expired. Simulated timing rule for prototype demonstration.",
    sourceUrl: "https://example.gov/simulated/affordable-housing/2025/currency",
    effectiveDate: PROGRAM_CONFIG.effectiveDate,
    simulated: true,
    formulaVersion: "document_expiry@v1",
    limitations: [
      "Simulated timing thresholds; the real program may differ.",
      "Applies only to synthetic documents in this prototype.",
    ],
  },
];

export const CHECKLIST: ChecklistItemDef[] = [
  {
    id: "chk.id",
    label: "Photo ID for primary applicant",
    description: "A current, non-expired government-issued photo ID for the person applying.",
    requiredFieldNames: ["id_expiry_date"],
    requiredDocKinds: ["id"],
    ruleRefId: "rule.required_documents",
  },
  {
    id: "chk.income_paystub",
    label: "Recent pay stub or benefit letter",
    description: "Proof of current income within the currency window specified by the program.",
    requiredFieldNames: ["annual_gross_income", "benefit_monthly_amount"],
    requiredDocKinds: ["paystub", "benefit_letter"],
    ruleRefId: "rule.document_currency",
  },
  {
    id: "chk.lease",
    label: "Current lease or housing statement",
    description: "Shows current monthly rent and housing arrangement for the household.",
    requiredFieldNames: ["lease_monthly_rent"],
    requiredDocKinds: ["lease"],
    ruleRefId: "rule.required_documents",
  },
  {
    id: "chk.household_size",
    label: "Household size confirmation",
    description:
      "Names and count of people in the household. Used only when the renter confirms it.",
    requiredFieldNames: ["household_member_name"],
    requiredDocKinds: [],
    ruleRefId: "rule.income_limits",
  },
];
