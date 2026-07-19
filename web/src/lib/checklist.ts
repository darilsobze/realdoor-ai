// Load the frozen gold checklist (single source: repo-level data/).
import goldJson from "../../../data/checklist/gold.json";
import { GoldChecklistFileSchema, type GoldChecklistFile } from "@/contracts";

export const GOLD_CHECKLIST: GoldChecklistFile = GoldChecklistFileSchema.parse(goldJson);

export function requirementTitle(requirementId: string): string {
  return (
    GOLD_CHECKLIST.requirements.find((r) => r.requirement_id === requirementId)?.title ??
    requirementId
  );
}
