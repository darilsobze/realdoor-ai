// Everything computed from the confirmed profile: annualization, threshold
// comparison, checklist (waiting on Emmanuel's engine), packet preview summary.
// No caching — parents recompute via lib/calculations on every store change.
// Blocked calculations are calm info panels: abstaining is correct behavior.
import { Calculator, FileText, Info, ListChecks, Scale } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  DISCLAIMER_TEXT,
  type BlockedCalculation,
  type CalculationResult,
  type Citation,
  type ComputedCalculation,
} from "@/contracts";
import { FIELD_META, formatValue } from "@/lib/field-meta";
import { requirementTitle } from "@/lib/checklist";
import type { DerivedOutputs } from "@/lib/calculations";
import { StatusBadge } from "@/components/status-badge";
import type { ReviewField } from "@/store/review";
import { cn } from "@/lib/utils";

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function BlockedPanel({ calc, onJumpToField }: { calc: BlockedCalculation; onJumpToField: (field: string) => void }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-status-info-bg p-3 text-sm">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-status-info" />
      <div>
        <p className="text-body">{calc.explanation}</p>
        {calc.blocking_fields.length > 0 && (
          <p className="mt-1">
            {calc.blocking_fields.map((f) => (
              <button
                key={f}
                type="button"
                className="mr-3 text-status-info underline underline-offset-2"
                onClick={() => onJumpToField(f)}
              >
                Fix: {f === "household_size" ? "household size" : (FIELD_META[f as keyof typeof FIELD_META]?.label ?? f).toLowerCase()}
              </button>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}

function PanelShell({
  icon: Icon,
  title,
  pulseKey,
  children,
}: {
  icon: LucideIcon;
  title: string;
  pulseKey: string | number;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
          <Icon aria-hidden="true" className="size-4 text-primary" />
          {title}
        </h3>
        {/* key restarts the pulse when the underlying value recomputes */}
        <div key={pulseKey} className="animate-value-pulse rounded-md">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

function FormulaLine({ calc }: { calc: ComputedCalculation }) {
  return (
    <p className="tnum rounded-md bg-muted px-2.5 py-1.5 text-xs text-body">
      {calc.formula}
      <span className="ml-2 text-subtle">
        (formula v{calc.formula_version}, rounded to cents)
      </span>
    </p>
  );
}

export function AnnualIncomePanel({
  derived,
  profileVersion,
  onJumpToField,
}: {
  derived: DerivedOutputs;
  profileVersion: number;
  onJumpToField: (field: string) => void;
}) {
  // Show the total when several sources exist; otherwise the single wage/benefit result.
  const sources = [derived.wage, derived.benefit].filter(Boolean) as CalculationResult[];
  const main = sources.length > 1 ? derived.totalIncome : (sources[0] ?? null);

  return (
    <PanelShell icon={Calculator} title="Annual income (before taxes)" pulseKey={profileVersion}>
      {main === null ? (
        <p className="text-sm text-subtle">
          Upload and confirm an income document to compute this.
        </p>
      ) : main.status === "blocked" ? (
        <BlockedPanel calc={main} onJumpToField={onJumpToField} />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="tnum text-xl font-semibold text-ink">
            {USD.format(main.result_value)} <span className="text-sm font-normal text-subtle">per year</span>
          </p>
          <FormulaLine calc={main} />
          <p className="text-xs text-subtle">
            Inputs: confirmed values only (profile v{main.profile_version}).
          </p>
        </div>
      )}
    </PanelShell>
  );
}

export function ComparisonPanel({
  derived,
  citation,
  profileVersion,
  onJumpToField,
}: {
  derived: DerivedOutputs;
  citation: Citation;
  profileVersion: number;
  onJumpToField: (field: string) => void;
}) {
  const comparison = derived.comparison;
  return (
    <PanelShell icon={Scale} title="Compared with the published income limit" pulseKey={profileVersion}>
      {comparison === null ? (
        <p className="text-sm text-subtle">
          Computed once an income document is confirmed.
        </p>
      ) : comparison.status === "blocked" ? (
        <BlockedPanel calc={comparison} onJumpToField={onJumpToField} />
      ) : (
        <div className="flex flex-col gap-2">
          {(() => {
            const limit = comparison.inputs.find((i) => i.name === "published_threshold");
            const hh = comparison.inputs.find((i) => i.name === "household_size");
            const diff = comparison.result_value;
            return (
              <>
                <p className="text-sm text-body">
                  Published limit for a {String(hh?.value)}-person household:{" "}
                  <span className="tnum font-semibold text-ink">
                    {USD.format(Number(limit?.value))}
                  </span>{" "}
                  per year.
                </p>
                <p className="tnum text-xl font-semibold text-ink">
                  {USD.format(Math.abs(diff))}{" "}
                  <span className="text-sm font-normal text-subtle">
                    {diff <= 0 ? "under" : "over"} the published limit
                  </span>
                </p>
                <FormulaLine calc={comparison} />
                <p className="text-xs text-subtle">
                  {citation.section}, p. {citation.page} · rule {comparison.source_rule_id} ·
                  effective {citation.effective_date} · program {citation.program_id} {citation.rule_year}
                </p>
                <Separator />
                <p className="text-sm text-body">{DISCLAIMER_TEXT}</p>
              </>
            );
          })()}
        </div>
      )}
    </PanelShell>
  );
}

export function ChecklistPanel({
  derived,
  checklistVersion,
  profileVersion,
}: {
  derived: DerivedOutputs;
  checklistVersion: string;
  profileVersion: number;
}) {
  return (
    <PanelShell icon={ListChecks} title="Application checklist" pulseKey={profileVersion}>
      <ul className="flex flex-col gap-2.5">
        {derived.checklist.map((row) => (
          <li key={row.requirement_id} className="flex flex-col gap-0.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-ink">
                {requirementTitle(row.requirement_id)}
              </span>
              <StatusBadge variant={row.status} />
            </div>
            <p className="text-xs text-subtle">{row.explanation}</p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-subtle">
        Evaluated against the frozen checklist ({checklistVersion}) using your
        confirmed values only.
      </p>
    </PanelShell>
  );
}

export function PacketPreviewPanel({
  fields,
  derived,
  profileVersion,
}: {
  fields: ReviewField[];
  derived: DerivedOutputs;
  profileVersion: number;
}) {
  const confirmed = fields.filter((f) => f.state === "confirmed");
  const computedCount = [derived.wage, derived.benefit, derived.totalIncome, derived.comparison]
    .filter((c) => c?.status === "computed").length;
  const unresolved = fields.filter((f) => f.state === "unresolved" || f.state === "proposed");

  return (
    <PanelShell icon={FileText} title="Application packet (preview)" pulseKey={profileVersion}>
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="tnum">Profile v{profileVersion}</Badge>
          <span className="text-subtle tnum">
            {confirmed.length} confirmed {confirmed.length === 1 ? "value" : "values"} ·{" "}
            {computedCount} {computedCount === 1 ? "calculation" : "calculations"} ·{" "}
            {unresolved.length} unresolved
          </span>
        </div>
        {confirmed.length === 0 ? (
          <p className="text-subtle">Confirm values to add them to your packet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {confirmed.map((f) => (
              <li key={f.extracted.id} className={cn("flex justify-between gap-3")}>
                <span className="text-body">{FIELD_META[f.extracted.field_name].label}</span>
                <span className="tnum font-medium text-ink">
                  {formatValue(f.extracted.field_name, f.confirmedValue)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-subtle">
          The full packet (cover, evidence references, calculation sheet,
          checklist, manifest) arrives with the packet builder. Download only,
          started by you — never sent anywhere.
        </p>
      </div>
    </PanelShell>
  );
}
