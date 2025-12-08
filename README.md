**ShopyVerse — Chatbot Service**
================================

Microservice RAG (Retrieval-Augmented Generation) pour l’assistant conversationnel de ShopyVerse.

Technos principales : `Fastify` (API), `Qdrant` (vector store), HuggingFace (LLM + embeddings).

Objectif : fournir des réponses précises, vérifiables et basées uniquement sur la base de connaissances ingestée.

**Architecture (résumé)**
-------------------------

```
┌─────────────────┐
│   Front-end     │
│  (Widget Chat)  │
└────────┬────────┘
         │ POST /api/v1/chat
         ↓
   ┌─────────────────┐
   │  NLU Classifier │  ← Détecte intent (FAQ / produit / autre)
   └────────┬────────┘
            │
    ┌───────┴───────┐
    ↓               ↓
 ┌─FAQ─┐      ┌──PRODUCT──┐
 │ RAG │      │ Search +  │
 │Index│      │ Tool Call │
 └──┬──┘      │(Catalog)  │
   │         └─────┬──────┘
   └────┬──────────┘
        ↓
   ┌──────────────────┐
   │  Qdrant Search   │  ← Contexte vectoriel
   └────────┬─────────┘
            ↓
   ┌──────────────────┐
   │  LLM (HF Chat)   │  ← Génération réponse
   └────────┬─────────┘
            ↓
   ┌──────────────────────┐
   │  Response + Sources  │  ← { answer, sources, products? }
   └──────────┬───────────┘
              ↓
   ┌──────────────────────┐
   │  Interaction Logs    │  ← Persistance pour dashboard
   └──────────────────────┘
```

**Flux détaillé**

1. Le client envoie une requête via le widget front-end à `POST /api/v1/chat`.
2. **NLU** classe la requête (FAQ, recherche produit, ou autre).
3. Selon le type :
   - **FAQ** : recherche RAG dans la base FAQ (Qdrant).
   - **Produit** : recherche sémantique du catalogue ET optionnellement tool-call vers le service catalogue.
4. Construction du prompt contextualisé avec extraits pertinents.
5. Requête au LLM (HuggingFace Chat Completions API).
6. Réponse structurée `{ answer, sources, products?, recommendations? }`.
7. Enregistrement dans les logs persistants pour le dashboard IA.

**Principales fonctionnalités**
------------------------------

### En place ✅
- **Chatbot RAG** : recherche vectorielle, sélection des meilleurs passages, réponse concise basée sur les données.
- **Ingestion FAQ** : route `/api/v1/ingest` pour ajouter des documents (vectorisation via HF embeddings + stockage Qdrant).
- **Sécurité** : authentification simple par header `x-api-key` sur les routes `api/v1/*`.
- **Observabilité** : logs structurés (Pino) et endpoint `/metrics` (Prometheus).

### En développement 🔄
- **Recherche & orientation produit** : indexation sémantique du catalogue, tool-calling vers le service catalogue ou recherche vectorielle directe.
- **NLU minimale** : classification des requêtes (FAQ / recherche produit / autre) pour router intelligemment vers le bon pipeline.
- **Index sémantique produits** : vectorisation complète du catalogue (descriptions, caractéristiques, prix) pour une recherche par intention utilisateur.
- **Widget chat front-end** : intégration légère dans la boutique (iframe ou Web Component).
- **Logs persistants** : enregistrement des interactions pour audit, ML analytics et réentraînement des modèles.
- **Tableau de bord IA** : visualisation des interactions, performances du chatbot, taux de satisfaction.
- **(Optionnel)** **A/B test promos** : liaison avec les offres en cours pour assister l'utilisateur sur les produits pertinents.

**Modèle LLM**
--------------

Le service est conçu pour utiliser des modèles compatibles avec l’API HuggingFace Chat Completions (ex. `Qwen2.5-7B-Instruct`).
Avantages : pas d’hébergement de modèle requis, latence faible, bonnes performances en RAG.

Règles du prompt RAG (extrait)
------------------------------

- Répondre **EXCLUSIVELY** avec les informations fournies dans le contexte.
- Être concis et professionnel (ton e‑commerce).
- Si l’information n’existe pas dans le contexte, indiquer clairement qu’on ne sait pas.

Exemple d’encadrement du prompt :

```
Tu es l'assistant virtuel de ShopyVerse.
Règles :
1) Utilise uniquement le CONTEXTE ci-dessous.
2) Si la réponse n'est pas présente, réponds "Je n'ai pas cette information".
3) Ne pas inventer d'informations.

===== CONTEXTE =====
...extraits issus de Qdrant...
===== FIN CONTEXTE =====

Question du client : ...
```

