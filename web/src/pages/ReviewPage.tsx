// Field-review screen: document viewer with evidence highlights left, field
// cards right (stacked below 1024px), sticky uncertainty center, confirm /
// correct flow with "What will update" preview and version-bump toast, and —
// C4 — every derived value (annualization, comparison, checklist, packet
// preview) recomputed from the single confirmed-profile store on any change.
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpenCheck, FileCheck2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DocumentViewer, type EvidenceTarget } from "@/components/document-viewer";
import { FieldCard } from "@/components/field-card";
import { HouseholdSizeCard } from "@/components/household-size-card";
import {
  AnnualIncomePanel,
  ChecklistPanel,
  ComparisonPanel,
  PacketPreviewPanel,
} from "@/components/derived-panels";
import { GOLD_CHECKLIST } from "@/lib/checklist";
import { UncertaintyCenter } from "@/components/uncertainty-center";
import { DeleteEverything } from "@/components/delete-everything";
import { WhatWillUpdateDialog, type PendingCorrection } from "@/components/what-will-update";
import { buildDerived, diffOutputs, withCorrection } from "@/lib/calculations";
import { FIELD_META } from "@/lib/field-meta";
import { SCORED_RULE } from "@/lib/rules";
import { useReview } from "@/store/review";

export function ReviewPage() {
  const { state, dispatch } = useReview();
  const [pending, setPending] = useState<PendingCorrection | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const needCount = state.fields.filter(
    (f) => f.state === "proposed" || f.state === "corrected",
  ).length;

  // Announce extraction completion once the screen mounts (aria-live).
  useEffect(() => {
    if (state.document) {
      setAnnouncement(
        `We read your document. ${state.fields.length} values found, ${needCount} need your confirmation.`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.document?.id]);

  // THE derived values: computed from the confirmed-profile store, no caching.
  // Deterministic per profile version (computedAt = lastChangedAt).
  const context = useMemo(
    () => ({ profileVersion: state.profileVersion, computedAt: state.lastChangedAt }),
    [state.profileVersion, state.lastChangedAt],
  );
  const derived = useMemo(
    () =>
      buildDerived(state.fields, state.householdSize, SCORED_RULE, context, state.document?.id ?? null),
    [state.fields, state.householdSize, context, state.document?.id],
  );

  const evidence: EvidenceTarget | null = useMemo(() => {
    const f = state.fields.find((x) => x.extracted.id === state.selectedId);
    if (!f || !f.extracted.bbox || !f.extracted.page) return null;
    return {
      page: f.extracted.page,
      bbox: f.extracted.bbox,
      label: FIELD_META[f.extracted.field_name].label,
    };
  }, [state.fields, state.selectedId]);

  if (!state.document || !state.sessionId) {
    return (
      <main className="mx-auto flex max-w-(--container-reading) flex-col items-center gap-4 px-6 py-24 text-center">
        <h1 className="text-2xl">Nothing to review yet</h1>
        <p className="max-w-md text-body">
          Upload a document first — we'll read the values off the page and bring
          you back here to check them.
        </p>
        <Button onClick={() => (window.location.hash = "#/")}>
          <ArrowLeft aria-hidden="true" data-icon="inline-start" />
          Go to upload
        </Button>
      </main>
    );
  }

  const pageCount = Math.max(1, ...state.fields.map((f) => f.extracted.page ?? 1));

  /** Recompute list from REAL engine records: current vs hypothetical state. */
  function recomputeListFor(fieldId: string, newValue: string): string[] {
    const after = buildDerived(
      withCorrection(state.fields, fieldId, newValue),
      state.householdSize,
      SCORED_RULE,
      context,
      state.document?.id ?? null,
    );
    return diffOutputs(derived, after);
  }

  function announceUpdate(label: string, version: number, outputs: string[]) {
    toast.success(`Profile updated to v${version} — ${outputs.length} item${outputs.length === 1 ? "" : "s"} recomputed`);
    setAnnouncement(
      `${label} confirmed. Profile is now version ${version}. Recomputed: ${outputs.join(", ")}.`,
    );
  }

  function confirmField(id: string, correctedValue?: string) {
    const field = state.fields.find((f) => f.extracted.id === id);
    if (!field) return;
    const outputs = recomputeListFor(
      id,
      correctedValue ??
        String(field.extracted.normalized_value ?? field.extracted.raw_text ?? ""),
    );
    dispatch({ type: "confirm", id, correctedValue, recomputedOutputs: outputs });
    announceUpdate(FIELD_META[field.extracted.field_name].label, state.profileVersion + 1, outputs);
  }

  function confirmHouseholdSize(value: number) {
    const after = buildDerived(
      state.fields,
      { value, confirmedAt: "pending" },
      SCORED_RULE,
      context,
      state.document?.id ?? null,
    );
    const outputs = diffOutputs(derived, after);
    dispatch({ type: "set_household_size", value, recomputedOutputs: outputs });
    announceUpdate("Household size", state.profileVersion + 1, outputs);
  }

  function jumpToField(fieldName: string) {
    if (fieldName === "household_size") {
      document.getElementById("household-size-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const target = state.fields.find((f) => f.extracted.field_name === fieldName);
    if (target) {
      const el = document.getElementById(`field-card-${target.extracted.id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl">Check what we read</h1>
          <p className="text-sm text-subtle">
            Every value shows where it came from. Nothing counts until you confirm it.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => (window.location.hash = "#/packet")}>
            <FileCheck2 aria-hidden="true" data-icon="inline-start" />
            Packet preview
          </Button>
          <Button variant="outline" size="sm" onClick={() => (window.location.hash = "#/understand")}>
            <BookOpenCheck aria-hidden="true" data-icon="inline-start" />
            Understand the rules
          </Button>
          <Button variant="outline" size="sm" onClick={() => (window.location.hash = "#/safety")}>
            <ShieldCheck aria-hidden="true" data-icon="inline-start" />
            Safety
          </Button>
          <Button variant="ghost" size="sm" onClick={() => (window.location.hash = "#/")}>
            <ArrowLeft aria-hidden="true" data-icon="inline-start" />
            Upload another document
          </Button>
          <DeleteEverything />
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div id="document-viewer" className="order-2 scroll-mt-6 lg:order-1 lg:sticky lg:top-6">
          <DocumentViewer
            sessionId={state.sessionId}
            documentId={state.document.id}
            displayName={state.document.displayName}
            pageCount={pageCount}
            evidence={evidence}
          />
        </div>

        <div className="order-1 flex flex-col gap-4 lg:order-2">
          <UncertaintyCenter fields={state.fields} />
          <div id="household-size-card" className="scroll-mt-24">
            <HouseholdSizeCard
              value={state.householdSize.value}
              confirmedAt={state.householdSize.confirmedAt}
              onConfirm={confirmHouseholdSize}
            />
          </div>
          {state.fields.map((field) => (
            <FieldCard
              key={field.extracted.id}
              field={field}
              selected={state.selectedId === field.extracted.id}
              onShowEvidence={() => {
                const selecting = state.selectedId !== field.extracted.id;
                dispatch({ type: "select", id: selecting ? field.extracted.id : null });
                if (selecting && window.innerWidth < 1024) {
                  document
                    .getElementById("document-viewer")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
              onConfirm={() => confirmField(field.extracted.id)}
              onRequestCorrection={(value) =>
                setPending({
                  field,
                  newValue: value,
                  recomputedOutputs: recomputeListFor(field.extracted.id, value),
                })
              }
            />
          ))}
        </div>
      </div>

      <section aria-labelledby="derived-heading" className="flex flex-col gap-4">
        <h2 id="derived-heading" className="text-lg">
          Computed from your confirmed values
        </h2>
        <div className="grid items-start gap-4 md:grid-cols-2">
          <AnnualIncomePanel
            derived={derived}
            profileVersion={state.profileVersion}
            onJumpToField={jumpToField}
          />
          <ComparisonPanel
            derived={derived}
            citation={SCORED_RULE.citation}
            profileVersion={state.profileVersion}
            onJumpToField={jumpToField}
          />
          <ChecklistPanel
            derived={derived}
            checklistVersion={GOLD_CHECKLIST.checklist_version}
            profileVersion={state.profileVersion}
          />
          <PacketPreviewPanel
            fields={state.fields}
            derived={derived}
            profileVersion={state.profileVersion}
          />
        </div>
      </section>

      <WhatWillUpdateDialog
        pending={pending}
        onCancel={() => setPending(null)}
        onConfirm={(p) => {
          setPending(null);
          confirmField(p.field.extracted.id, p.newValue);
        }}
      />
    </main>
  );
}
