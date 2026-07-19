// "Extraction summary" status hero: the three counts as large stat items
// (number prominent, label under), each a jump-link to the first matching
// field. Icon + text semantics; no percentages, no scores. Given extra visual
// weight via a primary-tinted top edge.
import { CheckCircle2, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReviewField } from "@/store/review";

function focusField(id: string) {
  const el = document.getElementById(`field-card-${id}`);
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
  (el as HTMLElement | null)?.focus({ preventScroll: true });
}

interface Stat {
  icon: LucideIcon;
  tone: string;
  count: number;
  label: string;
  target?: string;
}

export function UncertaintyCenter({ fields }: { fields: ReviewField[] }) {
  const needConfirmation = fields.filter((f) => f.state === "proposed" || f.state === "corrected");
  const couldNotRead = fields.filter((f) => f.state === "unresolved");
  const confirmed = fields.filter((f) => f.state === "confirmed");

  const stats: Stat[] = [
    {
      icon: TriangleAlert,
      tone: "text-status-attention",
      count: needConfirmation.length,
      label: needConfirmation.length === 1 ? "needs your confirmation" : "need your confirmation",
      target: needConfirmation[0]?.extracted.id,
    },
    {
      icon: Info,
      tone: "text-status-info",
      count: couldNotRead.length,
      label: couldNotRead.length === 1 ? "could not be read" : "could not be read",
      target: couldNotRead[0]?.extracted.id,
    },
    {
      icon: CheckCircle2,
      tone: "text-status-confirmed",
      count: confirmed.length,
      label: confirmed.length === 1 ? "confirmed by you" : "confirmed by you",
      target: confirmed[0]?.extracted.id,
    },
  ];

  return (
    <Card className="overflow-hidden border-t-2 border-t-primary shadow-card">
      <CardContent className="flex flex-col gap-3 p-4">
        <h2 className="text-sm font-semibold text-ink">Extraction summary</h2>
        <ul className="grid grid-cols-3 gap-2">
          {stats.map(({ icon: Icon, tone, count, label, target }) => (
            <li key={label}>
              <button
                type="button"
                disabled={!target}
                onClick={() => target && focusField(target)}
                className={cn(
                  "flex h-full w-full flex-col items-start gap-1 rounded-lg border bg-background p-3 text-left transition-colors duration-150",
                  target ? "hover:border-primary/40 hover:bg-muted" : "opacity-70",
                )}
              >
                <Icon aria-hidden="true" className={cn("size-4", tone)} />
                <span className="tnum text-2xl font-semibold text-ink leading-none">{count}</span>
                <span className="text-xs text-subtle">{label}</span>
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
