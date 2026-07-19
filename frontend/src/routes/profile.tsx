import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, FileText, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useSession } from "@/state/session";
import { useAnnouncer } from "@/state/announcer";
import type { ExtractedField, SourceRegion, SyntheticDocument } from "@/domain/types";
import { DocumentViewer } from "@/components/document-viewer";
import { FieldRow } from "@/components/field-row";
import { Banner } from "@/components/banner";
import { UploadDropzone } from "@/components/upload-dropzone";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  EXTRACTION_STAGES,
  ExtractionProgress,
  type StageStatus,
} from "@/components/extraction-progress";
import { runUploadFlow } from "@/api/upload-flow";
import { adaptExtraction } from "@/api/adapters";
import { ApiError } from "@/api/errors";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const {
    state,
    addDocument,
    removeDocument,
    confirmField,
    rejectField,
    setHouseholdSize,
    setMode,
    setBackendSession,
  } = useSession();
  const { announce } = useAnnouncer();
  const router = useRouter();
  const [activeDocId, setActiveDocId] = useState<string | null>(state.documents[0]?.id ?? null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [progress, setProgress] = useState<StageStatus[]>(EXTRACTION_STAGES.map(() => "pending"));
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);

  // If a demo session is active, this page is not the right place — redirect.
  useEffect(() => {
    if (state.mode === "demo") {
      router.navigate({ to: "/safety/profile" });
    } else if (state.mode === null) {
      setMode("normal");
    }
  }, [state.mode, router, setMode]);

  const activeDoc: SyntheticDocument | undefined = useMemo(
    () => state.documents.find((d) => d.id === activeDocId) ?? state.documents[0],
    [state.documents, activeDocId],
  );
  const activeFields = activeDoc?.proposedFields ?? [];
  const selectedField = activeFields.find((f) => f.id === selectedFieldId) ?? null;
  const highlight: SourceRegion | null = selectedField?.source ?? null;

  const unreviewed = state.proposed.filter((f) => !state.confirmed[f.id]);

  // Per-document completion tally (based on proposed vs confirmed fields).
  const docStatus = (doc: SyntheticDocument) => {
    const total = doc.proposedFields.length;
    const done = doc.proposedFields.filter((f) => state.confirmed[f.id]).length;
    return { total, done, complete: total > 0 && done === total, empty: total === 0 };
  };

  const handleFileUpload = async (file: File) => {
    setLastFile(file);
    setProcessing(file.name);
    setUploadError(null);
    setProgress(EXTRACTION_STAGES.map((_, index) => (index === 0 ? "active" : "pending")));
    announce(`Uploading and reading ${file.name}.`);
    const timers = [1800, 6000, 10000, 14000].map((delay, timerIndex) =>
      window.setTimeout(() => {
        setProgress((current) =>
          current.map((status, index) => {
            if (index <= timerIndex) return "done";
            if (index === timerIndex + 1 && index < EXTRACTION_STAGES.length - 1) return "active";
            return status;
          }),
        );
      }, delay),
    );
    try {
      const result = await runUploadFlow(state.backendSessionId, file);
      timers.forEach(window.clearTimeout);
      if (!state.backendSessionId) setBackendSession(result.sessionId);
      const doc = adaptExtraction(result.sessionId, file.name, result.extraction);
      addDocument(doc);
      setActiveDocId(doc.id);
      setProgress(EXTRACTION_STAGES.map(() => "done"));
      setProcessing(null);
      announce(`${file.name} extracted. Review and confirm each proposed value.`);
    } catch (error) {
      timers.forEach(window.clearTimeout);
      setProgress((current) => {
        const active = current.findIndex((status) => status === "active");
        return current.map((status, index) => (index === Math.max(0, active) ? "error" : status));
      });
      setUploadError(
        error instanceof ApiError
          ? error.message
          : "The document could not be read. Please try again.",
      );
      setProcessing(null);
      announce(`Reading ${file.name} failed.`);
    }
  };

  const incompleteDocs = state.documents.filter((d) => {
    const s = docStatus(d);
    return !s.empty && !s.complete;
  });

  return (
    <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold">Profile — confirm your documents</h1>
        <p className="text-sm text-muted-foreground">
          Upload a document below. The copilot proposes values with a source region — nothing is
          used anywhere until you confirm it.
        </p>
      </header>

      <section
        aria-labelledby="upload-heading"
        className="rounded-lg border border-border bg-card p-4"
      >
        <h2
          id="upload-heading"
          className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Upload a document
        </h2>
        <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
          <UploadDropzone onFile={(file) => void handleFileUpload(file)} disabled={!!processing} />
          <div>
            <Label htmlFor="household">Household size</Label>
            <Input
              id="household"
              type="number"
              min={1}
              max={20}
              value={state.householdSize ?? ""}
              onChange={(e) =>
                setHouseholdSize(e.target.value === "" ? null : Number(e.target.value))
              }
              placeholder="e.g. 3"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Synthetic files are processed by the RealDoor server and its configured extraction
              provider for this session.
            </p>
          </div>
        </div>

        {(processing || uploadError) && (
          <ExtractionProgress
            statuses={progress}
            error={uploadError}
            onRetry={() => lastFile && void handleFileUpload(lastFile)}
          />
        )}

        {state.documents.length > 0 && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Documents in this session
            </p>
            <ul className="mt-2 flex flex-wrap gap-2" aria-label="Uploaded documents">
              {state.documents.map((d) => {
                const s = docStatus(d);
                const isActive = activeDoc?.id === d.id;
                return (
                  <li key={d.id} className="flex items-center gap-1 animate-fade-in">
                    <button
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => {
                        setActiveDocId(d.id);
                        setSelectedFieldId(null);
                      }}
                      className={[
                        "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors duration-200",
                        isActive
                          ? "border-primary bg-primary text-primary-foreground"
                          : s.complete
                            ? "border-status-ok-foreground/40 bg-status-ok text-status-ok-foreground"
                            : "border-border bg-background hover:bg-accent",
                      ].join(" ")}
                    >
                      {s.complete ? (
                        <CheckCircle2 aria-hidden="true" className="size-4 animate-scale-in" />
                      ) : (
                        <FileText aria-hidden="true" className="size-4" />
                      )}

                      <span className="max-w-[220px] truncate">{d.displayName}</span>
                      <span
                        className={
                          isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                        }
                      >
                        {s.empty
                          ? "no fields"
                          : s.complete
                            ? "complete"
                            : `${s.done}/${s.total} confirmed`}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeDocument(d.id)}
                      aria-label={`Remove ${d.displayName}`}
                      className="rounded-md border border-border bg-background px-2 py-1.5 text-xs hover:bg-accent"
                    >
                      <Trash2 aria-hidden="true" className="size-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {!activeDoc ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No document yet. Drag one above or choose a file to get started.
          </p>
        </div>
      ) : (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <DocumentViewer doc={activeDoc} highlight={highlight} />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Proposed fields for {activeDoc.displayName}
            </h2>
            {activeFields.length === 0 ? (
              <div className="mt-2">
                <Banner variant="warn" title="No values could be extracted">
                  The extractor abstained. Try a clearer synthetic PDF or review the service
                  configuration.
                </Banner>
              </div>
            ) : (
              <ul className="mt-2 space-y-2">
                {activeFields.map((f: ExtractedField) => (
                  <FieldRow
                    key={f.id}
                    field={f}
                    confirmed={state.confirmed[f.id]}
                    isSelected={selectedFieldId === f.id}
                    onSelect={() => setSelectedFieldId(f.id)}
                    onConfirm={(value, corrected) => confirmField(f, value, corrected)}
                    onReject={() => rejectField(f.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <UnresolvedRail
        unreviewedCount={unreviewed.length}
        totalConfirmed={Object.keys(state.confirmed).length}
        incompleteDocs={incompleteDocs.map((d) => {
          const s = docStatus(d);
          return { name: d.displayName, done: s.done, total: s.total };
        })}
      />
    </div>
  );
}

function UnresolvedRail({
  unreviewedCount,
  totalConfirmed,
  incompleteDocs,
}: {
  unreviewedCount: number;
  totalConfirmed: number;
  incompleteDocs: { name: string; done: number; total: number }[];
}) {
  const allDone = unreviewedCount === 0 && totalConfirmed > 0;
  return (
    <aside
      aria-label="Unresolved issues summary"
      className="sticky bottom-0 z-10 rounded-lg border border-border bg-card p-3 shadow-lg"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 text-sm">
          <p>
            <span className="font-semibold">{unreviewedCount}</span> field
            {unreviewedCount === 1 ? "" : "s"} still need review ·{" "}
            <span className="font-semibold">{totalConfirmed}</span> confirmed
          </p>
          {incompleteDocs.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Not fully reviewed:{" "}
              {incompleteDocs.map((d) => `${d.name} (${d.done}/${d.total})`).join(" · ")}
            </p>
          )}
          {allDone && (
            <p className="mt-1 text-xs text-status-ok-foreground">
              All extracted fields are confirmed. You can continue.
            </p>
          )}
        </div>
        <Button asChild variant={allDone ? "default" : "secondary"}>
          <Link to="/understand">
            Continue to Understand
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </Button>
      </div>
    </aside>
  );
}
