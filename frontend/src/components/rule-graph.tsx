import { useEffect, useId, useRef, useState } from "react";
import {
  BadgeCheck,
  Calculator,
  ScrollText,
  Scale,
  ArrowDownRight,
  ArrowRight,
} from "lucide-react";
import type { CalculationResult, RuleRecord } from "@/domain/types";
import type { IncomeComparison } from "@/domain/calc";

type NodeId = "input" | "formula" | "limit" | "comparison";

export type RuleGraphProps = {
  incomeRule: RuleRecord;
  calc: CalculationResult | null;
  comparison: IncomeComparison | null;
  householdSize: number | null;
  grossField: {
    value: number | string | null;
    confirmedAt?: string;
    docLabel?: string;
  } | null;
};

/**
 * Animated rule-graph visualization for Step 2 (Understand).
 * Every node maps to a traceable artifact: confirmed input, formula,
 * published limit, and a neutral comparison. Never uses color as the
 * sole signal — status is always text + icon.
 */
export function RuleGraph({
  incomeRule,
  calc,
  comparison,
  householdSize,
  grossField,
}: RuleGraphProps) {
  const [selected, setSelected] = useState<NodeId>("input");
  const uid = useId();
  const arrowId = `arrow-${uid}`;
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Trigger edge draw-in animation after mount.
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const grossValue =
    grossField && typeof grossField.value === "number" ? (grossField.value as number) : null;

  const nodes: Record<
    NodeId,
    {
      title: string;
      kind: string;
      icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
      summary: React.ReactNode;
      evidence: React.ReactNode;
    }
  > = {
    input: {
      title: "Renter-confirmed input",
      kind: "Verified input",
      icon: BadgeCheck,
      summary:
        grossValue != null ? (
          <dl className="grid gap-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Gross pay (period)</dt>
              <dd className="font-mono font-semibold">${grossValue.toFixed(2)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Household size</dt>
              <dd className="font-mono font-semibold">{householdSize ?? "—"}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">No confirmed pay-stub value yet.</p>
        ),
      evidence: (
        <>
          <p className="font-semibold">Source of this input</p>
          <p className="mt-1">
            Value came from a renter-confirmed field on{" "}
            <span className="font-medium">Step 1: Profile</span>
            {grossField?.docLabel ? (
              <>
                {" "}
                · document <em>{grossField.docLabel}</em>
              </>
            ) : null}
            . It is never reused until the renter confirms or corrects it.
          </p>
          {grossField?.confirmedAt ? (
            <p className="mt-1 text-muted-foreground">
              Confirmed at {new Date(grossField.confirmedAt).toLocaleString()}
            </p>
          ) : null}
        </>
      ),
    },
    formula: {
      title: "Annualization formula",
      kind: "Deterministic math",
      icon: Calculator,
      summary: calc ? (
        <div>
          <p className="text-xs italic text-muted-foreground">{calc.steps[1]}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            ${calc.result.value.toLocaleString()}
            <span className="ml-1 text-xs font-normal text-muted-foreground">/year</span>
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Awaiting a confirmed gross pay value.</p>
      ),
      evidence: (
        <>
          <p className="font-semibold">Formula & version</p>
          <p className="mt-1 font-mono text-xs">{calc?.formulaVersion ?? "annualize_pay@v1"}</p>
          <ul className="mt-2 list-disc space-y-0.5 pl-4">
            {(calc?.steps ?? ["gross_pay_period × 26 pay periods = annual income"]).map((s, i) => (
              <li key={i} className="font-mono">
                {s}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-muted-foreground">
            Simulated. Deterministic — the language model does not perform this math.
          </p>
        </>
      ),
    },
    limit: {
      title: "Published limit",
      kind: "Program benchmark",
      icon: ScrollText,
      summary: (
        <div className="grid gap-1 text-sm">
          <p className="text-xs text-muted-foreground">{incomeRule.title}</p>
          <p>
            <span className="text-muted-foreground">Household size:</span>{" "}
            <span className="font-semibold">{householdSize ?? "—"}</span>
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {comparison && comparison.comparison !== "insufficient_data"
              ? `$${comparison.publishedLimit.toLocaleString()}`
              : "—"}
          </p>
        </div>
      ),
      evidence: (
        <>
          <p className="font-semibold">Source & effective date</p>
          <p className="mt-1">
            {incomeRule.program} · rule version {incomeRule.ruleVersion}
          </p>
          <p className="mt-0.5 text-muted-foreground">
            {incomeRule.section} · effective {incomeRule.effectiveDate}
          </p>
          <p className="mt-2">Table: {incomeRule.threshold?.tableName ?? "—"}</p>
          <p className="mt-2 text-muted-foreground">
            {incomeRule.limitations[0] ?? "Simulated rule content."}
          </p>
        </>
      ),
    },
    comparison: {
      title: "Neutral comparison",
      kind: "Factual, not a verdict",
      icon: Scale,
      summary:
        comparison && comparison.comparison !== "insufficient_data" ? (
          <div className="grid gap-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Annualized income</p>
                <p className="font-mono text-base font-semibold">
                  ${comparison.annualIncome.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Published limit</p>
                <p className="font-mono text-base font-semibold">
                  ${comparison.publishedLimit.toLocaleString()}
                </p>
              </div>
            </div>
            <p className="text-sm">
              <span className="text-muted-foreground">Signed difference:</span>{" "}
              <span className="font-semibold">
                {comparison.differenceUSD == null
                  ? "—"
                  : comparison.differenceUSD > 0
                    ? `$${comparison.differenceUSD.toLocaleString()} under limit`
                    : comparison.differenceUSD < 0
                      ? `$${Math.abs(comparison.differenceUSD).toLocaleString()} over limit`
                      : "exactly at the published limit"}
              </span>
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Not enough confirmed data to compare.</p>
        ),
      evidence: (
        <>
          <p className="font-semibold">What this is — and isn't</p>
          <p className="mt-1">
            A neutral, factual comparison between your annualized confirmed income and the published
            limit for your household size. It is
            <em> not</em> an eligibility decision, score, ranking, or probability. A human reviewer
            decides eligibility.
          </p>
        </>
      ),
    },
  };

  const order: NodeId[] = ["input", "formula", "limit", "comparison"];
  const active = nodes[selected];

  return (
    <section
      aria-labelledby="rule-graph-heading"
      className="rounded-xl border border-border bg-card"
    >
      <header className="border-b border-border px-5 py-4">
        <h2 id="rule-graph-heading" className="text-lg font-semibold">
          Rule logic map
        </h2>
        <p className="text-sm text-muted-foreground">
          Every node is traceable: renter-confirmed input → deterministic formula → published limit
          → neutral comparison.
        </p>
      </header>

      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Graph canvas */}
        <div className="relative">
          <div className="relative grid grid-cols-2 gap-x-10 gap-y-8">
            {/* SVG connector layer */}
            <svg
              ref={svgRef}
              aria-hidden="true"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              <defs>
                <marker
                  id={arrowId}
                  markerWidth="6"
                  markerHeight="6"
                  refX="5"
                  refY="3"
                  orient="auto"
                  markerUnits="userSpaceOnUse"
                >
                  <polygon
                    points="0 0, 6 3, 0 6"
                    fill="currentColor"
                    className="text-muted-foreground"
                  />
                </marker>
              </defs>
              <g
                stroke="currentColor"
                className="text-border"
                strokeWidth={0.6}
                strokeDasharray="1.6 1.6"
                fill="none"
                vectorEffect="non-scaling-stroke"
                style={{
                  strokeDashoffset: drawn ? 0 : 200,
                  transition: "stroke-dashoffset 900ms ease-out",
                }}
              >
                {/* input (top-left) → formula (top-right) */}
                <path d="M 30 18 L 50 18" markerEnd={`url(#${arrowId})`} />
                {/* formula (top-right) → comparison (bottom-right) */}
                <path d="M 75 32 L 75 62" markerEnd={`url(#${arrowId})`} />
                {/* limit (bottom-left) → comparison (bottom-right) */}
                <path d="M 30 82 L 50 82" markerEnd={`url(#${arrowId})`} />
              </g>
            </svg>

            {order.map((id, i) => {
              const n = nodes[id];
              const Icon = n.icon;
              const isSelected = selected === id;
              const isEmphasis = id === "comparison";
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelected(id)}
                  aria-pressed={isSelected}
                  aria-label={`${n.title} — ${n.kind}`}
                  className={[
                    "group relative z-10 flex flex-col items-start gap-3 rounded-lg border p-4 text-left transition-all duration-200 animate-fade-in",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring",
                    isSelected
                      ? "border-primary shadow-md ring-2 ring-primary/25"
                      : "border-border hover:border-primary/60 hover:shadow-sm",
                    isEmphasis ? "bg-primary text-primary-foreground" : "bg-background",
                  ].join(" ")}
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <div className="flex w-full items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={[
                        "flex size-8 shrink-0 items-center justify-center rounded-md",
                        isEmphasis ? "bg-primary-foreground/15" : "bg-secondary",
                      ].join(" ")}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="flex flex-col leading-tight">
                      <span
                        className={[
                          "text-[10px] font-bold uppercase tracking-wider",
                          isEmphasis ? "text-primary-foreground/80" : "text-muted-foreground",
                        ].join(" ")}
                      >
                        {n.kind}
                      </span>
                      <span className="text-sm font-semibold">{n.title}</span>
                    </div>
                    <span
                      aria-hidden="true"
                      className={[
                        "ml-auto text-xs opacity-0 transition-opacity duration-200",
                        isSelected ? "opacity-70" : "group-hover:opacity-50",
                      ].join(" ")}
                    >
                      {i < order.length - 1 ? (
                        <ArrowRight className="size-3.5" />
                      ) : (
                        <ArrowDownRight className="size-3.5" />
                      )}
                    </span>
                  </div>
                  <div className="w-full">{n.summary}</div>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Tip: use{" "}
            <kbd className="rounded border border-border bg-secondary px-1 py-0.5 font-mono text-[10px]">
              Tab
            </kbd>{" "}
            to move between nodes, then
            <kbd className="mx-1 rounded border border-border bg-secondary px-1 py-0.5 font-mono text-[10px]">
              Enter
            </kbd>{" "}
            to inspect evidence.
          </p>
        </div>

        {/* Evidence panel */}
        <aside
          aria-live="polite"
          aria-atomic="true"
          className="h-fit rounded-lg border border-border bg-background p-4 lg:sticky lg:top-4"
        >
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="flex size-7 items-center justify-center rounded-md bg-secondary"
            >
              <active.icon className="size-4" />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Evidence
              </span>
              <span className="text-sm font-semibold">{active.title}</span>
            </div>
          </div>
          <div key={selected} className="mt-3 space-y-2 text-sm animate-fade-in">
            {active.evidence}
          </div>
          <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
            Simulated rule data. This copilot never decides eligibility; it only shows the published
            number next to your confirmed input.
          </p>
        </aside>
      </div>
    </section>
  );
}
