/**
 * Provider-agnostic AI contracts. The rest of the app talks to `AIProvider`
 * only — swapping OpenAI for another vendor means adding one implementation.
 */

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type CompleteOptions = {
  temperature?: number;
  maxTokens?: number;
  /** Ask the provider to return a strict JSON object when supported. */
  json?: boolean;
};

export interface AIProvider {
  readonly name: string;
  /** True when the provider can actually reach a model (key configured). */
  readonly isLive: boolean;
  complete(messages: ChatMessage[], options?: CompleteOptions): Promise<string>;
}

export class AIError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AIError";
  }
}
