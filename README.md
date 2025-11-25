🤖 ShopyVerse - Chatbot Service
===============================

Ce microservice est l'agent conversationnel intelligent de la plateforme e-commerce ShopyVerse. Il utilise une architecture RAG (Retrieval-Augmented Generation) pour répondre aux questions des utilisateurs en se basant sur une base de connaissances vectorielle (FAQ) et peut interagir avec le catalogue produits.

  

🏗 Architecture & Stack Technique
---------------------------------

Le projet suit une architecture modulaire inspirée du Domain-Driven Design (DDD) pour séparer la logique métier de l'infrastructure.

   Runtime : Node.js v20+ (TypeScript)
   Framework Web : [Fastify](https://www.fastify.io/) (Performance & faible overhead)
   Base de données Vectorielle : [Qdrant](https://qdrant.tech/) (Stockage des embeddings FAQ/Produits)
   LLM & Embeddings : [Hugging Face Inference API](https://huggingface.co/inference-api) (Modèles Mistral/Zephyr & MiniLM)
   Validation : Zod (Variables d'env et DTOs)
   Observabilité : Prometheus (Metrics) & Pino (Logs)

 Arborescence du projet

    src/
    ├── app/                   Couche Interface (Serveur Fastify, Routes, Middlewares)
    ├── application/           Cas d'utilisation (Chat flow, RAG, Ingestion)
    ├── domain/                Entités métier et Interfaces (Types partagés)
    ├── infrastructure/        Implémentations techniques (Clients Qdrant, HF, Tools)
    ├── prompts/               Templates de prompts pour le LLM
    └── index.ts               Point d'entrée
    

  

🚀 Installation et Démarrage
----------------------------

 Prérequis

   Node.js 20+
   Docker & Docker Compose (pour Qdrant)
   Un Token [Hugging Face](https://huggingface.co/settings/tokens) (Gratuit)

 1\. Installation des dépendances

    npm install
    

 2\. Configuration (.env)

Copiez le fichier d'exemple et remplissez-le :

    cp .env.example .env
    

Variables requises :

    PORT=3001
    NODEENV=development
    APIKEY=votreclesecreteinterne  Pour protéger l'API
    HFACCESSTOKEN=hfxxxxxxxxxxxx    Votre token Hugging Face
    QDRANTURL=http://localhost:6333   URL locale de Qdrant
    APICOREURL=http://localhost:3000  URL de l'API Catalogue (pour les tools)
    

 3\. Lancement de l'infrastructure locale

Démarrez Qdrant via Docker :

    docker-compose up -d
    

 4\. Initialisation des données (Seed)

Chargez la FAQ initiale dans la base vectorielle :

    npx ts-node-esm scripts/seed-faq.ts
    

 5\. Démarrage du serveur

En mode développement (avec hot-reload) :

    npm run dev
    

  

🔌 Documentation API
--------------------

 1\. Chat (RAG)

POST /chat  
Endpoint principal pour converser avec l'assistant.

   Auth: x-api-key header requis.

    // Request
    {
      "message": "Quels sont les délais de livraison ?",
      "sessionId": "optional-uuid"
    }
    
    // Response
    {
      "answer": "Les délais sont de 3 à 5 jours ouvrés...",
      "sources": [ { "title": "livraison", "text": "..." } ]
    }
    

 2\. Ingestion de documents

POST /ingest  
Permet d'indexer de nouveaux documents (FAQ ou descriptions produits) dans Qdrant.

    {
      "documents": [
        {
          "content": "Texte à indexer",
          "metadata": { "topic": "retour", "id": "123" }
        }
      ]
    }
    

 3\. Observabilité

   GET /health : Vérification de l'état du service (Liveness/Readiness).
   GET /metrics : Métriques Prometheus (Durée requêtes, erreurs, etc.).

  

✅ État d'avancement (Sprint Actuel)
-----------------------------------

Voici les fonctionnalités implémentées à ce jour :

    Setup du projet : Configuration TypeScript, Fastify, ESLint, Jest.
    Pipeline RAG :
        Client Hugging Face pour la génération de texte.
        Client Embeddings pour la vectorisation.
        Recherche de contexte pertinent dans Qdrant.
    Pipeline d'Ingestion : Script de seed et endpoint API pour charger la FAQ.
    Infrastructure Tools : Architecture prête pour le "Tool Calling" (recherche produit).
    Sécurité & Config : Middleware d'authentification par API Key et validation Zod.
    Observabilité : Logs structurés JSON et endpoint métriques Prometheus.
    Tests : Configuration Jest et mocks des services externes.

  

🚧 Roadmap & Reste à faire
--------------------------

Les points suivants sont prévus pour les prochains sprints afin de finaliser le service :

 1\. Intégration Réelle avec le Catalogue (Tooling)

   Actuellement : Le ProductSearchTool retourne des données mockées.
   À faire : Connecter le tool à l'API Core (shopyverse-api-core) via des requêtes HTTP réelles pour chercher les produits en stock.

 2\. Gestion de la Mémoire (Session)

   Actuellement : Chaque message est traité indépendamment (Stateless).
   À faire : Stocker l'historique de conversation (Redis ou Postgres) pour permettre le suivi du contexte (ex: "Et en rouge ?" après une recherche de chaussures).

 3\. Amélioration du RAG

   Prompt Engineering : Affiner le prompt système pour éviter les hallucinations.
   Guardrails : Ajouter une couche de modération pour bloquer les sujets hors-sujet ou inappropriés.

 4\. Déploiement & CI/CD

   Finaliser le Dockerfile de production (Multi-stage build).
   Créer les manifests Kubernetes (Deployment, Service, ConfigMap).
   Activer le pipeline CI/CD complet (Build -> Push Registry -> Deploy Staging).

  

🧪 Tests
--------

Lancer la suite de tests unitaires :

npm run test

Note : Les tests utilisent des mocks pour Qdrant et Hugging Face afin de s'exécuter sans connexion réseau.
