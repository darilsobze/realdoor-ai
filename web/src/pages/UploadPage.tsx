// Upload screen: journey preview, drag/drop + keyboard-accessible file input,
// a "try a sample" affordance, layered consent, and — during the 20-40s
// extraction — a staged progress checklist whose timing mirrors the real
// pipeline (see handleFile). Motion respects prefers-reduced-motion.
import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileText, FileUp, Info, ListChecks, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ExtractionProgress,
  EXTRACTION_STAGES,
  type StageStatus,
} from "@/components/extraction-progress";
import { cn } from "@/lib/utils";
import { ApiError, createSession, extractDocument, uploadDocument } from "@/lib/api";
import { useReview } from "@/store/review";
import sampleStubUrl from "../../../data/synthetic-docs/stub_clean.pdf?url";

const JOURNEY = [
  { n: 1, title: "Profile", clause: "We read the values; you confirm each one against the page." },
  { n: 2, title: "Understand", clause: "See the published limit and rule, with its source and date." },
  { n: 3, title: "Prepare", clause: "Build a packet you download and hand in — never sent for you." },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const allPending = (): StageStatus[] => EXTRACTION_STAGES.map(() => "pending");

// Timed advance of stages 2-5 (indices 1-4), calibrated to the ~20-40s
// pipeline with brisk early steps. Capped: the timer never marks the last two
// stages done — the real extract response does that.
const SCHEDULE: { at: number; done: number; active: number }[] = [
  { at: 2200, done: 1, active: 2 }, // Rendering done → OCR active
  { at: 9000, done: 2, active: 3 }, // OCR done → Identifying active
  { at: 14000, done: 3, active: 4 }, // Identifying done → Matching active (capped here)
];

export function UploadPage() {
  const { dispatch } = useReview();
  const [busy, setBusy] = useState(false);
  const [statuses, setStatuses] = useState<StageStatus[]>(allPending);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastFile = useRef<File | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cancelled = useRef(false);

  useEffect(() => () => {
    cancelled.current = true;
    timers.current.forEach(clearTimeout);
  }, []);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  /** Mark a run of stages done, up to (not including) `activeIdx`, which goes active. */
  function advance(doneUpTo: number, activeIdx: number) {
    setStatuses((prev) =>
      prev.map((s, i) => {
        if (i <= doneUpTo) return "done";
        if (i === activeIdx) return "active";
        return s === "done" || s === "active" ? s : "pending";
      }),
    );
  }

  async function handleFile(file: File) {
    if (busy) return;
    lastFile.current = file;
    cancelled.current = false;
    setBusy(true);
    setError(null);
    setStatuses(allPending());
    advance(-1, 0); // stage 1 (Uploading) active
    clearTimers();

    try {
      const sessionId = await createSession();
      const documentId = await uploadDocument(sessionId, file);
      if (cancelled.current) return;
      advance(0, 1); // Uploading done → Rendering active

      // Timed, capped advance of the middle stages.
      for (const step of SCHEDULE) {
        timers.current.push(
          setTimeout(() => {
            if (!cancelled.current) advance(step.done, step.active);
          }, step.at),
        );
      }

      const extraction = await extractDocument(sessionId, documentId);
      if (cancelled.current) return;
      clearTimers();

      // Response arrived: resolve every remaining stage in a quick cascade
      // (also fast-forwards gracefully if the response beat the timer).
      for (let i = 0; i < EXTRACTION_STAGES.length; i++) {
        setStatuses((prev) => prev.map((s, idx) => (idx <= i ? "done" : idx === i + 1 ? "active" : s)));
        await sleep(180);
        if (cancelled.current) return;
      }

      const announcer = document.getElementById("extraction-announcer");
      if (announcer) announcer.textContent = "Extraction complete. Opening your values to review.";
      await sleep(250);

      dispatch({
        type: "initialize",
        sessionId,
        document: { id: documentId, displayName: file.name },
        extraction,
      });
      window.location.hash = "#/review";
    } catch (err) {
      clearTimers();
      // Turn the active stage red; no stage claims done that didn't happen.
      setStatuses((prev) => prev.map((s) => (s === "active" ? "error" : s)));
      setError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong reading your document. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function loadSample() {
    const res = await fetch(sampleStubUrl);
    const blob = await res.blob();
    void handleFile(new File([blob], "stub_clean.pdf (sample)", { type: "application/pdf" }));
  }

  const showProgress = busy || error !== null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-(--container-reading) flex-col gap-8 px-6 py-16">
      <span id="extraction-announcer" aria-live="assertive" className="sr-only" />

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl">RealDoor</h1>
        <p className="max-w-xl text-body">
          Get your rental application ready — with{" "}
          <strong className="font-semibold text-ink">every value checked by you</strong>. Upload a
          document to start. Nothing is sent anywhere else, and you can delete everything at any time.
        </p>
      </header>

      {showProgress ? (
        <ExtractionProgress
          statuses={statuses}
          error={error}
          onRetry={() => lastFile.current && handleFile(lastFile.current)}
        />
      ) : (
        <>
          {/* Journey preview: three numbered chips, one clause each. */}
          <ol className="grid gap-3 sm:grid-cols-3">
            {JOURNEY.map((step, i) => (
              <li
                key={step.title}
                className="animate-fade-up flex items-start gap-3 rounded-xl border bg-card p-4 shadow-card"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-primary tnum">
                  {step.n}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink">{step.title}</span>
                  <span className="block text-xs text-subtle">{step.clause}</span>
                </span>
              </li>
            ))}
          </ol>

          {/* Layered consent: one-line summary + accessible disclosure. */}
          <Collapsible className="rounded-lg border border-status-info/20 bg-status-info-bg">
            <CollapsibleTrigger className="group flex w-full items-center gap-2.5 p-4 text-left">
              <Info aria-hidden="true" className="size-4 shrink-0 text-status-info" />
              <span className="flex-1 text-sm text-body">
                <span className="font-medium text-status-info">We read only application values, keep them for this session, and delete on request.</span>{" "}
                See exactly what happens.
              </span>
              <ChevronDown
                aria-hidden="true"
                className="size-4 shrink-0 text-status-info transition-transform duration-150 group-data-[state=open]:rotate-180"
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="flex flex-col gap-1.5 px-4 pb-4 pl-11 text-sm text-body">
                <li>
                  <strong className="font-medium text-ink">What we read:</strong> only the values an
                  application needs — pay amounts, dates, pay schedule, employer, and document type.
                  Anything else on the page is ignored.
                </li>
                <li>
                  <strong className="font-medium text-ink">Why:</strong> so you can check every value
                  against the document and build your packet. This tool prepares your application — it
                  never makes a decision about it.
                </li>
                <li>
                  <strong className="font-medium text-ink">How long we keep it:</strong> for this
                  session only, on the server this app runs with. Your document is never sent anywhere else.
                </li>
                <li>
                  <strong className="font-medium text-ink">Deleting:</strong> "Delete everything"
                  removes your files and every value read from them, immediately and for real.
                </li>
              </ul>
            </CollapsibleContent>
          </Collapsible>

          <Card
            className="animate-fade-up"
            style={{ animationDelay: "180ms" }}
          >
            <CardContent className="p-8">
              <div
                className={cn(
                  "group/drop flex flex-col items-center gap-4 rounded-lg border-2 border-dashed px-6 py-14 text-center transition-all duration-200 ease-(--ease-out-soft)",
                  dragOver
                    ? "-translate-y-0.5 border-primary bg-accent shadow-card"
                    : "border-border hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card",
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) void handleFile(file);
                }}
              >
                <FileUp
                  aria-hidden="true"
                  className={cn(
                    "size-10 text-primary transition-transform duration-200 ease-(--ease-out-soft)",
                    dragOver && "scale-110",
                  )}
                />
                <div className="flex flex-col gap-1">
                  <p className="text-lg font-semibold text-ink">Upload a document</p>
                  <p className="text-sm text-subtle">
                    A pay stub or benefit letter, as a PDF. Drag it here or choose a file.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button type="button" onClick={() => inputRef.current?.click()}>
                    Choose a PDF
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void loadSample()}>
                    <FileText aria-hidden="true" data-icon="inline-start" />
                    Try a sample pay stub
                  </Button>
                </div>
                <p className="text-xs text-subtle">
                  The sample is a synthetic document — no real person's data.
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="sr-only"
                  aria-label="Upload a PDF document"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                    e.target.value = "";
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Footer trust line. */}
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs text-subtle">
            <span className="inline-flex items-center gap-1">
              <ListChecks aria-hidden="true" className="size-3.5" /> Supports 2026 LIHTC rules
            </span>
            <span aria-hidden="true">·</span>
            <span>Boston metro</span>
            <span aria-hidden="true">·</span>
            <span>Synthetic documents only</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <ShieldCheck aria-hidden="true" className="size-3.5" /> Never an eligibility decision
            </span>
          </p>
        </>
      )}
    </main>
  );
}
