// Field-review screen: document viewer with evidence highlights left, field
// cards right (stacked below 1024px), sticky uncertainty center, confirm /
// correct flow with "What will update" preview and version-bump toast.
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DocumentViewer, type EvidenceTarget } from "@/components/document-viewer";
import { FieldCard } from "@/components/field-card";
import { UncertaintyCenter } from "@/components/uncertainty-center";
import { WhatWillUpdateDialog, type PendingCorrection } from "@/components/what-will-update";
import { FIELD_DEPENDENTS, FIELD_META } from "@/lib/field-meta";
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

  function confirmField(id: string, correctedValue?: string) {
    const field = state.fields.find((f) => f.extracted.id === id);
    if (!field) return;
    const nextVersion = state.profileVersion + 1;
    const recomputed = FIELD_DEPENDENTS[field.extracted.field_name].length;
    dispatch({ type: "confirm", id, correctedValue });
    toast.success(
      `Profile updated to v${nextVersion} — ${recomputed} item${recomputed === 1 ? "" : "s"} recomputed`,
    );
    setAnnouncement(
      `${FIELD_META[field.extracted.field_name].label} confirmed. Profile is now version ${nextVersion}.`,
    );
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
        <Button variant="ghost" size="sm" onClick={() => (window.location.hash = "#/")}>
          <ArrowLeft aria-hidden="true" data-icon="inline-start" />
          Upload another document
        </Button>
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
          {state.fields.map((field) => (
            <FieldCard
              key={field.extracted.id}
              field={field}
              selected={state.selectedId === field.extracted.id}
              onShowEvidence={() => {
                const selecting = state.selectedId !== field.extracted.id;
                dispatch({ type: "select", id: selecting ? field.extracted.id : null });
                // Below the two-column breakpoint the viewer sits after the
                // cards — bring it into view so the highlight is visible.
                if (selecting && window.innerWidth < 1024) {
                  document
                    .getElementById("document-viewer")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
              onConfirm={() => confirmField(field.extracted.id)}
              onRequestCorrection={(value) => setPending({ field, newValue: value })}
            />
          ))}
        </div>
      </div>

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
