// Upload screen: real empty state, drag/drop + keyboard-accessible file input,
// named skeleton state ("Reading your document…") with aria-live completion.
import { useRef, useState } from "react";
import { FileUp, ShieldCheck, Trash2, Eye } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ApiError, createSession, extractDocument, uploadDocument } from "@/lib/api";
import { useReview } from "@/store/review";

type Phase =
  | { kind: "idle" }
  | { kind: "working"; label: string }
  | { kind: "error"; message: string };

export function UploadPage() {
  const { dispatch } = useReview();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (phase.kind === "working") return;
    try {
      setPhase({ kind: "working", label: "Preparing a private session…" });
      const sessionId = await createSession();
      setPhase({ kind: "working", label: "Uploading your document…" });
      const documentId = await uploadDocument(sessionId, file);
      setPhase({ kind: "working", label: "Reading your document…" });
      const extraction = await extractDocument(sessionId, documentId);
      dispatch({
        type: "initialize",
        sessionId,
        document: { id: documentId, displayName: file.name },
        extraction,
      });
      window.location.hash = "#/review";
    } catch (err) {
      setPhase({
        kind: "error",
        message:
          err instanceof ApiError
            ? err.message
            : "Something went wrong. Please try again.",
      });
    }
  }

  const working = phase.kind === "working";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-(--container-reading) flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl">RealDoor</h1>
        <p className="max-w-xl text-body">
          Get your rental application ready — with every value checked by you.
          Upload a document to start. Nothing is sent anywhere else, and you can
          delete everything at any time.
        </p>
      </header>

      {phase.kind === "error" && (
        <Alert role="alert" className="border-status-blocking/30 bg-status-blocking-bg text-status-blocking">
          <AlertTitle>We couldn't read that document</AlertTitle>
          <AlertDescription className="text-status-blocking/90">{phase.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-8">
          {working ? (
            <div className="flex flex-col gap-4" aria-hidden="true">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <div
              className={cn(
                "flex flex-col items-center gap-4 rounded-lg border-2 border-dashed px-6 py-14 text-center transition-colors duration-150",
                dragOver ? "border-primary bg-accent" : "border-border",
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
              <FileUp aria-hidden="true" className="size-10 text-primary" />
              <div className="flex flex-col gap-1">
                <p className="text-lg font-semibold text-ink">Upload a document</p>
                <p className="text-sm text-subtle">
                  A pay stub or benefit letter, as a PDF. Drag it here or choose a file.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={working}
              >
                Choose a PDF
              </Button>
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
          )}

          {/* Named loading state, announced politely; completion announced on the review screen. */}
          <p aria-live="polite" className={cn("mt-4 text-center text-sm text-subtle", !working && "sr-only")}>
            {working ? phase.label : ""}
          </p>
        </CardContent>
      </Card>

      <section aria-label="How your document is handled" className="grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: Eye,
            text: "We read values off the page and show you exactly where each one came from.",
          },
          {
            icon: ShieldCheck,
            text: "Nothing counts until you confirm it. You stay in control of every value.",
          },
          {
            icon: Trash2,
            text: "Delete your session at any time — files and everything derived from them are removed.",
          },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-start gap-3">
            <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
            <p className="text-sm text-body">{text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
