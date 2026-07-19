import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  ArrowRight,
  ChevronDown,
  FileText,
  FlaskConical,
  ListChecks,
  ShieldCheck,
  User,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useSession } from "@/state/session";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/banner";
import heroImage from "@/assets/hero-doorway.jpg";

const APP_CONFIG = {
  program: "LIHTC",
  metro: "Boston-Cambridge-Quincy, MA-NH HMFA",
  ruleVersion: "2026-frozen-2026-07-18",
  effectiveDate: "2026-05-01",
};

export const Route = createFileRoute("/")({
  component: Index,
});

const delayed = (ms: number): CSSProperties => ({
  animationDelay: `${ms}ms`,
  animationFillMode: "both",
});

function Index() {
  const { state, consent, setMode, reset } = useSession();
  const router = useRouter();

  const enter = (mode: "normal" | "demo") => {
    if (state.mode && state.mode !== mode) reset();
    if (!state.consented) consent();
    setMode(mode);
    router.navigate({ to: mode === "demo" ? "/safety/profile" : "/profile" });
  };

  return (
    <div>
      {/* ---------- HERO ---------- */}
      <section
        aria-labelledby="hero-heading"
        className="relative min-h-[78vh] w-full overflow-hidden"
      >
        <img
          src={heroImage}
          alt=""
          aria-hidden="true"
          width={1920}
          height={1080}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/65 to-slate-950/85"
        />

        <div className="relative mx-auto flex min-h-[78vh] max-w-5xl flex-col items-center justify-center px-4 py-20 text-center">
          <p
            className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-200/90 animate-fade-in"
            style={delayed(0)}
          >
            Application-Readiness Copilot
          </p>
          <h1
            id="hero-heading"
            className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.05] text-white md:text-6xl lg:text-7xl animate-fade-in"
            style={delayed(100)}
          >
            Understand your documents. Read the rules. Prepare your packet.
          </h1>
          <p
            className="mt-6 max-w-2xl text-base leading-relaxed text-slate-100/85 md:text-lg animate-fade-in"
            style={delayed(200)}
          >
            RealDoor helps you make sense of your paperwork for one affordable housing program in{" "}
            {APP_CONFIG.metro}. It never decides whether you qualify — a human reviewer does that.
          </p>

          <div
            className="mt-10 flex flex-wrap items-center justify-center gap-3 animate-fade-in"
            style={delayed(300)}
          >
            <Button
              size="lg"
              onClick={() => enter("normal")}
              className="focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            >
              Use your own documents
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => enter("demo")}
              className="bg-white/10 text-white backdrop-blur hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            >
              Try the safety demo
            </Button>
          </div>

          <a
            href="#how-it-works"
            className="mt-14 inline-flex items-center gap-1 text-xs uppercase tracking-widest text-slate-200/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 rounded"
          >
            How it works
            <ChevronDown aria-hidden="true" className="size-4 animate-bounce" />
          </a>
        </div>

        {/* Eligibility disclaimer under the hero image */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-slate-950/80 px-4 py-3 backdrop-blur-sm">
          <p className="mx-auto max-w-5xl text-center text-xs leading-relaxed text-slate-300/80">
            <ShieldCheck aria-hidden="true" className="inline size-3.5 -translate-y-px mr-1.5" />
            <strong>This copilot does not decide eligibility.</strong> It will not approve, deny,
            score, rank, or predict acceptance. A human reviewer makes the final decision.
          </p>
        </div>
      </section>

      {/* ---------- HOW IT WORKS ---------- */}
      <section
        id="how-it-works"
        aria-labelledby="how-heading"
        className="mx-auto max-w-6xl px-4 py-16 md:py-20"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          How it works
        </p>
        <h2
          id="how-heading"
          className="mt-2 max-w-3xl text-3xl font-semibold text-foreground md:text-4xl"
        >
          Three steps to a packet you control.
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Every number in the final packet is traceable to a document you confirmed and a rule you
          can read.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <BigStepCard
            icon={User}
            label="Profile"
            title="Upload and confirm each value"
            body="Upload your pay stubs or benefit letters (or pick a synthetic sample). Review each proposed value against the exact source region before it's reused."
            delayMs={0}
          />
          <BigStepCard
            icon={FileText}
            label="Understand"
            title="Read the rule that applies"
            body="See the published rule text, its deterministic formula, effective date, and how your confirmed inputs meet the limit — nothing invented."
            tone="primary"
            delayMs={80}
          />
          <BigStepCard
            icon={ListChecks}
            label="Prepare"
            title="Build a packet you fully own"
            body="Compare confirmed values to a plain-language checklist, pick attachments, preview the packet, and download or delete it. Nothing is auto-sent."
            delayMs={160}
          />
        </div>
      </section>

      {/* ---------- MODE CTA BAND ---------- */}
      <section
        aria-labelledby="start-heading"
        className="border-y border-border bg-secondary/30 px-4 py-16"
      >
        <div className="mx-auto max-w-6xl">
          <h2 id="start-heading" className="text-2xl font-semibold md:text-3xl">
            Start when you're ready.
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Pick a session mode. Normal mode sends synthetic PDFs to the RealDoor server and
            configured extraction provider; demo mode stays local.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <ModeCard
              tone="primary"
              icon={User}
              eyebrow="Start a session"
              title="Use your own documents"
              body="Upload a synthetic PDF for server-side OCR and allowlisted extraction. You review and confirm every value before reuse."
              cta="Start"
              onClick={() => enter("normal")}
            />
            <ModeCard
              tone="secondary"
              icon={FlaskConical}
              eyebrow="Safety demo"
              title="Try with synthetic samples"
              body="Explore the full journey with curated simulated documents. Also includes refusal and prompt-injection tests."
              cta="Open safety demo"
              onClick={() => enter("demo")}
            />
          </div>

          <div className="mt-8 rounded-lg border border-border bg-card p-5">
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <ShieldCheck aria-hidden="true" className="size-5 text-primary" />
              Before you begin
            </h3>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm">
              <li>Nothing is submitted to a property. Export is manual only.</li>
              <li>You can delete your session at any time from the top right.</li>
              <li>
                Normal mode uses the frozen official 2026 rule corpus; safety-demo records are
                labeled simulated.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <SiteFooter />
    </div>
  );
}

