import { useEffect, useState } from "react";
import { Check, Loader2, RotateCw } from "lucide-react";
import type { CalculationResult, ComputedCalculation } from "@/engine/types";
import { Button } from "@/components/ui/button";

function steps(calculation: ComputedCalculation): Array<{ label: string; detail: string }> {
  return [
    {
      label: "Gathering renter-confirmed inputs",
      detail: calculation.inputs
        .map((input) => `${input.name}: ${input.value}${input.unit ? ` ${input.unit}` : ""}`)
        .join(" · "),
    },
    {
      label: "Selecting the versioned formula",
      detail: `Formula version ${calculation.formula_version}`,
    },
    { label: "Computing deterministically", detail: calculation.formula },
    { label: "Done", detail: `Profile version ${calculation.profile_version}` },
  ];
}

export function CalculationTrace({
  title,
  calculation,
}: {
  title: string;
  calculation: CalculationResult | null;
}) {
  const computed = calculation?.status === "computed" ? calculation : null;
  const traceSteps = computed ? steps(computed) : [];
  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [activeStep, setActiveStep] = useState(reduceMotion ? traceSteps.length : 0);

  useEffect(() => {
    if (!computed || reduceMotion || activeStep >= traceSteps.length) return;
    const timer = window.setTimeout(() => setActiveStep((step) => step + 1), 550);
    return () => window.clearTimeout(timer);
  }, [activeStep, computed, reduceMotion, traceSteps.length]);

  if (!calculation || calculation.status === "blocked") {
    return (
      <section className="rounded-lg border border-status-warn-foreground/30 bg-status-warn p-4">
        <h3 className="font-semibold text-status-warn-foreground">{title}</h3>
        <p className="mt-1 text-sm text-status-warn-foreground">
          {calculation?.status === "blocked"
            ? calculation.explanation
            : "Confirm the required values to start this calculation."}
        </p>
      </section>
    );
  }

  const done = activeStep >= traceSteps.length;
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        {done ? (
          <Button variant="ghost" size="sm" onClick={() => setActiveStep(0)}>
            <RotateCw aria-hidden="true" className="size-3.5" /> Replay
          </Button>
        ) : null}
      </div>
      <ol className="mt-2 space-y-1" aria-live="polite">
        {traceSteps.map((step, index) => {
          const status = index < activeStep ? "done" : index === activeStep ? "active" : "pending";
          return (
            <li
              key={step.label}
              className={`flex items-start gap-2 rounded px-2 py-1.5 text-sm ${status === "active" ? "bg-status-info text-status-info-foreground" : ""}`}
            >
              <span className="mt-0.5 grid size-4 place-items-center" aria-hidden="true">
                {status === "done" ? (
                  <Check className="size-3.5 text-status-ok-foreground" />
                ) : null}
                {status === "active" ? <Loader2 className="size-3.5 animate-spin" /> : null}
                {status === "pending" ? <span className="size-2 rounded-full border" /> : null}
              </span>
              <span>
                <span className="block font-medium">{step.label}</span>
                {status !== "pending" ? (
                  <span className="block text-xs opacity-80">{step.detail}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
      {done ? (
        <div className="mt-3 rounded bg-status-ok px-3 py-2 text-status-ok-foreground">
          <p className="text-xs font-semibold uppercase">Computed</p>
          <p className="font-mono text-lg">
            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
              calculation.result_value,
            )}{" "}
            {calculation.result_unit}
          </p>
        </div>
      ) : null}
    </section>
  );
}
