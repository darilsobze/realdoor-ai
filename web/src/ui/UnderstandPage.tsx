// "Understand" screen: free-text questions about the frozen rule corpus.
// The LLM only explains — every number shown as a threshold comes from the
// structured corpus (lib/rules), never from model text; deterministic math
// steps come from the engine via the confirmed-profile store. Refusals and
// abstentions render as calm informational panels: both are correct behavior.
import { useMemo, useState } from "react";
import { BookOpenCheck, Info, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { DISCLAIMER_TEXT } from "@/contracts";
import { ApiError, askRules, type RulesAskResponse } from "@/lib/api";
import { buildDerived } from "@/lib/calculations";
import { APP_SCOPE, SCORED_RULE, ruleById } from "@/lib/rules";
import { useReview } from "@/store/review";

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const AUTHORITY_LABELS: Record<string, string> = {
  official_hud: "Official HUD source",
  official_federal: "Official federal source",
  hackathon_simulation: "Hackathon challenge convention — not an official program rule",
};

const EXAMPLE_QUESTIONS = [
  "What is the income limit for a 3-person household?",
  "When do the FY 2026 limits take effect?",
];

/**
 * Belt and suspenders for "thresholds never from LLM text": if the model's
 * prose contains a dollar amount that is NOT present in the cited rule's own
 * threshold table, hide the prose and point at the structured data instead.
 */
function proseIsNumericallyGrounded(answer: string, ruleId: string | null): boolean {
  const amounts = [...answer.matchAll(/\$\s?([\d,]+(?:\.\d{1,2})?)/g)].map((m) =>
    Number(m[1].replaceAll(",", "")),
  );
  if (amounts.length === 0) return true;
  const rule = ruleId ? ruleById(ruleId) : null;
  const known = new Set((rule?.thresholds ?? []).map((t) => t.annual_income_limit_usd));
  return amounts.every((a) => known.has(a));
}

type AskState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "answered"; response: RulesAskResponse };

