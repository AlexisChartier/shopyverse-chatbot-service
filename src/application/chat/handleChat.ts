// src/application/chat/handleChat.ts
import { retrieverService } from "../retriever/retrieveContext.js";
import { llmClient, type ChatMessage } from "../../infrastructure/llm/HfInferenceClient.js";
import { RAG_PROMPT_TEMPLATE } from "../../prompts/rag.fr.js";
import { intentDetector, type Intent } from "../../nlu/intentDetector.js";

type SourceOut = { title: string; text: string; score?: number };

type ChatResponse = {
  answer: string;
  sources: SourceOut[];
  sessionId: string;
};

export class ChatService {
  // sessionId -> historique (user / assistant)
  private sessions = new Map<string, ChatMessage[]>();

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  }

  async processMessage(userMessage: string, sessionId?: string): Promise<ChatResponse> {
    console.log(`Traitement de la question : "${userMessage}"`);

    // 0) Déterminer l'intent
    const intent: Intent = intentDetector.detect(userMessage);
    console.log("Intent détecté :", intent);

    // 1) Récupérer ou créer une session
    let currentSessionId = sessionId || this.generateSessionId();
    const history = this.sessions.get(currentSessionId) ?? [];

    // 2) Router selon l'intent
    if (intent === "FAQ") {
      return this.handleFaq(userMessage, currentSessionId, history);
    }

    if (intent === "PRODUCT_SEARCH") {
      return this.handleProductSearch(userMessage, currentSessionId, history);
    }

    // OTHER
    return this.handleOther(userMessage, currentSessionId, history);
  }

  private async handleFaq(
    userMessage: string,
    sessionId: string,
    history: ChatMessage[]
  ): Promise<ChatResponse> {
    // RAG classique sur la base de connaissances FAQ
    const sources = await retrieverService.search(userMessage, 5);

    if (!sources.length) {
      const answer =
        "Je suis désolé, je n'ai pas trouvé d'information précise à ce sujet dans ma base de connaissances. " +
        "Pouvez-vous reformuler ou contacter le support ?";

      const updatedHistory: ChatMessage[] = [
        ...history,
        { role: "user", content: userMessage },
        { role: "assistant", content: answer }
      ];
      this.sessions.set(sessionId, updatedHistory);

      return { answer, sources: [], sessionId };
    }

    // Stratégie combinée : tri + top-K + seuil
    const sortedSources = [...sources].sort((a, b) => b.score - a.score);
    const TOP_K = 3;
    const MIN_SCORE = 0.1;

    const bestScore = sortedSources[0]?.score ?? 0;
    let relevantSources = sortedSources.slice(0, TOP_K);

    if (bestScore < MIN_SCORE) {
      console.log("FAQ: aucun résultat suffisamment pertinent. bestScore =", bestScore);

      const answer =
        "Je suis désolé, je n'ai pas trouvé d'information précise à ce sujet dans ma base de connaissances. " +
        "Pouvez-vous reformuler ou contacter le support ?";

      const updatedHistory: ChatMessage[] = [
        ...history,
        { role: "user", content: userMessage },
        { role: "assistant", content: answer }
      ];
      this.sessions.set(sessionId, updatedHistory);

      return { answer, sources: [], sessionId };
    }

    const contextText = relevantSources.map((s) => `- ${s.content}`).join("\n");
    const ragPrompt = RAG_PROMPT_TEMPLATE(contextText, userMessage);

    const systemMessage: ChatMessage = {
      role: "system",
      content:
        "Tu es un assistant client pour une boutique en ligne nommée ShopyVerse. " +
        "Tu réponds en français, de manière concise et utile. " +
        "Tu t'appuies en priorité sur les informations de la base de connaissances FAQ. " +
        "Si l'information n'est pas disponible, tu le dis clairement."
    };

    const messages: ChatMessage[] = [
      systemMessage,
      ...history,
      { role: "user", content: ragPrompt }
    ];

    console.log(
      `FAQ: appel du LLM avec ${relevantSources.length} sources, bestScore=${bestScore}, sessionId=${sessionId}`
    );

    const answer = await llmClient.generate(messages);

    const updatedHistory: ChatMessage[] = [
      ...history,
      { role: "user", content: userMessage },
      { role: "assistant", content: answer }
    ];
    this.sessions.set(sessionId, updatedHistory);

    return {
      answer,
      sources: relevantSources.map((s) => ({
        title: s.metadata.topic || "Document",
        text: s.content,
        score: s.score
      })),
      sessionId
    };
  }

  private async handleProductSearch(
    userMessage: string,
    sessionId: string,
    history: ChatMessage[]
  ): Promise<ChatResponse> {
    // Pour l'instant stub : on n'a pas encore de produits ou de service catalogue.
    // On crée quand même un point d'extension clairement identifié.

    const answer =
      "Vous semblez chercher un produit précis. " +
      "La recherche de produits par le chatbot n'est pas encore disponible, " +
      "mais elle sera bientôt intégrée avec le catalogue ShopyVerse.";

    const updatedHistory: ChatMessage[] = [
      ...history,
      { role: "user", content: userMessage },
      { role: "assistant", content: answer }
    ];
    this.sessions.set(sessionId, updatedHistory);

    // Plus tard : ici on branchera un appel au microservice produits (via HTTP)
    // et on renverra une liste de recommandations.

    return {
      answer,
      sources: [], 
      sessionId
    };
  }

  private async handleOther(
  userMessage: string,
  sessionId: string,
  history: ChatMessage[]
): Promise<ChatResponse> {

  const answer =
    "Je suis l’assistant virtuel de ShopyVerse. " +
    "Je peux vous aider concernant la livraison, les retours, les commandes et la recherche de produits. " +
    "Cette question sort de mon domaine d’expertise. " +
    "Pouvez-vous reformuler votre demande en lien avec votre expérience sur ShopyVerse ?";

  const updatedHistory: ChatMessage[] = [
    ...history,
    { role: "user", content: userMessage },
    { role: "assistant", content: answer }
  ];

  this.sessions.set(sessionId, updatedHistory);

  return {
    answer,
    sources: [],
    sessionId
  };
}
}

export const chatService = new ChatService();