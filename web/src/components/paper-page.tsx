// A real, document-style rendering of one packet section. Content is driven
// entirely by the strings buildPacketSections() produces (the same source the
// PDF renders from), so the preview and the printed packet stay in parity.
// Each section has its own typographic layout; the exact line text is preserved
// verbatim (labels, values, the "Profile version:" colon the verifier keys on).
import {
  BadgeCheck,
  CheckCircle2,
  FileText,
  ListChecks,
  Scale,
  TriangleAlert,
} from "lucide-react";
import { StatusBadge, type StatusVariant } from "@/components/status-badge";
import type { PacketSection } from "@/engine";
import { cn } from "@/lib/utils";

/** Split "label: rest" on the first ": " only. */
function splitFirst(line: string, sep: string): [string, string] {
  const i = line.indexOf(sep);
  return i === -1 ? [line, ""] : [line.slice(0, i), line.slice(i + sep.length)];
}

const SECTION_ICON: Record<string, typeof FileText> = {
  Cover: FileText,
  "Confirmed values": BadgeCheck,
  "Calculation sheet": Scale,
  Checklist: ListChecks,
  "Unresolved items": TriangleAlert,
  Manifest: FileText,
};

export interface PaperPageProps {
  section: PacketSection;
  /** Per-line checklist status variants, aligned to section.lines (Checklist only). */
  statuses?: StatusVariant[];
  pageNumber: number;
  pageCount: number;
  /** Miniature density (in the ring) vs full size (in the dialog). */
  dense?: boolean;
}

/** The white paper sheet with a section eyebrow + "Page N of M". */
export function PaperPage({ section, statuses, pageNumber, pageCount, dense }: PaperPageProps) {
  const Icon = SECTION_ICON[section.name] ?? FileText;
  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card text-left",
        dense ? "gap-2 p-4" : "gap-4 p-7",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-2">
        <span className="flex items-center gap-1.5">
          <Icon aria-hidden="true" className={cn("text-primary", dense ? "size-3.5" : "size-4")} />
          <span className={cn("font-semibold text-ink", dense ? "text-[0.8rem]" : "text-base")}>
            {section.name}
          </span>
        </span>
        <span className={cn("shrink-0 tnum text-subtle", dense ? "text-[0.6rem]" : "text-xs")}>
          Page {pageNumber} of {pageCount}
        </span>
      </div>
      <div className={cn("min-h-0 flex-1", dense ? "overflow-hidden" : "overflow-y-auto")}>
        <SectionBody section={section} statuses={statuses} dense={dense} />
      </div>
    </div>
  );
}

