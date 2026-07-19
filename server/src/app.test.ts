// Session-service integration tests: lifecycle, validation, cross-session
// isolation, REAL deletion, page render. Extraction (needs ANTHROPIC_API_KEY)
// is exercised by scripts/prove-extraction.ts, not here.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "./app.ts";
import { SESSIONS_ROOT } from "./sessions.ts";
import { shutdownOcr } from "./ocr.ts";
import type { RulesQuestionProvider } from "./rules/service.ts";

const app = createApp();
const fixture = readFileSync(
  join(process.cwd(), "..", "data", "synthetic-docs", "stub_clean.pdf"),
);

async function newSession(): Promise<string> {
  const res = await request(app).post("/session").expect(201);
  return res.body.sessionId as string;
}

async function uploadFixture(sessionId: string): Promise<string> {
  const res = await request(app)
    .post(`/session/${sessionId}/documents`)
    .attach("file", fixture, "stub_clean.pdf")
    .expect(201);
  return res.body.documentId as string;
}

afterAll(async () => {
  await shutdownOcr();
});

describe("session lifecycle", () => {
  it("creates a session with an isolated directory", async () => {
    const id = await newSession();
    expect(existsSync(join(SESSIONS_ROOT, id))).toBe(true);
    await request(app).delete(`/session/${id}`).expect(204);
  });

  it("DELETE removes files + derived data for real; later calls 404", async () => {
    const id = await newSession();
    await uploadFixture(id);
    const dir = join(SESSIONS_ROOT, id);
    expect(existsSync(dir)).toBe(true);

    await request(app).delete(`/session/${id}`).expect(204);
    expect(existsSync(dir)).toBe(false);

    const again = await request(app).delete(`/session/${id}`).expect(404);
    expect(again.body.error.code).toBe("SESSION_NOT_FOUND");
    await request(app).get(`/session/${id}/audit`).expect(404);
  });

  it("unknown and malformed session ids are 404 with the error contract", async () => {
    const res = await request(app)
      .post("/session/../../etc/documents")
      .expect(404);
    const res2 = await request(app)
      .get("/session/00000000-0000-0000-0000-000000000000/audit")
      .expect(404);
    expect(res2.body.error).toMatchObject({ code: "SESSION_NOT_FOUND" });
    expect(res.status).toBe(404);
  });
});

describe("document upload", () => {
  it("accepts a PDF and records an audit event without the filename", async () => {
    const id = await newSession();
    const docId = await uploadFixture(id);
    expect(docId).toMatch(/^[0-9a-f-]{36}$/);

    const audit = await request(app).get(`/session/${id}/audit`).expect(200);
    const uploadEvent = audit.body.events.find((e: { type: string }) => e.type === "document_uploaded");
    expect(uploadEvent).toMatchObject({ document_id: docId });
    expect(JSON.stringify(audit.body)).not.toContain("stub_clean");
    await request(app).delete(`/session/${id}`).expect(204);
  });

  it("rejects non-PDF uploads with VALIDATION_FAILED", async () => {
    const id = await newSession();
    const res = await request(app)
      .post(`/session/${id}/documents`)
      .attach("file", Buffer.from("hello, not a pdf"), "evil.pdf")
      .expect(422);
    expect(res.body.error).toMatchObject({ code: "VALIDATION_FAILED", fieldRef: "file" });
    await request(app).delete(`/session/${id}`).expect(204);
  });

  it("rejects a document id from another session (cross-session isolation)", async () => {
    const a = await newSession();
    const b = await newSession();
    const docInA = await uploadFixture(a);

    const res = await request(app)
      .get(`/session/${b}/documents/${docInA}/page/1`)
      .expect(404);
    expect(res.body.error.code).toBe("DOCUMENT_NOT_FOUND");
    await request(app).delete(`/session/${a}`).expect(204);
    await request(app).delete(`/session/${b}`).expect(204);
  });
});

