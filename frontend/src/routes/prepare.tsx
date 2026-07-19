import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, Clock, Download, HelpCircle, Trash2, TriangleAlert } from "lucide-react";
import { useSession } from "@/state/session";
import { GOLD_CHECKLIST } from "@/domain/gold-checklist";
import { evaluateGoldChecklist, type GoldChecklistStatus } from "@/engine/checklist";
import { buildPacketLines, renderPacketPdf } from "@/engine/packet";
import { Banner } from "@/components/banner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/prepare")({ component: PreparePage });

const RULE_VERSION = "2026-frozen-2026-07-18";

const STATUS_STYLE: Record<GoldChecklistStatus, string> = {
  confirmed: "bg-status-ok text-status-ok-foreground",
  needs_confirmation: "bg-status-warn text-status-warn-foreground",
  missing: "bg-status-danger text-status-danger-foreground",
  expired: "bg-status-danger text-status-danger-foreground",
  conflicting: "bg-status-danger text-status-danger-foreground",
  not_applicable: "bg-status-info text-status-info-foreground",
};

function StatusIcon({ status }: { status: GoldChecklistStatus }) {
  if (status === "confirmed") return <CheckCircle2 aria-hidden="true" className="size-4" />;
  if (status === "expired") return <Clock aria-hidden="true" className="size-4" />;
  if (status === "missing" || status === "conflicting") {
    return <TriangleAlert aria-hidden="true" className="size-4" />;
  }
  return <HelpCircle aria-hidden="true" className="size-4" />;
}

function PreparePage() {
  const { state, confirmedList, removeDocument } = useSession();
  const [notes, setNotes] = useState("");
  const [selectedAttachments, setSelectedAttachments] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const [downloading, setDownloading] = useState(false);

  const checklist = useMemo(() => {
    const documents = state.documents.map((document) => {
      const type = confirmedList.find(
        (field) => field.docId === document.id && field.name === "document_type",
      );
      const date = confirmedList.find(
        (field) => field.docId === document.id && field.name === "document_date",
      );
      return {
        documentId: document.id,
        documentType: type ? String(type.value) : "other",
        documentTypeConfirmed: Boolean(type),
        documentDate: date ? String(date.value) : null,
        documentDateConfirmed: Boolean(date),
        conflicting: false,
      };
    });
    return evaluateGoldChecklist({
      checklist: GOLD_CHECKLIST,
      documents,
      householdSizeConfirmed: state.householdSize !== null,
      asOfDate: new Date().toISOString().slice(0, 10),
    });
  }, [confirmedList, state.documents, state.householdSize]);

  const requirementTitle = new Map(
    GOLD_CHECKLIST.requirements.map((requirement) => [
      requirement.requirement_id,
      requirement.title,
    ]),
  );
  const documentName = new Map(
    state.documents.map((document) => [document.id, document.displayName]),
  );
  const selectedDocumentNames = state.documents
    .filter((document) => selectedAttachments[document.id])
    .map((document) => document.displayName);
  const packetInput = {
    generatedAt: new Date().toISOString(),
    profileVersion: state.profileVersion,
    ruleVersion: RULE_VERSION,
    checklistVersion: GOLD_CHECKLIST.checklist_version,
    householdSize: state.householdSize,
    confirmedFields: confirmedList.map((field) => ({
      name: field.name,
      value: field.value,
      status: field.status,
      documentName: documentName.get(field.docId) ?? field.docId,
    })),
    checklist: checklist.map((item) => ({
      title: requirementTitle.get(item.requirement_id) ?? item.requirement_id,
      status: item.status,
      explanation: item.explanation,
    })),
    selectedDocumentNames,
    notes,
  };

  async function downloadPacket() {
    setDownloading(true);
    setMessage("");
    try {
      const bytes = await renderPacketPdf(packetInput);
      const buffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
      const url = URL.createObjectURL(new Blob([buffer], { type: "application/pdf" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `realdoor-packet-v${state.profileVersion}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("Your PDF packet was downloaded. Nothing was submitted anywhere.");
    } catch {
      setMessage("The PDF packet could not be generated. Your session was not changed.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold">Prepare — your application-readiness packet</h1>
        <p className="text-sm text-muted-foreground">
          Review the frozen gold checklist, choose attachments, and download a renter-controlled
          draft.
        </p>
      </header>

      <Banner variant="info" title="Renter-controlled draft">
        You choose what is included. RealDoor never submits the packet and never decides
        eligibility.
      </Banner>

      <section aria-labelledby="checklist-heading" className="grid gap-3">
        <h2 id="checklist-heading" className="text-lg font-semibold">
          Gold checklist · {GOLD_CHECKLIST.checklist_version}
        </h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {checklist.map((item) => (
            <li key={item.requirement_id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold">
                  {requirementTitle.get(item.requirement_id) ?? item.requirement_id}
                </h3>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLE[item.status]}`}
                >
                  <StatusIcon status={item.status} /> {item.status.replaceAll("_", " ")}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{item.explanation}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="attachments-heading"
        className="rounded-lg border border-border bg-card p-4"
      >
        <h2 id="attachments-heading" className="text-lg font-semibold">
          Choose attachments
        </h2>
        <p className="text-sm text-muted-foreground">
          Documents are excluded unless you select them.
        </p>
        {state.documents.length === 0 ? (
          <p className="mt-3 text-sm">No documents in this session.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {state.documents.map((document) => (
              <li
                key={document.id}
                className="flex items-center justify-between gap-3 rounded border p-2"
              >
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`attach-${document.id}`}
                    checked={Boolean(selectedAttachments[document.id])}
                    onCheckedChange={() =>
                      setSelectedAttachments((current) => ({
                        ...current,
                        [document.id]: !current[document.id],
                      }))
                    }
                  />
                  <Label htmlFor={`attach-${document.id}`}>{document.displayName}</Label>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeDocument(document.id)}
                  aria-label={`Remove ${document.displayName}`}
                >
                  <Trash2 aria-hidden="true" className="size-4" /> Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="notes-heading"
        className="rounded-lg border border-border bg-card p-4"
      >
        <h2 id="notes-heading" className="text-lg font-semibold">
          Renter notes (optional)
        </h2>
        <Textarea
          className="mt-2"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={4}
          placeholder="Anything you want a human reviewer to understand."
        />
      </section>

      <section aria-labelledby="preview-heading" className="grid gap-3">
        <h2 id="preview-heading" className="text-lg font-semibold">
          Packet preview
        </h2>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-card p-4 text-xs">
          {buildPacketLines(packetInput).join("\n")}
        </pre>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void downloadPacket()} disabled={downloading}>
            <Download aria-hidden="true" className="size-4" />
            {downloading ? "Building PDF…" : "Download PDF packet"}
          </Button>
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {message}
          </p>
        </div>
      </section>
    </div>
  );
}
