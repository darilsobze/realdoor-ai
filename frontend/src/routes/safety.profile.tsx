import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, FileText, FlaskConical, Trash2 } from "lucide-react";
import { useSession } from "@/state/session";
import { useAnnouncer } from "@/state/announcer";
import type { ExtractedField, SourceRegion, SyntheticDocument } from "@/domain/types";
import { DocumentViewer } from "@/components/document-viewer";
import { FieldRow } from "@/components/field-row";
import { Banner } from "@/components/banner";
import { SYNTHETIC_DOCUMENTS } from "@/domain/fixtures";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/safety/profile")({
  component: SafetyProfilePage,
});

function SafetyProfilePage() {
  const {
    state,
    addDocument,
    removeDocument,
    confirmField,
    rejectField,
    setHouseholdSize,
    setMode,
    reset,
  } = useSession();
  const { announce } = useAnnouncer();
  const router = useRouter();
  const [activeDocId, setActiveDocId] = useState<string | null>(state.documents[0]?.id ?? null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  // Entering this page implies demo mode. If a normal session is active, wipe first.
  useEffect(() => {
    if (state.mode === "normal") {
      // Clear any real uploads that were made in normal mode.
      reset();
      setMode("demo");
    } else if (state.mode === null) {
      setMode("demo");
    }
  }, [state.mode, reset, setMode]);

  const activeDoc: SyntheticDocument | undefined = useMemo(
    () => state.documents.find((d) => d.id === activeDocId) ?? state.documents[0],
    [state.documents, activeDocId],
  );
  const activeFields = activeDoc?.proposedFields ?? [];
  const selectedField = activeFields.find((f) => f.id === selectedFieldId) ?? null;
  const highlight: SourceRegion | null = selectedField?.source ?? null;

  const unreviewed = state.proposed.filter((f) => !state.confirmed[f.id]);

  const docStatus = (doc: SyntheticDocument) => {
    const total = doc.proposedFields.length;
    const done = doc.proposedFields.filter((f) => state.confirmed[f.id]).length;
    return { total, done, complete: total > 0 && done === total, empty: total === 0 };
  };

  const incompleteDocs = state.documents.filter((d) => {
    const s = docStatus(d);
    return !s.empty && !s.complete;
  });

  const allDone = unreviewed.length === 0 && Object.keys(state.confirmed).length > 0;

  return (
    <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6">
      <Banner variant="info" title="Safety demo session — simulated data only.">
        This journey uses curated synthetic documents. Values, thresholds, and citations are
        illustrative and clearly labeled [SIMULATED]. To use your own documents instead,{" "}
        <button
          type="button"
          onClick={() => {
            reset();
            setMode("normal");
            router.navigate({ to: "/profile" });
          }}
          className="underline underline-offset-2"
        >
          switch to a normal session
        </button>
        .
      </Banner>

      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <FlaskConical aria-hidden="true" className="size-6 text-primary" />
          Safety demo — Profile
        </h1>
        <p className="text-sm text-muted-foreground">
          Add one or more synthetic samples below. The copilot proposes values with a source region
          — nothing is used anywhere until you confirm it.
        </p>
      </header>

      <section
        aria-labelledby="samples-heading"
        className="rounded-lg border border-border bg-card p-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="samples-heading"
              className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Synthetic sample documents
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Each sample includes pre-extracted fields with a simulated source region for review.
            </p>
          </div>
          <div className="w-full max-w-[240px]">
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
          </div>
        </div>

        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {SYNTHETIC_DOCUMENTS.map((d) => {
            const already = state.documents.some((sd) => sd.id === d.id);
            return (
              <li
                key={d.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.proposedFields.length} proposed field
                    {d.proposedFields.length === 1 ? "" : "s"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={already ? "ghost" : "secondary"}
                  disabled={already}
                  onClick={() => {
                    addDocument(d);
                    setActiveDocId(d.id);
                    announce(`${d.displayName} added to session.`);
                  }}
                >
                  {already ? "Added" : "Add to session"}
                </Button>
              </li>
            );
          })}
        </ul>

        {state.documents.length > 0 && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Documents in this session
            </p>
            <ul className="mt-2 flex flex-wrap gap-2" aria-label="Session documents">
              {state.documents.map((d) => {
                const s = docStatus(d);
                const isActive = activeDoc?.id === d.id;
                return (
                  <li key={d.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => {
                        setActiveDocId(d.id);
                        setSelectedFieldId(null);
                      }}
                      className={[
                        "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm",
                        isActive
                          ? "border-primary bg-primary text-primary-foreground"
                          : s.complete
                            ? "border-status-ok-foreground/40 bg-status-ok text-status-ok-foreground"
                            : "border-border bg-background hover:bg-accent",
                      ].join(" ")}
                    >
                      {s.complete ? (
                        <CheckCircle2 aria-hidden="true" className="size-4" />
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
            No document yet. Add a synthetic sample above.
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
          </div>
        </section>
      )}

      <aside
        aria-label="Unresolved issues summary"
        className="sticky bottom-0 z-10 rounded-lg border border-border bg-card p-3 shadow-lg"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 text-sm">
            <p>
              <span className="font-semibold">{unreviewed.length}</span> field
              {unreviewed.length === 1 ? "" : "s"} still need review ·{" "}
              <span className="font-semibold">{Object.keys(state.confirmed).length}</span> confirmed
            </p>
            {incompleteDocs.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Not fully reviewed:{" "}
                {incompleteDocs
                  .map((d) => {
                    const s = docStatus(d);
                    return `${d.displayName} (${s.done}/${s.total})`;
                  })
                  .join(" · ")}
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
    </div>
  );
}
