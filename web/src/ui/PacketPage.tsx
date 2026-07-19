import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileCheck2, Info, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  buildPacket,
  buildPacketSections,
  type PacketPresentation,
} from "@/engine";
import type { PacketAttachment } from "@/engine/packet-pdf";
import { ChecklistTraceCard } from "@/components/trace-cards";
import { PacketGallery } from "@/components/packet-gallery";
import type { StatusVariant } from "@/components/status-badge";
import { buildDerived } from "@/lib/calculations";
import { GOLD_CHECKLIST, requirementTitle } from "@/lib/checklist";
import { FIELD_META, formatValue } from "@/lib/field-meta";
import { ruleById, SCORED_RULE } from "@/lib/rules";
import { useReview, type ReviewField } from "@/store/review";
import type { Citation, ComputedCalculation, FieldName, ProfileField } from "@/contracts";

const CALC_LABELS: Record<string, string> = {
  annualized_income: "Annual income",
  income_sum: "Total annual income",
  threshold_comparison: "Compared with the published limit",
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmed",
  needs_confirmation: "Needs confirmation",
  missing: "Missing",
  expired: "Expired",
  conflicting: "Conflicting",
  not_applicable: "Not applicable",
};

function formatPacketDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function toProfileField(field: ReviewField): ProfileField {
  return {
    field_name: field.extracted.field_name,
    state: field.state,
    confidence_tier: field.extracted.confidence_tier,
    model_proposed_value: field.extracted.model_proposed_value,
    user_corrected_value: field.correctedValue,
    confirmed_value: field.confirmedValue,
    unit: field.extracted.unit,
    proposed_at: null,
    corrected_at: field.correctedAt,
    confirmed_at: field.confirmedAt,
    extracted_field_id: field.extracted.id,
    source_document_id: field.extracted.document_id,
    page: field.extracted.page,
    bbox: field.extracted.bbox,
  };
}

function completedCalculations(values: unknown[]): ComputedCalculation[] {
  return values.filter(
    (value): value is ComputedCalculation =>
      typeof value === "object" &&
      value !== null &&
      "status" in value &&
      value.status === "computed",
  );
}

function uniqueCitations(calculations: ComputedCalculation[]) {
  const citations = calculations
    .map((calculation) =>
      calculation.source_rule_id ? ruleById(calculation.source_rule_id)?.citation : null,
    )
    .filter((citation): citation is Citation => citation !== null && citation !== undefined);
  return citations.filter(
    (citation, index) =>
      citations.findIndex(
        (candidate) =>
          candidate.official_source === citation.official_source &&
          candidate.section === citation.section &&
          candidate.table_id === citation.table_id,
      ) === index,
  );
}

async function fetchDocumentPages(
  sessionId: string,
  documentId: string,
  displayName: string,
  pageCount: number,
): Promise<PacketAttachment[]> {
  const pages: PacketAttachment[] = [];
  for (let page = 1; page <= pageCount; page += 1) {
    const response = await fetch(
      `/api/session/${encodeURIComponent(sessionId)}/documents/${encodeURIComponent(documentId)}/page/${page}`,
    );
    if (!response.ok) throw new Error(`Could not load attachment page ${page}.`);
    pages.push({
      documentId,
      fileName: `${displayName} - page ${page}`,
      bytes: new Uint8Array(await response.arrayBuffer()),
      mimeType: "image/png",
    });
  }
  return pages;
}