Cette structure limite fortement les hallucinations.

**Installation rapide**
----------------------

Prérequis : `Node.js >= 18`, `Docker` si vous voulez lancer Qdrant localement, et un token HuggingFace.

1) Copier le fichier d'exemple d'environnement :

```bash
cp .env.example .env
# Éditez .env pour ajouter HF token, QDRANT url, API key, etc.
```

2) Installer puis lancer en mode développement :

```bash
npm install
npm run dev
```

L’API démarre par défaut sur le port défini dans la variable d’environnement (par ex. `3001`).

**Variables d’environnement importantes**
---------------------------------------

- `HF_API_TOKEN` : token HuggingFace
- `QDRANT_URL` : URL du service Qdrant
- `API_KEY` : clé API pour protéger les endpoints
- Consultez ` .env.example` pour la liste complète.

**Endpoints principaux**
------------------------

- `POST /api/v1/ingest` — ingérer documents FAQ (JSON).
- `POST /api/v1/ingest/products` — ingérer catalogue produits (JSON).
- `POST /api/v1/chat` — envoyer un message utilisateur, reçoit `{ answer, sources, products?, recommendations? }`.
- `GET /metrics` — métriques Prometheus.
- `GET /api/v1/dashboard/interactions` — (à implémenter) historique des interactions pour le dashboard.

Exemple : ingestion (FAQ)

```bash
curl -s -X POST http://localhost:3001/api/v1/ingest \
	-H "Content-Type: application/json" \
	-H "x-api-key: dev-api-key" \
	-d '{
		"documents": [
			{
				"content": "Nos délais de livraison sont de 3 à 5 jours ouvrés en France.",
				"metadata": { "topic": "livraison" }
			}
		]
	}'
```

Exemple : appel au chatbot

```bash
curl -s -X POST http://localhost:3001/api/v1/chat \
	-H "Content-Type: application/json" \
	-H "x-api-key: dev-api-key" \
	-d '{"message": "Bonjour, quels sont vos délais de livraison ?"}'

# Réponse attendue (exemple):
// {
//   "answer": "Les délais de livraison sont de 3 à 5 jours ouvrés en France métropolitaine.",
//   "sources": [ { "title": "livraison", "text": "Nos délais de livraison..." } ]
// }
```

**Roadmap & Priorités**
-----------------------

**Phase 1 (En cours) 🔄**
- ✅ FAQs + base vectorielle
- 🔄 NLU classifier (intent detection)
- 🔄 Index sémantique produits (Qdrant ou ES)
- 🔄 Tool-calling vers service catalogue

**Phase 2 (Bientôt) 📅**
- Widget chat front-end (iframe / Web Component)
- Logs persistants d'interactions
- Dashboard IA (visualisation, analytics)
- Historique conversationnel (sessionId)

**Phase 3 (Optionnel) ✨**
- Recommandations basées promos / A/B test
- Reranker HuggingFace pour améliorer la pertinence
- Feedback loop (thumbs up/down) pour réentraînement
- Monitoring & alerting avancés

**Phase 4 (Infra) 🚀**
- Docker image, Helm chart
- CI/CD GitHub Actions
- Scaling horizontale (replicas Kubernetes)

**Ingestion du catalogue produits**
----------------------------------

Après implémentation de l'index sémantique, vous pourrez ingérer le catalogue ainsi :

```bash
curl -s -X POST http://localhost:3001/api/v1/ingest/products \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-api-key" \
  -d '{
    "products": [
      {
        "id": "prod-123",
        "name": "T-Shirt ShopyVerse Coton",
        "description": "T-shirt premium en coton biologique, couleurs variées.",
        "price": 29.99,
        "category": "Vêtements/Hommes",
        "tags": ["coton", "bio", "confortable"],
        "in_stock": true
      }
    ]
  }'
```

Ces produits seront vectorisés et indexés pour la recherche sémantique (ex. "je cherche un t-shirt confortable pour homme").

**Frontend Integration (React TypeScript)**
------------------------------------------

### Setup

To integrate the chatbot service into your React TypeScript frontend, follow these steps:

#### 1. Install Dependencies

```bash
npm install axios # or your preferred HTTP client
```

#### 2. Create a Chatbot Service Client

Create a file `src/services/chatbotClient.ts` in your React app:

