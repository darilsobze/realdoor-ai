// Document viewer: server-rendered page PNG (the same render that fed OCR, so
// boxes align exactly) with the active field's evidence box outlined 2px in
// primary + 8% fill, and a scrim over the rest of the page.
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { pageUrl } from "@/lib/api";
import type { BBox } from "@/contracts";

/** Server render scale: PNG pixels per PDF point (server RENDER_SCALE). */
const PNG_SCALE = 2;

export interface EvidenceTarget {
  page: number;
  bbox: BBox;
  label: string;
}

export function DocumentViewer({
  sessionId,
  documentId,
  displayName,
  pageCount,
  evidence,
}: {
  sessionId: string;
  documentId: string;
  displayName: string;
  pageCount: number;
  evidence: EvidenceTarget | null;
}) {
  const [page, setPage] = useState(1);
  const [pagePts, setPagePts] = useState<{ w: number; h: number } | null>(null);

  // Follow the evidence to its page.
  useEffect(() => {
    if (evidence) setPage(evidence.page);
  }, [evidence]);

  const box = evidence && evidence.page === page && pagePts ? evidence.bbox : null;

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="truncate text-sm font-semibold text-ink" title={displayName}>
          {displayName}
        </h2>
        {pageCount > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </Button>
            <span className="text-xs text-subtle tnum">
              Page {page} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Next page"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="relative overflow-hidden rounded-lg border">
        <img
          src={pageUrl(sessionId, documentId, page)}
          alt={`Page ${page} of ${displayName}`}
          className="block w-full"
          onLoad={(e) => {
            const img = e.currentTarget;
            setPagePts({ w: img.naturalWidth / PNG_SCALE, h: img.naturalHeight / PNG_SCALE });
          }}
        />
        {box && pagePts && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute rounded-[2px] outline-2 outline-primary bg-evidence-fill transition-all duration-200 ease-(--ease-out-soft)"
            style={{
              left: `${(box.x / pagePts.w) * 100}%`,
              top: `${(box.y / pagePts.h) * 100}%`,
              width: `${(box.width / pagePts.w) * 100}%`,
              height: `${(box.height / pagePts.h) * 100}%`,
              boxShadow: "0 0 0 100vmax var(--scrim)",
            }}
          />
        )}
      </div>

      <p aria-live="polite" className="text-xs text-subtle">
        {evidence
          ? `Highlighting where “${evidence.label}” was read on page ${evidence.page}.`
          : "Choose “Show evidence” on a value to see where it was read."}
      </p>
    </Card>
  );
}
