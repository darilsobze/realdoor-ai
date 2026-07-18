// Per-session temp directories. No database: a session is a directory under
// server/sessions/ plus an in-memory index entry. Deletion is REAL — the
// directory (documents + all derived data, including the audit log) is
// removed recursively and the id becomes unknown (404) immediately.
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const SESSIONS_ROOT = join(here, "..", "sessions");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface DocumentMeta {
  documentId: string;
  /** Sanitized display name (basename only) — never used as a filesystem path. */
  displayName: string;
  bytes: number;
  uploadedAt: string;
}

export interface Session {
  sessionId: string;
  createdAt: string;
  dir: string;
  documents: Map<string, DocumentMeta>;
}

const sessions = new Map<string, Session>();

export function createSession(): Session {
  const sessionId = randomUUID();
  const dir = join(SESSIONS_ROOT, sessionId);
  mkdirSync(join(dir, "docs"), { recursive: true });
  mkdirSync(join(dir, "derived"), { recursive: true });
  const session: Session = {
    sessionId,
    createdAt: new Date().toISOString(),
    dir,
    documents: new Map(),
  };
  sessions.set(sessionId, session);
  return session;
}

/** Returns null for unknown OR malformed ids (malformed ids never touch the fs). */
export function getSession(sessionId: string): Session | null {
  if (!UUID_RE.test(sessionId)) return null;
  return sessions.get(sessionId) ?? null;
}

export async function addDocument(
  session: Session,
  displayName: string,
  pdf: Buffer,
): Promise<DocumentMeta> {
  const documentId = randomUUID();
  await writeFile(join(session.dir, "docs", `${documentId}.pdf`), pdf);
  const meta: DocumentMeta = {
    documentId,
    displayName,
    bytes: pdf.length,
    uploadedAt: new Date().toISOString(),
  };
  session.documents.set(documentId, meta);
  return meta;
}

/** Document ids are only ever resolved within the OWNING session's directory —
 *  a valid docId presented against another session is simply not found. */
export function getDocumentPath(session: Session, documentId: string): string | null {
  if (!UUID_RE.test(documentId) || !session.documents.has(documentId)) return null;
  return join(session.dir, "docs", `${documentId}.pdf`);
}

export function derivedPath(session: Session, name: string): string {
  return join(session.dir, "derived", name);
}

export async function readDerived(session: Session, name: string): Promise<Buffer | null> {
  try {
    return await readFile(derivedPath(session, name));
  } catch {
    return null;
  }
}

export async function writeDerived(session: Session, name: string, data: Buffer | string) {
  await writeFile(derivedPath(session, name), data);
}

/** Real deletion: files + derived data + audit log, then the index entry. */
export function deleteSession(session: Session): void {
  sessions.delete(session.sessionId);
  if (existsSync(session.dir)) {
    rmSync(session.dir, { recursive: true, force: true });
  }
}
