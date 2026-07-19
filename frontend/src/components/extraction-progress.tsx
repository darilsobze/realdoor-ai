import { Check, CircleAlert, Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export type StageStatus = "pending" | "active" | "done" | "error";

export const EXTRACTION_STAGES = [
  "Uploading your document",
  "Rendering the page",
  "Reading the text (OCR)",
  "Identifying allowlisted values",
  "Matching values to page evidence",
  "Validating the allowed-fields response",
] as const;

export function ExtractionProgress({
  statuses,
  error,
  onRetry,
}: {
  statuses: StageStatus[];
  error: string | null;
  onRetry: () => void;
}) {
  const completed = statuses.filter((status) => status === "done").length;
  return (
    <div className="mt-4 rounded-lg border border-border bg-background p-4">
      <div className="flex items-start gap-3">
        {error ? (
          <CircleAlert aria-hidden="true" className="mt-0.5 size-5 text-status-danger-foreground" />
        ) : (
          <Loader2 aria-hidden="true" className="mt-0.5 size-5 animate-spin text-primary" />
        )}
        <div className="flex-1">
          <h3 className="font-semibold">
            {error ? "We couldn't finish reading this document" : "Reading your document…"}
          </h3>
          <ol className="mt-2 space-y-1" aria-live="polite">
            {EXTRACTION_STAGES.map((label, index) => {
              const status = statuses[index] ?? "pending";
              return (
                <li
                  key={label}
                  className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                    status === "active"
                      ? "bg-status-info text-status-info-foreground"
                      : status === "error"
                        ? "bg-status-danger text-status-danger-foreground"
                        : ""
                  }`}
                >
                  <span className="grid size-5 place-items-center" aria-hidden="true">
                    {status === "done" ? (
                      <Check className="size-4 text-status-ok-foreground" />
                    ) : null}
                    {status === "active" ? <Loader2 className="size-4 animate-spin" /> : null}
                    {status === "error" ? <CircleAlert className="size-4" /> : null}
                    {status === "pending" ? <span className="size-2 rounded-full border" /> : null}
                  </span>
                  {label}
                </li>
              );
            })}
          </ol>
          <span className="sr-only" aria-live="polite">
            {completed} of {EXTRACTION_STAGES.length} extraction steps complete.
          </span>
          {error ? (
            <div className="mt-3" role="alert">
              <p className="text-sm text-status-danger-foreground">{error}</p>
              <Button className="mt-2" size="sm" onClick={onRetry}>
                <RotateCw aria-hidden="true" className="size-4" />
                Try again
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
