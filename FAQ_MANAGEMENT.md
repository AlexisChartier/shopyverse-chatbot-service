# FAQ Management System

## Overview

Ce système permet de gérer dynamiquement les FAQs de ShopyVerse depuis un admin panel React. Les FAQs sont :
- Stockées dans PostgreSQL
- Synchronisées automatiquement vers Qdrant pour la recherche sémantique
- Accessibles via une API REST protégée par clé API

## Architecture

```
Frontend (React)
    ↓
FaqManager Component
    ↓ (HTTP requests)
Backend Admin API
    ↓
PostgreSQL (faq_items table)
    ↓ (sync on create/update/delete)
Qdrant (vector store for semantic search)
    ↓
Chat Service (uses embeddings for FAQ retrieval)
```

## Database Schema

### faq_items table

```sql
CREATE TABLE faq_items (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  tags TEXT[] NOT NULL DEFAULT '{}',
  embedding_vector TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Colonnes** :
- `id` : Identificateur unique
- `title` : Titre de la FAQ
- `content` : Contenu complet (sera embedé dans Qdrant)
- `category` : Catégorie (e.g., "shipping", "returns", "payments")
- `tags` : Array de tags pour organisation
- `is_active` : Soft delete flag
- `created_at`, `updated_at` : Timestamps

## API Endpoints

Tous les endpoints sont protégés par le header `x-api-key`.

### GET /api/v1/admin/faq
Récupère toutes les FAQs actives

**Response** :
```json
{
  "faqs": [
    {
      "id": 1,
      "title": "Que faire en cas de rupture de stock ?",
      "content": "Si un produit est en rupture...",
      "category": "stock",
      "tags": ["rupture", "disponibilité"],
      "isActive": true
    }
  ]
}
```

### GET /api/v1/admin/faq/:id
Récupère une FAQ spécifique

**Response** :
```json
{
  "faq": {
    "id": 1,
    "title": "...",
    "content": "...",
    "category": "...",
    "tags": ["..."],
    "isActive": true
  }
}
```

### GET /api/v1/admin/faq/categories
Récupère toutes les catégories utilisées

**Response** :
```json
{
  "categories": ["general", "shipping", "returns", "payments", "stock"]
}
```

### GET /api/v1/admin/faq/category/:category
Récupère toutes les FAQs d'une catégorie

**Response** :
```json
{
  "category": "shipping",
  "faqs": [...]
}
```

### POST /api/v1/admin/faq
Crée une nouvelle FAQ et la synchonise automatiquement à Qdrant

**Request** :
```json
{
  "title": "Que faire en cas de rupture de stock ?",
  "content": "Si un produit est en rupture de stock...",
  "category": "stock",
  "tags": ["rupture", "disponibilité"]
}
```

**Response** :
```json
{
  "faq": {
    "id": 42,
    "title": "...",
    "content": "...",
    "category": "...",
    "tags": ["..."],
    "isActive": true
  }
}
```

### PUT /api/v1/admin/faq/:id
Met à jour une FAQ et la resynchronise à Qdrant

**Request** :
```json
{
  "title": "New title",
  "content": "Updated content",
  "tags": ["new", "tags"]
}
```

### DELETE /api/v1/admin/faq/:id
Supprime une FAQ (soft delete) et la retire de Qdrant

**Response** :
```json
{
  "message": "FAQ 42 deleted successfully"
}
```

### POST /api/v1/admin/faq/sync
Synchronise toutes les FAQs vers Qdrant (utile en cas de migration)

**Response** :
```json
{
  "message": "FAQ sync to Qdrant completed"
}
```

## Frontend Integration

### Utilisation du composant FaqManager

```tsx
import React from "react";
import { FaqManager } from "./FaqManager";

export function AdminPanel() {
  return (
    <FaqManager 
      apiBaseUrl="http://localhost:3001/api/v1/admin"
      apiKey="dev-api-key"
    />
  );
}
```

### Ou créer un hook personnalisé

```tsx
import { useState, useCallback } from "react";

export function useFaqApi(apiBaseUrl: string, apiKey: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createFaq = useCallback(
    async (faq: { title: string; content: string; category: string; tags: string[] }) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiBaseUrl}/faq`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify(faq),
        });
        if (!response.ok) throw new Error("Failed to create FAQ");
        return await response.json();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl, apiKey]
  );

  const updateFaq = useCallback(
    async (id: number, updates: Partial<any>) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiBaseUrl}/faq/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify(updates),
        });
        if (!response.ok) throw new Error("Failed to update FAQ");
        return await response.json();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl, apiKey]
  );

  const deleteFaq = useCallback(
    async (id: number) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiBaseUrl}/faq/${id}`, {
          method: "DELETE",
          headers: { "x-api-key": apiKey },
        });
        if (!response.ok) throw new Error("Failed to delete FAQ");
        return await response.json();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl, apiKey]
  );

  return { createFaq, updateFaq, deleteFaq, loading, error };
}
```

## Workflow complet

### 1. Créer une FAQ depuis le front

```tsx
const { createFaq } = useFaqApi(apiBaseUrl, apiKey);

