// Marketing landing above the (unchanged) upload screen, following the
// reference designs: a full-viewport hero with white text over the background
// video + a dark eligibility band, a "How it works" three-step band, a
// "Start when you're ready" session-mode section with a "Before you begin"
// note, the upload screen, then the site footer. The primary CTAs smooth-scroll
// to the upload section (id="application", set in UploadPage).
import {
  ArrowRight,
  ChevronDown,
  FileText,
  ListChecks,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroMedia } from "@/components/hero-media";
import { SiteFooter } from "@/components/site-footer";
import { UploadPage } from "@/pages/UploadPage";
import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

const METRO = "Boston-Cambridge-Quincy, MA-NH HMFA";

interface Step {
  href: string;
  eyebrow: string;
  title: string;
  body: string;
  icon: LucideIcon;
  highlight?: boolean;
}

const STEPS: Step[] = [
  {
    href: "#/review",
    eyebrow: "Profile",
    title: "Upload and confirm each value",
    body: "Upload your pay stubs or benefit letters (or pick a synthetic sample). Review each proposed value against the exact source region before it's reused.",
    icon: UserRound,
  },
  {
    href: "#/understand",
    eyebrow: "Understand",
    title: "Read the rule that applies",
    body: "See the published rule text, its deterministic formula, effective date, and how your confirmed inputs meet the limit — nothing invented.",
    icon: FileText,
    highlight: true,
  },
  {
    href: "#/packet",
    eyebrow: "Prepare",
    title: "Build a packet you fully own",
    body: "Compare confirmed values to a plain-language checklist, pick attachments, preview the packet, and download or delete it. Nothing auto-sent.",
    icon: ListChecks,
  },
];

const BEFORE_YOU_BEGIN = [
  "Nothing is submitted to a property. Export is manual only.",
  "You can delete your session at any time from the top right.",
  "Normal mode uses the frozen official 2026 rule corpus; safety-demo records are labeled simulated.",
];

export function LandingPage() {
  const reduced = usePrefersReducedMotion();

  function scrollTo(id: string, focus = false) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    if (focus) el.focus({ preventScroll: true });
  }

  return (
    <>
      {/* ---------------------------------------------------------- Hero --- */}
      <section aria-labelledby="hero-heading" className="relative flex min-h-[calc(100dvh-3.5rem)] flex-col overflow-hidden">
        <HeroMedia />

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
              Application-readiness copilot
            </p>
            <h1
              id="hero-heading"
              className="text-balance text-4xl font-semibold leading-[1.05] text-white drop-shadow-sm sm:text-5xl lg:text-6xl"
            >
              Understand your documents. Read the rules. Prepare your packet.
            </h1>
            <p className="max-w-2xl text-pretty text-base text-white/90 sm:text-lg">
              RealDoor helps you make sense of your paperwork for one affordable housing program in{" "}
              {METRO}. It never decides whether you qualify — a human reviewer does that.
            </p>

            <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" onClick={() => scrollTo("application", true)}>
                Use your own documents
                <ArrowRight aria-hidden="true" />
              </Button>
              <a
                href="#/safety"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-4 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
              >
                Try the safety demo
              </a>
            </div>

            <button
              type="button"
              onClick={() => scrollTo("how-it-works")}
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 hover:text-white"
            >
              How it works
              <ChevronDown aria-hidden="true" className={cn("size-4", !reduced && "animate-bounce")} />
            </button>
          </div>
        </div>

        {/* Eligibility disclaimer band, pinned to the hero foot. */}
        <div className="relative z-10 border-t border-white/10 bg-black/45 px-6 py-3 text-center text-sm text-white/85 backdrop-blur-sm">
          <p className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
            <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-white/90" />
            <strong className="font-semibold text-white">This copilot does not decide eligibility.</strong>
            It will not approve, deny, score, rank, or predict acceptance. A human reviewer makes the final decision.
          </p>
        </div>
      </section>

      {/* -------------------------------------------------- How it works --- */}
      <section id="how-it-works" aria-labelledby="how-heading" className="mx-auto w-full max-w-6xl px-6 py-20 scroll-mt-16">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">How it works</p>
        <h2 id="how-heading" className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Three steps to a packet you control.
        </h2>
        <p className="mt-3 max-w-2xl text-body">
          Every number in the final packet is traceable to a document you confirmed and a rule you can read.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <a
                key={step.eyebrow}
                href={step.href}
                className={cn(
                  "group flex flex-col gap-3 rounded-2xl border p-6 transition-all duration-200 hover:-translate-y-0.5",
                  step.highlight
                    ? "border-transparent bg-primary text-primary-foreground shadow-lg hover:bg-primary/90"
                    : "border-border bg-card hover:border-primary/40 hover:shadow-card",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg",
                    step.highlight ? "bg-white/15 text-primary-foreground" : "bg-accent text-primary",
                  )}
                >
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <span className={cn("text-xs font-semibold uppercase tracking-wide", step.highlight ? "text-primary-foreground/80" : "text-subtle")}>
                  {step.eyebrow}
                </span>
                <span className={cn("text-lg font-semibold", step.highlight ? "text-primary-foreground" : "text-ink")}>
                  {step.title}
                </span>
                <span className={cn("text-sm leading-relaxed", step.highlight ? "text-primary-foreground/90" : "text-body")}>
                  {step.body}
                </span>
              </a>
            );
          })}
        </div>
      </section>

      {/* -------------------------------------------- Start when ready --- */}
      <section aria-labelledby="start-heading" className="border-t border-border bg-secondary/40">
        <div className="mx-auto w-full max-w-6xl px-6 py-20">
          <h2 id="start-heading" className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Start when you're ready.
          </h2>
          <p className="mt-3 max-w-2xl text-body">
            Pick a session mode. Normal mode sends synthetic PDFs to the RealDoor server and configured
            extraction provider; demo mode stays local.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
              <span className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <UserRound aria-hidden="true" className="size-4" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-subtle">Start a session</span>
              </span>
              <span className="text-lg font-semibold text-ink">Use your own documents</span>
              <span className="text-sm leading-relaxed text-body">
                Upload a synthetic PDF for server-side OCR and allowlisted extraction. You review and confirm
                every value before reuse.
              </span>
              <Button className="mt-1 w-fit" onClick={() => scrollTo("application", true)}>
                Start
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
              <span className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-primary">
                  <ShieldCheck aria-hidden="true" className="size-4" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-subtle">Safety demo</span>
              </span>
              <span className="text-lg font-semibold text-ink">Try with synthetic samples</span>
              <span className="text-sm leading-relaxed text-body">
                Explore the full journey with curated simulated documents. Also includes refusal and
                prompt-injection tests.
              </span>
              <a
                href="#/safety"
                className="mt-1 inline-flex w-fit items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm font-medium text-ink hover:bg-muted"
              >
                Open safety demo
                <ArrowRight aria-hidden="true" className="size-4" />
              </a>
            </div>
          </div>

          {/* Before you begin. */}
          <div className="mt-4 rounded-2xl border border-border bg-card p-6">
            <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
              <ShieldCheck aria-hidden="true" className="size-4 text-primary" />
              Before you begin
            </h3>
            <ul className="mt-3 flex flex-col gap-2">
              {BEFORE_YOU_BEGIN.map((line) => (
                <li key={line} className="flex items-start gap-2 text-sm text-body">
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-subtle" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* The existing upload screen — unchanged aside from the city selector. */}
      <UploadPage />

      <SiteFooter />
    </>
  );
}
