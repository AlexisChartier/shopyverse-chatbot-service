import { HfInference } from '@huggingface/inference';
import { config } from '../config/env.js';
import type { LlmClient, LlmGenerationOptions } from './LlmClient.js';

export class HfInferenceClient implements LlmClient {
  private hf: HfInference;
  private model = 'mistralai/Mistral-7B-Instruct-v0.3'; // Modèle performant

  constructor() {
    this.hf = new HfInference(config.HF_ACCESS_TOKEN);
  }

  async generate(prompt: string, options?: LlmGenerationOptions): Promise<string> {
    try {
      const result = await this.hf.textGeneration({
        model: this.model,
        inputs: prompt,
        parameters: {
          max_new_tokens: options?.maxTokens || 500,
          temperature: options?.temperature || 0.7,
          stop: options?.stopSequences,
          return_full_text: false, // On veut juste la réponse
        },
      });
      return result.generated_text;
    } catch (error) {
      console.error('Erreur Hugging Face:', error);
      throw new Error('Echec de la génération LLM');
    }
  }
}

export const llmClient = new HfInferenceClient();