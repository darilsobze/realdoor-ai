import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Clock,
  FileX,
  ShieldQuestion,
} from "lucide-react";
import type { ChecklistItemResult, ChecklistStatus } from "@/domain/types";
import { CHECKLIST_STATUS_LABEL } from "@/domain/checklist";

const ICON: Record<ChecklistStatus, typeof CheckCircle2> = {
  confirmed: CheckCircle2,
  needs_confirmation: CircleHelp,
  missing: FileX,
  expired: Clock,
  conflicting: AlertTriangle,
  rule_unavailable: ShieldQuestion,
};

const STYLE: Record<ChecklistStatus, string> = {
  confirmed: "bg-status-ok text-status-ok-foreground",
  needs_confirmation: "bg-status-warn text-status-warn-foreground",
  missing: "bg-status-danger text-status-danger-foreground",
  expired: "bg-status-danger text-status-danger-foreground",
  conflicting: "bg-status-warn text-status-warn-foreground",
  rule_unavailable: "bg-status-info text-status-info-foreground",
};

export function ChecklistItemView({ item }: { item: ChecklistItemResult }) {
  const Icon = ICON[item.status];
  const label = CHECKLIST_STATUS_LABEL[item.status];
  return (
    <li className="rounded-md border border-border bg-card p-4 transition-colors duration-200 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{item.def.label}</p>
          <p className="mt-1 text-sm text-muted-foreground">{item.def.description}</p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STYLE[item.status]}`}
        >
          <Icon aria-hidden="true" className="size-3.5" />
          {label}
        </span>
      </div>
      <p className="mt-2 text-sm text-foreground/85">{item.reasonText}</p>
    </li>
  );
}
