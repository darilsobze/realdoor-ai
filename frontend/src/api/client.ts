import type { z } from "zod";
import { ApiError } from "./errors";
import {
  AuditResponseSchema,
  ErrorResponseSchema,
  ExtractionResultSchema,
  RulesAskResponseSchema,
  RulesFileSchema,
  SessionResponseSchema,
  UploadResponseSchema,
  type ExtractionResultDto,
  type RulesAskResponse,
  type RulesFileDto,
} from "./schemas";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

function endpoint(path: string): string {
  return `${API_BASE}${path}`;
}

async function responseBody(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

async function parse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  const body = await responseBody(response);
  if (!response.ok) {
    const parsed = ErrorResponseSchema.safeParse(body);
    throw new ApiError({
      code: parsed.success ? parsed.data.error.code : "UNKNOWN",
      status: response.status,
      message: parsed.success
        ? parsed.data.error.message
        : "Something went wrong talking to the server.",
      fieldRef: parsed.success ? parsed.data.error.fieldRef : undefined,
    });
  }
  return schema.parse(body);
}

export async function createSession(signal?: AbortSignal): Promise<string> {
  const body = await parse(
    await fetch(endpoint("/session"), { method: "POST", signal }),
    SessionResponseSchema,
  );
  return body.sessionId;
}

export async function uploadDocument(
  sessionId: string,
  file: File,
  signal?: AbortSignal,
): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const body = await parse(
    await fetch(endpoint(`/session/${encodeURIComponent(sessionId)}/documents`), {
      method: "POST",
      body: form,
      signal,
    }),
    UploadResponseSchema,
  );
  return body.documentId;
}

export async function extractDocument(
  sessionId: string,
  documentId: string,
  signal?: AbortSignal,
): Promise<ExtractionResultDto> {
  return parse(
    await fetch(
      endpoint(
        `/session/${encodeURIComponent(sessionId)}/documents/${encodeURIComponent(documentId)}/extract`,
      ),
      { method: "POST", signal },
    ),
    ExtractionResultSchema,
  );
}

export async function getRules(signal?: AbortSignal): Promise<RulesFileDto> {
  return parse(await fetch(endpoint("/rules"), { signal }), RulesFileSchema);
}

export async function askRules(
  question: string,
  confirmedContext: { program_id?: string; metro_id?: string; rule_year?: number },
  signal?: AbortSignal,
): Promise<RulesAskResponse> {
  return parse(
    await fetch(endpoint("/rules/ask"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, confirmedContext }),
      signal,
    }),
    RulesAskResponseSchema,
  );
}

export async function getAudit(sessionId: string, signal?: AbortSignal): Promise<unknown[]> {
  const body = await parse(
    await fetch(endpoint(`/session/${encodeURIComponent(sessionId)}/audit`), { signal }),
    AuditResponseSchema,
  );
  return body.events;
}

export async function deleteSession(sessionId: string, signal?: AbortSignal): Promise<void> {
  const response = await fetch(endpoint(`/session/${encodeURIComponent(sessionId)}`), {
    method: "DELETE",
    signal,
  });
  if (response.status === 204) return;
  const body = await responseBody(response);
  const parsed = ErrorResponseSchema.safeParse(body);
  if (response.status === 404 && parsed.success && parsed.data.error.code === "SESSION_NOT_FOUND") {
    return;
  }
  throw new ApiError({
    code: parsed.success ? parsed.data.error.code : "UNKNOWN",
    status: response.status,
    message: parsed.success
      ? parsed.data.error.message
      : "The session could not be deleted from the server.",
    fieldRef: parsed.success ? parsed.data.error.fieldRef : undefined,
  });
}

export function pageUrl(sessionId: string, documentId: string, page: number): string {
  return endpoint(
    `/session/${encodeURIComponent(sessionId)}/documents/${encodeURIComponent(documentId)}/page/${page}`,
  );
}
