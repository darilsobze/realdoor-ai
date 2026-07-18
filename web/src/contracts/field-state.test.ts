import { describe, expect, it } from "vitest";
import {
  IllegalTransitionError,
  canTransition,
  deriveConfirmationStatus,
  transitionField,
  type FieldEvent,
  type FieldState,
} from "./field-state";

describe("field state machine (deep guide §10.3.4)", () => {
  it.each([
    ["proposed", "confirm", "confirmed"],
    ["proposed", "correct", "corrected"],
    ["proposed", "reject", "rejected"],
    ["proposed", "mark_unresolved", "unresolved"],
    ["corrected", "confirm", "confirmed"],
    ["corrected", "correct", "corrected"],
    ["corrected", "reject", "rejected"],
    ["confirmed", "supersede", "superseded"],
    ["unresolved", "correct", "corrected"],
  ] as [FieldState, FieldEvent, FieldState][])(
    "allows %s --%s--> %s",
    (from, event, to) => {
      expect(transitionField(from, event)).toBe(to);
    },
  );

  it.each([
    ["proposed", "supersede"],
    ["confirmed", "confirm"],
    ["confirmed", "correct"], // corrections after confirm go via supersede + new revision
    ["confirmed", "reject"],
    ["rejected", "confirm"],
    ["rejected", "correct"],
    ["superseded", "confirm"],
    ["superseded", "supersede"],
    ["unresolved", "confirm"], // cannot confirm a value that was never proposed/entered
    ["unresolved", "mark_unresolved"],
    ["corrected", "mark_unresolved"],
  ] as [FieldState, FieldEvent][])(
    "rejects %s --%s-->",
    (from, event) => {
      expect(() => transitionField(from, event)).toThrow(IllegalTransitionError);
      expect(canTransition(from, event)).toBe(false);
    },
  );

  it("full corrected path: proposed → corrected → confirmed", () => {
    const s1 = transitionField("proposed", "correct");
    const s2 = transitionField(s1, "confirm");
    expect(s2).toBe("confirmed");
  });
});

describe("deriveConfirmationStatus (CLAUDE.md confirmation statuses)", () => {
  it("maps unresolved to unable_to_extract", () => {
    expect(deriveConfirmationStatus("unresolved", "none", false)).toBe(
      "unable_to_extract",
    );
  });
  it("maps proposed+high to high_confidence_unconfirmed", () => {
    expect(deriveConfirmationStatus("proposed", "high", false)).toBe(
      "high_confidence_unconfirmed",
    );
  });
  it("maps proposed+medium to low_confidence_review_required", () => {
    expect(deriveConfirmationStatus("proposed", "medium", false)).toBe(
      "low_confidence_review_required",
    );
  });
  it("maps confirmed without correction to confirmed_by_renter", () => {
    expect(deriveConfirmationStatus("confirmed", "high", false)).toBe(
      "confirmed_by_renter",
    );
  });
  it("maps confirmed after correction to corrected_by_renter", () => {
    expect(deriveConfirmationStatus("confirmed", "high", true)).toBe(
      "corrected_by_renter",
    );
  });
  it("pending correction still requires review", () => {
    expect(deriveConfirmationStatus("corrected", "high", true)).toBe(
      "low_confidence_review_required",
    );
  });
  it("hidden states return null", () => {
    expect(deriveConfirmationStatus("rejected", "high", false)).toBeNull();
    expect(deriveConfirmationStatus("superseded", "high", false)).toBeNull();
  });
});
