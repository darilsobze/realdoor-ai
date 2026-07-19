const DECISION_REQUESTS = [
  /\b(?:eligible|eligibility|qualif(?:y|ied|ication))\b/i,
  /\b(?:approved?|denied?|accepted?|rejected?)\b/i,
  /\bwhat (?:are|is) (?:my|our) chances\b/i,
  /\b(?:will|would|could|can) (?:i|we) (?:get|be)\b.{0,30}\b(?:approved?|accepted?|denied?|rejected?)\b/i,
  /\b(?:odds|probability|likelihood)\b.{0,30}\b(?:approval|acceptance|qualification)\b/i,
  /\b(?:do|does|will|would)\b.{0,20}\b(?:i|we|my|our)\b.{0,30}\b(?:meet|satisfy|pass)\b.{0,30}\b(?:requirements?|criteria|limits?|threshold)\b/i,
  /\bshould (?:i|we) apply\b/i,
  /\b(?:my|our) income\b.{0,25}\b(?:pass|meet|satisfy)\b.{0,25}\b(?:limits?|threshold|requirements?|criteria)\b/i,
  /\b(?:i|we|my|our|household)\b.{0,45}\b(?:meet|pass|satisfy)\b.{0,30}\b(?:requirements?|criteria|limits?|thresholds?|caps?)\b/i,
  /\b(?:i|we|my|our)\b.{0,35}\b(?:within|under|over|below|above)\b.{0,25}\b(?:income\s+)?(?:limits?|thresholds?|caps?)\b/i,
  /\b(?:this|the|my|our)\s+household\b.{0,40}\b(?:within|under|over|below|above|meet|pass|satisfy)\b.{0,30}\b(?:income\s+)?(?:limits?|thresholds?|caps?|requirements?|criteria)\b/i,
];

export function isDecisionRequest(question: string): boolean {
  return DECISION_REQUESTS.some((pattern) => pattern.test(question));
}

export const DECISION_REFUSAL =
  "I can’t decide or predict eligibility, approval, denial, or acceptance. " +
  "A qualified human makes the final decision. I can show confirmed values, " +
  "the published threshold, the formula, its source and effective date, and any missing items.";
