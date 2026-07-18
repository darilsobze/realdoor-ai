import type { LucideIcon } from "lucide-react";
import {
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  CircleMinus,
  Info,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Status is always icon + text; color is a secondary signal (WCAG:
 * never color alone). Variants cover checklist + confirmation states.
 */
export type StatusVariant =
  | "confirmed"
  | "needs_confirmation"
  | "missing"
  | "expired"
  | "conflicting"
  | "not_applicable"
  | "info";

const VARIANTS: Record<
  StatusVariant,
  { icon: LucideIcon; label: string; className: string }
> = {
  confirmed: {
    icon: CheckCircle2,
    label: "Confirmed",
    className: "bg-status-confirmed-bg text-status-confirmed",
  },
  needs_confirmation: {
    icon: TriangleAlert,
    label: "Needs confirmation",
    className: "bg-status-attention-bg text-status-attention",
  },
  missing: {
    icon: XCircle,
    label: "Missing",
    className: "bg-status-blocking-bg text-status-blocking",
  },
  expired: {
    icon: CalendarClock,
    label: "Expired",
    className: "bg-status-blocking-bg text-status-blocking",
  },
  conflicting: {
    icon: CircleAlert,
    label: "Conflicting",
    className: "bg-status-blocking-bg text-status-blocking",
  },
  not_applicable: {
    icon: CircleMinus,
    label: "Not applicable",
    className: "bg-muted text-subtle",
  },
  info: {
    icon: Info,
    label: "Info",
    className: "bg-status-info-bg text-status-info",
  },
};

export function StatusBadge({
  variant,
  label,
  className,
}: {
  variant: StatusVariant;
  label?: string;
  className?: string;
}) {
  const v = VARIANTS[variant];
  const IconComponent = v.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        v.className,
        className,
      )}
    >
      <IconComponent aria-hidden="true" className="size-3.5 shrink-0" />
      {label ?? v.label}
    </span>
  );
}
