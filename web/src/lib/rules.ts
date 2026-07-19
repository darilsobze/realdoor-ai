// Load the frozen rule corpus. UI threshold numbers come from HERE (via the
// deterministic engine) — never from LLM text. The JSON is bundled at build
// time from the repo-level data/ directory, the single source of truth.
import rulesJson from "../../../data/rules/rules.json";
import { RulesFileSchema, type Rule, type RulesFile } from "@/contracts";

export const RULES: RulesFile = RulesFileSchema.parse(rulesJson);

/** The scored FY2026 60% MTSP income-limit table (official frozen data). */
export const SCORED_RULE_ID = "HUD-MTSP-002";

export const SCORED_RULE: Rule = (() => {
  const rule = RULES.rules.find((r) => r.rule_id === SCORED_RULE_ID);
  if (!rule?.thresholds) {
    throw new Error(`Rule ${SCORED_RULE_ID} with thresholds missing from rules.json`);
  }
  return rule;
})();

/** The app's single supported scope (one metro, one program, one rule year —
 *  ARCHITECTURE "known limitations"). Sent as confirmedContext on /rules/ask
 *  so metro-sensitive questions resolve instead of abstaining. */
export const APP_SCOPE = {
  program_id: "LIHTC",
  metro_id: "boston_cambridge_quincy_ma_nh_hmfa",
  rule_year: 2026,
} as const;

export function ruleById(ruleId: string): Rule | null {
  return RULES.rules.find((r) => r.rule_id === ruleId) ?? null;
}
