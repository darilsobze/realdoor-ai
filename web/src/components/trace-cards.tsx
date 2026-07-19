// The three computation-trace cards. Every step label and detail is pulled
// from the real ComputedCalculation / ChecklistResult records. The retrieval
// step reads the FROZEN LOCAL CORPUS (data/rules/rules.json) — the app does no
// web search — and "View the sources" lists the real citation objects.
import {
  Brain,
  Calculator,
  ClipboardList,
  ListChecks,
  Scale,
  ScanSearch,
  Search,
  SquareArrowOutUpRight,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/status-badge";
import { ComputationTrace, type TraceSource, type TraceStep } from "@/components/computation-trace";
import {
  DISCLAIMER_TEXT,
  type Citation,
  type ComputedCalculation,
} from "@/contracts";
import { requirementTitle, GOLD_CHECKLIST } from "@/lib/checklist";
import { ruleById } from "@/lib/rules";
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

/** The frozen corpus rule behind a calculation, as a source entry. */
function ruleSource(ruleId: string | null, label: string): TraceSource | null {
  const rule = ruleId ? ruleById(ruleId) : null;
  if (!rule) return null;
  const c = rule.citation;
  const authorityLabel =
    c.rule_version.includes("frozen") && rule.authority === "hackathon_simulation"
      ? "Frozen challenge convention"
      : "Official source";
  return {
    label,
    sublabel: `${authorityLabel} · rule ${rule.rule_id}${c.page ? ` · p. ${c.page}` : ""} · effective ${c.effective_date}`,
    href: c.official_source?.startsWith("http") ? c.official_source : undefined,
  };
}

/** Annual income — thinking → search internal → formula found → computing → done. */
export function IncomeTraceCard({
  derived,
  profileVersion,
  autoPlay,
  startLabel,
  idlePrompt,
}: {
  derived: DerivedOutputs;
  profileVersion: number;
  autoPlay: boolean;
  startLabel?: string;
  idlePrompt?: string;
}) {
  const sources = [derived.wage, derived.benefit].filter(Boolean);
  const main = sources.length > 1 ? derived.totalIncome : (sources[0] ?? null);

  if (!main || main.status !== "computed") {
    return (
      <ComputationTrace
        traceKey={`income:v${profileVersion}`}
        icon={Calculator}
        title="Annual income (before taxes)"
        steps={[{ label: "Waiting on confirmed income", icon: Brain }]}
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
    { label: "Reading your confirmed values", icon: Brain, detail: `Gross pay ${USD0.format(Number(amount?.value ?? 0))} · ${freq} · profile v${main.profile_version}` },
    { label: "Searching the internal rule library", icon: Search, detail: GOLD_CHECKLIST.checklist_version.replace("application_checklists_", "corpus ").slice(0, 34) },
    { label: "Relevant formula found", icon: ScanSearch, detail: `annualize v${main.formula_version} · ${freq} ×${multiplier}` },
    { label: "Computing", icon: Calculator, detail: main.formula },
    { label: "Done", icon: Calculator },
  ];

  const src = ruleSource(main.source_rule_id, "Income annualization method");

  return (
    <ComputationTrace
      traceKey={`income:v${profileVersion}`}
      icon={Calculator}
      title="Annual income (before taxes)"
      steps={steps}
      autoPlay={autoPlay}
      startLabel={startLabel}
      idlePrompt={idlePrompt}
      replayLabel="Recalculate"
      announce={`Annual income computed: ${USD.format(main.result_value)} per year.`}
      sources={[
        ...(src ? [src] : []),
        { label: "Your confirmed values", sublabel: `Reviewed on your document · profile v${main.profile_version}` },
      ]}
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

/** Comparison — thinking → search internal → table found → household row → compare → done. */
export function ComparisonTraceCard({
  derived,
  citation,
  profileVersion,
  autoPlay,
  startDelayMs = 0,
  startLabel,
  idlePrompt,
}: {
  derived: DerivedOutputs;
  citation: Citation;
  profileVersion: number;
  autoPlay: boolean;
  startDelayMs?: number;
  startLabel?: string;
  idlePrompt?: string;
}) {
  const c = derived.comparison;
  if (!c || c.status !== "computed") {
    return (
      <ComputationTrace
        traceKey={`comparison:v${profileVersion}`}
        icon={Scale}
        title="Compared with the published income limit"
        steps={[{ label: "Waiting on confirmed income and household size", icon: Brain }]}
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
    { label: "Reading your annual income", icon: Brain, detail: `${USD0.format(Number(income?.value))} per year` },
    { label: "Searching the internal rule library", icon: Search, detail: `FY${citation.rule_year} MTSP, frozen corpus` },
    { label: "Published limit table found", icon: ScanSearch, detail: `${citation.section}, p. ${citation.page}` },
    { label: "Selecting your household row", icon: Scale, detail: `${String(hh?.value)}-person household → ${USD0.format(Number(limit?.value))}` },
    { label: "Comparing", icon: Scale, detail: `${USD0.format(Number(income?.value))} − ${USD0.format(Number(limit?.value))}` },
    { label: "Done", icon: Scale },
  ];

  return (
    <ComputationTrace
      traceKey={`comparison:v${profileVersion}`}
      icon={Scale}
      title="Compared with the published income limit"
      steps={steps}
      autoPlay={autoPlay}
      startDelayMs={startDelayMs}
      startLabel={startLabel}
      idlePrompt={idlePrompt}
      replayLabel="Recompare"
      announce={`Comparison computed: ${USD.format(Math.abs(diff))} ${diff <= 0 ? "under" : "over"} the published limit.`}
      sources={[
        {
          label: "FY2026 MTSP income limits (60%)",
          sublabel: `${citation.section}, p. ${citation.page} · effective ${citation.effective_date}`,
          href: citation.official_source?.startsWith("http") ? citation.official_source : undefined,
        },
        ...(ruleSource(c.source_rule_id, "Threshold comparison rule") ? [ruleSource(c.source_rule_id, "Threshold comparison rule")!] : []),
      ]}
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

/** Checklist — thinking → load checklist → match → check → done; rows stagger in. */
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
    { label: "Reading your confirmed documents", icon: Brain, detail: matchedSummary },
    { label: "Loading the frozen checklist", icon: Search, detail: checklistVersion },
    { label: "Matching documents to requirements", icon: ScanSearch },
    { label: "Checking dates and applicability", icon: ClipboardList },
    { label: "Done", icon: ListChecks },
  ];

  return (
    <ComputationTrace
      traceKey={`checklist:v${profileVersion}`}
      icon={ListChecks}
      title="Application checklist"
      steps={steps}
      autoPlay={autoPlay}
      replayLabel="Re-check"
      announce={`Checklist evaluated: ${derived.checklist.length} requirements.`}
      sources={[
        { label: "Frozen application checklist", sublabel: `${checklistVersion} · organizer reference` },
        { label: "Your confirmed documents", sublabel: matchedSummary },
      ]}
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
        </div>
      )}
    />
  );
}
