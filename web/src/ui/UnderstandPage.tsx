// "Understand" screen: free-text questions about the frozen rule corpus.
// The LLM only explains — every number shown as a threshold comes from the
// structured corpus (lib/rules), never from model text; deterministic math
// steps come from the engine via the confirmed-profile store. Refusals and
// abstentions render as calm informational panels: both are correct behavior.
import { useEffect, useMemo, useRef, useState } from "react";
import { Ban, BookOpenCheck, Brain, Info, Loader2, MessageCircleQuestion, MessageCircleReply, ScanSearch, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { DISCLAIMER_TEXT, type Rule, type ThresholdRow } from "@/contracts";
import { IncomeTraceCard, ComparisonTraceCard } from "@/components/trace-cards";
import { ComputationTrace, type TraceSource, type TraceStep } from "@/components/computation-trace";
import { ApiError, askRules, type RulesAskResponse } from "@/lib/api";
import { buildDerived } from "@/lib/calculations";
import { usePrefersReducedMotion } from "@/lib/motion";
import { APP_SCOPE, SCORED_RULE, ruleById } from "@/lib/rules";
import { useReview } from "@/store/review";

/** Truthful ask trace — the app answers ONLY from the frozen corpus (no web,
 *  no vector retrieval). Refusals happen deterministically before any lookup,
 *  so they show no "searching" step. */
function askSteps(question: string, r: RulesAskResponse): TraceStep[] {
  if (r.refusal) {
    return [
      { label: "Reading your question", icon: Brain },
      { label: "Recognized a decision request — declining before any lookup", icon: Ban },
    ];
  }
  const q = question.length > 52 ? `${question.slice(0, 52)}…` : question;
  const steps: TraceStep[] = [
    { label: "Reading your question", icon: Brain },
    { label: "Searching the frozen rule corpus", icon: Search, detail: q },
  ];
  if (r.citation) {
    steps.push({ label: "Relevant rule found", icon: ScanSearch, detail: `rule ${r.citation.rule_id}` });
    steps.push({ label: "Composing the answer from that rule", icon: MessageCircleReply });
  } else {
    steps.push({ label: "No authoritative rule found — abstaining", icon: ScanSearch });
  }
  return steps;
}

function askSources(r: RulesAskResponse): TraceSource[] {
  if (!r.citation) return [];
  const c = r.citation;
  return [
    {
      label: c.section ?? c.official_source,
      sublabel: `rule ${c.rule_id} · ${c.page !== null ? `p. ${c.page} · ` : ""}effective ${c.effective_date} · ${c.program_id} ${c.rule_year}`,
      href: c.official_source?.startsWith("http") ? c.official_source : undefined,
    },
  ];
}

// Auto-emphasis for answer prose: bold currency, percentages, dates, and
// FY-years so the key figures stand out. (Supplements the structured callouts;
// the exact numbers still come from the cited rule, not the model text.)
const RICH_SPLIT =
  /(\$[\d,]+(?:\.\d{2})?|\b\d{1,3}(?:\.\d+)?%|\b\d{4}-\d{2}-\d{2}\b|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b|\bFY\s?\d{4}\b)/;
function renderRich(text: string): React.ReactNode {
  return text.split(RICH_SPLIT).map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-ink tnum">{part}</strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-subtle">{children}</p>
  );
}

/** The answer body (revealed after the trace). Refusals/abstentions render as
 *  calm info panels; a grounded answer shows the prose (or the structured
 *  table when prose numbers aren't in the cited rule) + citation + disclaimer. */