```typescript
import axios, { AxiosInstance } from 'axios';

interface ChatMessage {
  message: string;
}

interface ChatResponse {
  answer: string;
  sources?: Array<{
    title: string;
    text: string;
  }>;
  products?: Array<{
    id: string;
    name: string;
    price?: number;
  }>;
  recommendations?: string[];
}

class ChatbotClient {
  private apiClient: AxiosInstance;
  private apiKey: string;

  constructor(baseURL: string, apiKey: string) {
    this.apiKey = apiKey;
    this.apiClient = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
    });
  }

  /**
   * Send a message to the chatbot and get a response
   */
  async sendMessage(message: string): Promise<ChatResponse> {
    try {
      const response = await this.apiClient.post<ChatResponse>(
        '/api/v1/chat',
        { message }
      );
      return response.data;
    } catch (error) {
      console.error('Chatbot API error:', error);
      throw error;
    }
  }

  /**
   * Get conversation metrics (optional)
   */
  async getMetrics(): Promise<any> {
    try {
      const response = await this.apiClient.get('/metrics');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      throw error;
    }
  }
}

// Create a singleton instance
const chatbotClient = new ChatbotClient(
  process.env.REACT_APP_CHATBOT_API_URL || 'http://localhost:3001',
  process.env.REACT_APP_CHATBOT_API_KEY || 'dev-api-key'
);

export default chatbotClient;
```

#### 3. Create Environment Variables

In your React project's `.env` file:

```bash
REACT_APP_CHATBOT_API_URL=http://localhost:3001
REACT_APP_CHATBOT_API_KEY=dev-api-key
```

For production, set these in your deployment environment variables.

#### 4. Create a React Hook for Chat

Create `src/hooks/useChatbot.ts`:

```typescript
import { useState, useCallback } from 'react';
import chatbotClient from '../services/chatbotClient';

interface ChatResponse {
  answer: string;
  sources?: Array<{
    title: string;
    text: string;
  }>;
  products?: Array<{
    id: string;
    name: string;
    price?: number;
  }>;
}

interface UseChatbotReturn {
  sendMessage: (message: string) => Promise<ChatResponse | null>;
  response: ChatResponse | null;
  loading: boolean;
  error: string | null;
}

export const useChatbot = (): UseChatbotReturn => {
  const [response, setResponse] = useState<ChatResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (message: string) => {
    setLoading(true);
    setError(null);

    try {
      const result = await chatbotClient.sendMessage(message);
      setResponse(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { sendMessage, response, loading, error };
};
```

#### 5. Create a Chat Widget Component

Create `src/components/ChatWidget.tsx`:

