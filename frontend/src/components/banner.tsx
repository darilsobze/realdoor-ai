import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

type Variant = "info" | "warn" | "danger";

const VARIANT_STYLES: Record<Variant, string> = {
  info: "bg-status-info text-status-info-foreground border-status-info-foreground/30",
  warn: "bg-status-warn text-status-warn-foreground border-status-warn-foreground/30",
  danger: "bg-status-danger text-status-danger-foreground border-status-danger-foreground/30",
};

const VARIANT_ICON: Record<Variant, typeof Info> = {
  info: Info,
  warn: AlertTriangle,
  danger: ShieldAlert,
};

export function Banner({
  variant = "info",
  title,
  children,
}: {
  variant?: Variant;
  title: string;
  children?: ReactNode;
}) {
  const Icon = VARIANT_ICON[variant];
  return (
    <div
      role="note"
      className={`flex items-start gap-3 rounded-md border px-3 py-2 text-sm animate-fade-in ${VARIANT_STYLES[variant]}`}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        {children ? <div className="text-sm opacity-95">{children}</div> : null}
      </div>
    </div>
  );
}
