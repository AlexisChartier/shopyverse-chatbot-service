// src/infrastructure/llm/LlmClient.ts
import { InferenceClient } from "@huggingface/inference";
import { config } from "../config/env.js"; 

const HF_TOKEN = config.HF_ACCESS_TOKEN;
const MODEL_ID =  "Qwen/Qwen2.5-7B-Instruct";

// Client Hugging Face partagé
const hf = new InferenceClient(HF_TOKEN);

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

class LlmClient {
  async generate(messages: ChatMessage[]): Promise<string> {
    const completion = await hf.chatCompletion({
      model: MODEL_ID,
      messages,
      max_tokens: 512,
      temperature: 0.2,
    });

    // On récupère le contenu texte de la première réponse
    const choice = completion.choices?.[0];

    let contentText = "";

    const msgContent = choice?.message?.content;

    if (typeof msgContent === "string") {
    contentText = msgContent;
    } else if (Array.isArray(msgContent)) {
      contentText = (msgContent as any[])
      .map((c) => (typeof c?.text === "string" ? c.text : ""))
      .join("");
    } else {
      contentText = "";
    }

return contentText.trim();
  }
}

export const llmClient = new LlmClient();