// "What will update" preview: shown before a correction is confirmed, listing
// every output that will recompute. Confirmation is always an explicit action.
import { useRef } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FIELD_DEPENDENTS, FIELD_META, formatValue } from "@/lib/field-meta";
import type { ReviewField } from "@/store/review";

export interface PendingCorrection {
  field: ReviewField;
  newValue: string;
}

export function WhatWillUpdateDialog({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: PendingCorrection | null;
  onCancel: () => void;
  onConfirm: (pending: PendingCorrection) => void;
}) {
  // The inline-edit trigger unmounts on close, so Radix's default focus
  // return has nowhere to go — send focus back to the field card instead.
  const lastFieldId = useRef<string | null>(null);
  if (pending) lastFieldId.current = pending.field.extracted.id;

  const meta = pending ? FIELD_META[pending.field.extracted.field_name] : null;
  const dependents = pending ? FIELD_DEPENDENTS[pending.field.extracted.field_name] : [];
  const oldValue = pending
    ? (pending.field.confirmedValue ??
      pending.field.correctedValue ??
      pending.field.extracted.normalized_value)
    : null;

  return (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent
        className="max-w-md"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          if (lastFieldId.current) {
            document.getElementById(`field-card-${lastFieldId.current}`)?.focus();
          }
        }}
      >
        {pending && meta && (
          <>
            <DialogHeader>
              <DialogTitle>What will update</DialogTitle>
              <DialogDescription>
                Confirming this change to {meta.label.toLowerCase()} recomputes the
                items below. Nothing is sent anywhere.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
              <span className="text-subtle tnum">
                {oldValue !== null
                  ? formatValue(pending.field.extracted.field_name, oldValue)
                  : "Not read"}
              </span>
              <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-subtle" />
              <span className="font-semibold text-ink tnum">
                {formatValue(pending.field.extracted.field_name, pending.newValue)}
              </span>
            </div>

            <ul className="flex flex-col gap-1.5" aria-label="Items that will recompute">
              {dependents.map((d) => (
                <li key={d} className="flex items-center gap-2 text-sm text-body">
                  <RefreshCw aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
                  {d}
                </li>
              ))}
            </ul>

            <DialogFooter>
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={() => onConfirm(pending)}>Confirm this value</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
