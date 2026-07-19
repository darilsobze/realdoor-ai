import { describe, expect, it, vi } from "vitest";
import { RulesLlmOutputSchema } from "./schema.ts";
import { askRulesQuestion, type RulesQuestionProvider } from "./service.ts";

function fakeProvider(...outputs: unknown[]): RulesQuestionProvider {
  return {
    name: "test",
    isConfigured: () => true,
    requestAnswer: vi.fn(async () => outputs.shift()),
  };
}

describe("RulesLlmOutputSchema", () => {
  it("rejects unknown properties", () => {
    const parsed = RulesLlmOutputSchema.safeParse({
      answer: "May 1, 2026.",
      rule_id: "HUD-MTSP-001",
      abstained: false,
      requested_program_id: "LIHTC",
      requested_metro_id: "boston_cambridge_quincy_ma_nh_hmfa",
      requested_rule_year: 2026,
      extra: "not allowed",
    });

    expect(parsed.success).toBe(false);
  });
});

describe("askRulesQuestion", () => {
  it("defaults missing context to the app's single supported scope", async () => {
    const provider = fakeProvider({
      answer: "The 3-person 60% threshold is $92,580.",
      rule_id: "HUD-MTSP-002",
      abstained: false,
      requested_program_id: null,
      requested_metro_id: null,
      requested_rule_year: null,
    });

    const result = await askRulesQuestion(
      "What is the income limit for a 3-person household?",
      undefined,
      provider,
    );

    expect(result).toMatchObject({
      abstained: false,
      citation: {
        program_id: "LIHTC",
        metro_id: "boston_cambridge_quincy_ma_nh_hmfa",
        rule_year: 2026,
      },
    });
  });

  it.each([
    "What is the Section 8 income limit?",
    "For Chicago, what is the income limit?",
    "Compare LIHTC and Section 8 limits.",
    "Compare Boston and Chicago limits.",
    "Boston vs Chicago limits.",
    "Compare Boston limits for 2026 and 2025.",
  ])("does not let defaults override explicit unsupported question scope: %s", async (question) => {
    const provider = fakeProvider({
      answer: "A Boston LIHTC threshold.",
      rule_id: "HUD-MTSP-002",
      abstained: false,
      requested_program_id: null,
      requested_metro_id: null,
      requested_rule_year: null,
    });

    const result = await askRulesQuestion(question, undefined, provider);

    expect(result).toMatchObject({ abstained: true, refusal: false, citation: null });
  });


  it("keeps an explicitly matching supported context", async () => {
    const provider = fakeProvider({
      answer: "The 3-person 60% threshold is $92,580.",
      rule_id: "HUD-MTSP-002",
      abstained: false,
      requested_program_id: null,
      requested_metro_id: null,
      requested_rule_year: null,
    });

    const result = await askRulesQuestion(
      "What is the income limit for a 3-person household?",
      {
        program_id: "LIHTC",
        metro_id: "boston_cambridge_quincy_ma_nh_hmfa",
        rule_year: 2026,
      },
      provider,
    );

    expect(result.abstained).toBe(false);
  });

  it("returns an answer with a citation rebuilt from the trusted corpus", async () => {
    const provider = fakeProvider({
      answer: "The FY 2026 limits take effect May 1, 2026.",
      rule_id: "HUD-MTSP-001",
      abstained: false,
      requested_program_id: "LIHTC",
      requested_metro_id: "boston_cambridge_quincy_ma_nh_hmfa",
      requested_rule_year: 2026,
    });

    const result = await askRulesQuestion("When do the FY 2026 limits take effect?", undefined, provider);

    expect(result).toMatchObject({
      abstained: false,
      refusal: false,
      citation: {
        rule_id: "HUD-MTSP-001",
        program_id: "LIHTC",
        rule_year: 2026,
        effective_date: "2026-05-01",
      },
    });
  });

  it("uses the corpus freeze date when the selected rule has no effective date", async () => {
    const provider = fakeProvider({
      answer: "The property database is not a vacancy feed.",
      rule_id: "HUD-DATA-001",
      abstained: false,
      requested_program_id: "LIHTC",
      requested_metro_id: "boston_cambridge_quincy_ma_nh_hmfa",
      requested_rule_year: 2026,
    });

    const result = await askRulesQuestion("Does the property database prove vacancy?", undefined, provider);

    expect(result.citation?.effective_date).toBe("2026-07-18");
  });

  it("retries once after invalid structured output and accepts a valid retry", async () => {
    const provider = fakeProvider(
      { answer: "unsupported shape" },
      {
        answer: "The FY 2026 limits take effect May 1, 2026.",
        rule_id: "HUD-MTSP-001",
        abstained: false,
        requested_program_id: "LIHTC",
        requested_metro_id: "boston_cambridge_quincy_ma_nh_hmfa",
        requested_rule_year: 2026,
      },
    );

    const result = await askRulesQuestion("When do the limits take effect?", undefined, provider);

    expect(provider.requestAnswer).toHaveBeenCalledTimes(2);
    expect(result.abstained).toBe(false);
  });

  it("abstains after two invalid structured outputs", async () => {
    const provider = fakeProvider({ answer: "bad" }, { answer: "still bad" });

    const result = await askRulesQuestion("When do the limits take effect?", undefined, provider);

    expect(provider.requestAnswer).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ abstained: true, refusal: false, citation: null });
  });

  it("abstains when the selected rule is for the wrong requested year or metro", async () => {
    const provider = fakeProvider({
      answer: "A 2026 Boston threshold.",
      rule_id: "HUD-MTSP-002",
      abstained: false,
      requested_program_id: "LIHTC",
      requested_metro_id: "chicago_joliet_naperville_il_hmfa",
      requested_rule_year: 2025,
    });

    const result = await askRulesQuestion("What is the 2025 Chicago threshold?", undefined, provider);

    expect(result).toMatchObject({ abstained: true, refusal: false, citation: null });
  });

  it("abstains when explicit question scope conflicts even if model scope is omitted", async () => {
    const provider = fakeProvider({
      answer: "A Boston FY 2026 threshold.",
      rule_id: "HUD-MTSP-002",
      abstained: false,
      requested_program_id: null,
      requested_metro_id: null,
      requested_rule_year: null,
    });

    const result = await askRulesQuestion(
      "What is the 2025 Chicago threshold?",
      {
        program_id: "LIHTC",
        metro_id: "boston_cambridge_quincy_ma_nh_hmfa",
        rule_year: 2026,
      },
      provider,
    );

    expect(result).toMatchObject({ abstained: true, refusal: false, citation: null });
  });

  it("abstains on an explicit wrong metro even without a year or model scope", async () => {
    const provider = fakeProvider({
      answer: "A Boston threshold.",
      rule_id: "HUD-MTSP-002",
      abstained: false,
      requested_program_id: null,
      requested_metro_id: null,
      requested_rule_year: null,
    });

    const result = await askRulesQuestion(
      "What is the Chicago threshold?",
      { metro_id: "boston_cambridge_quincy_ma_nh_hmfa" },
      provider,
    );

    expect(result).toMatchObject({ abstained: true, refusal: false, citation: null });
  });

  it.each([
    "what is the chicago threshold?",
    "What is the threshold in Chicago?",
  ])("abstains for metro phrasing that conflicts with the selected rule: %s", async (question) => {
    const provider = fakeProvider({
      answer: "A Boston threshold.",
      rule_id: "HUD-MTSP-002",
      abstained: false,
      requested_program_id: null,
      requested_metro_id: null,
      requested_rule_year: null,
    });

    const result = await askRulesQuestion(question, undefined, provider);

    expect(result).toMatchObject({ abstained: true, refusal: false, citation: null });
  });

  it("abstains on a metro-sensitive question without deterministic supported metro context", async () => {
    const provider = fakeProvider({
      answer: "A Boston household amount.",
      rule_id: "HUD-MTSP-002",
      abstained: false,
      requested_program_id: "LIHTC",
      requested_metro_id: "boston_cambridge_quincy_ma_nh_hmfa",
      requested_rule_year: 2026,
    });

    const result = await askRulesQuestion(
      "How much can a Chicago household earn?",
      undefined,
      provider,
    );

    expect(result).toMatchObject({ abstained: true, refusal: false, citation: null });
  });
});
