// Staged progress checklist shown during the 20-40s extraction. The stage
// order mirrors the real pipeline (upload → render → OCR → identify → match →
// allowlist). Timing is honest: see UploadPage — stages 2-5 advance on a
// calibrated timer capped at "in progress", stage 6 completes only when the
// real extract response arrives; on error the active stage turns red.
import { Check, CircleAlert, Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StageStatus = "pending" | "active" | "done" | "error";

export const EXTRACTION_STAGES = [
  "Uploading your document",
  "Rendering the page",
  "Reading the text (OCR)",
  "Identifying the application values",
  "Matching each value to its place on the page",
  "Checking against the allowed-fields list",
] as const;

function StageRow({ label, status }: { label: string; status: StageStatus }) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors duration-150",
        status === "active" && "animate-fade-up-fast bg-status-info-bg/60",
        status === "error" && "bg-status-blocking-bg",
      )}
    >
      <span className="flex size-5 shrink-0 items-center justify-center" aria-hidden="true">
        {status === "done" && <Check className="size-4 text-status-confirmed" strokeWidth={3} />}
        {status === "active" && <Loader2 className="size-4 animate-spin text-primary" />}
        {status === "error" && <CircleAlert className="size-4 text-status-blocking" />}
        {status === "pending" && <span className="size-2.5 rounded-full border border-subtle/60" />}
      </span>
      <span
        className={cn(
          "text-sm",
          status === "pending" && "text-subtle",
          status === "active" && "font-medium text-ink",
          status === "done" && "text-ink",
          status === "error" && "font-medium text-status-blocking",
        )}
      >
        {label}
      </span>
    </li>
  );
}

export function ExtractionProgress({
  statuses,
  error,
  onRetry,
}: {
  statuses: StageStatus[];
  error: string | null;
  onRetry: () => void;
}) {
  const completion = statuses.filter((s) => s === "done").length;
  return (
    <Card className="mx-auto w-full max-w-[480px] shadow-card">
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-3">
          {error ? (
            <CircleAlert aria-hidden="true" className="size-5 text-status-blocking" />
          ) : (
            <Loader2 aria-hidden="true" className="size-5 animate-spin text-primary" />
          )}
          <div>
            <h2 className="text-base font-semibold text-ink">
              {error ? "We couldn't finish reading your document" : "Reading your document…"}
            </h2>
            <p className="text-xs text-subtle">
              {error ? "Nothing was saved. You can try again." : "This usually takes 20–40 seconds. Nothing is sent anywhere else."}
            </p>
          </div>
        </div>

        {/* Each completion announced; navigation announces "Extraction complete". */}
        <ol aria-live="polite" className="flex flex-col gap-0.5">
          {EXTRACTION_STAGES.map((label, i) => (
            <StageRow key={label} label={label} status={statuses[i]} />
          ))}
        </ol>
        <span className="sr-only" aria-live="polite">
          {completion} of {EXTRACTION_STAGES.length} steps complete
        </span>

        {error && (
          <div role="alert" className="flex flex-col gap-2 rounded-lg bg-status-blocking-bg p-3">
            <p className="text-sm text-status-blocking">{error}</p>
            <div>
              <Button size="sm" onClick={onRetry}>
                <RotateCw aria-hidden="true" data-icon="inline-start" />
                Try again
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
