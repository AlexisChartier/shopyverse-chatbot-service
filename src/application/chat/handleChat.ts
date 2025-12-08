import { retrieverService } from "../retriever/retrieveContext.js";
import { llmClient, type ChatMessage } from "../../infrastructure/llm/HfInferenceClient.js";
import { bgeReranker } from "../../infrastructure/llm/BgeReranker.js";
import { RAG_PROMPT_TEMPLATE } from "../../prompts/rag.fr.js";
import { intentDetector, type Intent } from "../../nlu/intentDetector.js";
import { productRetrieverService } from "../products/productRetriever.js";
import { chatLogRepository } from "../../infrastructure/db/repositories/ChatLogRepository.js";
import { logger } from "../../infrastructure/observability/logger.js";
import { chatbotFallbackCounter } from "../../infrastructure/observability/metrics.js";
import { recoClient } from "../../infrastructure/reco/RecoClient.js";

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

  async processMessage(
    userMessage: string,
    sessionId?: string,
    requestId?: string,
    requestLogger?: any,
  ): Promise<ChatResponse> {
    const log = requestLogger?.child?.({ request_id: requestId }) ?? logger.child({ request_id: requestId });

    log.info({ sessionId, requestId }, `Processing message: ${userMessage}`);

    // 0) Déterminer l'intent
    const intent: Intent = intentDetector.detect(userMessage);
    log.info({ intent }, "Intent detected");

    // 1) Récupérer ou créer une session
    let currentSessionId = sessionId || this.generateSessionId();
    const history = this.sessions.get(currentSessionId) ?? [];

    // 2) Router selon l'intent
    if (intent === "FAQ") {
      return this.handleFaq(userMessage, currentSessionId, history, intent, log);
    }

    if (intent === "PRODUCT_SEARCH") {
      return this.handleProductSearch(userMessage, currentSessionId, history, intent, log);
    }

    // OTHER
    return this.handleOther(userMessage, currentSessionId, history, intent, log);
  }

  private async handleFaq(
    userMessage: string,
    sessionId: string,
    history: ChatMessage[],
    intent: Intent,
    log: any,
  ): Promise<ChatResponse> {
    const sources = await retrieverService.search(userMessage, 5);

    // === Cas 1 : aucun résultat → fallback ===
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

      // Log DB
      try {
        await chatLogRepository.log({
          sessionId,
          intent,
          userMessage,
          assistantAnswer: answer,
          hasFallback: true,
        });
      } catch (e) {
        log.error({ err: e }, "Failed to log FAQ (no sources) interaction");
      }

      chatbotFallbackCounter.labels(intent, "no_sources").inc();

      return { answer, sources: [], sessionId };
    }

    // === Stratégie combinée : tri + top-K + seuil ===
    const sortedSources = [...sources].sort((a, b) => b.score - a.score);
    const TOP_K = 3;
    const MIN_SCORE = 0.1;

    const bestScore = sortedSources[0]?.score ?? 0;
    const relevantSources = sortedSources.slice(0, TOP_K);

    if (bestScore < MIN_SCORE) {
      log.warn({ bestScore }, "FAQ: no relevant result");

      const answer =
        "Je suis désolé, je n'ai pas trouvé d'information précise à ce sujet dans ma base de connaissances. " +
        "Pouvez-vous reformuler ou contacter le support ?";

      const updatedHistory: ChatMessage[] = [
        ...history,
        { role: "user", content: userMessage },
        { role: "assistant", content: answer }
      ];
      this.sessions.set(sessionId, updatedHistory);

      // Log DB
      try {
        await chatLogRepository.log({
          sessionId,
          intent,
          userMessage,
          assistantAnswer: answer,
          hasFallback: true,
        });
      } catch (e) {
        log.error({ err: e }, "Failed to log FAQ (low score) interaction");
      }

      chatbotFallbackCounter.labels(intent, "low_score").inc();

      return { answer, sources: [], sessionId };
    }

    // === Cas normal : RAG + LLM avec BGE Reranking ===
    // Step 1: Rerank candidates using BGE reranker to improve quality
    log.debug({ sourcesCount: relevantSources.length }, "FAQ: applying BGE reranker");

    const rerankedResults = await bgeReranker.rerank(
      userMessage,
      relevantSources.map((s) => s.content),
      Math.min(3, relevantSources.length) // Keep top 3 after reranking
    );

    // Step 2: Map reranked results back to source objects with new scores
    const finalSources = rerankedResults.map((reranked) => ({
      ...relevantSources[reranked.index],
      score: reranked.score, // Update score from reranker
    }));

    // Step 3: Build context from reranked sources
    const contextText = finalSources.map((s) => `- ${s.content}`).join("\n");
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

    log.info({ sourcesCount: finalSources.length, sessionId }, "FAQ: calling LLM");

    const answer = await llmClient.generate(messages);

    const updatedHistory: ChatMessage[] = [
      ...history,
      { role: "user", content: userMessage },
      { role: "assistant", content: answer }
    ];
    this.sessions.set(sessionId, updatedHistory);

    // Log DB
    try {
      await chatLogRepository.log({
        sessionId,
        intent,
        userMessage,
        assistantAnswer: answer,
        hasFallback: false,
      });
    } catch (e) {
      log.error({ err: e }, "Failed to log FAQ interaction");
    }

    return {
      answer,
      sources: finalSources.map((s) => ({
        title: s.metadata.topic || "Document",
        text: s.content,
        score: s.score // Now reranker score instead of embedding score
      })),
      sessionId
    };
  }

  private async handleProductSearch(
    userMessage: string,
    sessionId: string,
    history: ChatMessage[],
    intent: Intent,
    log: any,
  ): Promise<ChatResponse> {
    // 1) Recherche sémantique produit
    const results = await productRetrieverService.search(userMessage, 5);

    // === Cas fallback : aucun produit trouvé ===
    if (!results.length) {
      const answer =
        "Vous semblez chercher un produit précis. " +
        "Je ne trouve pas encore de produit correspondant dans le catalogue indexé. " +
        "Vous pouvez reformuler votre demande ou consulter les catégories directement sur ShopyVerse.";

      const updatedHistory: ChatMessage[] = [
        ...history,
        { role: "user", content: userMessage },
        { role: "assistant", content: answer },
      ];
      this.sessions.set(sessionId, updatedHistory);

      try {
        await chatLogRepository.log({
          sessionId,
          intent,
          userMessage,
          assistantAnswer: answer,
          hasFallback: true,
        });
      } catch (e) {
        log.error({ err: e }, "Failed to log PRODUCT_SEARCH (no results) interaction");
      }

      chatbotFallbackCounter.labels(intent, "no_product").inc();

      return {
        answer,
        sources: [],
        sessionId,
      };
    }

    // 2) On garde les 3 meilleurs
    const TOP_K = 3;
    const topResults = results.slice(0, TOP_K);

    // Call recommendation service based on best hit to augment response
    let recommendations: { title: string; description?: string }[] = [];
    try {
      if (topResults[0]?.productId) {
        const reco = await recoClient.getRecommendations(topResults[0].productId);
        recommendations = reco.map((r) => ({
          title: r.name ?? r.title ?? r.slug ?? 'Produit recommandé',
          description: r.description,
        }));
      }
    } catch (err) {
      log.warn({ err }, "Failed to fetch recommendations from reco service");
    }

    const lines = topResults.map((p, idx) => {
      const cat = p.categoryName ? ` (${p.categoryName})` : "";
      return `${idx + 1}. ${p.title}${cat} — ${p.description}`;
    });

    const recoLines =
      recommendations.length > 0
        ? "\n\nRecommandations liées :\n" +
          recommendations.map((r, idx) => `${idx + 1}. ${r.title}${r.description ? ` — ${r.description}` : ''}`).join("\n")
        : "";

    const answer =
      "Voici quelques produits ShopyVerse qui pourraient vous intéresser :\n\n" +
      lines.join("\n") +
      recoLines;

    const updatedHistory: ChatMessage[] = [
      ...history,
      { role: "user", content: userMessage },
      { role: "assistant", content: answer },
    ];
    this.sessions.set(sessionId, updatedHistory);

    try {
      await chatLogRepository.log({
        sessionId,
        intent,
        userMessage,
        assistantAnswer: answer,
        hasFallback: false,
      });
    } catch (e) {
      log.error({ err: e }, "Failed to log PRODUCT_SEARCH interaction");
    }

    return {
      answer,
      sources: topResults.map((p) => ({
        title: p.title,
        text: p.description,
        score: p.score,
      })),
      sessionId,
    };
  }

  private async handleOther(
    userMessage: string,
    sessionId: string,
    history: ChatMessage[],
    intent: Intent,
    log: any,
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

    // Pour OTHER, on peut considérer que c'est toujours un fallback métier
    try {
      await chatLogRepository.log({
        sessionId,
        intent,
        userMessage,
        assistantAnswer: answer,
        hasFallback: true,
      });
    } catch (e) {
      log.error({ err: e }, "Failed to log OTHER interaction");
    }

    chatbotFallbackCounter.labels(intent, "other").inc();

    return {
      answer,
      sources: [],
      sessionId
    };
  }
}

export const chatService = new ChatService();