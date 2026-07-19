// Marketing landing hero above the upload screen (RealPage-style structure,
// adapted to our light system): a thin announcement band, a full-viewport hero
// over a background-media slot with a scrim, a three-stage band, then the
// existing upload screen — unchanged — below. The primary CTA and the skip-link
// (in App.tsx) smooth-scroll to the upload section (id="application").
import { ArrowDown, ArrowRight, BookOpenCheck, FolderCheck, UserCheck, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroMedia } from "@/components/hero-media";
import { UploadPage } from "@/pages/UploadPage";
import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

const CHIPS = ["2026 LIHTC", "Boston metro", "Synthetic documents only"];

interface Stage {
  href: string;
  eyebrow: string;
  title: string;
  tagline: string;
  icon: LucideIcon;
  primary?: boolean;
}

const STAGES: Stage[] = [
  { href: "#/review", eyebrow: "Step 1", title: "Profile", tagline: "Every value checked by you", icon: UserCheck },
  { href: "#/understand", eyebrow: "Step 2", title: "Understand", tagline: "Official rules, cited", icon: BookOpenCheck },
  { href: "#/packet", eyebrow: "Step 3", title: "Prepare", tagline: "A packet you control", icon: FolderCheck, primary: true },
];

export function LandingPage() {
  const reduced = usePrefersReducedMotion();

  function scrollToUpload(focus = false) {
    const el = document.getElementById("application");
    if (!el) return;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    if (focus) el.focus({ preventScroll: true });
  }

  function trySample() {
    scrollToUpload();
    // Fire the real "Try a sample pay stub" button inside the upload screen.
    window.setTimeout(() => document.getElementById("try-sample")?.click(), reduced ? 0 : 350);
  }

  return (
    <>
      {/* Announcement band. */}
      <a
        href="#/safety"
        className="flex items-center justify-center gap-2 border-b border-primary/15 bg-accent px-6 py-2 text-center text-sm font-medium text-primary hover:bg-accent/70"
      >
        Built for the RealPage × Hack-Nation Global AI Hackathon
        <ArrowRight aria-hidden="true" className="size-4" />
      </a>

      {/* Full-viewport hero over the background-media slot. */}
      <section
        aria-labelledby="hero-heading"
        className="relative flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center overflow-hidden px-6 py-20 text-center"
      >
        <HeroMedia />

        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-6">
          <h1 id="hero-heading" className="text-balance text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
            <span className="font-light text-ink/80">Your application, </span>
            <span className="font-semibold text-ink">ready to hand over</span>
          </h1>
          <p className="max-w-xl text-pretty text-lg text-body">
            Every value checked by you. Every rule cited. Never a decision made for you.
          </p>

          <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" onClick={() => scrollToUpload(true)}>
              Get started
              <ArrowDown aria-hidden="true" />
            </Button>
            <Button size="lg" variant="ghost" onClick={trySample}>
              Try the sample document
            </Button>
          </div>

          <ul className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {CHIPS.map((chip) => (
              <li
                key={chip}
                className="rounded-full border border-border/70 bg-card/70 px-3 py-1 text-xs font-medium text-subtle backdrop-blur-sm"
              >
                {chip}
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={() => scrollToUpload()}
          aria-label="Scroll to the application"
          className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full p-1 text-subtle hover:text-primary"
        >
          <ArrowDown aria-hidden="true" className={cn("size-5", !reduced && "animate-bounce")} />
        </button>
      </section>

      {/* Three-stage band. */}
      <section aria-label="How RealDoor works" className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="grid gap-4 md:grid-cols-3">
          {STAGES.map((stage) => {
            const Icon = stage.icon;
            return (
              <a
                key={stage.title}
                href={stage.href}
                className={cn(
                  "group flex flex-col gap-2 rounded-2xl border p-6 transition-all duration-200 hover:-translate-y-0.5",
                  stage.primary
                    ? "border-transparent bg-primary text-primary-foreground shadow-lg hover:bg-primary/90"
                    : "border-border bg-card hover:border-primary/40 hover:shadow-card",
                )}
              >
                <Icon aria-hidden="true" className={cn("size-6", stage.primary ? "text-primary-foreground" : "text-primary")} />
                <span
                  className={cn(
                    "text-xs font-semibold uppercase tracking-wide",
                    stage.primary ? "text-primary-foreground/80" : "text-subtle",
                  )}
                >
                  {stage.eyebrow}
                </span>
                <span className={cn("text-lg font-semibold", stage.primary ? "text-primary-foreground" : "text-ink")}>
                  {stage.title}
                </span>
                <span className={cn("text-sm", stage.primary ? "text-primary-foreground/90" : "text-body")}>
                  {stage.tagline}
                </span>
                <span
                  className={cn(
                    "mt-2 inline-flex items-center gap-1 text-sm font-medium",
                    stage.primary ? "text-primary-foreground" : "text-primary",
                  )}
                >
                  Open
                  <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </a>
            );
          })}
        </div>
      </section>

      {/* The existing upload screen — unchanged. */}
      <UploadPage />
    </>
  );
}
