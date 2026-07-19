// Renter-stated household size (attestation, never extracted). Selects the
// row in the published income-limit table — used for nothing else.
import { useId, useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";

export function HouseholdSizeCard({
  value,
  confirmedAt,
  onConfirm,
}: {
  value: number | null;
  confirmedAt: string | null;
  onConfirm: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value !== null ? String(value) : "");
  const inputId = useId();
  const helperId = useId();
  const parsed = Number(draft);
  const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 8;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
              <Users aria-hidden="true" className="size-4 text-primary" />
              Household size
            </h3>
            <p id={helperId} className="text-xs text-subtle">
              How many people will live in the home. This picks the row in the
              published income-limit table — nothing else.
            </p>
          </div>
          {confirmedAt ? (
            <StatusBadge variant="confirmed" label="Confirmed by you" />
          ) : (
            <StatusBadge variant="needs_confirmation" label="Needed for the comparison" />
          )}
        </div>

        {confirmedAt && !editing ? (
          <div className="flex items-center gap-3">
            <p className="tnum text-xl font-semibold text-ink">
              {value} {value === 1 ? "person" : "people"}
            </p>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Change
            </Button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) {
                onConfirm(parsed);
                setEditing(false);
              }
            }}
          >
            <Label htmlFor={inputId}>Number of people (1–8)</Label>
            <div className="flex gap-2">
              <Input
                id={inputId}
                type="number"
                min={1}
                max={8}
                inputMode="numeric"
                className="w-24"
                value={draft}
                aria-describedby={helperId}
                onChange={(e) => setDraft(e.target.value)}
              />
              <Button type="submit" size="sm" disabled={!valid}>
                Confirm household size
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
