**ShopyVerse Chatbot Service**
==============================

**Microservice IA – Retrieval-Augmented Chatbot (Fastify + HuggingFace + Qdrant)**

Ce microservice fournit l’assistant conversationnel de ShopyVerse.

Il repose sur une architecture simple, performante et extensible :

*   **Fastify** pour l’API REST
    
*   **Qdrant** comme base vectorielle
    
*   **HuggingFace Inference API** pour le LLM
    
*   **Embeddings HF** pour la recherche de contexte
    
*   **RAG (Retrieval-Augmented Generation)** pour des réponses fiables basées sur des données réelles
    

**Architecture Résumée**
------------------------

Client → /api/v1/chat

↓

ChatService.processMessage()

→ RetrieverService.search() (Qdrant search)

→ RAG\_PROMPT\_TEMPLATE() (prompt contextualisé FR)

→ llmClient.generate() (HF chatCompletion API)

↓

Réponse finale (answer + sources)Le service supporte également une route d’ingestion pour alimenter la base de connaissances.

**Fonctionnalités**
===================

### **✓ Chatbot RAG complet**

*   Recherche vectorielle dans Qdrant
    
*   Sélection des meilleurs passages (score > 0.4)
    
*   Prompt French-Optimized pour Qwen2.5
    
*   Réponse concise et strictement basée sur les données ingerées
    

### **✓ Ingestion de documents**

Via /api/v1/ingest :

*   création automatique de la collection shopyverse\_docs
    
*   vectorisation via HuggingFace embeddings
    
*   stockage dans Qdrant
    

### **✓ Authentification simple par API Key**

Toutes les routes /api/v1/\* sont protégées par un header :x-api-key:

### **✓ Observabilité**

*   logs structurés Pino
    
*   route /metrics pour export Prometheus
    

**🤖 Modèle LLM utilisé**
=========================

Le chatbot utilise :

### **Qwen/Qwen2.5-7B-Instruct**

Modèle compatible **HuggingFace Chat Completions API**, excellent en RAG, multilingue et gratuit via inference-serverless.

Utilisation via chatCompletion :

*   pas besoin d’héberger le modèle
    
*   très faible latence (~1s)
    
*   réponses stables et non-hallucinées
    

**RAG PROMPT (optimisé)**
=========================

Le prompt utilisé force le LLM à :

*   répondre **EXCLUSIVEMENT selon le contexte fourni**
    
*   être concis
    
*   parler en français
    
*   éviter toute hallucination
    
*   répondre comme un assistant e-commerce professionnel
    

Le rendu type :Tu es l’assistant virtuel de ShopyVerse.

Règles strictes :

1\. Utilise EXCLUSIVEMENT les informations ci-dessous.

2\. Si la réponse n’est pas présente, dis-le simplement.

3\. N’invente jamais d’informations.

\===== CONTEXTE =====

...

\===== FIN CONTEXTE =====

Question du client :

...

**Installation & Lancement**
============================

**1\. Dépendances**
-------------------

*   Node.js 18+
    
*   Qdrant (Docker ou local)
    
*   HuggingFace account + Access Token
    

**2. .env requisPORT=3001**
---------------------------

**\# HuggingFace**
------------------

**HF\_TOKEN=hf\_xxxxx**
-----------------------

**HF\_MODEL=Qwen/Qwen2.5-7B-Instruct**
--------------------------------------

**\# Qdrant**
-------------

**QDRANT\_URL=http://localhost:6333**
-------------------------------------

**\# API security**
-------------------

**API\_KEY=dev-api-key**
------------------------

**\# Core services**
--------------------

**API\_CORE\_URL=http://localhost:3000**
----------------------------------------

**3\. Installer & lancer :**
----------------------------

**npm install**
---------------

**npm run dev**
---------------

**Ingestion de documents (FAQ / connaissance)**
===============================================

Appeler :curl -X POST http://localhost:3001/api/v1/ingest \\

\-H "Content-Type: application/json" \\

\-H "x-api-key: dev-api-key" \\

\-d '{

"documents": \[

{

"content": "Nos délais de livraison sont de 3 à 5 jours ouvrés en France.",

"metadata": { "topic": "livraison" }

}

\]

}'

**Exemple d’appel au chatbot**
==============================

curl -X POST http://localhost:3001/api/v1/chat \\

\-H "Content-Type: application/json" \\

\-H "x-api-key: dev-api-key" \\

\-d '{"message": "Bonjour, quels sont vos délais de livraison ?"}'Réponse :{

"answer": "Les délais de livraison sont de 3 à 5 jours ouvrés en France métropolitaine.",

"sources": \[

{ "title": "livraison", "text": "Nos délais de livraison..." }

\]

}

**Améliorations prévues (roadmap interne)**
===========================================

*   Historique conversationnel (sessionId)
    
*   Recommandation produit via tool-calling
    
*   Reranker HF pour améliorer la pertinence RAG
    
*   Monitoring avancé
    
*   Dockerfile + Helm Chart + CI/CD GitHub Actions
    
*   Widget chat côté front