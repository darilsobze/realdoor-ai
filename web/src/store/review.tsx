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
import { FIELD_DEPENDENTS } from "@/lib/field-meta";

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
  profileVersion: number;
  changeLog: ChangeLogEntry[];
  /** Extracted-field id whose evidence is highlighted in the viewer. */
  selectedId: string | null;
}

const initialState: ReviewState = {
  sessionId: null,
  document: null,
  fields: [],
  profileVersion: 1,
  changeLog: [],
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
   *  corrected → confirmed; without: proposed → confirmed. */
  | { type: "confirm"; id: string; correctedValue?: string };

function reducer(state: ReviewState, action: Action): ReviewState {
  switch (action.type) {
    case "initialize":
      return {
        ...initialState,
        sessionId: action.sessionId,
        document: action.document,
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
        nextFieldState = transitionField(nextFieldState, "correct");
      }
      nextFieldState = transitionField(nextFieldState, "confirm");

      const wasCorrected = target.wasCorrected || action.correctedValue !== undefined;
      const nextVersion = state.profileVersion + 1;
      const entry: ChangeLogEntry = {
        version: nextVersion,
        timestamp: now,
        changed: [target.extracted.field_name],
        recomputed_outputs: FIELD_DEPENDENTS[target.extracted.field_name],
      };

      return {
        ...state,
        profileVersion: nextVersion,
        changeLog: [...state.changeLog, entry],
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
