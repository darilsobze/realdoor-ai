import type { CalculationResult } from "@/domain/types";
import { Calculator } from "lucide-react";

export function FormulaBlock({ calc }: { calc: CalculationResult }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-4">
      <div className="flex items-center gap-2">
        <Calculator aria-hidden="true" className="size-4 text-primary" />
        <p className="text-sm font-semibold">{calc.label}</p>
        <span className="ml-auto rounded bg-background px-2 py-0.5 font-mono text-xs text-muted-foreground">
          {calc.formulaVersion}
        </span>
      </div>
      <ol className="mt-3 space-y-1 font-mono text-sm text-foreground">
        {calc.steps.map((s, i) => (
          <li key={i}>
            <span className="text-muted-foreground">{i + 1}.</span> {s}
          </li>
        ))}
      </ol>
      <p className="mt-3 rounded bg-card px-3 py-2 text-sm">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Deterministic result
        </span>
        <br />
        <span className="font-mono text-base">
          ${calc.result.value.toLocaleString()} {calc.result.unit}
        </span>
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        This math runs in deterministic, unit-tested code — not the language model.
      </p>
    </div>
  );
}
