import rulesData from "../../../data/rules/rules.json" with { type: "json" };
import { RulesFileSchema, type RulesFile } from "../../../web/src/contracts/index.ts";

const frozenCorpus: RulesFile = RulesFileSchema.parse(rulesData);

export function getRulesCorpus(): RulesFile {
  return frozenCorpus;
}
