import { describe, expect, it } from "vitest";
import { createSessionState, sessionReducer } from "./session";
import type { ExtractedField, SyntheticDocument } from "@/domain/types";

const field: ExtractedField = {
  id: "field-1",
  docId: "doc-1",
  name: "gross_pay",
  label: "Gross pay",
  proposedValue: 1580,
  modelProposedValue: "$1,580.00",
  confidence: 0.95,
  confidenceTier: "high",
  state: "proposed",
  unit: "USD",
  source: null,
};

const document: SyntheticDocument = {
  id: "doc-1",
  kind: "paystub",
  displayName: "paystub.pdf",
  synthetic: false,
  backendSessionId: "session-1",
  pageImages: ["/api/page/1"],
  rawText: "",
  proposedFields: [field],
};

describe("session reducer", () => {
  it("stores one backend session while documents append", () => {
    let state = createSessionState();
    state = sessionReducer(state, { type: "set_backend_session", sessionId: "session-1" });
    state = sessionReducer(state, { type: "add_document", doc: document });

    expect(state.backendSessionId).toBe("session-1");
    expect(state.documents).toEqual([document]);
  });

  it("increments profile version while preserving the model proposal", () => {
    let state = createSessionState();
    state = sessionReducer(state, { type: "add_document", doc: document });
    state = sessionReducer(state, {
      type: "confirm_field",
      field,
      value: 1600,
      corrected: true,
    });

    expect(state.profileVersion).toBe(1);
    expect(state.confirmed[field.id]).toMatchObject({ value: 1600, correctedFromProposed: true });
    expect(state.documents[0].proposedFields[0].modelProposedValue).toBe("$1,580.00");
  });

  it("isolates normal and demo modes", () => {
    let state = createSessionState();
    state = sessionReducer(state, { type: "set_mode", mode: "normal" });
    state = sessionReducer(state, { type: "set_backend_session", sessionId: "session-1" });
    state = sessionReducer(state, { type: "add_document", doc: document });
    state = sessionReducer(state, { type: "set_mode", mode: "demo" });

    expect(state.mode).toBe("demo");
    expect(state.backendSessionId).toBeNull();
    expect(state.documents).toEqual([]);
  });
});
