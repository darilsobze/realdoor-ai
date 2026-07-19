// Marketing footer (from the landing reference): four columns plus a legal
// line. Program facts come from the frozen corpus citation so they can't drift.
// Items with a real destination are links; trust statements and facts are plain
// text (no dead "#" links).
import { SCORED_RULE } from "@/lib/rules";

const METRO = "Boston-Cambridge-Quincy, MA-NH HMFA";
const c = SCORED_RULE.citation;
const EMAIL = "hello@realdoor.example";

type Item = { label: string; href?: string };

const COLUMNS: { heading: string; items: Item[] }[] = [
  {
    heading: "RealDoor",
    items: [
      { label: "About", href: "#how-it-works" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Rule sources", href: "#/understand" },
      { label: "Accessibility", href: "#/safety" },
    ],
  },
  {
    heading: "Program",
    items: [
      { label: `Metro: ${METRO}` },
      { label: `Rule version ${c.rule_version}` },
      { label: `Effective ${c.effective_date}` },
      { label: "Changelog" },
    ],
  },
  {
    heading: "Support",
    items: [
      { label: "FAQ" },
      { label: "Contact", href: `mailto:${EMAIL}` },
      { label: "Report an issue", href: `mailto:${EMAIL}?subject=RealDoor%20issue` },
      { label: "Responsible disclosure" },
    ],
  },
  {
    heading: "Contact",
    items: [
      { label: EMAIL, href: `mailto:${EMAIL}` },
      { label: "Human review only" },
      { label: "Synthetic data only" },
      { label: "No auto-submission" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-14">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.heading} className="flex flex-col gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ink">{col.heading}</h2>
              <ul className="flex flex-col gap-2">
                {col.items.map((item) => (
                  <li key={item.label} className="break-words text-sm text-subtle">
                    {item.href ? (
                      <a href={item.href} className="rounded-sm hover:text-primary">
                        {item.label}
                      </a>
                    ) : (
                      item.label
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>Simulated prototype. Not affiliated with any housing authority. © {c.rule_year} RealDoor.</p>
          <p className="tnum">
            {c.program_id} · v{c.rule_version} · effective {c.effective_date}
          </p>
        </div>
      </div>
    </footer>
  );
}
