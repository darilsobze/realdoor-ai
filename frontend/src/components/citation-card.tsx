import { ExternalLink, FileWarning } from "lucide-react";
import type { RuleRecord } from "@/domain/types";

export function CitationCard({ rule }: { rule: RuleRecord }) {
  return (
    <article className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{rule.section}</p>
          <h3 className="text-base font-semibold text-foreground">{rule.title}</h3>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>
            Rule version <span className="font-mono">{rule.ruleVersion}</span>
          </p>
          <p>Effective {rule.effectiveDate}</p>
        </div>
      </header>

      <p className="mt-2 text-sm leading-relaxed text-foreground">{rule.bodyText}</p>

      {rule.threshold ? (
        <div className="mt-3 overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <caption className="p-2 text-left text-xs text-muted-foreground">
              {rule.threshold.tableName} ({rule.threshold.unit}) — simulated placeholder
            </caption>
            <thead className="bg-secondary text-left">
              <tr>
                <th className="p-2 font-medium">Household size</th>
                <th className="p-2 font-medium">Published limit</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(rule.threshold.values).map(([k, v]) => (
                <tr key={k} className="border-t border-border">
                  <td className="p-2">{k}</td>
                  <td className="p-2 font-mono">${v.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {rule.limitations.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-status-warn px-3 py-2 text-status-warn-foreground">
          <FileWarning aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide">Limitations</p>
            <ul className="mt-1 list-inside list-disc text-sm">
              {rule.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <a
        href={rule.sourceUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-2 hover:underline"
      >
        View simulated source <ExternalLink aria-hidden="true" className="size-3.5" />
      </a>
    </article>
  );
}