function renderAnswerBody(
  r: RulesAskResponse,
  citedRule: Rule | null,
  structuredThreshold: ThresholdRow | null,
  householdSize: number | null,
): React.ReactNode {
  if (!r.citation) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg bg-status-info-bg p-3">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-status-info" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-status-info">
            {r.refusal ? "This tool doesn't make decisions" : "No authoritative rule found"}
          </p>
          <p className="text-sm text-body">{r.answer}</p>
        </div>
      </div>
    );
  }
  const official = r.citation.authority === "official_hud" || r.citation.authority === "official_federal";
  return (
    <div className="flex flex-col gap-4">
      {proseIsNumericallyGrounded(r.answer, r.citation.rule_id) ? (
        <p className="text-[0.95rem] leading-relaxed text-body">{renderRich(r.answer)}</p>
      ) : (
        <p className="text-[0.95rem] leading-relaxed text-body">
          See the published table below — the exact figures come from the cited
          source, not from generated text.
        </p>
      )}

      {structuredThreshold && (
        <div className="rounded-lg border border-primary/15 bg-accent/50 px-4 py-3">
          <SectionLabel>Published limit · {householdSize}-person household</SectionLabel>
          <p className="mt-0.5 text-2xl font-semibold text-ink tnum">
            {USD.format(structuredThreshold.annual_income_limit_usd)}
            <span className="ml-1.5 text-sm font-normal text-subtle">per year</span>
          </p>
          <p className="text-xs text-subtle">Read straight from the published table — not generated.</p>
        </div>
      )}
      {citedRule?.thresholds && !structuredThreshold && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">Published annual income limits by household size</caption>
            <thead>
              <tr className="bg-muted text-left text-xs text-subtle">
                <th scope="col" className="px-3 py-2 font-medium">Household size</th>
                <th scope="col" className="px-3 py-2 font-medium">Annual income limit</th>
              </tr>
            </thead>
            <tbody>
              {citedRule.thresholds.map((t) => (
                <tr key={t.household_size} className="border-t border-border">
                  <td className="tnum px-3 py-1.5">{t.household_size}</td>
                  <td className="tnum px-3 py-1.5 font-medium text-ink">{USD.format(t.annual_income_limit_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <SectionLabel>Source</SectionLabel>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", official ? "bg-status-confirmed-bg text-status-confirmed" : "bg-status-attention-bg text-status-attention")}>
            <ShieldCheck aria-hidden="true" className="size-3.5" />
            {AUTHORITY_LABELS[r.citation.authority] ?? r.citation.authority}
          </span>
        </p>
        <p className="text-xs text-subtle">
          <span className="text-body">{r.citation.section ?? r.citation.official_source}</span>
          {r.citation.page !== null && `, p. ${r.citation.page}`} · rule <em className="not-italic font-medium text-body">{r.citation.rule_id}</em> ·
          version {r.citation.rule_version} · <span className="font-medium text-body">effective {r.citation.effective_date}</span>
        </p>
      </div>

      <p className="rounded-lg bg-muted px-3 py-2 text-xs italic text-body">{DISCLAIMER_TEXT}</p>
    </div>
  );
}

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
  // Increments each ask so the trace animates fresh every time.
  const [askId, setAskId] = useState(0);
  const [askedText, setAskedText] = useState("");
  const reduced = usePrefersReducedMotion();
  // Bring the Ask output to the top of the viewport on each new question so the
  // thinking process is comfortably in view (the page has scroll room below).
  const askOutputRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (askId === 0) return;
    askOutputRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, [askId, reduced]);

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
    setAskedText(trimmed);
    setAskId((n) => n + 1);
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
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-8">
      <header>
        <h1 className="text-xl">Understand the rules</h1>
        <p className="text-sm text-subtle">
          Your numbers, computed on request from the frozen rules — then ask anything, answered only from the corpus with its source.
        </p>
      </header>

      {/* Your numbers — Annual income, then Comparison, side by side. Each waits
          behind a Calculate/Compare button and runs on request. */}
      <section aria-labelledby="your-numbers" className="flex flex-col gap-3">
        <h2 id="your-numbers" className="text-lg">Your numbers (computed deterministically)</h2>
        {derived.totalIncome === null && derived.wage === null ? (
          <p className="text-sm text-subtle">
            Upload and confirm an income document on the review screen and your
            annualization and comparison will appear here, computed step by step.
          </p>
        ) : (
          <div className="grid items-start gap-4 md:grid-cols-2">
            <IncomeTraceCard
              derived={derived}
              profileVersion={state.profileVersion}
              autoPlay={false}
              startLabel="Calculate"
              idlePrompt="Turn your confirmed pay into a yearly figure — computed locally from the rules, step by step."
            />
            <ComparisonTraceCard
              derived={derived}
              citation={SCORED_RULE.citation}
              profileVersion={state.profileVersion}
              autoPlay={false}
              startLabel="Compare"
              idlePrompt="Compare your annual income against the published limit for your household size."
            />
          </div>
        )}
        <p className="text-xs text-subtle">
          Formulas run in deterministic code on your confirmed values (profile v
          {state.profileVersion}) — never in a language model.
        </p>
      </section>

      {/* Ask — at the bottom. */}
      <section aria-labelledby="ask-heading" className="flex flex-col gap-4">
        <h2 id="ask-heading" className="text-lg">Ask about the rules</h2>
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
          {ask.kind === "loading" ? "Checking the rule library…" : ask.kind === "answered" ? "Answer ready." : ""}
        </p>

        <div ref={askOutputRef} className="flex scroll-mt-6 flex-col gap-4">
          {ask.kind === "loading" && (
            <div className="inline-flex w-fit items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium text-ink shadow-card">
              <Loader2 aria-hidden="true" className="size-4 animate-spin text-primary" />
              Thinking…
            </div>
          )}

          {ask.kind === "error" && (
            <div role="alert" className="rounded-lg border border-status-blocking/30 bg-status-blocking-bg p-4 text-sm text-status-blocking">
              {ask.message}
            </div>
          )}

          {ask.kind === "answered" && (
            <ComputationTrace
              key={askId}
              traceKey={`ask:${askId}`}
              icon={BookOpenCheck}
              title="Answer"
              autoPlay
              replayLabel="Re-run"
              steps={askSteps(askedText, ask.response)}
              sources={askSources(ask.response)}
              announce={ask.response.refusal ? "Declined — this tool does not make decisions." : ask.response.citation ? "Answer ready with a citation." : "No authoritative rule found."}
              result={() => renderAnswerBody(ask.response, citedRule, structuredThreshold, householdSize)}
            />
          )}
        </div>
      </section>

      {/* Scroll room: the page extends below the Ask output so its thinking can
          be scrolled to the top of the viewport and watched comfortably. */}
      {(ask.kind === "loading" || ask.kind === "answered") && (
        <div aria-hidden="true" className="h-[60vh] shrink-0" />
      )}
    </main>
  );
}
