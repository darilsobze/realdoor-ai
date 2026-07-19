// One extracted field: raw text, normalized value, confidence as words
// (% on expand), status badge (icon + text), and Confirm / Correct /
// Show evidence actions — all keyboard reachable. Abstentions render as calm
// informational panels, never as errors.
import { useId, useState } from "react";
import { Eye, Info, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge, type StatusVariant } from "@/components/status-badge";
import { deriveConfirmationStatus, type ConfirmationStatus } from "@/contracts";
import { FIELD_META, formatValue } from "@/lib/field-meta";
import { cn } from "@/lib/utils";
import type { ReviewField } from "@/store/review";

const STATUS_DISPLAY: Record<ConfirmationStatus, { variant: StatusVariant; label: string }> = {
  high_confidence_unconfirmed: { variant: "needs_confirmation", label: "Needs your confirmation" },
  low_confidence_review_required: { variant: "needs_confirmation", label: "Check this value" },
  confirmed_by_renter: { variant: "confirmed", label: "Confirmed by you" },
  corrected_by_renter: { variant: "confirmed", label: "Corrected by you" },
  unable_to_extract: { variant: "info", label: "Could not read" },
};

const CONFIDENCE_WORDS = {
  high: "High confidence",
  medium: "Medium confidence — double-check this",
  none: "Could not read",
} as const;

export function FieldCard({
  field,
  selected,
  onShowEvidence,
  onConfirm,
  onRequestCorrection,
}: {
  field: ReviewField;
  selected: boolean;
  onShowEvidence: () => void;
  /** Plain confirmation of the proposed value. */
  onConfirm: () => void;
  /** Opens the "What will update" preview with the drafted value. */
  onRequestCorrection: (value: string) => void;
}) {
  const meta = FIELD_META[field.extracted.field_name];
  const status = deriveConfirmationStatus(
    field.state,
    field.extracted.confidence_tier,
    field.wasCorrected,
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputId = useId();
  const helperId = useId();

  const isAbstained = field.state === "unresolved";
  const isConfirmed = field.state === "confirmed";
  const currentValue =
    field.confirmedValue ?? field.correctedValue ?? field.extracted.normalized_value;
  const hasEvidence = field.extracted.bbox !== null;
  const confidencePct =
    field.extracted.confidence !== null ? Math.round(field.extracted.confidence * 100) : null;

  function startEditing() {
    const current = field.confirmedValue ?? field.correctedValue ?? field.extracted.normalized_value;
    setDraft(current !== null ? String(current) : "");
    setEditing(true);
  }

  return (
    <Card
      id={`field-card-${field.extracted.id}`}
      tabIndex={-1}
      data-field={field.extracted.field_name}
      className={cn(
        "scroll-mt-24 transition-shadow duration-150",
        selected && "ring-2 ring-primary/40",
      )}
    >
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-ink">{meta.label}</h3>
            <p id={helperId} className="text-xs text-subtle">
              {meta.helper}
            </p>
          </div>
          {status && <StatusBadge variant={STATUS_DISPLAY[status].variant} label={STATUS_DISPLAY[status].label} />}
        </div>

        {isAbstained && !editing ? (
          <div className="flex items-start gap-2.5 rounded-lg bg-status-info-bg p-3 text-sm text-status-info">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p>
              {field.extracted.abstention_reason ??
                "This value could not be read from the document."}{" "}
              You can type it in yourself — nothing counts until you confirm it.
            </p>
          </div>
        ) : (
          !editing && (
            <div className="flex flex-col gap-1">
              {/* key restarts the pulse on each confirmation */}
              <p
                key={field.confirmedAt ?? "unconfirmed"}
                className={cn(
                  "rounded-md text-xl font-semibold text-ink tnum",
                  field.confirmedAt && "animate-value-pulse",
                )}
              >
                {formatValue(field.extracted.field_name, currentValue)}
              </p>
              {field.extracted.raw_text && (
                <p className="text-xs text-subtle">
                  As printed: <span className="tnum">“{field.extracted.raw_text}”</span>
                </p>
              )}
              {isConfirmed ? (
                <p className="text-xs text-subtle">
                  {field.wasCorrected
                    ? "You typed this value and confirmed it."
                    : "You checked this value against the document."}
                </p>
              ) : (
                !isAbstained && (
                  <details className="text-xs text-subtle">
                    <summary className="cursor-pointer rounded-sm select-none marker:text-subtle">
                      {CONFIDENCE_WORDS[field.extracted.confidence_tier]}
                    </summary>
                    <p className="mt-1 pl-4">
                      {confidencePct !== null
                        ? `${confidencePct}% match between the read value and the document text.`
                        : "No document-text match available."}
                    </p>
                  </details>
                )
              )}
            </div>
          )
        )}

        {editing ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim().length > 0) {
                onRequestCorrection(draft.trim());
                setEditing(false);
              }
            }}
          >
            <Label htmlFor={inputId}>
              {isAbstained ? `Enter ${meta.label.toLowerCase()}` : `Correct ${meta.label.toLowerCase()}`}
            </Label>
            <Input
              id={inputId}
              value={draft}
              autoFocus
              aria-describedby={helperId}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={draft.trim().length === 0}>
                Preview what changes
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            {!isConfirmed && !isAbstained && (
              <Button size="sm" onClick={onConfirm}>
                Confirm this value
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={startEditing}>
              <Pencil aria-hidden="true" data-icon="inline-start" />
              {isAbstained ? "Enter value" : "Correct"}
            </Button>
            {hasEvidence && (
              <Button size="sm" variant="ghost" onClick={onShowEvidence} aria-pressed={selected}>
                <Eye aria-hidden="true" data-icon="inline-start" />
                Show evidence
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
