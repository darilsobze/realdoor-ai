import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ExternalLink, Send } from "lucide-react";
import { useSession } from "@/state/session";
import { getRules, askRules } from "@/api/client";
import { ApiError } from "@/api/errors";
import type { RuleDto, RulesAskResponse, RulesFileDto } from "@/api/schemas";
import { buildProfileCalculations } from "@/engine/profile";
import { CalculationTrace } from "@/components/calculation-trace";
import { Banner } from "@/components/banner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/understand")({ component: UnderstandPage });

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function scoredRule(corpus: RulesFileDto | null): RuleDto | null {
  return corpus?.rules.find((rule) => rule.citation.table_id === "mtsp-2026-60pct") ?? null;
}

function UnderstandPage() {
  const { state, confirmedList } = useSession();
  const [corpus, setCorpus] = useState<RulesFileDto | null>(null);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<RulesAskResponse | null>(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getRules(controller.signal)
      .then(setCorpus)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRulesError(
          error instanceof ApiError ? error.message : "The rule library is unavailable.",
        );
      });
    return () => controller.abort();
  }, []);

  const rule = scoredRule(corpus);
  const derived = useMemo(
    () =>
      rule
        ? buildProfileCalculations({
            confirmedFields: confirmedList,
            householdSize: state.householdSize,
            householdConfirmed: state.householdSize !== null,
            profileVersion: state.profileVersion,
            computedAt: state.startedAt,
            rule,
          })
        : null,
    [confirmedList, rule, state.householdSize, state.profileVersion, state.startedAt],
  );

  async function submitQuestion(event: React.FormEvent) {
    event.preventDefault();
    if (!question.trim() || !rule) return;
    setAsking(true);
    setAskError(null);
    setAnswer(null);
    try {
      setAnswer(
        await askRules(question.trim(), {
          program_id: rule.citation.program_id,
          metro_id: rule.citation.metro_id,
          rule_year: rule.citation.rule_year,
        }),
      );
    } catch (error) {
      setAskError(
        error instanceof ApiError ? error.message : "The question could not be answered.",
      );
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold">
          Understand — official rules and deterministic math
        </h1>
        <p className="text-sm text-muted-foreground">
          Values come from your confirmations. Thresholds and citations come from the frozen rule
          corpus.
        </p>
      </header>

      {rulesError ? (
        <Banner variant="danger" title="Rule library unavailable">
          {rulesError}
        </Banner>
      ) : null}
      {!corpus && !rulesError ? (
        <Banner variant="info" title="Loading the frozen rule library">
          Please wait…
        </Banner>
      ) : null}

      {rule && derived ? (
        <section aria-labelledby="math-heading" className="grid gap-3">
          <h2 id="math-heading" className="text-lg font-semibold">
            Deterministic calculation trace
          </h2>
          <CalculationTrace
            key={`income-${state.profileVersion}`}
            title="Annual income before taxes"
            calculation={derived.totalIncome ?? derived.wage ?? derived.benefit}
          />
          <CalculationTrace
            key={`comparison-${state.profileVersion}`}
            title="Compared with the published income limit"
            calculation={derived.comparison}
          />
          {derived.comparison?.status === "computed" ? (
            <p className="rounded-md border border-border bg-background p-3 text-sm">
              Neutral comparison: annual income is{" "}
              {USD.format(Math.abs(derived.comparison.result_value))}{" "}
              {derived.comparison.result_value <= 0 ? "under" : "over"} the published limit. This is
              not an eligibility decision.
            </p>
          ) : null}
        </section>
      ) : null}

      {rule ? (
        <section
          className="rounded-lg border border-border bg-card p-4"
          aria-labelledby="source-heading"
        >
          <h2 id="source-heading" className="text-lg font-semibold">
            {rule.title}
          </h2>
          <p className="mt-2 text-sm">{rule.text}</p>
          <dl className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
            <div>
              <dt className="font-semibold">Rule version</dt>
              <dd>{rule.citation.rule_version}</dd>
            </div>
            <div>
              <dt className="font-semibold">Effective date</dt>
              <dd>{rule.citation.effective_date}</dd>
            </div>
            <div>
              <dt className="font-semibold">Section</dt>
              <dd>{rule.citation.section}</dd>
            </div>
            <div>
              <dt className="font-semibold">Page</dt>
              <dd>{String(rule.citation.page ?? "—")}</dd>
            </div>
          </dl>
          <a
            className="mt-3 inline-flex items-center gap-1 text-sm text-primary underline"
            href={rule.citation.official_source}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink aria-hidden="true" className="size-4" /> View official source
          </a>
        </section>
      ) : null}

      <section
        aria-labelledby="ask-heading"
        className="rounded-lg border border-border bg-card p-4"
      >
        <h2 id="ask-heading" className="text-lg font-semibold">
          Ask about the frozen rules
        </h2>
        <form onSubmit={(event) => void submitQuestion(event)} className="mt-3 grid gap-2">
          <label htmlFor="rules-question" className="sr-only">
            Your rules question
          </label>
          <Textarea
            id="rules-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={3}
            placeholder="What is the income limit for a three-person household?"
          />
          <div>
            <Button type="submit" disabled={asking || !rule || !question.trim()}>
              <Send aria-hidden="true" className="size-4" />
              {asking ? "Checking…" : "Ask"}
            </Button>
          </div>
        </form>
        {askError ? (
          <div role="alert" className="mt-3">
            <Banner variant="danger" title="Question unavailable">
              {askError}
            </Banner>
          </div>
        ) : null}
        {answer ? (
          <div className="mt-3">
            <Banner
              variant={answer.refusal || answer.abstained ? "info" : "info"}
              title={
                answer.refusal
                  ? "This copilot does not decide eligibility"
                  : answer.abstained
                    ? "No authoritative rule found"
                    : "Answer from the frozen corpus"
              }
            >
              <p>{answer.answer}</p>
              {answer.citation ? (
                <p className="mt-2 text-xs">
                  Rule {answer.citation.rule_id} · version {answer.citation.rule_version} ·
                  effective {answer.citation.effective_date} · {answer.citation.section}
                </p>
              ) : null}
            </Banner>
          </div>
        ) : null}
      </section>

      <div className="flex justify-end">
        <Button asChild>
          <Link to="/prepare">
            Continue to Prepare
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
