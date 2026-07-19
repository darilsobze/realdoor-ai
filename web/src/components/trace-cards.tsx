// The three computation-trace cards. Every step label and detail is pulled
// from the real ComputedCalculation / ChecklistResult records — no invented
// actions, no fake retrieval. The "result" render is the same information the
// static panels showed, with a count-up / staggered reveal on a fresh play.
import { Calculator, ListChecks, Scale, SquareArrowOutUpRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/status-badge";
import { ComputationTrace, type TraceStep } from "@/components/computation-trace";
import {
  DISCLAIMER_TEXT,
  type Citation,
  type ComputedCalculation,
} from "@/contracts";
import { requirementTitle } from "@/lib/checklist";
import type { DerivedOutputs } from "@/lib/calculations";
import { useCountUp } from "@/lib/motion";
import { cn } from "@/lib/utils";

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const USD0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function MoneyCountUp({ value, play, className }: { value: number; play: boolean; className?: string }) {
  const n = useCountUp(Math.abs(value), play);
  return <span className={cn("tnum", className)}>{USD.format(n)}</span>;
}

function inputVal(calc: ComputedCalculation, name: string) {
  return calc.inputs.find((i) => i.name === name);
}

/** Annual income — 4 steps, result counts up. */
export function IncomeTraceCard({
  derived,
  profileVersion,
  autoPlay,
}: {
  derived: DerivedOutputs;
  profileVersion: number;
  autoPlay: boolean;
}) {
  const sources = [derived.wage, derived.benefit].filter(Boolean);
  const main = sources.length > 1 ? derived.totalIncome : (sources[0] ?? null);

  if (!main || main.status !== "computed") {
    return (
      <ComputationTrace
        traceKey={`income:v${profileVersion}`}
        icon={Calculator}
        title="Annual income (before taxes)"
        steps={[{ label: "Waiting on confirmed income" }]}
        autoPlay={false}
        announce=""
        result={() => (
          <p className="text-sm text-subtle">
            {main?.status === "blocked" ? main.explanation : "Confirm an income document to compute this."}
          </p>
        )}
      />
    );
  }

  const amount = inputVal(main, "amount");
  const freq = String(amount?.unit ?? "USD/period").split("/")[1] ?? "period";
  const multiplier = inputVal(main, "periods_per_year")?.value ?? "";
  const steps: TraceStep[] = [
    {
      label: "Gathering your confirmed values",
      detail: `Gross pay ${USD0.format(Number(amount?.value ?? 0))} · ${freq} · profile v${main.profile_version}`,
    },
    {
      label: "Selecting the formula",
      detail: `annualize v${main.formula_version} · ${freq} ×${multiplier}`,
    },
    { label: "Computing", detail: main.formula },
    { label: "Done" },
  ];

  return (
    <ComputationTrace
      traceKey={`income:v${profileVersion}`}
      icon={Calculator}
      title="Annual income (before taxes)"
      steps={steps}
      autoPlay={autoPlay}
      announce={`Annual income computed: ${USD.format(main.result_value)} per year.`}
      result={(play) => (
        <div className="flex flex-col gap-2">
          <p className="text-xl font-semibold text-ink">
            <MoneyCountUp value={main.result_value} play={play} />{" "}
            <span className="text-sm font-normal text-subtle">per year</span>
          </p>
          <p className="tnum rounded-md bg-muted px-2.5 py-1.5 text-xs text-body">
            {main.formula}
            <span className="ml-2 text-subtle">(formula v{main.formula_version}, rounded to cents)</span>
          </p>
          <p className="text-xs text-subtle">Inputs: confirmed values only (profile v{main.profile_version}).</p>
        </div>
      )}
    />
  );
}

/** Comparison — 5 steps, result counts up + disclaimer. */
export function ComparisonTraceCard({
  derived,
  citation,
  profileVersion,
  autoPlay,
  startDelayMs = 0,
}: {
  derived: DerivedOutputs;
  citation: Citation;
  profileVersion: number;
  autoPlay: boolean;
  startDelayMs?: number;
}) {
  const c = derived.comparison;
  if (!c || c.status !== "computed") {
    return (
      <ComputationTrace
        traceKey={`comparison:v${profileVersion}`}
        icon={Scale}
        title="Compared with the published income limit"
        steps={[{ label: "Waiting on confirmed income and household size" }]}
        autoPlay={false}
        announce=""
        result={() => (
          <p className="text-sm text-subtle">
            {c?.status === "blocked" ? c.explanation : "Confirm income and household size to compute this."}
          </p>
        )}
      />
    );
  }

  const income = inputVal(c, "annual_income");
  const hh = inputVal(c, "household_size");
  const limit = inputVal(c, "published_threshold");
  const diff = c.result_value;

  const steps: TraceStep[] = [
    { label: "Loading the published table", detail: `FY${citation.rule_year} MTSP, frozen corpus` },
    {
      label: "Selecting your household row",
      detail: `${String(hh?.value)}-person household → ${USD0.format(Number(limit?.value))}`,
    },
    {
      label: "Reading the source",
      detail: `${citation.section}, p. ${citation.page} · effective ${citation.effective_date}`,
    },
    {
      label: "Comparing",
      detail: `${USD0.format(Number(income?.value))} − ${USD0.format(Number(limit?.value))}`,
    },
    { label: "Done" },
  ];

  return (
    <ComputationTrace
      traceKey={`comparison:v${profileVersion}`}
      icon={Scale}
      title="Compared with the published income limit"
      steps={steps}
      autoPlay={autoPlay}
      startDelayMs={startDelayMs}
      announce={`Comparison computed: ${USD.format(Math.abs(diff))} ${diff <= 0 ? "under" : "over"} the published limit.`}
      result={(play) => (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-body">
            Published limit for a {String(hh?.value)}-person household:{" "}
            <span className="tnum font-semibold text-ink">{USD.format(Number(limit?.value))}</span> per year.
          </p>
          <p className="text-xl font-semibold text-ink">
            <MoneyCountUp value={diff} play={play} />{" "}
            <span className="text-sm font-normal text-subtle">
              {diff <= 0 ? "under" : "over"} the published limit
            </span>
          </p>
          <p className="tnum rounded-md bg-muted px-2.5 py-1.5 text-xs text-body">
            {c.formula}
            <span className="ml-2 text-subtle">(formula v{c.formula_version}, rounded to cents)</span>
          </p>
          <p className="text-xs text-subtle">
            {citation.section}, p. {citation.page} · rule {c.source_rule_id} · effective{" "}
            {citation.effective_date} · program {citation.program_id} {citation.rule_year}
          </p>
          {citation.official_source?.startsWith("http") && (
            <a
              href={citation.official_source}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-1 text-xs text-primary underline underline-offset-2"
            >
              <SquareArrowOutUpRight aria-hidden="true" className="size-3" />
              View official table
            </a>
          )}
          <Separator />
          <p className="text-sm text-body">{DISCLAIMER_TEXT}</p>
        </div>
      )}
    />
  );
}

/** Checklist — 3 method steps, then rows resolve one by one (staggered). */
export function ChecklistTraceCard({
  derived,
  checklistVersion,
  matchedSummary,
  profileVersion,
  autoPlay,
}: {
  derived: DerivedOutputs;
  checklistVersion: string;
  matchedSummary: string;
  profileVersion: number;
  autoPlay: boolean;
}) {
  const steps: TraceStep[] = [
    { label: "Loading the frozen checklist", detail: checklistVersion },
    { label: "Matching your confirmed documents", detail: matchedSummary },
    { label: "Checking dates and applicability" },
  ];

  return (
    <ComputationTrace
      traceKey={`checklist:v${profileVersion}`}
      icon={ListChecks}
      title="Application checklist"
      steps={steps}
      autoPlay={autoPlay}
      announce={`Checklist evaluated: ${derived.checklist.length} requirements.`}
      result={(play) => (
        <div className="flex flex-col gap-2.5">
          <ul className="flex flex-col gap-2.5">
            {derived.checklist.map((row, i) => (
              <li
                key={row.requirement_id}
                className={cn("flex flex-col gap-0.5", play && "animate-fade-up-fast")}
                style={play ? { animationDelay: `${i * 150}ms` } : undefined}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink">{requirementTitle(row.requirement_id)}</span>
                  <StatusBadge variant={row.status} />
                </div>
                <p className="text-xs text-subtle">{row.explanation}</p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-subtle">
            Evaluated against the frozen checklist ({checklistVersion}) using your confirmed values only.
          </p>
        </div>
      )}
    />
  );
}
