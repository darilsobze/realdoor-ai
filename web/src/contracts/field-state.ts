import { z } from "zod";

/**
 * Field lifecycle state machine (deep guide §10.3.4 / §11.4).
 *
 *   proposed → confirmed
 *   proposed → corrected → confirmed
 *   proposed → rejected
 *   proposed → unresolved            (unable_to_extract lands here)
 *   unresolved → corrected           (renter types the value by hand)
 *   corrected → corrected            (re-edit before confirming)
 *   confirmed → superseded_by_new_confirmation
 *
 * Any transition not listed below is illegal and throws.
 */
export const FieldStateSchema = z.enum([
  "proposed",
  "corrected",
  "confirmed",
  "rejected",
  "unresolved",
  "superseded",
]);
export type FieldState = z.infer<typeof FieldStateSchema>;

export const FieldEventSchema = z.enum([
  "confirm",
  "correct",
  "reject",
  "mark_unresolved",
  "supersede",
]);
export type FieldEvent = z.infer<typeof FieldEventSchema>;

const TRANSITIONS: Record<FieldState, Partial<Record<FieldEvent, FieldState>>> = {
  proposed: {
    confirm: "confirmed",
    correct: "corrected",
    reject: "rejected",
    mark_unresolved: "unresolved",
  },
  corrected: {
    confirm: "confirmed",
    correct: "corrected",
    reject: "rejected",
  },
  confirmed: {
    supersede: "superseded",
  },
  unresolved: {
    correct: "corrected",
  },
  rejected: {},
  superseded: {},
};

export class IllegalTransitionError extends Error {
  constructor(state: FieldState, event: FieldEvent) {
    super(`Illegal field transition: "${event}" is not allowed from state "${state}"`);
    this.name = "IllegalTransitionError";
  }
}

export function transitionField(state: FieldState, event: FieldEvent): FieldState {
  const next = TRANSITIONS[state][event];
  if (!next) throw new IllegalTransitionError(state, event);
  return next;
}

export function canTransition(state: FieldState, event: FieldEvent): boolean {
  return TRANSITIONS[state][event] !== undefined;
}

/** Extraction confidence as words; numbers are secondary (design brief). */
export const ConfidenceTierSchema = z.enum(["high", "medium", "none"]);
export type ConfidenceTier = z.infer<typeof ConfidenceTierSchema>;

/** The five confirmation statuses (CLAUDE.md), derived — never stored twice. */
export const ConfirmationStatusSchema = z.enum([
  "high_confidence_unconfirmed",
  "low_confidence_review_required",
  "confirmed_by_renter",
  "corrected_by_renter",
  "unable_to_extract",
]);
export type ConfirmationStatus = z.infer<typeof ConfirmationStatusSchema>;

/**
 * Derive the display status from lifecycle state + confidence.
 * Returns null for states that are not shown as field statuses
 * (rejected, superseded — those rows leave the review list).
 */
export function deriveConfirmationStatus(
  state: FieldState,
  confidence: ConfidenceTier,
  wasCorrected: boolean,
): ConfirmationStatus | null {
  switch (state) {
    case "unresolved":
      return "unable_to_extract";
    case "confirmed":
      return wasCorrected ? "corrected_by_renter" : "confirmed_by_renter";
    case "proposed":
      return confidence === "high"
        ? "high_confidence_unconfirmed"
        : "low_confidence_review_required";
    case "corrected":
      // Edited but not yet explicitly confirmed — still requires review.
      return "low_confidence_review_required";
    case "rejected":
    case "superseded":
      return null;
  }
}