function BigStepCard({
  icon: Icon,
  label,
  title,
  body,
  tone = "default",
  delayMs = 0,
}: {
  icon: typeof User;
  label: string;
  title: string;
  body: string;
  tone?: "default" | "primary";
  delayMs?: number;
}) {
  const isPrimary = tone === "primary";
  return (
    <article
      className={[
        "flex flex-col rounded-2xl border p-6 shadow-sm transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md animate-fade-in",
        isPrimary
          ? "border-primary/40 bg-primary text-primary-foreground"
          : "border-border bg-card text-card-foreground",
      ].join(" ")}
      style={delayed(delayMs)}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={[
            "grid size-9 place-items-center rounded-md",
            isPrimary
              ? "bg-primary-foreground/15 text-primary-foreground"
              : "bg-secondary text-foreground",
          ].join(" ")}
        >
          <Icon className="size-5" />
        </span>
        <p
          className={[
            "text-xs font-semibold uppercase tracking-[0.18em]",
            isPrimary ? "text-primary-foreground/85" : "text-primary",
          ].join(" ")}
        >
          {label}
        </p>
      </div>
      <h3 className="mt-5 text-xl font-semibold leading-snug">{title}</h3>
      <p
        className={[
          "mt-3 text-sm leading-relaxed",
          isPrimary ? "text-primary-foreground/85" : "text-muted-foreground",
        ].join(" ")}
      >
        {body}
      </p>
    </article>
  );
}

function ModeCard({
  tone,
  icon: Icon,
  eyebrow,
  title,
  body,
  cta,
  onClick,
}: {
  tone: "primary" | "secondary";
  icon: typeof User;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-5 transition-[border-color,box-shadow] duration-200 hover:border-primary/40 hover:shadow-md">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={[
            "grid size-9 place-items-center rounded-md",
            tone === "primary"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-foreground",
          ].join(" ")}
        >
          <Icon className="size-5" />
        </span>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {eyebrow}
        </p>
      </div>
      <h3 className="mt-3 text-lg font-semibold">{title}</h3>
      <p className="mt-1 flex-1 text-sm text-muted-foreground">{body}</p>
      <div className="mt-4">
        <Button
          onClick={onClick}
          variant={tone === "primary" ? "default" : "secondary"}
          size="lg"
          className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {cta}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function SiteFooter() {
  const columns: { heading: string; links: string[] }[] = [
    {
      heading: "RealDoor",
      links: ["About", "How it works", "Rule sources", "Accessibility"],
    },
    {
      heading: "Program",
      links: [
        `Metro: ${APP_CONFIG.metro}`,
        `Rule version ${APP_CONFIG.ruleVersion}`,
        `Effective ${APP_CONFIG.effectiveDate}`,
        "Changelog",
      ],
    },
    {
      heading: "Support",
      links: ["FAQ", "Contact", "Report an issue", "Responsible disclosure"],
    },
    {
      heading: "Contact",
      links: [
        "hello@realdoor.example",
        "Human review only",
        "Synthetic data only",
        "No auto-submission",
      ],
    },
  ];

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <nav aria-label="Site" className="grid gap-10 md:grid-cols-4">
          {columns.map((col) => (
            <div key={col.heading}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                {col.heading}
              </h2>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                {col.links.map((label) => (
                  <li key={label}>
                    <a
                      href="#"
                      className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>
            Simulated prototype. Not affiliated with any housing authority. ©{" "}
            {new Date().getFullYear()} RealDoor.
          </p>
          <p>
            {APP_CONFIG.program} · v{APP_CONFIG.ruleVersion} · effective {APP_CONFIG.effectiveDate}
          </p>
        </div>
      </div>
    </footer>
  );
}