function SectionBody({
  section,
  statuses,
  dense,
}: {
  section: PacketSection;
  statuses?: StatusVariant[];
  dense?: boolean;
}) {
  const base = dense ? "text-[0.68rem] leading-snug" : "text-sm leading-relaxed";
  switch (section.name) {
    case "Cover":
      return <CoverBody lines={section.lines} dense={dense} />;
    case "Confirmed values":
      return <ConfirmedBody lines={section.lines} dense={dense} base={base} />;
    case "Calculation sheet":
      return <CalculationBody lines={section.lines} dense={dense} base={base} />;
    case "Checklist":
      return <ChecklistBody lines={section.lines} statuses={statuses} dense={dense} base={base} />;
    case "Unresolved items":
      return <UnresolvedBody lines={section.lines} dense={dense} base={base} />;
    case "Manifest":
      return <ManifestBody lines={section.lines} dense={dense} />;
    default:
      return (
        <ul className={cn("flex flex-col gap-1 text-body", base)}>
          {section.lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      );
  }
}

function CoverBody({ lines, dense }: { lines: string[]; dense?: boolean }) {
  const [title, prepared, disclaimer] = [lines[0] ?? "", lines[1] ?? "", lines[2] ?? ""];
  return (
    <div className="flex h-full flex-col">
      <p className={cn("font-semibold uppercase tracking-wide text-primary", dense ? "text-[0.55rem]" : "text-[0.7rem]")}>
        RealDoor
      </p>
      <h3 className={cn("mt-1 font-semibold tracking-tight text-ink", dense ? "text-[0.95rem] leading-tight" : "text-2xl")}>
        {title}
      </h3>
      <p className={cn("mt-1 text-subtle", dense ? "text-[0.62rem]" : "text-sm")}>{prepared}</p>
      <p
        className={cn(
          "mt-auto rounded-md bg-muted px-2.5 py-2 italic text-body",
          dense ? "text-[0.58rem] leading-snug" : "text-xs",
        )}
      >
        {disclaimer}
      </p>
    </div>
  );
}

function ConfirmedBody({ lines, dense, base }: { lines: string[]; dense?: boolean; base: string }) {
  if (lines.length === 1 && lines[0].startsWith("No ")) return <Empty text={lines[0]} base={base} />;
  return (
    <dl className="flex flex-col">
      {lines.map((line, i) => {
        const [label, rest] = splitFirst(line, ": ");
        const [value, evidence] = splitFirst(rest, " — ");
        return (
          <div
            key={i}
            className={cn(
              "grid grid-cols-[1fr_auto] items-baseline gap-x-3 border-b border-border/50 py-1.5 last:border-0",
              dense ? "text-[0.66rem]" : "text-sm",
            )}
          >
            <dt className="text-subtle">{label}</dt>
            <dd className="tnum text-right font-medium text-ink">{value}</dd>
            {evidence && (
              <dd className={cn("col-span-2 text-subtle", dense ? "text-[0.55rem]" : "text-xs")}>{evidence}</dd>
            )}
          </div>
        );
      })}
    </dl>
  );
}

function CalculationBody({ lines, dense, base }: { lines: string[]; dense?: boolean; base: string }) {
  if (lines.length === 1 && lines[0].startsWith("No ")) return <Empty text={lines[0]} base={base} />;
  // Group: a line that isn't "Method:"/"Source:" begins a new worked example.
  const blocks: { head: string; meta: string[] }[] = [];
  for (const line of lines) {
    if (line.startsWith("Method:") || line.startsWith("Source:")) {
      blocks[blocks.length - 1]?.meta.push(line);
    } else {
      blocks.push({ head: line, meta: [] });
    }
  }
  return (
    <div className={cn("flex flex-col gap-3", dense && "gap-2")}>
      {blocks.map((block, i) => {
        const [label, formula] = splitFirst(block.head, ": ");
        return (
          <div key={i} className="flex flex-col gap-1">
            <p className={cn("font-semibold text-ink", dense ? "text-[0.68rem]" : "text-sm")}>{label}</p>
            <p
              className={cn(
                "tnum rounded-md bg-muted px-2 py-1 font-medium text-body",
                dense ? "text-[0.6rem] leading-snug" : "text-xs",
              )}
            >
              {formula}
            </p>
            {block.meta.map((m, j) => (
              <p key={j} className={cn("text-subtle", dense ? "text-[0.55rem] leading-snug" : "text-xs")}>
                {m}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ChecklistBody({
  lines,
  statuses,
  dense,
  base,
}: {
  lines: string[];
  statuses?: StatusVariant[];
  dense?: boolean;
  base: string;
}) {
  if (lines.length === 0) return <Empty text="No checklist requirements." base={base} />;
  return (
    <ul className="flex flex-col gap-2">
      {lines.map((line, i) => {
        const [title, rest] = splitFirst(line, " — ");
        const [, explanation] = splitFirst(rest, ": ");
        const variant = statuses?.[i];
        return (
          <li key={i} className="flex flex-col gap-1 border-b border-border/50 pb-2 last:border-0">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className={cn("font-medium text-ink", dense ? "text-[0.66rem]" : "text-sm")}>{title}</span>
              {variant && (
                <StatusBadge
                  variant={variant}
                  className={dense ? "gap-1 px-1.5 py-0 text-[0.55rem] [&_svg]:size-2.5" : undefined}
                />
              )}
            </div>
            <span className={cn("text-subtle", dense ? "text-[0.58rem] leading-snug" : "text-xs")}>
              {explanation || rest}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function UnresolvedBody({ lines, dense, base }: { lines: string[]; dense?: boolean; base: string }) {
  const clear = lines.length === 1 && lines[0].startsWith("No ");
  if (clear) {
    return (
      <p className={cn("flex items-center gap-2 text-status-confirmed", base)}>
        <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
        {lines[0]}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {lines.map((line, i) => (
        <li key={i} className={cn("flex items-start gap-2 text-body", dense ? "text-[0.64rem]" : "text-sm")}>
          <TriangleAlert aria-hidden="true" className={cn("shrink-0 text-status-attention", dense ? "mt-0.5 size-3" : "mt-0.5 size-3.5")} />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

function ManifestBody({ lines, dense }: { lines: string[]; dense?: boolean }) {
  return (
    <dl className="flex flex-col">
      {lines.map((line, i) => {
        // Keep the label's colon in the text — the parity verifier keys on
        // "Profile version:" specifically.
        const [label, value] = splitFirst(line, ": ");
        return (
          <div
            key={i}
            className={cn(
              "grid grid-cols-[auto_1fr] items-baseline gap-x-3 py-1",
              dense ? "text-[0.62rem]" : "text-xs",
            )}
          >
            <dt className="text-subtle">{label}:</dt>
            <dd className="tnum break-words text-right text-ink">{value}</dd>
          </div>
        );
      })}
    </dl>
  );
}

function Empty({ text, base }: { text: string; base: string }) {
  return <p className={cn("text-subtle", base)}>{text}</p>;
}
