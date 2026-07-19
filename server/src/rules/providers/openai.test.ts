import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRulesCorpus } from "../corpus.ts";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class OpenAIMock {
    chat = { completions: { create: createMock } };
  },
}));

import { openaiRulesProvider } from "./openai.ts";

describe("openaiRulesProvider", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("uses strict structured output with no additional properties", async () => {
    createMock.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            answer: "May 1, 2026.",
            rule_id: "HUD-MTSP-001",
            abstained: false,
            requested_program_id: "LIHTC",
            requested_metro_id: "boston_cambridge_quincy_ma_nh_hmfa",
            requested_rule_year: 2026,
          }),
          refusal: null,
        },
      }],
    });

    await openaiRulesProvider.requestAnswer(
      "When do the FY 2026 limits take effect?",
      getRulesCorpus(),
    );

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        response_format: {
          type: "json_schema",
          json_schema: expect.objectContaining({
            strict: true,
            schema: expect.objectContaining({ additionalProperties: false }),
          }),
        },
      }),
    );
  });
});
