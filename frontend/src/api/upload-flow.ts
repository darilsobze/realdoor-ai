import { createSession, extractDocument, uploadDocument } from "./client";
import type { ExtractionResultDto } from "./schemas";

export type UploadFlowDependencies = {
  createSession: () => Promise<string>;
  uploadDocument: (sessionId: string, file: File) => Promise<string>;
  extractDocument: (sessionId: string, documentId: string) => Promise<ExtractionResultDto>;
};

const defaultDependencies: UploadFlowDependencies = {
  createSession,
  uploadDocument,
  extractDocument,
};

export async function runUploadFlow(
  existingSessionId: string | null,
  file: File,
  dependencies: UploadFlowDependencies = defaultDependencies,
): Promise<{ sessionId: string; extraction: ExtractionResultDto }> {
  const sessionId = existingSessionId ?? (await dependencies.createSession());
  const documentId = await dependencies.uploadDocument(sessionId, file);
  const extraction = await dependencies.extractDocument(sessionId, documentId);
  return { sessionId, extraction };
}
