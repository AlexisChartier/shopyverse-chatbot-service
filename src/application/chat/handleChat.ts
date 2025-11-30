import { retrieverService } from '../retriever/retrieveContext.js';
import { llmClient } from '../../infrastructure/llm/HfInferenceClient.js';
import { RAG_PROMPT_TEMPLATE } from '../../prompts/rag.fr.js';

export class ChatService {
  async processMessage(userMessage: string) {
    console.log(`Traitement de la question : "${userMessage}"`);

    // 1. Recherche du contexte pertinent (RAG)
    // On cherche les 3 meilleurs documents
    const sources = await retrieverService.search(userMessage, 3);
    
    // Filtrage simple : on ignore les résultats trop peu pertinents (score < 0.5 par exemple)
    // Note : Le seuil dépend du modèle d'embedding et de la distance (Cosine vs Euclidien)
    const relevantSources = sources.filter(s => s.score > 0.4);

    let answer = "";

    if (relevantSources.length === 0) {
      // Fallback si aucune info trouvée
      answer = "Je suis désolé, je n'ai pas trouvé d'information précise à ce sujet dans ma base de connaissances. Pouvez-vous reformuler ou contacter le support ?";
    } else {
      // 2. Construction du Prompt
      const contextText = relevantSources.map(s => `- ${s.content}`).join('\n');
      const prompt = RAG_PROMPT_TEMPLATE(contextText, userMessage);

      // 3. Génération de la réponse via LLM
      console.log("Appel du LLM...");
      // llmClient.generate retourne directement la chaîne de caractères
      answer = await llmClient.generate(prompt);
    }

    return {
      answer,
      sources: relevantSources.map(s => ({ title: s.metadata.topic || 'Document', text: s.content }))
    };
  }
}

export const chatService = new ChatService();