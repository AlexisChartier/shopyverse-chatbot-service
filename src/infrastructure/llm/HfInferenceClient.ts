import { InferenceClient } from "@huggingface/inference";
import { config } from "../config/env.js"; 

const HF_TOKEN = config.HF_ACCESS_TOKEN;
const MODEL_ID = "Qwen/Qwen2.5-7B-Instruct";

const hf = new InferenceClient(HF_TOKEN);

class HfLlmClient {
  async generate(prompt: string): Promise<string> {
    // prompt = résultat de ton RAG_PROMPT_TEMPLATE(context, question)
    const completion = await hf.chatCompletion({
      model: MODEL_ID,
      messages: [
        {
          role: "system",
          content:
            "Tu es un assistant client pour une boutique en ligne nommée ShopyVerse. " +
            "Tu réponds en français, de manière concise et utile. " +
            "Tu dois t'appuyer en priorité sur le contexte fourni dans la demande de l'utilisateur. " +
            "Si l'information n'est pas dans le contexte, indique-le honnêtement.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 512,
      temperature: 0.2,
    });

    const choice = completion.choices?.[0];
    const msgContent = choice?.message?.content;

    let contentText = "";

    if (typeof msgContent === "string") {
      contentText = msgContent;
    } else if (Array.isArray(msgContent)) {
      // Pour TypeScript : on cast en tableau générique
      contentText = (msgContent as Array<{ text?: string }>)
        .map((c) => c.text ?? "")
        .join("");
    }

    return contentText.trim();
  }
}

export const llmClient = new HfLlmClient();