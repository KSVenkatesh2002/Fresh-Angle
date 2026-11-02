import { describe, it, expect, vi } from "vitest";
import { AiFallbackChain } from "@/services/ai/fallback";
import {
  AiProvider,
  AiGenerationResult,
  AiProviderError,
} from "@/services/ai/provider";
import { z } from "zod";

class MockFailingProvider implements AiProvider {
  constructor(
    public readonly id: string,
    public readonly name: string,
    private shouldFail: boolean,
    private responseText: string = "",
  ) {}

  async generateText(): Promise<AiGenerationResult> {
    if (this.shouldFail) {
      throw new AiProviderError(this.id, "Simulated API rate limit");
    }
    return {
      text: this.responseText,
      model: `${this.id}-model`,
      provider: this.name,
    };
  }
}

describe("AiFallbackChain", () => {
  it("falls back to secondary provider if primary fails", async () => {
    const provider1 = new MockFailingProvider("p1", "Primary Provider", true);
    const provider2 = new MockFailingProvider(
      "p2",
      "Secondary Provider",
      false,
      "Success output",
    );

    const chain = new AiFallbackChain([provider1, provider2]);
    const result = await chain.generateText({ prompt: "test" });

    expect(result.provider).toBe("Secondary Provider");
    expect(result.text).toBe("Success output");
  });

  it("throws descriptive error if all providers in chain fail", async () => {
    const provider1 = new MockFailingProvider("p1", "P1", true);
    const provider2 = new MockFailingProvider("p2", "P2", true);

    const chain = new AiFallbackChain([provider1, provider2]);
    await expect(chain.generateText({ prompt: "test" })).rejects.toThrow(
      /All AI providers in fallback chain failed/,
    );
  });

  it("automatically repairs malformed JSON on retry", async () => {
    const schema = z.object({
      answer: z.string(),
      count: z.number(),
    });

    let calls = 0;
    const repairMock: AiProvider = {
      id: "repair-mock",
      name: "Repair Mock Provider",
      generateText: async () => {
        calls++;
        if (calls === 1) {
          // First attempt: invalid syntax
          return {
            text: 'Here is your json: { answer: "unquoted", count: "not-a-number" }',
            model: "mock",
            provider: "Repair Mock Provider",
          };
        }
        // Second attempt: valid clean JSON
        return {
          text: '{"answer": "valid", "count": 42}',
          model: "mock",
          provider: "Repair Mock Provider",
        };
      },
    };

    const chain = new AiFallbackChain([repairMock]);
    const { data } = await chain.generateValidatedJson(
      { prompt: "give json" },
      schema,
    );

    expect(calls).toBe(2);
    expect(data.answer).toBe("valid");
    expect(data.count).toBe(42);
  });
});
