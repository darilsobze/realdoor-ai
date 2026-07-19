import { Link, useRouterState } from "@tanstack/react-router";
import { Check, FileText, FlaskConical, ListChecks, User } from "lucide-react";
import { useSession } from "@/state/session";

type StepTo = "/profile" | "/safety/profile" | "/understand" | "/prepare";

export function StepProgress() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { state } = useSession();
  const isDemo = state.mode === "demo";

  const profileTo: StepTo = isDemo ? "/safety/profile" : "/profile";

  const steps: {
    to: StepTo;
    label: string;
    icon: typeof User;
    description: string;
    match: string[];
  }[] = [
    {
      to: profileTo,
      label: "Profile",
      icon: User,
      description: "Confirm your documents",
      match: ["/profile", "/safety/profile"],
    },
    {
      to: "/understand",
      label: "Understand",
      icon: FileText,
      description: "Read the published rules",
      match: ["/understand"],
    },
    {
      to: "/prepare",
      label: "Prepare",
      icon: ListChecks,
      description: "Preview your packet",
      match: ["/prepare"],
    },
  ];

  const currentIndex = steps.findIndex((s) => s.match.some((m) => path.startsWith(m)));

  return (
    <nav aria-label="Application readiness steps" className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <ol className="flex flex-1 items-stretch gap-1 sm:gap-2">
          {steps.map((step, i) => {
            const isCurrent = i === currentIndex;
            const isDone = currentIndex > i;
            const Icon = step.icon;
            return (
              <li key={step.label} className="flex-1">
                <Link
                  to={step.to}
                  aria-current={isCurrent ? "step" : undefined}
                  className={[
                    "group flex h-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-200",
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent",
                  ].join(" ")}
                >
                  <span
                    aria-hidden="true"
                    className={[
                      "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors duration-200",
                      isCurrent
                        ? "border-primary-foreground/60 bg-primary-foreground/10"
                        : isDone
                          ? "border-foreground/40 bg-secondary"
                          : "border-border bg-background",
                    ].join(" ")}
                  >
                    {isDone ? (
                      <Check className="size-4 animate-scale-in" />
                    ) : (
                      <Icon className="size-4" />
                    )}
                  </span>

                  <span className="flex flex-col leading-tight">
                    <span className="font-semibold">
                      Step {i + 1}: {step.label}
                    </span>
                    <span
                      className={[
                        "text-xs",
                        isCurrent ? "text-primary-foreground/85" : "text-muted-foreground",
                      ].join(" ")}
                    >
                      {step.description}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
        {isDemo && (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary"
            aria-label="Safety demo mode"
          >
            <FlaskConical aria-hidden="true" className="size-3.5" />
            Demo mode
          </span>
        )}
      </div>
    </nav>
  );
}
