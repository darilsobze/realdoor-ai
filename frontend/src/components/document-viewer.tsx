import { useEffect, useMemo, useState } from "react";
import type { SourceRegion, SyntheticDocument } from "@/domain/types";

/**
 * Renders a synthetic document page with an optional highlight rectangle
 * over the source region for the currently selected field.
 */
export function DocumentViewer({
  doc,
  highlight,
}: {
  doc: SyntheticDocument;
  highlight?: SourceRegion | null;
}) {
  const [pageIndex, setPageIndex] = useState(highlight?.page ?? 0);
  const [naturalSize, setNaturalSize] = useState({ width: 1, height: 1 });
  useEffect(() => {
    if (highlight) setPageIndex(highlight.page);
  }, [highlight]);
  const page = doc.pageImages[pageIndex] ?? doc.pageImages[0];
  const label = useMemo(
    () => (highlight ? `Highlighted: ${highlight.label}` : "No field selected."),
    [highlight],
  );

  return (
    <figure className="flex flex-col gap-2">
      <figcaption
        className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
        aria-live="polite"
      >
        <span>
          {doc.displayName} · Page {pageIndex + 1} of {doc.pageImages.length} · {label}
        </span>
        {doc.pageImages.length > 1 ? (
          <span className="flex gap-1">
            <button
              type="button"
              className="rounded border px-2 py-1"
              disabled={pageIndex === 0}
              onClick={() => setPageIndex((page) => page - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="rounded border px-2 py-1"
              disabled={pageIndex >= doc.pageImages.length - 1}
              onClick={() => setPageIndex((page) => page + 1)}
            >
              Next
            </button>
          </span>
        ) : null}
      </figcaption>
      <div className="relative overflow-hidden rounded-md border border-border bg-white shadow-sm">
        <img
          src={page}
          alt={`Document page ${pageIndex + 1} for ${doc.displayName}`}
          className="block h-auto w-full"
          onLoad={(event) =>
            setNaturalSize({
              width: event.currentTarget.naturalWidth || 1,
              height: event.currentTarget.naturalHeight || 1,
            })
          }
        />
        {highlight && highlight.page === pageIndex ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute rounded ring-2 ring-offset-2 ring-offset-white transition-all duration-200 ease-out animate-fade-in"
            style={{
              left: `${highlight.space === "pdf_points" ? (highlight.bbox.x * 2 * 100) / naturalSize.width : highlight.bbox.x * 100}%`,
              top: `${highlight.space === "pdf_points" ? (highlight.bbox.y * 2 * 100) / naturalSize.height : highlight.bbox.y * 100}%`,
              width: `${highlight.space === "pdf_points" ? (highlight.bbox.w * 2 * 100) / naturalSize.width : highlight.bbox.w * 100}%`,
              height: `${highlight.space === "pdf_points" ? (highlight.bbox.h * 2 * 100) / naturalSize.height : highlight.bbox.h * 100}%`,
              backgroundColor: "var(--color-highlight)",
              boxShadow: "0 0 0 2px oklch(0.55 0.14 250)",
            }}
          />
        ) : null}
      </div>
      {highlight ? (
        <p className="sr-only">
          Source region highlighted: {highlight.label}, page {highlight.page + 1}.
        </p>
      ) : null}
    </figure>
  );
}
