// Session-scoped review store: the extraction result plus each field's
// lifecycle state (contracts/field-state machine), the profile version
// counter and change log. The model's original output is never overwritten —
// corrections live in correctedValue, confirmations in confirmedValue.
//
// Inline edits are component-local drafts; the store only changes on the
// explicit Confirm (after the "What will update" preview), so every stored
// state change goes through transitionField().
import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import {
  transitionField,
  type ChangeLogEntry,
  type ExtractedField,
  type ExtractionResult,
  type FieldState,
} from "@/contracts";

export interface ReviewField {
  /** The validated extraction output — read-only evidence record. */
  extracted: ExtractedField;
  state: FieldState;
  correctedValue: string | null;
  confirmedValue: string | number | null;
  correctedAt: string | null;
  confirmedAt: string | null;
  wasCorrected: boolean;
}

export interface ReviewState {
  sessionId: string | null;
  document: { id: string; displayName: string } | null;
  fields: ReviewField[];
  /** Renter-stated, never extracted — selects the income-limit table row. */
  householdSize: { value: number | null; confirmedAt: string | null };
  profileVersion: number;
  changeLog: ChangeLogEntry[];
  /** Timestamp of the last confirmed change; derived calculations use it as
   *  computed_at so recomputation is deterministic per profile version. */
  lastChangedAt: string;
  /** Extracted-field id whose evidence is highlighted in the viewer. */
  selectedId: string | null;
}

const initialState: ReviewState = {
  sessionId: null,
  document: null,
  fields: [],
  householdSize: { value: null, confirmedAt: null },
  profileVersion: 1,
  changeLog: [],
  lastChangedAt: "",
  selectedId: null,
};

type Action =
  | {
      type: "initialize";
      sessionId: string;
      document: { id: string; displayName: string };
      extraction: ExtractionResult;
    }
  | { type: "select"; id: string | null }
  /** Explicit renter confirmation. With correctedValue: proposed/unresolved →
   *  corrected → confirmed; without: proposed → confirmed. recomputedOutputs
   *  comes from diffing REAL engine records (lib/calculations.diffOutputs). */
  | { type: "confirm"; id: string; correctedValue?: string; recomputedOutputs: string[] }
  /** Renter states household size (attestation, not extraction). */
  | { type: "set_household_size"; value: number; recomputedOutputs: string[] };

function reducer(state: ReviewState, action: Action): ReviewState {
  switch (action.type) {
    case "initialize":
      return {
        ...initialState,
        sessionId: action.sessionId,
        document: action.document,
        lastChangedAt: new Date().toISOString(),
        fields: action.extraction.fields.map((extracted) => ({
          extracted,
          state: extracted.state,
          correctedValue: null,
          confirmedValue: null,
          correctedAt: null,
          confirmedAt: null,
          wasCorrected: false,
        })),
      };
    case "select":
      return { ...state, selectedId: action.id };
    case "confirm": {
      const target = state.fields.find((f) => f.extracted.id === action.id);
      if (!target) return state;
      const now = new Date().toISOString();

      let nextFieldState: FieldState = target.state;
      if (action.correctedValue !== undefined) {
        if (nextFieldState === "confirmed") {
          // Correcting an already-confirmed value: the old revision is
          // superseded (deep guide §11.3) and a new revision runs
          // proposed → corrected → confirmed. transitionField validates
          // the supersede is legal before we spawn the new revision.
          transitionField(nextFieldState, "supersede");
          nextFieldState = "proposed";
        }
        nextFieldState = transitionField(nextFieldState, "correct");
      }
      nextFieldState = transitionField(nextFieldState, "confirm");

      const wasCorrected = target.wasCorrected || action.correctedValue !== undefined;
      const nextVersion = state.profileVersion + 1;
      const entry: ChangeLogEntry = {
        version: nextVersion,
        timestamp: now,
        changed: [target.extracted.field_name],
        recomputed_outputs: action.recomputedOutputs,
      };

      return {
        ...state,
        profileVersion: nextVersion,
        changeLog: [...state.changeLog, entry],
        lastChangedAt: now,
        fields: state.fields.map((f) =>
          f.extracted.id === action.id
            ? {
                ...f,
                state: nextFieldState,
                wasCorrected,
                correctedValue: action.correctedValue ?? f.correctedValue,
                correctedAt: action.correctedValue !== undefined ? now : f.correctedAt,
                confirmedValue:
                  action.correctedValue ??
                  f.extracted.normalized_value ??
                  f.extracted.raw_text,
                confirmedAt: now,
              }
            : f,
        ),
      };
    }
    case "set_household_size": {
      const now = new Date().toISOString();
      const nextVersion = state.profileVersion + 1;
      return {
        ...state,
        householdSize: { value: action.value, confirmedAt: now },
        profileVersion: nextVersion,
        lastChangedAt: now,
        changeLog: [
          ...state.changeLog,
          {
            version: nextVersion,
            timestamp: now,
            changed: ["household_size"],
            recomputed_outputs: action.recomputedOutputs,
          },
        ],
      };
    }
  }
}

const ReviewContext = createContext<{
  state: ReviewState;
  dispatch: Dispatch<Action>;
} | null>(null);

export function ReviewProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>;
}

export function useReview() {
  const ctx = useContext(ReviewContext);
  if (!ctx) throw new Error("useReview must be used inside <ReviewProvider>");
  return ctx;
}
