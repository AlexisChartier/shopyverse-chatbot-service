**ShopyVerse — Chatbot Service**
================================

Microservice RAG (Retrieval-Augmented Generation) pour l’assistant conversationnel de ShopyVerse.

Technos principales : `Fastify` (API), `Qdrant` (vector store), HuggingFace (LLM + embeddings).

Objectif : fournir des réponses précises, vérifiables et basées uniquement sur la base de connaissances ingestée.

**Architecture (résumé)**
-------------------------

1. Le client envoie une requête à `POST /api/v1/chat`.
2. Le service récupère le contexte via une recherche vectorielle dans `Qdrant`.
3. On construit un prompt RAG (FR) contenant les extraits pertinents.
4. Le prompt est envoyé au LLM via l’API HuggingFace Chat Completions.
5. Le service renvoie une réponse structurée `{ answer, sources }`.

**Principales fonctionnalités**
------------------------------

- **Chatbot RAG** : recherche vectorielle, sélection des meilleurs passages, réponse concise basée sur les données.
- **Ingestion** : route `/api/v1/ingest` pour ajouter des documents (vectorisation via HF embeddings + stockage Qdrant).
- **Sécurité** : authentification simple par header `x-api-key` sur les routes `api/v1/*`.
- **Observabilité** : logs structurés (Pino) et endpoint `/metrics` (Prometheus).

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

- `POST /api/v1/ingest` — ingérer un ou plusieurs documents (JSON).
- `POST /api/v1/chat` — envoyer un message utilisateur et recevoir `{ answer, sources }`.
- `GET /metrics` — métriques Prometheus.

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

**Roadmap (brefs points)**
--------------------------

- Historique conversationnel (sessionId)
- Recommandation produit via tool-calling
- Reranker HuggingFace pour améliorer la pertinence
- Monitoring & alerting avancés
- Docker image, Helm chart et CI/CD (GitHub Actions)
- Widget chat côté front

**Contribuer / développement**
-----------------------------

- Lancer en local : `npm run dev`.
- Ajouter des documents via `/api/v1/ingest` pour tester les scénarios RAG.
- Ouvrir une PR sur la branche `main` pour proposer des améliorations.

---

Si vous souhaitez que je reformule certains paragraphes (ex. prompt RAG, guide d’ingestion, ou section technique), dites-moi laquelle et je l’affinerai.
