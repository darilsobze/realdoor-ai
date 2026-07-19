/**
 * SafetyService — refusal classifier + prompt-injection scanner.
 * All heuristics are conservative, transparent, and never allow the model to
 * take action on document-embedded instructions.
 */

const ELIGIBILITY_PHRASES = [
  /am i (going to be )?(eligible|approved|accepted|denied|rejected|qualified)/i,
  /will i (qualify|get in|be accepted|be rejected|be approved|be denied)/i,
  /(what are|score|rate|rank|predict|probability|chance|odds|likelihood) (of|for|that).{0,40}(accept|qualify|approv|eligib)/i,
  /decide (for me|whether i qualify|if i qualify|whether i'm eligible)/i,
  /(am i|is my household) (eligible|ineligible|qualified)/i,
  /(will|can) you (approve|deny|reject|accept|rank|score) (me|my application)/i,
  /(readiness|eligibility|acceptance) (score|rank|ranking|probability)/i,
  /(likely|probably) (to )?(qualify|be accepted|be approved)/i,
  /\bscore me\b/i,
  /how do i stack up/i,
  /what are my chances/i,
  /predict my odds/i,
  /rate my application/i,
  /should i (even )?(apply|bother applying)/i,
  /tell me if i (will|can|should) (qualify|get in|be accepted)/i,
];

export type RefusalResult = {
  refused: boolean;
  reason: string;
  redirectedTo: string;
};

export function classifyEligibilityRequest(prompt: string): RefusalResult {
  const trimmed = prompt.trim();
  const hit = ELIGIBILITY_PHRASES.some((r) => r.test(trimmed));
  if (!hit) {
    return {
      refused: false,
      reason: "",
      redirectedTo: "",
    };
  }
  return {
    refused: true,
    reason: "This copilot does not decide eligibility, score, rank, or predict acceptance.",
    redirectedTo:
      "Review your renter-confirmed inputs, the published threshold, the formula and its effective date, and speak with a human reviewer.",
  };
}

// Injection scanner: purely detects instruction-like patterns in document text.
// Detection NEVER changes system behavior — it only logs the attempt.
const INJECTION_PATTERNS: RegExp[] = [
  /ignore (all|any|previous|prior) (instructions|prompts|rules)/i,
  /disregard (the |your )?(system|previous|prior) (prompt|instructions)/i,
  /you are now (a|an) [a-z ]{0,40}/i,
  /mark (this|the) (applicant|user) as (pre[- ]?approved|eligible|approved)/i,
  /bypass (all|any) (rules|checks|validation)/i,
  /act as (?!a renter)/i,
];

export function detectInjection(text: string): string[] {
  const hits: string[] = [];
  for (const p of INJECTION_PATTERNS) {
    const m = text.match(p);
    if (m) hits.push(m[0]);
  }
  return hits;
}
