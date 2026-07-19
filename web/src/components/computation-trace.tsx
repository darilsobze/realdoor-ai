// Agent-style trace: sequential retrieval + computation steps (each with its
// own icon; pending → active pulse → green check), then the real result
// reveals. It REPLAYS records already computed live — never a gate on
// computation, and no step claims an action that didn't happen (the app does
// no web search; retrieval is from the frozen local corpus, and "View sources"
// shows the real citation objects). After completion the steps collapse to a
// "Thought for Xs" disclosure so cards stay compact.
import { useEffect, useRef, useState } from "react";
import { Brain, Check, ChevronDown, Play, RotateCw, ShieldCheck, SquareArrowOutUpRight, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/motion";

/** Traces that have auto-played this session, keyed by `${cardId}:v${version}`. */
const played = new Set<string>();

export interface TraceStep {
  label: string;
  /** Real values pulled from the record (never invented). */
  detail?: React.ReactNode;
  /** Per-step icon (thinking / searching / found / computing). */
  icon?: LucideIcon;
}

export interface TraceSource {
  label: string;
  sublabel?: string;
  href?: string;
}

const STEP_MS = 640;

/** The step rows (pending dim icon → active pulsing icon → green check).
 *  Shared by the computation cards and the Ask trace. */
export function TraceStepList({
  steps,
  activeStep,
  armed,
  done,
}: {
  steps: TraceStep[];
  activeStep: number;
  armed: boolean;
  done: boolean;
}) {
  return (
    <ol className="flex flex-col gap-0.5">
      {steps.map((step, i) => {
        const status =
          !armed && !done
            ? "pending"
            : i < activeStep
              ? "done"
              : i === activeStep && !done
                ? "active"
                : done
                  ? "done"
                  : "pending";
        const StepIcon = step.icon ?? Brain;
        return (
          <li
            key={step.label}
            className={cn(
              "flex items-start gap-2.5 rounded-md px-2 py-1.5 transition-colors duration-150",
              status === "active" && "animate-fade-up-fast bg-status-info-bg/60",
            )}
          >
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
              {status === "done" ? (
                <Check className="size-3.5 text-status-confirmed" strokeWidth={3} />
              ) : status === "active" ? (
                <StepIcon className="size-3.5 animate-pulse text-primary" />
              ) : (
                <StepIcon className="size-3 text-subtle/50" />
              )}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className={cn("text-sm", status === "pending" ? "text-subtle" : "text-ink", status === "active" && "font-medium")}>
                {step.label}
              </span>
              {step.detail && (status === "done" || status === "active") && (
                <span className="tnum text-xs text-subtle">{step.detail}</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function ComputationTrace({
  traceKey,
  icon: Icon,
  title,
  steps,
  result,
  sources = [],
  autoPlay,
  announce,
  startDelayMs = 0,
  replayLabel = "Replay",
  startLabel,
  idlePrompt,
}: {
  traceKey: string;
  icon: LucideIcon;
  title: string;
  steps: TraceStep[];
  /** Final resolved body; `play` is true only after a fresh animated run. */
  result: (play: boolean) => React.ReactNode;
  sources?: TraceSource[];
  autoPlay: boolean;
  announce: string;
  startDelayMs?: number;
  replayLabel?: string;
  /** When set, the trace waits behind this button instead of auto-playing. */
  startLabel?: string;
  idlePrompt?: string;
}) {
  const reduced = usePrefersReducedMotion();
  // Manual mode: wait behind a Calculate/Compare button until the renter runs it.
  const manualIdle = !!startLabel && !played.has(traceKey);
  const autoAnimate = !manualIdle && autoPlay && !reduced && !played.has(traceKey);

  const [phase, setPhase] = useState<"idle" | "animating" | "done">(
    manualIdle ? "idle" : autoAnimate ? "animating" : "done",
  );
  const [armed, setArmed] = useState(!autoAnimate || startDelayMs === 0);
  const [activeStep, setActiveStep] = useState(autoAnimate ? 0 : steps.length);
  const [playMode, setPlayMode] = useState(autoAnimate);
  const [runId, setRunId] = useState(0);
  const [live, setLive] = useState("");
  const stepCount = useRef(steps.length);
  stepCount.current = steps.length;

  useEffect(() => {
    if (armed) return;
    const t = setTimeout(() => setArmed(true), startDelayMs);
    return () => clearTimeout(t);
  }, [armed, startDelayMs]);

  useEffect(() => {
    if (phase !== "animating" || !armed) return;
    played.add(traceKey);
    if (activeStep >= stepCount.current) {
      setPhase("done");
      setRunId((r) => r + 1);
      setLive(announce);
      return;
    }
    const t = setTimeout(() => setActiveStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [phase, armed, activeStep, traceKey, announce]);

  const idle = phase === "idle";
  const animating = phase === "animating";
  const done = phase === "done";
  const animatedRun = playMode && runId > 0;

  function run() {
    played.add(traceKey);
    setPlayMode(true);
    setArmed(true);
    setShowSteps(false);
    if (reduced) {
      setActiveStep(steps.length);
      setRunId((r) => r + 1);
      setLive(announce);
      setPhase("done");
    } else {
      setActiveStep(0);
      setPhase("animating");
    }
  }

  const [showSteps, setShowSteps] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const thoughtSeconds = ((steps.length * STEP_MS) / 1000).toFixed(0);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
            <Icon aria-hidden="true" className="size-4 text-primary" />
            {title}
          </h3>
          {done && (
            <button
              type="button"
              onClick={run}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-subtle hover:text-primary"
            >
              <RotateCw aria-hidden="true" className="size-3" />
              {replayLabel}
            </button>
          )}
        </div>

        {/* Idle (manual mode): wait behind the Calculate/Compare button. */}
        {idle && (
          <div className="flex flex-col items-start gap-3">
            {idlePrompt && <p className="text-sm text-subtle">{idlePrompt}</p>}
            <Button size="sm" onClick={run}>
              <Play aria-hidden="true" data-icon="inline-start" />
              {startLabel}
            </Button>
          </div>
        )}

        {/* Live steps during the animation. */}
        {animating && <TraceStepList steps={steps} activeStep={activeStep} armed={armed} done={false} />}

        {/* Result reveals once the steps finish; remounts per run so the
            count-up / row stagger re-animate on (re)play. */}
        {done && (
          <div key={runId} className={cn(animatedRun && "animate-value-pulse rounded-md")}>
            {result(animatedRun)}
          </div>
        )}

        {done && (
          <div className="flex flex-col gap-2">
            {/* "Thought for Xs · N steps" — collapsible, reveals the steps. */}
            <div className="overflow-hidden rounded-lg border bg-background">
              <button
                type="button"
                aria-expanded={showSteps}
                onClick={() => setShowSteps((v) => !v)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-subtle hover:text-ink"
              >
                <Brain aria-hidden="true" className="size-3.5 text-subtle" />
                <span className="flex-1">
                  {animatedRun ? `Thought for ${thoughtSeconds}s` : "Steps"} · {steps.length} steps
                </span>
                <ChevronDown aria-hidden="true" className={cn("size-3.5 transition-transform", showSteps && "rotate-180")} />
              </button>
              {showSteps && (
                <div className="border-t px-1 py-1">
                  <TraceStepList steps={steps} activeStep={steps.length} armed done />
                </div>
              )}
            </div>

            {sources.length > 0 && (
              <div className="overflow-hidden rounded-lg border bg-background">
                <button
                  type="button"
                  aria-expanded={showSources}
                  onClick={() => setShowSources((v) => !v)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-ink hover:text-primary"
                >
                  <ShieldCheck aria-hidden="true" className="size-3.5 text-status-confirmed" />
                  <span className="flex-1">View the sources</span>
                  <ChevronDown aria-hidden="true" className={cn("size-3.5 transition-transform", showSources && "rotate-180")} />
                </button>
                {showSources && (
                  <ul className="flex flex-col gap-1.5 border-t px-3 py-2">
                    {sources.map((s) => (
                      <li key={s.label} className="flex flex-col gap-0.5 text-xs">
                        {s.href ? (
                          <a
                            href={s.href}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex w-fit items-center gap-1 font-medium text-primary underline underline-offset-2"
                          >
                            <SquareArrowOutUpRight aria-hidden="true" className="size-3" />
                            {s.label}
                          </a>
                        ) : (
                          <span className="font-medium text-ink">{s.label}</span>
                        )}
                        {s.sublabel && <span className="text-subtle">{s.sublabel}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        <span aria-live="polite" className="sr-only">{live}</span>
      </CardContent>
    </Card>
  );
}