export function PacketPage() {
  const { state } = useReview();
  const [includeDocument, setIncludeDocument] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState("");
  // Sections the renter has reviewed and dropped into the packet folder.
  const [collected, setCollected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState("");

  const context = useMemo(
    () => ({ profileVersion: state.profileVersion, computedAt: state.lastChangedAt }),
    [state.profileVersion, state.lastChangedAt],
  );
  const derived = useMemo(
    () =>
      buildDerived(
        state.fields,
        state.householdSize,
        SCORED_RULE,
        context,
        state.document?.id ?? null,
      ),
    [state.fields, state.householdSize, state.document?.id, context],
  );

  // Packet integrity: a profile change after collecting invalidates the
  // collected set (values/derived may have moved), so reset with a notice.
  const lastVersion = useRef(state.profileVersion);
  useEffect(() => {
    if (state.profileVersion === lastVersion.current) return;
    lastVersion.current = state.profileVersion;
    setCollected((prev) => {
      if (prev.size === 0) return prev;
      setNotice(
        `Your profile changed to v${state.profileVersion}, so collected sections were reset — recollect them to keep the packet in sync with your confirmed values.`,
      );
      return new Set();
    });
  }, [state.profileVersion]);

  if (!state.sessionId || !state.document) {
    return (
      <main className="mx-auto flex max-w-(--container-reading) flex-col items-center gap-4 px-6 py-24 text-center">
        <h1 className="text-2xl">No packet to prepare yet</h1>
        <p className="text-body">Upload and review a document before preparing a packet.</p>
        <Button onClick={() => (window.location.hash = "#/")}>Go to upload</Button>
      </main>
    );
  }

  const calculations = completedCalculations([
    derived.wage,
    derived.benefit,
    derived.totalIncome,
    derived.comparison,
  ]);
  const unresolvedItems = [
    ...state.fields
      .filter((field) => field.state !== "confirmed")
      .map((field) => `${FIELD_META[field.extracted.field_name].label}: confirmation needed`),
    ...derived.checklist
      .filter((item) => item.status !== "confirmed" && item.status !== "not_applicable")
      .map((item) => `${requirementTitle(item.requirement_id)}: ${STATUS_LABELS[item.status] ?? item.status}`),
  ];
  const selectedDocumentIds = includeDocument ? [state.document.id] : [];
  const packet = buildPacket({
    createdAt: state.lastChangedAt,
    profileVersion: state.profileVersion,
    ruleVersion: SCORED_RULE.citation.rule_version,
    checklistVersion: GOLD_CHECKLIST.checklist_version,
    confirmedFields: state.fields.map(toProfileField),
    calculations,
    citations: uniqueCitations(calculations),
    checklist: derived.checklist,
    selectedDocumentIds,
    unresolvedItems,
  });
  // Display lookups the packet renders through — keeps the engine UI-free while
  // the preview AND the PDF share one presentation, so they stay identical.
  const docNames = new Map(state.document ? [[state.document.id, state.document.displayName]] : []);
  const presentation: Partial<PacketPresentation> = {
    fieldLabel: (name) => FIELD_META[name as FieldName]?.label ?? name,
    formatValue: (name, value) => formatValue(name as FieldName, value),
    documentName: (id) => docNames.get(id) ?? id,
    requirementTitle,
    statusLabel: (status) => STATUS_LABELS[status] ?? status,
    calculationLabel: (type) => CALC_LABELS[type] ?? type,
    formatDate: formatPacketDate,
  };
  const sections = buildPacketSections(packet, presentation);
  const pageCount = Math.max(1, ...state.fields.map((field) => field.extracted.page ?? 1));

  // Plain-language summary of which documents the checklist matched.
  const typeField = state.fields.find(
    (f) => f.extracted.field_name === "document_type" && f.state === "confirmed",
  );
  const typeLabel = typeField ? String(typeField.confirmedValue).replaceAll("_", " ") : "document";
  const matchedDocs = new Set(derived.checklist.flatMap((r) => r.matched_document_ids)).size;
  const matchedSummary =
    matchedDocs > 0 ? `${matchedDocs} ${typeLabel}${matchedDocs === 1 ? "" : "s"} matched` : "No documents matched yet";

  const checklistStatuses = derived.checklist.map((r) => r.status as StatusVariant);
  const allCollected = collected.size === sections.length;

  function addSection(name: string) {
    setCollected((prev) => new Set(prev).add(name));
    setNotice("");
  }
  function removeSection(name: string) {
    setCollected((prev) => {
      const next = new Set(prev);
      next.delete(name);
      return next;
    });
    const isUnresolved = name === "Unresolved items" && unresolvedItems.length > 0;
    setNotice(
      isUnresolved
        ? `Removed "${name}". Some items still need confirmation — the reviewer needs this section to see what's outstanding.`
        : `Removed "${name}". All six sections are required before you can download.`,
    );
  }

  async function download() {
    if (!allCollected) return;
    setDownloading(true);
    setMessage("");
    try {
      const attachments = includeDocument
        ? await fetchDocumentPages(
            state.sessionId!,
            state.document!.id,
            state.document!.displayName,
            pageCount,
          )
        : [];
      // Multiple rendered pages belong to one selected document. Combine them
      // before the strict manifest check by rendering a temporary PDF.
      let normalizedAttachments: PacketAttachment[] = [];
      if (attachments.length > 0) {
        const { PDFDocument } = await import("pdf-lib");
        const attachmentPdf = await PDFDocument.create();
        for (const attachment of attachments) {
          const image = await attachmentPdf.embedPng(attachment.bytes);
          const page = attachmentPdf.addPage([image.width, image.height]);
          page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
        }
        normalizedAttachments = [
          {
            documentId: state.document!.id,
            fileName: state.document!.displayName,
            bytes: await attachmentPdf.save(),
            mimeType: "application/pdf",
          },
        ];
      }
      const { renderPacketPdf } = await import("@/engine/packet-pdf");
      const bytes = await renderPacketPdf(packet, normalizedAttachments, presentation);
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const url = URL.createObjectURL(new Blob([buffer], { type: "application/pdf" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `realdoor-packet-v${state.profileVersion}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("Your packet was downloaded. Nothing was sent anywhere.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The packet could not be downloaded.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <header>
        <p className="text-sm font-medium text-primary">Profile v{state.profileVersion}</p>
        <h1 className="text-2xl">Preview your application packet</h1>
        <p className="mt-1 max-w-2xl text-sm text-body">{packet.cover.disclaimer}</p>
      </header>

      <ChecklistTraceCard
        derived={derived}
        checklistVersion={GOLD_CHECKLIST.checklist_version}
        matchedSummary={matchedSummary}
        profileVersion={state.profileVersion}
        autoPlay
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <h2 className="flex items-center gap-2 text-base">
            <FileCheck2 aria-hidden="true" className="size-4 text-primary" />
            Choose attachments
          </h2>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
            <input
              type="checkbox"
              checked={includeDocument}
              onChange={(event) => setIncludeDocument(event.target.checked)}
              className="mt-1 size-4"
            />
            <span>
              <span className="block text-sm font-medium text-ink">{state.document.displayName}</span>
              <span className="block text-xs text-subtle">
                Include {pageCount} rendered {pageCount === 1 ? "page" : "pages"} after the packet manifest.
              </span>
            </span>
          </label>
          <p className="flex items-start gap-2 text-xs text-subtle">
            <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            Documents are excluded by default and included only when you select them.
          </p>
        </CardContent>
      </Card>

      <section aria-labelledby="packet-gallery-heading" className="flex flex-col gap-3">
        <div>
          <h2 id="packet-gallery-heading" className="text-lg">Your packet, page by page</h2>
          <p className="text-sm text-subtle">
            Turn the ring to review each section, then drop it into the folder — or use each page's
            “Add to packet”. Collect all six to enable the download.
          </p>
        </div>

        {notice && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-lg border border-status-info/30 bg-status-info-bg p-3 text-sm text-status-info"
          >
            <RefreshCw aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {notice}
          </p>
        )}

        <PacketGallery
          sections={sections}
          checklistStatuses={checklistStatuses}
          collected={collected}
          onAdd={addSection}
          onRemove={removeSection}
        />
      </section>

      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-surface p-4 shadow-lg">
        <p aria-live="polite" className="text-sm text-body">
          {message || (allCollected ? "All six sections collected — ready to download." : `${collected.size} of ${sections.length} sections collected.`)}
        </p>
        <Button onClick={download} disabled={downloading || !allCollected}>
          <Download aria-hidden="true" data-icon="inline-start" />
          {downloading
            ? "Building packet…"
            : allCollected
              ? "Download my packet"
              : "Collect all sections to download"}
        </Button>
      </div>
    </main>
  );
}
