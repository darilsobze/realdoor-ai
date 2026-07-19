// Agent-style computation trace: sequential steps (pending circle → active
// pulse/spinner → green check), then the real result reveals. It is a REPLAY
// over records that are already computed live — never a gate on computation,
// and no step claims an action that didn't happen. After completion the steps
// collapse to a "How this was computed" disclosure so cards stay compact.
import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Loader2, RotateCw, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/motion";

export interface TraceStep {
  label: string;
  /** Real values pulled from the record (never invented). */
  detail?: React.ReactNode;
}

const STEP_MS = 620;

/** Traces that have auto-played this session, keyed by `${cardId}:v${version}`. */
const played = new Set<string>();

export function ComputationTrace({
  traceKey,
  icon: Icon,
  title,
  steps,
  result,
  autoPlay,
  announce,
  startDelayMs = 0,
}: {
  traceKey: string;
  icon: LucideIcon;
  title: string;
  steps: TraceStep[];
  /** Final resolved body; `play` is true only right after an animated run so
   *  count-ups / staggers animate once (instant when replayed-instantly). */
  result: (play: boolean) => React.ReactNode;
  autoPlay: boolean;
  announce: string;
  /** Delay the first step (used to sequence sibling traces). */
  startDelayMs?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const shouldAnimate = autoPlay && !reduced && !played.has(traceKey);

  const [animating, setAnimating] = useState(shouldAnimate);
  const [armed, setArmed] = useState(!shouldAnimate || startDelayMs === 0);
  const [activeStep, setActiveStep] = useState(shouldAnimate ? 0 : steps.length);

  useEffect(() => {
    if (armed) return;
    const t = setTimeout(() => setArmed(true), startDelayMs);
    return () => clearTimeout(t);
  }, [armed, startDelayMs]);
  // playMode gates the result count-up/stagger; runId remounts the result on
  // each fresh completion so those animations re-run.
  const [playMode, setPlayMode] = useState(shouldAnimate);
  const [runId, setRunId] = useState(0);
  const [showSteps, setShowSteps] = useState(false);
  const [live, setLive] = useState("");
  // Keep timers stable across step count identity.
  const stepCount = useRef(steps.length);
  stepCount.current = steps.length;

  useEffect(() => {
    if (!animating || !armed) return;
    played.add(traceKey);
    if (activeStep >= stepCount.current) {
      setAnimating(false);
      setRunId((r) => r + 1);
      setLive(announce);
      return;
    }
    const t = setTimeout(() => setActiveStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [animating, armed, activeStep, traceKey, announce]);

  const done = !animating;

  function replay() {
    setShowSteps(false);
    setPlayMode(true);
    setArmed(true);
    setActiveStep(0);
    setAnimating(true);
  }

  const stepsVisible = animating || showSteps;

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
              onClick={replay}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-subtle hover:text-primary"
            >
              <RotateCw aria-hidden="true" className="size-3" />
              Replay
            </button>
          )}
        </div>

        {stepsVisible && (
          <ol className="flex flex-col gap-0.5">
            {steps.map((step, i) => {
              const status =
                animating && !armed
                  ? "pending"
                  : i < activeStep
                    ? "done"
                    : i === activeStep && animating
                      ? "active"
                      : done
                        ? "done"
                        : "pending";
              return (
                <li
                  key={step.label}
                  className={cn(
                    "flex items-start gap-2.5 rounded-md px-2 py-1.5 transition-colors duration-150",
                    status === "active" && "animate-fade-up-fast bg-status-info-bg/60",
                  )}
                >
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
                    {status === "done" && <Check className="size-3.5 text-status-confirmed" strokeWidth={3} />}
                    {status === "active" && <Loader2 className="size-3.5 animate-spin text-primary" />}
                    {status === "pending" && <span className="size-2 rounded-full border border-subtle/60" />}
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
        )}

        {/* Result reveals once the steps finish; remounts per run so the
            count-up / row stagger re-animate on (re)play. */}
        {done && (
          <div key={runId} className={cn(playMode && runId > 0 && "animate-value-pulse rounded-md")}>
            {result(playMode && runId > 0)}
          </div>
        )}

        {done && (
          <button
            type="button"
            aria-expanded={showSteps}
            onClick={() => setShowSteps((v) => !v)}
            className="inline-flex w-fit items-center gap-1 text-xs text-subtle hover:text-ink"
          >
            <ChevronRight aria-hidden="true" className={cn("size-3 transition-transform", showSteps && "rotate-90")} />
            How this was computed
          </button>
        )}

        <span aria-live="polite" className="sr-only">{live}</span>
      </CardContent>
    </Card>
  );
}
