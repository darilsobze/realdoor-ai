import { FileText, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";

const SWATCHES = [
  ["--background", "Background"],
  ["--card", "Surface"],
  ["--border", "Border"],
  ["--ink", "Ink (headings)"],
  ["--body", "Body"],
  ["--subtle", "Secondary"],
  ["--primary", "Primary"],
  ["--status-confirmed", "Confirmed"],
  ["--status-attention", "Attention"],
  ["--status-blocking", "Blocking"],
  ["--status-info", "Info"],
] as const;

/** Dev-only reference page: tokens, badges, and canonical component states. */
export function StyleGuide() {
  return (
    <main className="mx-auto max-w-(--container-reading) space-y-10 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-2xl">RealDoor style guide</h1>
        <p className="text-subtle">
          Design tokens and canonical component states. Dev reference only.
        </p>
      </header>

      <section aria-labelledby="sg-type" className="space-y-3">
        <h2 id="sg-type" className="text-xl">Type scale</h2>
        <Card className="shadow-card">
          <CardContent className="space-y-2 pt-6">
            <p className="text-2xl text-ink font-semibold">28 — Page title</p>
            <p className="text-xl text-ink font-semibold">22 — Section title</p>
            <p className="text-lg text-ink font-semibold">18 — Card title</p>
            <p className="text-base">16 — Body text, 1.6 line height</p>
            <p className="text-sm">14 — Supporting text</p>
            <p className="text-xs text-subtle">13 — Meta and captions</p>
            <p className="text-base tnum">Tabular: $1,580.00 · 2026-05-01</p>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="sg-colors" className="space-y-3">
        <h2 id="sg-colors" className="text-xl">Color tokens</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SWATCHES.map(([token, name]) => (
            <div
              key={token}
              className="rounded-lg border bg-card p-3 shadow-card"
            >
              <div
                className="mb-2 h-10 rounded-md border"
                style={{ backgroundColor: `var(${token})` }}
              />
              <p className="text-xs font-medium text-ink">{name}</p>
              <p className="text-xs text-subtle">{token}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="sg-status" className="space-y-3">
        <h2 id="sg-status" className="text-xl">Status badges (icon + text, never color alone)</h2>
        <div className="flex flex-wrap gap-2">
          <StatusBadge variant="confirmed" />
          <StatusBadge variant="needs_confirmation" />
          <StatusBadge variant="missing" />
          <StatusBadge variant="expired" />
          <StatusBadge variant="conflicting" />
          <StatusBadge variant="not_applicable" />
          <StatusBadge variant="info" label="No conclusion generated" />
        </div>
      </section>

      <section aria-labelledby="sg-card" className="space-y-3">
        <h2 id="sg-card" className="text-xl">Field card</h2>
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">
                  Gross pay <span className="font-normal text-subtle">(money you earn before taxes)</span>
                </CardTitle>
                <CardDescription>
                  From <span className="inline-flex items-center gap-1"><FileText aria-hidden="true" className="size-3.5" /> paystub-march.pdf</span>, page 1
                </CardDescription>
              </div>
              <StatusBadge variant="needs_confirmation" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-3">
              <span className="tnum text-xl font-semibold text-ink">$1,580.00</span>
              <span className="text-sm text-subtle">per pay period · Confidence: High</span>
            </div>
            <Separator />
            <div className="flex flex-wrap gap-2">
              <Button size="sm">Confirm this value</Button>
              <Button size="sm" variant="outline">Correct it</Button>
              <Button size="sm" variant="ghost">Show evidence</Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="sg-info" className="space-y-3">
        <h2 id="sg-info" className="text-xl">Abstention panel (calm, never an error)</h2>
        <div
          role="status"
          className="rounded-lg border border-status-info/20 bg-status-info-bg p-4 text-sm"
        >
          <p className="font-medium text-status-info">No authoritative rule found</p>
          <p className="mt-1 text-body">
            The rule library does not cover this question, so no conclusion was
            generated. A qualified person at the housing office can answer it.
          </p>
        </div>
      </section>

      <section aria-labelledby="sg-loading" className="space-y-3">
        <h2 id="sg-loading" className="text-xl">Loading (named, skeleton — never a bare spinner)</h2>
        <Card className="shadow-card">
          <CardContent className="space-y-3 pt-6">
            <p className="text-sm text-subtle">Reading your document…</p>
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="sg-empty" className="space-y-3">
        <h2 id="sg-empty" className="text-xl">Empty state (icon, one sentence, one action)</h2>
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Upload aria-hidden="true" className="size-8 text-subtle" />
            <p className="text-sm text-body">No documents yet — add a pay stub or benefit letter to begin.</p>
            <Button>Add a document</Button>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="sg-misc" className="space-y-3">
        <h2 id="sg-misc" className="text-xl">Buttons & version badge</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button>Download my packet</Button>
          <Button variant="outline">Delete everything</Button>
          <Badge variant="secondary" className="tnum">Profile v3</Badge>
        </div>
      </section>
    </main>
  );
}