describe("page render", () => {
  it("serves a PNG of the requested page (and caches it in derived/)", async () => {
    const id = await newSession();
    const docId = await uploadFixture(id);

    const res = await request(app)
      .get(`/session/${id}/documents/${docId}/page/1`)
      .expect(200)
      .expect("Content-Type", /image\/png/);
    expect(res.body.subarray(1, 4).toString("latin1")).toBe("PNG");
    expect(existsSync(join(SESSIONS_ROOT, id, "derived", `${docId}.page-1.png`))).toBe(true);

    await request(app).get(`/session/${id}/documents/${docId}/page/99`).expect(404);
    await request(app).get(`/session/${id}/documents/${docId}/page/nope`).expect(422);
    await request(app).delete(`/session/${id}`).expect(204);
  });
});

describe("extraction endpoint configuration", () => {
  it.skipIf(!!process.env.OPENAI_API_KEY)(
    "returns 503 EXTRACTION_UNAVAILABLE when no API key is configured",
    async () => {
      const id = await newSession();
      const docId = await uploadFixture(id);
      const res = await request(app)
        .post(`/session/${id}/documents/${docId}/extract`)
        .expect(503);
      expect(res.body.error.code).toBe("EXTRACTION_UNAVAILABLE");
      await request(app).delete(`/session/${id}`).expect(204);
    },
  );
});

describe("rules endpoints", () => {
  it("GET /rules returns the frozen corpus and threshold tables", async () => {
    const res = await request(app).get("/rules").expect(200);

    expect(res.body).toMatchObject({
      corpus_version: "2026-frozen-2026-07-18",
      frozen_at: "2026-07-18",
      placeholder: false,
    });
    expect(res.body.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule_id: "HUD-MTSP-002" }),
      ]),
    );
  });

  it.each([
    "Am I eligible for this apartment?",
    "What are my chances?",
    "Will I be accepted?",
    "Do I meet the requirements?",
    "Should I apply based on my income?",
    "Does my income pass the limit?",
    "Can my household meet the requirements?",
    "Is my income within the limit?",
    "Am I under the income cap?",
    "Is this household under the income limit?",
  ])("POST /rules/ask deterministically refuses decision request: %s", async (question) => {
    const res = await request(app)
      .post("/rules/ask")
      .send({ question })
      .expect(200);

    expect(res.body).toMatchObject({
      abstained: true,
      refusal: true,
      citation: null,
    });
    expect(res.body.answer).toContain("A qualified human makes the final decision");
  });

  it("POST /rules/ask returns a corpus-grounded answer with trusted citation", async () => {
    const rulesProvider: RulesQuestionProvider = {
      name: "test",
      isConfigured: () => true,
      requestAnswer: async () => ({
        answer: "The FY 2026 limits take effect May 1, 2026.",
        rule_id: "HUD-MTSP-001",
        abstained: false,
        requested_program_id: "LIHTC",
        requested_metro_id: "boston_cambridge_quincy_ma_nh_hmfa",
        requested_rule_year: 2026,
      }),
    };
    const rulesApp = createApp(rulesProvider);

    const res = await request(rulesApp)
      .post("/rules/ask")
      .send({ question: "When do the FY 2026 limits take effect?" })
      .expect(200);

    expect(res.body).toMatchObject({
      abstained: false,
      refusal: false,
      citation: { rule_id: "HUD-MTSP-001", effective_date: "2026-05-01" },
    });
  });

  it("POST /rules/ask abstains rather than citing a rule for the wrong year or metro", async () => {
    const rulesProvider: RulesQuestionProvider = {
      name: "test",
      isConfigured: () => true,
      requestAnswer: async () => ({
        answer: "A Boston FY 2026 threshold.",
        rule_id: "HUD-MTSP-002",
        abstained: false,
        requested_program_id: "LIHTC",
        requested_metro_id: "chicago_joliet_naperville_il_hmfa",
        requested_rule_year: 2025,
      }),
    };
    const rulesApp = createApp(rulesProvider);

    const res = await request(rulesApp)
      .post("/rules/ask")
      .send({
        question: "What is the 2025 Chicago threshold?",
        confirmedContext: {
          program_id: "LIHTC",
          metro_id: "chicago_joliet_naperville_il_hmfa",
          rule_year: 2025,
        },
      })
      .expect(200);

    expect(res.body).toMatchObject({ abstained: true, refusal: false, citation: null });
  });
});
