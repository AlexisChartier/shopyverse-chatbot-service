import { InferenceClient } from "@huggingface/inference";
import { config } from "../config/env.js"; // adapte le chemin si besoin

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const HF_TOKEN = config.HF_ACCESS_TOKEN;
const MODEL_ID = config.HF_MODEL ?? "Qwen/Qwen2.5-7B-Instruct";

const hf = new InferenceClient(HF_TOKEN);

class HfLlmClient {
  async generate(messages: ChatMessage[]): Promise<string> {
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

    return contentText.trim();
  }
}

export const llmClient = new HfLlmClient();