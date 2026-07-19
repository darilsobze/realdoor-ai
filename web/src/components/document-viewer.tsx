// Document viewer: server-rendered page PNG (the same render that fed OCR, so
// boxes align exactly) with the active field's evidence box outlined 2px in
// primary + 8% fill, and a scrim over the rest of the page.
import { useEffect, useRef, useState } from "react";
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
  const frameRef = useRef<HTMLDivElement>(null);
  // Rendered width of the page image, in CSS px. The image is fit-to-width
  // (w-full), so this equals its container's content width; we recompute it on
  // resize and derive one scale factor that positions the evidence overlay —
  // so highlights stay pixel-accurate at any column width.
  const [renderW, setRenderW] = useState(0);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRenderW(el.clientWidth));
    ro.observe(el);
    setRenderW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Follow the evidence to its page.
  useEffect(() => {
    if (evidence) setPage(evidence.page);
  }, [evidence]);

  const box = evidence && evidence.page === page && pagePts ? evidence.bbox : null;
  // One fit-to-width factor: rendered pixels per PDF point.
  const scale = pagePts && renderW ? renderW / pagePts.w : 0;

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

      <div ref={frameRef} className="relative overflow-hidden rounded-lg border">
        <img
          src={pageUrl(sessionId, documentId, page)}
          alt={`Page ${page} of ${displayName}`}
          className="block w-full"
          onLoad={(e) => {
            const img = e.currentTarget;
            setPagePts({ w: img.naturalWidth / PNG_SCALE, h: img.naturalHeight / PNG_SCALE });
            setRenderW(img.clientWidth);
          }}
        />
        {box && scale > 0 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute rounded-[2px] outline-2 outline-primary bg-evidence-fill transition-all duration-200 ease-(--ease-out-soft)"
            style={{
              left: `${box.x * scale}px`,
              top: `${box.y * scale}px`,
              width: `${box.width * scale}px`,
              height: `${box.height * scale}px`,
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
