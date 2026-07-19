import { describe, expect, it, vi } from "vitest";
import { runUploadFlow } from "./upload-flow";
import type { ExtractionResultDto } from "./schemas";

const extraction: ExtractionResultDto = {
  document_id: "doc-1",
  extraction_version: "extract-v3",
  fields: [],
};

describe("upload flow", () => {
  it("creates the first session before upload and extraction", async () => {
    const deps = {
      createSession: vi.fn().mockResolvedValue("session-1"),
      uploadDocument: vi.fn().mockResolvedValue("doc-1"),
      extractDocument: vi.fn().mockResolvedValue(extraction),
    };

    const result = await runUploadFlow(null, new File(["pdf"], "stub.pdf"), deps);

    expect(deps.createSession).toHaveBeenCalledOnce();
    expect(deps.uploadDocument).toHaveBeenCalledWith("session-1", expect.any(File));
    expect(deps.extractDocument).toHaveBeenCalledWith("session-1", "doc-1");
    expect(result).toEqual({ sessionId: "session-1", extraction });
  });

  it("reuses an existing session", async () => {
    const deps = {
      createSession: vi.fn(),
      uploadDocument: vi.fn().mockResolvedValue("doc-2"),
      extractDocument: vi.fn().mockResolvedValue({ ...extraction, document_id: "doc-2" }),
    };

    await runUploadFlow("session-1", new File(["pdf"], "second.pdf"), deps);

    expect(deps.createSession).not.toHaveBeenCalled();
    expect(deps.uploadDocument).toHaveBeenCalledWith("session-1", expect.any(File));
  });
});
