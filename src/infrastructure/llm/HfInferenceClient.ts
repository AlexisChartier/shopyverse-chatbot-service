import { InferenceClient } from "@huggingface/inference";
import { config } from "../config/env.js"; 
import { llmDurationSeconds, llmPromptChars, llmRequestCounter, llmResponseChars } from "../observability/metrics.js";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const HF_TOKEN = config.HF_ACCESS_TOKEN;
const MODEL_ID = config.HF_MODEL ?? "Qwen/Qwen2.5-7B-Instruct";

const hf = new InferenceClient(HF_TOKEN);

class HfLlmClient {
  async generate(messages: ChatMessage[]): Promise<string> {
    const start = process.hrtime.bigint();
    const promptChars = messages.reduce((sum, msg) => sum + (msg.content?.length ?? 0), 0);
    let status: 'success' | 'error' = 'success';

    try {
      const completion = await hf.chatCompletion({
        model: MODEL_ID,
        messages,
        max_tokens: 512,
        temperature: 0.2,
      });

      const choice = completion.choices?.[0];
      const msgContent = choice?.message?.content;

      let contentText = "";

      if (typeof msgContent === "string") {
        contentText = msgContent;
      } else if (Array.isArray(msgContent)) {
        contentText = (msgContent as Array<{ text?: string }>).map(c => c.text ?? "").join("");
      }

      const trimmed = contentText.trim();

      // Metrics
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      llmRequestCounter.labels(MODEL_ID, status).inc();
      llmDurationSeconds.labels(MODEL_ID, status).observe(durationSeconds);
      llmPromptChars.labels(MODEL_ID).observe(promptChars);
      llmResponseChars.labels(MODEL_ID).observe(trimmed.length);

      return trimmed;
    } catch (err) {
      status = 'error';
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      llmRequestCounter.labels(MODEL_ID, status).inc();
      llmDurationSeconds.labels(MODEL_ID, status).observe(durationSeconds);
      llmPromptChars.labels(MODEL_ID).observe(promptChars);
      throw err;
    }
  }
}

export const llmClient = new HfLlmClient();