await createFaq({
  title: "Comment retourner un produit ?",
  content: "Pour retourner un produit, vous devez...",
  category: "returns",
  tags: ["retour", "remboursement"],
});
```

**Qu'il se passe** :
1. ✅ FAQ créée en PostgreSQL
2. ✅ Embedding généré (HfEmbeddings)
3. ✅ Vecteur inséré dans Qdrant
4. ✅ Chat service récupère automatiquement cette FAQ pour les recherches

### 2. Mettre à jour une FAQ

```tsx
await updateFaq(42, {
  content: "Nouvelle explication plus détaillée...",
  tags: ["retour", "remboursement", "refund"],
});
```

**Qu'il se passe** :
1. ✅ FAQ mise à jour en PostgreSQL
2. ✅ Nouvel embedding généré
3. ✅ Vecteur dans Qdrant mis à jour
4. ✅ Chat service utilise la version mise à jour

### 3. Supprimer une FAQ

```tsx
await deleteFaq(42);
```

**Qu'il se passe** :
1. ✅ FAQ marquée comme inactive en PostgreSQL (soft delete)
2. ✅ Vecteur retiré de Qdrant
3. ✅ Chat service ne retourne plus cette FAQ

### 4. Rechercher une FAQ depuis le chat

```bash
curl -X POST http://localhost:3001/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-api-key" \
  -d '{"message": "Comment retourner un produit ?", "session_id": "sess_123"}'
```

**Qu'il se passe** :
1. ✅ Intent détecté comme "FAQ"
2. ✅ Recherche sémantique dans Qdrant (toutes les FAQs)
3. ✅ BGE Reranker appliqué aux résultats
4. ✅ LLM génère réponse à partir des FAQs sélectionnées
5. ✅ Interaction loggée en DB avec `session_id`

## Synchronisation Qdrant

### Sync automatique
À chaque création/modification/suppression d'une FAQ, la sync Qdrant est déclenchée automatiquement via `FaqSyncService`.

### Sync manuelle
En cas de problème ou de migration :

```bash
curl -X POST http://localhost:3001/api/v1/admin/faq/sync \
  -H "x-api-key: dev-api-key"
```

## Best Practices

### 1. Titres clairs et concis
✅ "Que faire en cas de rupture de stock ?"
❌ "Stock"

### 2. Contenu détaillé
Le contenu doit contenir la réponse **complète**, car c'est ce qui est embedé dans Qdrant.

✅ "En cas de rupture de stock, vous pouvez... [détails complets]"
❌ "Rupture de stock possible"

### 3. Catégories cohérentes
Utilise les mêmes catégories :
- `shipping` (livraison, délais)
- `returns` (retours, remboursements)
- `payments` (paiements, factures)
- `account` (compte, inscription)
- `products` (produits, tailles, couleurs)
- `general` (généralités)

### 4. Tags utiles
Ajoute des tags pour faciliter la recherche future :
- `rupture`, `stock`, `disponibilité`
- `retour`, `remboursement`, `refund`
- `livraison`, `délai`, `tracking`

### 5. Test après modification
Après créer/modifier une FAQ, teste-la via le chat :

```bash
curl -X POST http://localhost:3001/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-api-key" \
  -d '{"message": "votre question de test", "session_id": "test_session"}'
```

## Dépannage

### FAQ ne s'affiche pas en réponse
1. Vérifie que la FAQ est `is_active=true`
2. Lance le sync manuel : `POST /api/v1/admin/faq/sync`
3. Teste avec le chat endpoint

### Erreur "Failed to sync FAQ to Qdrant"
1. Vérifie que Qdrant est en cours d'exécution
2. Vérifie que la collection `shopyverse_docs` existe
3. Checks logs : `docker logs qdrant`

### Embedding échoue
1. Vérifie que `HF_ACCESS_TOKEN` est défini
2. Vérifie la connexion à HuggingFace API
3. Checks logs du service

## Migration depuis seed-faq.ts

Si tu utilises actuellement `scripts/seed-faq.ts`, tu peux migrer :

```bash
# 1. Exporte les FAQs de seed-faq.ts
# 2. Via le front (FaqManager), crée les mêmes FAQs
# 3. Les seront automatiquement syncées à Qdrant
# 4. Désactive l'ancien script de seed
```

Ou crée un script de migration automatique :

```typescript
import { faqRepository } from "./src/infrastructure/db/repositories/FaqRepository.js";
import { faqSyncService } from "./src/infrastructure/sync/FaqSyncService.js";

const faqs = [
  { title: "...", content: "...", category: "...", tags: [] },
  // ... ton ancien seed-faq.ts content
];

for (const faq of faqs) {
  const created = await faqRepository.create({ ...faq, isActive: true });
  await faqSyncService.syncFaqToQdrant(created);
}
```

## Sécurité

⚠️ **Important** :
- Les endpoints admin requièrent le header `x-api-key`
- En production, utilise une vraie API key (pas `dev-api-key`)
- Restreins l'accès au front React à une IP whitelist
- Chiffre les FAQs sensibles en BD si nécessaire
- Utilise HTTPS en production