```typescript
import React, { useState } from 'react';
import { useChatbot } from '../hooks/useChatbot';

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  sources?: any[];
}

export const ChatWidget: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const { sendMessage, loading, error } = useChatbot();

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim()) return;

    // Add user message to chat
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    // Send to chatbot
    const response = await sendMessage(input);

    if (response) {
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: response.answer,
        sources: response.sources,
      };
      setMessages((prev) => [...prev, botMessage]);
    } else if (error) {
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        type: 'bot',
        content: `Erreur: ${error}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  return (
    <div className="chat-widget" style={styles.container}>
      <div style={styles.header}>
        <h3>ShopyVerse Assistant</h3>
      </div>

      <div style={styles.messagesContainer}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              ...styles.message,
              ...(msg.type === 'user' ? styles.userMessage : styles.botMessage),
            }}
          >
            <p>{msg.content}</p>
            {msg.sources && msg.sources.length > 0 && (
              <div style={styles.sources}>
                <strong>Sources:</strong>
                <ul>
                  {msg.sources.map((source, idx) => (
                    <li key={idx}>{source.title}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
        {loading && <div style={styles.loading}>Chargement...</div>}
      </div>

      <form onSubmit={handleSendMessage} style={styles.form}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Posez votre question..."
          disabled={loading}
          style={styles.input}
        />
        <button type="submit" disabled={loading} style={styles.button}>
          Envoyer
        </button>
      </form>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    width: '400px',
    height: '600px',
    border: '1px solid #ccc',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: '#007bff',
    color: '#fff',
    padding: '16px',
    borderRadius: '8px 8px 0 0',
    textAlign: 'center' as const,
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px',
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: '12px',
  },
  message: {
    marginBottom: '8px',
    padding: '12px',
    borderRadius: '8px',
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end' as const,
    backgroundColor: '#007bff',
    color: '#fff',
  },
  botMessage: {
    alignSelf: 'flex-start' as const,
    backgroundColor: '#f0f0f0',
    color: '#333',
  },
  sources: {
    marginTop: '8px',
    fontSize: '12px',
    opacity: 0.8,
  },
  loading: {
    padding: '12px',
    textAlign: 'center' as const,
    color: '#666',
    fontStyle: 'italic',
  },
  form: {
    display: 'flex' as const,
    gap: '8px',
    padding: '16px',
    borderTop: '1px solid #ccc',
  },
  input: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px',
  },
  button: {
    padding: '8px 16px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
};
```

#### 6. Use the Chat Widget in Your App

In your main `App.tsx`:

```typescript
import React from 'react';
import { ChatWidget } from './components/ChatWidget';

function App() {
  return (
    <div className="App">
      {/* Your other components */}
      <ChatWidget />
    </div>
  );
}

export default App;
```

### CORS Configuration

If your React app and chatbot service are on different origins (e.g., `localhost:3000` and `localhost:3001`), you need to enable CORS on the chatbot service.

The service already includes `@fastify/cors`. If you need to configure it, update `src/app/server.ts`:

```typescript
// Already configured for development, adjust for production
await fastify.register(require('@fastify/cors'), {
  origin: ['http://localhost:3000', 'https://yourdomain.com'],
  credentials: true,
});
```

### Example: Full Integration Flow

1. User enters a message in the chat widget
2. `handleSendMessage` sends the message via `useChatbot` hook
3. `chatbotClient.sendMessage()` makes a POST request to `/api/v1/chat`
4. Chatbot service classifies the intent, retrieves context, and returns an answer
5. Response is displayed in the chat widget with sources/products
6. User sees the answer and can continue the conversation

### Troubleshooting

| Issue | Solution |
|-------|----------|
| **CORS error** | Ensure the backend CORS config includes your frontend origin |
| **API Key rejection** | Check that `REACT_APP_CHATBOT_API_KEY` matches the backend's `API_KEY` |
| **500 error from chatbot** | Check chatbot service logs: `docker logs <container>` or `npm run dev` output |
| **Network timeout** | Verify the `REACT_APP_CHATBOT_API_URL` is correct and backend is running |

**Widget front-end (Optional Iframe)**
--------------------------------------

Alternatively, for a standalone widget deployed as an iframe:

```html
<!-- In your e-commerce site -->
<iframe 
  src="https://api.shopyverse.com/chat-widget" 
  width="400" 
  height="600"
  frameborder="0"
  allow="scripts">
</iframe>
```

**Dashboard IA & Logs**
----------------------

Les interactions sont enregistrées en base (`MongoDB` ou `PostgreSQL`) pour :

- Audit & conformité
- Analytics (taux de satisfaction, questions non résolues, etc.)
- Réentraînement des modèles NLU/LLM
- Détection de patterns (questions fréquentes, amélioration FAQ)

Structure d'un log d'interaction :

```json
{
  "id": "interaction-456",
  "timestamp": "2025-12-06T10:30:00Z",
  "user_id": "user-789",
  "session_id": "session-xyz",
  "message": "Je cherche un t-shirt shopyverse pour homme.",
  "intent": "product_search",
  "answer": "Voici nos t-shirts pour hommes...",
  "sources": [{ "type": "product", "id": "prod-123" }],
  "feedback": null,
  "latency_ms": 450
}
```

Le dashboard exploite ces données pour montrer :
- Taux de résolution des requêtes
- Intent distribution
- Produits les plus recherchés
- Temps de réponse

**Contribuer / développement**
-----------------------------

**Env local**
```bash
npm install
npm run dev
```

**Tester les endpoints**
```bash
# FAQ
curl -X POST http://localhost:3001/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-api-key" \
  -d '{"message": "Quels sont vos délais de livraison ?"}'

# Recherche produit (après implémentation)
curl -X POST http://localhost:3001/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-api-key" \
  -d '{"message": "Je cherche un t-shirt shopyverse pour homme."}'
```

**Ajouter des FAQs**
```bash
curl -X POST http://localhost:3001/api/v1/ingest \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-api-key" \
  -d '{
    "documents": [
      {
        "content": "Nos délais de livraison sont de 3 à 5 jours ouvrés en France métropolitaine.",
        "metadata": { "topic": "livraison", "type": "faq" }
      }
    ]
  }'
```

**PR & contributions**
- Branchez depuis `feat/model-implementation` ou créez une feature branch.
- Ouvrez une PR vers `main` avec description claire des changements.
- Tests & lint obligatoires : `npm run test && npm run lint`.

---

**Questions ou suggestions ?** Ouvrez une issue ou contactez l'équipe IA ShopyVerse.
