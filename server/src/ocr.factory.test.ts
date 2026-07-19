import { Path2D } from "@napi-rs/canvas";
import { describe, expect, it, vi } from "vitest";

const { getDocumentMock } = vi.hoisted(() => ({ getDocumentMock: vi.fn() }));

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({ getDocument: getDocumentMock }));

import { renderPdfPages } from "./ocr.ts";

describe("PDF.js canvas integration", () => {
  it("supplies a canvas factory compatible with the direct Path2D implementation", async () => {
    let documentOptions: Record<string, unknown> | undefined;
    getDocumentMock.mockImplementation((options: Record<string, unknown>) => {
      documentOptions = options;
      return {
        promise: Promise.resolve({
          numPages: 1,
          getPage: async () => ({
            getViewport: () => ({ width: 20, height: 20 }),
            render: ({ canvasContext }: { canvasContext: { fillRect: (...args: number[]) => void } }) => {
              canvasContext.fillRect(0, 0, 1, 1);
              return { promise: Promise.resolve() };
            },
          }),
          destroy: async () => undefined,
        }),
      };
    });

    await renderPdfPages(new Uint8Array([1]));

    expect(documentOptions?.CanvasFactory).toBeTypeOf("function");
    const CanvasFactory = documentOptions?.CanvasFactory as new () => {
      create(width: number, height: number): {
        context: { fill(path: Path2D): void };
      };
    };
    const { context } = new CanvasFactory().create(10, 10);
    const path = new Path2D();
    path.rect(0, 0, 5, 5);

    expect(() => context.fill(path)).not.toThrow();
  });
});
