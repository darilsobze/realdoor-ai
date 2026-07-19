import checklist from "../../../data/checklist/gold.json";

export type GoldRequirement = {
  requirement_id: string;
  title: string;
  description: string;
  accepted_document_types: string[];
  freshness_days: number | null;
  min_count: number;
  kind: "document" | "attestation";
};

export type GoldChecklist = {
  checklist_version: string;
  placeholder: boolean;
  requirements: GoldRequirement[];
};

export const GOLD_CHECKLIST = checklist as GoldChecklist;