export function UnderstandPage() {
  const { state } = useReview();
  const [question, setQuestion] = useState("");
  const [ask, setAsk] = useState<AskState>({ kind: "idle" });

  const context = useMemo(
    () => ({ profileVersion: state.profileVersion, computedAt: state.lastChangedAt || "1970-01-01T00:00:00.000Z" }),
    [state.profileVersion, state.lastChangedAt],
  );
  const derived = useMemo(
    () => buildDerived(state.fields, state.householdSize, SCORED_RULE, context, state.document?.id ?? null),
    [state.fields, state.householdSize, context, state.document?.id],
  );

  async function submit(q: string) {
    const trimmed = q.trim();
    if (!trimmed || ask.kind === "loading") return;
    setAsk({ kind: "loading" });
    try {
      setAsk({ kind: "answered", response: await askRules(trimmed, APP_SCOPE) });
    } catch (err) {
      setAsk({
        kind: "error",
        message:
          err instanceof ApiError ? err.message : "Something went wrong. Please try again.",
      });
    }
  }

  const citedRule =
    ask.kind === "answered" && ask.response.citation
      ? ruleById(ask.response.citation.rule_id)
      : null;
  const householdSize = state.householdSize.confirmedAt ? state.householdSize.value : null;
  const structuredThreshold =
    citedRule?.thresholds && householdSize
      ? (citedRule.thresholds.find((t) => t.household_size === householdSize) ?? null)
      : null;

  return (
    <main className="mx-auto flex w-full max-w-(--container-reading) flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="text-xl">Understand the rules</h1>
        <p className="text-sm text-subtle">
          Answers come only from the frozen rule library, always with the source.
        </p>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void submit(question);
            }}
          >
            <Label htmlFor="rules-question">Your question about the program rules</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="rules-question"
                value={question}
                placeholder="e.g. What counts as income?"
                onChange={(e) => setQuestion(e.target.value)}
              />
              <Button type="submit" disabled={ask.kind === "loading" || question.trim() === ""}>
                <MessageCircleQuestion aria-hidden="true" data-icon="inline-start" />
                Ask
              </Button>
            </div>
          </form>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((q) => (
              <Button
                key={q}
                type="button"
                variant="outline"
                size="sm"
                className="h-auto whitespace-normal text-left"
                onClick={() => {
                  setQuestion(q);
                  void submit(q);
                }}
              >
                {q}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <p aria-live="polite" className="sr-only">
        {ask.kind === "loading"
          ? "Checking the rule library…"
          : ask.kind === "answered"
            ? "Answer ready."
            : ""}
      </p>

      {ask.kind === "loading" && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-5">
            <p className="text-sm text-subtle">Checking the rule library…</p>
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-4 w-2/5" />
          </CardContent>
        </Card>
      )}

      {ask.kind === "error" && (
        <div role="alert" className="rounded-lg border border-status-blocking/30 bg-status-blocking-bg p-4 text-sm text-status-blocking">
          {ask.message}
        </div>
      )}

      {ask.kind === "answered" && (ask.response.refusal || ask.response.abstained) && !ask.response.citation && (
        <div role="status" className="rounded-lg border border-status-info/20 bg-status-info-bg p-4">
          <div className="flex items-start gap-2.5">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-status-info" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-status-info">
                {ask.response.refusal ? "This tool doesn't make decisions" : "No authoritative rule found"}
              </p>
              <p className="text-sm text-body">{ask.response.answer}</p>
            </div>
          </div>
        </div>
      )}

      {ask.kind === "answered" && !ask.response.refusal && !ask.response.abstained && ask.response.citation && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <BookOpenCheck aria-hidden="true" className="size-4 text-primary" />
              Answer
            </h2>

            {proseIsNumericallyGrounded(ask.response.answer, ask.response.citation.rule_id) ? (
              <p className="text-body">{ask.response.answer}</p>
            ) : (
              <p className="text-body">
                See the published table below — the exact figures come from the
                cited source, not from generated text.
              </p>
            )}

            {structuredThreshold && (
              <p className="rounded-lg bg-muted px-3 py-2 text-sm text-body">
                Published limit for your confirmed household size ({householdSize}):{" "}
                <span className="tnum font-semibold text-ink">
                  {USD.format(structuredThreshold.annual_income_limit_usd)}
                </span>{" "}
                per year <span className="text-subtle">(from the table itself)</span>
              </p>
            )}
            {citedRule?.thresholds && !structuredThreshold && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">
                    Published annual income limits by household size
                  </caption>
                  <thead>
                    <tr className="text-left text-xs text-subtle">
                      <th scope="col" className="py-1 pr-4 font-medium">Household size</th>
                      <th scope="col" className="py-1 font-medium">Annual income limit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {citedRule.thresholds.map((t) => (
                      <tr key={t.household_size} className="border-t border-border">
                        <td className="tnum py-1 pr-4">{t.household_size}</td>
                        <td className="tnum py-1">{USD.format(t.annual_income_limit_usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Separator />
            <div className="flex flex-col gap-1 text-xs text-subtle">
              <p className="font-medium text-body">
                {AUTHORITY_LABELS[ask.response.citation.authority] ?? ask.response.citation.authority}
              </p>
              <p>
                {ask.response.citation.section ?? ask.response.citation.official_source}
                {ask.response.citation.page !== null && `, p. ${ask.response.citation.page}`} · rule{" "}
                {ask.response.citation.rule_id} · version {ask.response.citation.rule_version} ·
                effective {ask.response.citation.effective_date}
              </p>
            </div>
            <p className="text-sm text-body">{DISCLAIMER_TEXT}</p>
          </CardContent>
        </Card>
      )}

      <section aria-labelledby="your-numbers" className="flex flex-col gap-3">
        <h2 id="your-numbers" className="text-lg">
          Your numbers (computed deterministically)
        </h2>
        {derived.totalIncome === null && derived.wage === null ? (
          <p className="text-sm text-subtle">
            Upload and confirm an income document on the review screen and your
            annualization and comparison will appear here with their formulas.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {[derived.wage, derived.benefit, derived.totalIncome, derived.comparison]
              .filter((c) => c !== null)
              .map((calc, i) =>
                calc.status === "computed" ? (
                  <p key={i} className="tnum rounded-md bg-muted px-3 py-2 text-xs text-body">
                    {calc.formula}
                  </p>
                ) : (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-md bg-status-info-bg px-3 py-2 text-xs text-body"
                  >
                    <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-status-info" />
                    {calc.explanation}
                  </div>
                ),
              )}
            <p className="text-xs text-subtle">
              Formulas run in deterministic code on your confirmed values (profile v
              {state.profileVersion}) — never in a language model.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
