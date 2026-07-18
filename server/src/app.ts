// Thin session service (docs/api.md). Error shape is always
// { error: { code, message, fieldRef? } } and messages NEVER contain prompt
// contents, document text, or extracted values.
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { readFile } from "node:fs/promises";
import { ExtractionAbstained } from "./extraction/claude.ts";
import { extractDocument } from "./extraction/pipeline.ts";
import { renderPdfPages } from "./ocr.ts";
import { appendAudit, readAudit } from "./audit.ts";
import {
  addDocument,
  createSession,
  deleteSession,
  getDocumentPath,
  getSession,
  readDerived,
  writeDerived,
  type Session,
} from "./sessions.ts";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldRef?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

function requireSession(req: Request): Session {
  const session = getSession(String(req.params.id));
  if (!session) {
    throw new ApiError(404, "SESSION_NOT_FOUND", "This session does not exist (or was deleted).");
  }
  return session;
}

function requireDocument(session: Session, docId: string): string {
  const path = getDocumentPath(session, docId);
  if (!path) {
    throw new ApiError(404, "DOCUMENT_NOT_FOUND", "This document does not exist in this session.");
  }
  return path;
}

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/session", async (_req, res) => {
    const session = createSession();
    await appendAudit(session, { type: "session_created" });
    res.status(201).json({ sessionId: session.sessionId });
  });

  app.delete("/session/:id", async (req, res) => {
    const session = requireSession(req);
    await appendAudit(session, { type: "session_delete_requested" });
    deleteSession(session); // removes files + derived data + audit log; later calls 404
    res.status(204).end();
  });

  app.post("/session/:id/documents", upload.single("file"), async (req, res) => {
    const session = requireSession(req);
    const file = req.file;
    if (!file) {
      throw new ApiError(422, "VALIDATION_FAILED", "Upload one PDF in the 'file' field.", "file");
    }
    // Magic-byte check — the original filename is untrusted and never used as a path.
    if (!file.buffer.subarray(0, 5).toString("latin1").startsWith("%PDF-")) {
      throw new ApiError(422, "VALIDATION_FAILED", "Only PDF files are accepted.", "file");
    }
    const displayName = (file.originalname ?? "document.pdf").split(/[\\/]/).pop() ?? "document.pdf";
    const meta = await addDocument(session, displayName.slice(0, 120), file.buffer);
    await appendAudit(session, {
      type: "document_uploaded",
      document_id: meta.documentId,
      bytes: meta.bytes,
    });
    res.status(201).json({ documentId: meta.documentId });
  });

  app.post("/session/:id/documents/:docId/extract", async (req, res) => {
    const session = requireSession(req);
    const pdfPath = requireDocument(session, req.params.docId);
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new ApiError(
        503,
        "EXTRACTION_UNAVAILABLE",
        "Extraction is not configured on this server.",
      );
    }
    const pdf = await readFile(pdfPath);
    try {
      const result = await extractDocument(req.params.docId, new Uint8Array(pdf));
      await writeDerived(session, `${req.params.docId}.extraction.json`, JSON.stringify(result));
      await appendAudit(session, {
        type: "extraction_run",
        document_id: req.params.docId,
        field_count: result.fields.length,
        abstained_count: result.fields.filter((f) => f.state === "unresolved").length,
      });
      res.json(result);
    } catch (err) {
      if (err instanceof ExtractionAbstained) {
        // Abstention is correct behavior, not an error (api.md): 200 with no fields.
        await appendAudit(session, { type: "extraction_abstained", document_id: req.params.docId });
        res.json({
          document_id: req.params.docId,
          extraction_version: "extract-v1",
          fields: [],
        });
        return;
      }
      throw err;
    }
  });

  app.get("/session/:id/documents/:docId/page/:n", async (req, res) => {
    const session = requireSession(req);
    const pdfPath = requireDocument(session, req.params.docId);
    const n = Number(req.params.n);
    if (!Number.isInteger(n) || n < 1 || n > 500) {
      throw new ApiError(422, "VALIDATION_FAILED", "Page number must be a small positive integer.", "page");
    }
    const cacheName = `${req.params.docId}.page-${n}.png`;
    let png = await readDerived(session, cacheName);
    if (!png) {
      const pdf = await readFile(pdfPath);
      // Same render pipeline (and scale) that feeds OCR, so evidence boxes align.
      const pages = await renderPdfPages(new Uint8Array(pdf));
      const page = pages.find((p) => p.page === n);
      if (!page) {
        throw new ApiError(404, "PAGE_NOT_FOUND", "This document has no such page.");
      }
      png = page.png;
      await writeDerived(session, cacheName, png);
    }
    res.type("png").send(png);
  });

  app.get("/session/:id/audit", async (req, res) => {
    const session = requireSession(req);
    res.json({ events: await readAudit(session) });
  });

  app.use((_req, _res, next) => {
    next(new ApiError(404, "NOT_FOUND", "Unknown route."));
  });

  // Central error shape. Unexpected errors are logged server-side by name only
  // (no message bodies — they can embed prompt or document text).
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ApiError) {
      res.status(err.status).json({
        error: { code: err.code, message: err.message, ...(err.fieldRef ? { fieldRef: err.fieldRef } : {}) },
      });
      return;
    }
    if (err instanceof multer.MulterError) {
      res.status(422).json({
        error: { code: "VALIDATION_FAILED", message: "Upload rejected (too large or malformed).", fieldRef: "file" },
      });
      return;
    }
    console.error("[server] unexpected error:", err instanceof Error ? err.name : typeof err);
    res.status(500).json({
      error: { code: "INTERNAL", message: "Something went wrong on the server." },
    });
  });

  return app;
}
