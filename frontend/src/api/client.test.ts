import { afterEach, describe, expect, it, vi } from "vitest";
import { createSession, deleteSession, extractDocument, pageUrl } from "./client";
import { ApiError } from "./errors";

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(response: Response) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("RealDoor API client", () => {
  it("creates a session from a validated response", async () => {
    const fetchMock = mockFetch(
      new Response(JSON.stringify({ sessionId: "session-1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(createSession()).resolves.toBe("session-1");
    expect(fetchMock).toHaveBeenCalledWith("/api/session", {
      method: "POST",
      signal: undefined,
    });
  });

  it("rejects malformed extraction payloads at the API boundary", async () => {
    mockFetch(
      new Response(JSON.stringify({ document_id: "doc-1", fields: "not-an-array" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(extractDocument("session-1", "doc-1")).rejects.toThrow();
  });

  it("normalizes documented server errors", async () => {
    mockFetch(
      new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_FAILED",
            message: "Upload one PDF.",
            fieldRef: "file",
          },
        }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      ),
    );

    const error = await createSession().catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: "VALIDATION_FAILED",
      status: 422,
      fieldRef: "file",
      message: "Upload one PDF.",
    });
  });

  it("treats an already-deleted session as deleted", async () => {
    mockFetch(
      new Response(
        JSON.stringify({
          error: { code: "SESSION_NOT_FOUND", message: "Session is gone." },
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(deleteSession("session-1")).resolves.toBeUndefined();
  });

  it("builds encoded same-origin evidence URLs", () => {
    expect(pageUrl("session/one", "document two", 3)).toBe(
      "/api/session/session%2Fone/documents/document%20two/page/3",
    );
  });
});
