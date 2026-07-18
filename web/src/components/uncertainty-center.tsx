// Sticky "uncertainty center": how many values need attention, each row a
// jump-link to the first matching field card. Counts only — no percentages,
// no scores, ever.
import { CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ReviewField } from "@/store/review";

function focusField(id: string) {
  const el = document.getElementById(`field-card-${id}`);
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
  (el as HTMLElement | null)?.focus({ preventScroll: true });
}

export function UncertaintyCenter({ fields }: { fields: ReviewField[] }) {
  const needConfirmation = fields.filter((f) => f.state === "proposed" || f.state === "corrected");
  const couldNotRead = fields.filter((f) => f.state === "unresolved");
  const confirmed = fields.filter((f) => f.state === "confirmed");

  const rows = [
    {
      icon: TriangleAlert,
      tone: "text-status-attention",
      count: needConfirmation.length,
      label: needConfirmation.length === 1 ? "value needs your confirmation" : "values need your confirmation",
      target: needConfirmation[0]?.extracted.id,
    },
    {
      icon: Info,
      tone: "text-status-info",
      count: couldNotRead.length,
      label: couldNotRead.length === 1 ? "value could not be read" : "values could not be read",
      target: couldNotRead[0]?.extracted.id,
    },
    {
      icon: CheckCircle2,
      tone: "text-status-confirmed",
      count: confirmed.length,
      label: confirmed.length === 1 ? "value confirmed by you" : "values confirmed by you",
      target: confirmed[0]?.extracted.id,
    },
  ];

  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4" aria-live="polite">
        <h2 className="mb-1 text-sm font-semibold text-ink">Where things stand</h2>
        {rows.map(({ icon: Icon, tone, count, label, target }) => (
          <button
            key={label}
            type="button"
            disabled={!target}
            onClick={() => target && focusField(target)}
            className="flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm text-body enabled:hover:bg-muted disabled:opacity-60"
          >
            <Icon aria-hidden="true" className={`size-4 shrink-0 ${tone}`} />
            <span>
              <span className="font-semibold tnum">{count}</span> {label}
            </span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
