import { retrieverService } from "../retriever/retrieveContext.js";
import { llmClient, type ChatMessage } from "../../infrastructure/llm/HfInferenceClient.js";
import { RAG_PROMPT_TEMPLATE } from "../../prompts/rag.fr.js";

type ChatResponse = {
  answer: string;
  sources: { title: string; text: string; score?: number }[];
  sessionId: string;
};

export class ChatService {
  // sessionId -> historique de messages (user + assistant)
  private sessions = new Map<string, ChatMessage[]>();

  // en prod : à stocker ailleurs (Redis, DB…) si besoin
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  }

  async processMessage(userMessage: string, sessionId?: string): Promise<ChatResponse> {
    console.log(`Traitement de la question : "${userMessage}"`);

    // 1) sessionId : réutiliser ou créer
    let currentSessionId = sessionId || this.generateSessionId();
    const history = this.sessions.get(currentSessionId) ?? [];

    // 2) Retrieval RAG
    const sources = await retrieverService.search(userMessage, 5);

    // Tri + top-K + seuil minimal
    const sortedSources = [...sources].sort((a, b) => b.score - a.score);
    const TOP_K = 3;
    const MIN_SCORE = 0.1;

    let relevantSources = sortedSources.slice(0, TOP_K);
    const bestScore = relevantSources[0]?.score ?? 0;

    let answer: string;

    if (!relevantSources.length || bestScore < MIN_SCORE) {
      console.log("Aucun résultat suffisamment pertinent. bestScore =", bestScore);

      answer =
        "Je suis désolé, je n'ai pas trouvé d'information précise à ce sujet dans ma base de connaissances. " +
        "Pouvez-vous reformuler ou contacter le support ?";

      // on garde quand même l'échange dans l'historique
      const updatedHistory: ChatMessage[] = [
        ...history,
        { role: "user", content: userMessage },
        { role: "assistant", content: answer },
      ];
      this.sessions.set(currentSessionId, updatedHistory);

      return {
        answer,
        sources: [],
        sessionId: currentSessionId,
      };
    }

    // 3) Construction du contexte + prompt
    const contextText = relevantSources.map(s => `- ${s.content}`).join("\n");
    const ragPrompt = RAG_PROMPT_TEMPLATE(contextText, userMessage);

    // 4) Préparation des messages à envoyer au LLM
    const systemMessage: ChatMessage = {
      role: "system",
      content:
        "Tu es un assistant client pour une boutique en ligne nommée ShopyVerse. " +
        "Tu réponds en français, de manière concise et utile. " +
        "Tu t'appuies en priorité sur le contexte fourni dans les messages utilisateur. " +
        "Si l'information ne se trouve pas dans ce contexte, indique-le honnêtement.",
    };

    const messages: ChatMessage[] = [
      systemMessage,
      ...history,
      { role: "user", content: ragPrompt },
    ];

    console.log(
      `Appel du LLM avec ${relevantSources.length} sources, bestScore=${bestScore}, sessionId=${currentSessionId}`
    );

    // 5) Appel LLM
    answer = await llmClient.generate(messages);

    // 6) Mise à jour de l'historique
    const updatedHistory: ChatMessage[] = [
      ...history,
      { role: "user", content: userMessage }, // on stocke la question "naturelle"
      { role: "assistant", content: answer },
    ];
    this.sessions.set(currentSessionId, updatedHistory);

    return {
      answer,
      sources: relevantSources.map(s => ({
        title: s.metadata.topic || "Document",
        text: s.content,
        score: s.score,
      })),
      sessionId: currentSessionId,
    };
  }
}

export const chatService = new ChatService();