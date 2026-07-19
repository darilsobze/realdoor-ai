import { createContext, useContext, useMemo, useReducer, useCallback, type ReactNode } from "react";
import type {
  ConfirmedField,
  ExtractedField,
  InjectionAttempt,
  ProposedValue,
  RefusalEvent,
  SyntheticDocument,
} from "@/domain/types";
import { detectInjection } from "@/domain/safety";

export type SessionMode = "normal" | "demo" | null;

export type SessionState = {
  startedAt: string;
  consented: boolean;
  mode: SessionMode;
  householdSize: number | null;
  documents: SyntheticDocument[];
  proposed: ExtractedField[]; // never trusted for math
  confirmed: Record<string, ConfirmedField>; // fieldId → ConfirmedField
  injections: InjectionAttempt[];
  refusals: RefusalEvent[];
  backendSessionId: string | null;
  profileVersion: number;
};

export const createSessionState = (): SessionState => ({
  startedAt: new Date().toISOString(),
  consented: false,
  mode: null,
  householdSize: null,
  documents: [],
  proposed: [],
  confirmed: {},
  injections: [],
  refusals: [],
  backendSessionId: null,
  profileVersion: 0,
});

export type SessionAction =
  | { type: "consent" }
  | { type: "reset" }
  | { type: "set_mode"; mode: SessionMode }
  | { type: "set_backend_session"; sessionId: string }
  | { type: "set_household_size"; size: number | null }
  | { type: "add_document"; doc: SyntheticDocument }
  | { type: "remove_document"; docId: string }
  | { type: "confirm_field"; field: ExtractedField; value: ProposedValue; corrected: boolean }
  | { type: "reject_field"; fieldId: string }
  | { type: "log_injection"; entry: InjectionAttempt }
  | { type: "log_refusal"; entry: RefusalEvent };

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "consent":
      return { ...state, consented: true };
    case "reset":
      return createSessionState();
    case "set_mode": {
      if (state.mode && action.mode && state.mode !== action.mode) {
        return { ...createSessionState(), mode: action.mode, consented: state.consented };
      }
      return { ...state, mode: action.mode };
    }
    case "set_backend_session":
      return { ...state, backendSessionId: action.sessionId };
    case "set_household_size":
      return { ...state, householdSize: action.size };
    case "add_document": {
      if (state.documents.find((d) => d.id === action.doc.id)) return state;
      // Injection scan on ingest — text is data, not instructions.
      const hits = detectInjection(action.doc.rawText);
      const attempts: InjectionAttempt[] = hits.map((h, i) => ({
        id: `${action.doc.id}.inj.${i}.${Date.now()}`,
        docId: action.doc.id,
        detectedText: h,
        detectedAt: new Date().toISOString(),
        action: "ignored",
      }));
      return {
        ...state,
        documents: [...state.documents, action.doc],
        proposed: [...state.proposed, ...action.doc.proposedFields],
        injections: [...state.injections, ...attempts],
      };
    }
    case "remove_document":
      return {
        ...state,
        documents: state.documents.filter((d) => d.id !== action.docId),
        proposed: state.proposed.filter((f) => f.docId !== action.docId),
        confirmed: Object.fromEntries(
          Object.entries(state.confirmed).filter(([, v]) => v.docId !== action.docId),
        ),
      };
    case "confirm_field": {
      const cf: ConfirmedField = {
        fieldId: action.field.id,
        docId: action.field.docId,
        name: action.field.name,
        status: action.corrected ? "corrected" : "confirmed",
        value: action.value,
        correctedFromProposed: action.corrected,
        confirmedAt: new Date().toISOString(),
      };
      return {
        ...state,
        profileVersion: state.profileVersion + 1,
        confirmed: { ...state.confirmed, [cf.fieldId]: cf },
      };
    }
    case "reject_field": {
      const next = { ...state.confirmed };
      delete next[action.fieldId];
      return { ...state, confirmed: next };
    }
    case "log_injection":
      return { ...state, injections: [...state.injections, action.entry] };
    case "log_refusal":
      return { ...state, refusals: [...state.refusals, action.entry] };
  }
}

type Ctx = {
  state: SessionState;
  consent: () => void;
  reset: () => void;
  setMode: (mode: SessionMode) => void;
  setBackendSession: (sessionId: string) => void;
  setHouseholdSize: (n: number | null) => void;
  addDocument: (doc: SyntheticDocument) => void;
  removeDocument: (id: string) => void;
  confirmField: (field: ExtractedField, value: ProposedValue, corrected: boolean) => void;
  rejectField: (fieldId: string) => void;
  logRefusal: (entry: RefusalEvent) => void;
  confirmedList: ConfirmedField[];
};

const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sessionReducer, undefined, createSessionState);

  const consent = useCallback(() => dispatch({ type: "consent" }), []);
  const reset = useCallback(() => dispatch({ type: "reset" }), []);
  const setMode = useCallback((mode: SessionMode) => dispatch({ type: "set_mode", mode }), []);
  const setBackendSession = useCallback(
    (sessionId: string) => dispatch({ type: "set_backend_session", sessionId }),
    [],
  );
  const setHouseholdSize = useCallback(
    (size: number | null) => dispatch({ type: "set_household_size", size }),
    [],
  );
  const addDocument = useCallback(
    (doc: SyntheticDocument) => dispatch({ type: "add_document", doc }),
    [],
  );
  const removeDocument = useCallback(
    (docId: string) => dispatch({ type: "remove_document", docId }),
    [],
  );
  const confirmField = useCallback(
    (field: ExtractedField, value: ProposedValue, corrected: boolean) =>
      dispatch({ type: "confirm_field", field, value, corrected }),
    [],
  );
  const rejectField = useCallback(
    (fieldId: string) => dispatch({ type: "reject_field", fieldId }),
    [],
  );
  const logRefusal = useCallback(
    (entry: RefusalEvent) => dispatch({ type: "log_refusal", entry }),
    [],
  );

  const confirmedList = useMemo(() => Object.values(state.confirmed), [state.confirmed]);

  const value: Ctx = useMemo(
    () => ({
      state,
      consent,
      reset,
      setMode,
      setBackendSession,
      setHouseholdSize,
      addDocument,
      removeDocument,
      confirmField,
      rejectField,
      logRefusal,
      confirmedList,
    }),
    [
      state,
      consent,
      reset,
      setMode,
      setBackendSession,
      setHouseholdSize,
      addDocument,
      removeDocument,
      confirmField,
      rejectField,
      logRefusal,
      confirmedList,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
