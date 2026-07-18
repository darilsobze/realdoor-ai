// Append-only per-session audit log (audit.jsonl inside the session dir, so
// real deletion removes it with everything else). NEVER log raw document
// contents, extracted values, or original filenames — ids, counts and
// timestamps only (CLAUDE.md logging rules).
import { appendFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Session } from "./sessions.ts";

export type AuditEvent =
  | { type: "session_created" }
  | { type: "consent_recorded" }
  | { type: "document_uploaded"; document_id: string; bytes: number }
  | { type: "extraction_run"; document_id: string; field_count: number; abstained_count: number }
  | { type: "extraction_abstained"; document_id: string }
  | { type: "correction_confirmed"; field_name: string; profile_version: number }
  | { type: "rule_corpus_used"; corpus_version: string }
  | { type: "packet_exported"; document_count: number }
  | { type: "session_delete_requested" };

export async function appendAudit(session: Session, event: AuditEvent): Promise<void> {
  const entry = { at: new Date().toISOString(), ...event };
  await appendFile(join(session.dir, "audit.jsonl"), JSON.stringify(entry) + "\n");
}

export async function readAudit(session: Session): Promise<unknown[]> {
  try {
    const raw = await readFile(join(session.dir, "audit.jsonl"), "utf8");
    return raw
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}
