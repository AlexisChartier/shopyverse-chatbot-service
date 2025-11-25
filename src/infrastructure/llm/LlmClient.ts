export interface LlmGenerationOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

export interface LlmClient {
  generate(prompt: string, options?: LlmGenerationOptions): Promise<string>;
}