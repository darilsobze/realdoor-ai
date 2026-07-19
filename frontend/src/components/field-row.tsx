import { useState } from "react";
import { Check, PencilLine, Search, X } from "lucide-react";
import type { ConfirmedField, ExtractedField, ProposedValue } from "@/domain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAnnouncer } from "@/state/announcer";

function formatValue(v: ProposedValue | null, unit?: string): string {
  if (v === null) return "Could not read";
  if (typeof v === "number") return unit === "USD" ? `$${v.toFixed(2)}` : String(v);
  return v;
}

export function FieldRow({
  field,
  confirmed,
  isSelected,
  onSelect,
  onConfirm,
  onReject,
}: {
  field: ExtractedField;
  confirmed?: ConfirmedField;
  isSelected: boolean;
  onSelect: () => void;
  onConfirm: (value: ProposedValue, corrected: boolean) => void;
  onReject: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(field.proposedValue));
  const { announce } = useAnnouncer();

  const confidencePct = field.confidence === null ? null : Math.round(field.confidence * 100);
  const status: "confirmed" | "corrected" | "unreviewed" | "rejected" =
    confirmed?.status ?? "unreviewed";

  return (
    <li
      className={[
        "rounded-md border p-3 transition-colors duration-150",
        isSelected ? "border-ring bg-accent/50" : "border-border bg-card",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium">{field.label}</p>
            <StatusPill status={status} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {field.state === "unresolved"
              ? (field.abstentionReason ?? "The extractor could not read this value.")
              : `Proposed by the extractor · confidence ${confidencePct ?? "unavailable"}${confidencePct === null ? "" : "%"}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onSelect}
          disabled={!field.source}
          aria-pressed={isSelected}
          aria-label={`Show source region for ${field.label}`}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-accent focus-visible:outline-2"
        >
          <Search aria-hidden="true" className="size-3.5" />
          Show source
        </button>
      </div>

      <div className="mt-2 rounded bg-secondary/60 px-3 py-2 text-sm">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Proposed value
        </span>
        <div className="font-mono text-base">{formatValue(field.proposedValue, field.unit)}</div>
      </div>

      {confirmed && (
        <div className="mt-2 rounded bg-status-ok px-3 py-2 text-sm text-status-ok-foreground animate-fade-in">
          <span className="text-xs uppercase tracking-wide">Renter-confirmed value</span>
          <div className="font-mono text-base">
            {formatValue(confirmed.value, field.unit)}
            {confirmed.correctedFromProposed ? " (corrected)" : ""}
          </div>
        </div>
      )}

      {editing ? (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = typeof field.proposedValue === "number" ? Number(draft) : draft;
            onConfirm(parsed as ProposedValue, true);
            announce(`${field.label} corrected and confirmed.`);
            setEditing(false);
          }}
        >
          <div className="flex-1">
            <Label htmlFor={`edit-${field.id}`} className="text-xs">
              Corrected value
            </Label>
            <Input
              id={`edit-${field.id}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
          </div>
          <Button type="submit" size="sm">
            Save correction
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(false);
              setDraft(String(field.proposedValue));
            }}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => {
              if (field.proposedValue !== null) onConfirm(field.proposedValue, false);
              announce(`${field.label} confirmed.`);
            }}
            disabled={field.proposedValue === null}
            aria-label={`Confirm proposed value for ${field.label}`}
          >
            <Check aria-hidden="true" className="size-4" />
            Confirm
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <PencilLine aria-hidden="true" className="size-4" />
            Correct
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              onReject();
              announce(`${field.label} rejected.`);
            }}
          >
            <X aria-hidden="true" className="size-4" />
            Reject
          </Button>
        </div>
      )}
    </li>
  );
}

function StatusPill({ status }: { status: "confirmed" | "corrected" | "unreviewed" | "rejected" }) {
  const map = {
    confirmed: { label: "Confirmed", cls: "bg-status-ok text-status-ok-foreground" },
    corrected: { label: "Corrected", cls: "bg-status-info text-status-info-foreground" },
    unreviewed: { label: "Needs review", cls: "bg-status-warn text-status-warn-foreground" },
    rejected: { label: "Rejected", cls: "bg-status-danger text-status-danger-foreground" },
  } as const;
  const m = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}
    >
      {m.label}
    </span>
  );
}
