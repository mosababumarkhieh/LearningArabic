import "server-only";
import type { AIProvider, ChatMessage, CompleteOptions } from "./types";
import { AIError } from "./types";

/**
 * OpenAI-compatible provider. Works against api.openai.com or any compatible
 * endpoint (Azure OpenAI, OpenRouter, local LM servers, vLLM, Ollama, etc.)
 * by changing AI_BASE_URL + AI_MODEL.
 */
class OpenAICompatibleProvider implements AIProvider {
  readonly name = "openai-compatible";

  constructor(
    private apiKey: string,
    private baseUrl: string,
    private model: string,
  ) {}

  get isLive() {
    return Boolean(this.apiKey);
  }

  async complete(
    messages: ChatMessage[],
    options: CompleteOptions = {},
  ): Promise<string> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/chat/completions`;

    // Different model families accept different parameters. We start with the
    // modern shape and, if the model rejects a parameter (HTTP 400), strip the
    // offending one and retry. This keeps a single provider working across
    // gpt-4o-*, gpt-4.1-*, gpt-5.*, and the o-series without per-model config.
    let useTemperature = options.temperature !== undefined;
    let temperature = options.temperature ?? 0.7;
    let useJson = Boolean(options.json);
    let useTokenLimit = Boolean(options.maxTokens);

    for (let attempt = 0; attempt < 4; attempt++) {
      const body: Record<string, unknown> = { model: this.model, messages };
      // `max_completion_tokens` is the current parameter; `max_tokens` is the
      // legacy alias that newer models reject.
      if (useTokenLimit) body.max_completion_tokens = options.maxTokens;
      if (useTemperature) body.temperature = temperature;
      if (useJson) body.response_format = { type: "json_object" };

      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
          // Stay under the serverless function budget so a slow model degrades
          // gracefully to the offline fallback instead of a hard timeout.
          signal: AbortSignal.timeout(55_000),
        });
      } catch (err) {
        throw new AIError("Failed to reach the AI provider.", err);
      }

      if (res.ok) {
        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          throw new AIError("AI provider returned an empty response.");
        }
        return content;
      }

      const text = await res.text().catch(() => "");
      const lower = text.toLowerCase();

      // Adapt to model-specific parameter restrictions and retry once each.
      if (res.status === 400) {
        if (useTemperature && lower.includes("temperature")) {
          // e.g. GPT-5 / o-series only allow the default temperature.
          if (temperature !== 1) {
            temperature = 1;
          } else {
            useTemperature = false;
          }
          continue;
        }
        if (useJson && lower.includes("response_format")) {
          useJson = false; // prompts already request JSON explicitly
          continue;
        }
        if (
          useTokenLimit &&
          (lower.includes("max_completion_tokens") || lower.includes("max_tokens"))
        ) {
          useTokenLimit = false;
          continue;
        }
      }

      throw new AIError(
        `AI provider returned ${res.status}: ${text.slice(0, 500)}`,
      );
    }

    throw new AIError("AI provider rejected the request after adapting parameters.");
  }
}

/**
 * Deterministic offline provider. Returns nothing useful for free-form
 * generation, so callers MUST provide their own offline fallback for tasks
 * they want to support without a key. `isLive` is false so callers can branch.
 */
class MockProvider implements AIProvider {
  readonly name = "mock";
  readonly isLive = false;

  async complete(): Promise<string> {
    throw new AIError(
      "No AI provider configured. Set AI_API_KEY to enable AI features.",
    );
  }
}

let cached: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (cached) return cached;

  const provider = (process.env.AI_PROVIDER || "openai").toLowerCase();
  const apiKey = process.env.AI_API_KEY || "";
  const baseUrl = process.env.AI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.AI_MODEL || "gpt-4o-mini";

  if (provider === "mock" || !apiKey) {
    cached = new MockProvider();
  } else {
    cached = new OpenAICompatibleProvider(apiKey, baseUrl, model);
  }
  return cached;
}

/** Convenience: parse a JSON object out of a model response, tolerant of fences. */
export function extractJson<T>(raw: string): T {
  let text = raw.trim();
  // Strip ```json ... ``` fences if present.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  // Find the outermost JSON object/array.
  const firstBrace = text.search(/[[{]/);
  const lastBrace = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new AIError("Could not parse AI JSON response.", err);
  }
}
