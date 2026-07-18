// Typed client for the session service (docs/api.md). All calls go through
// the vite dev proxy at /api → localhost:3001; no key ever reaches the browser.
import { ExtractionResultSchema, type ExtractionResult } from "@/contracts";

export class ApiError extends Error {
  readonly code: string;
  readonly fieldRef?: string;
  constructor(code: string, message: string, fieldRef?: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.fieldRef = fieldRef;
  }
}

async function parseJson(res: Response): Promise<unknown> {
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string; fieldRef?: string } })?.error;
    throw new ApiError(
      err?.code ?? "UNKNOWN",
      err?.message ?? "Something went wrong talking to the server.",
      err?.fieldRef,
    );
  }
  return body;
}

export async function createSession(): Promise<string> {
  const body = await parseJson(await fetch("/api/session", { method: "POST" }));
  return (body as { sessionId: string }).sessionId;
}

export async function uploadDocument(sessionId: string, file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const body = await parseJson(
    await fetch(`/api/session/${sessionId}/documents`, { method: "POST", body: form }),
  );
  return (body as { documentId: string }).documentId;
}

export async function extractDocument(
  sessionId: string,
  documentId: string,
): Promise<ExtractionResult> {
  const body = await parseJson(
    await fetch(`/api/session/${sessionId}/documents/${documentId}/extract`, {
      method: "POST",
    }),
  );
  return ExtractionResultSchema.parse(body);
}

export function pageUrl(sessionId: string, documentId: string, page: number): string {
  return `/api/session/${sessionId}/documents/${documentId}/page/${page}`;
}
