# BGE Reranker Integration - FAQ Pipeline

## Overview

A BGE (BAAI General Embeddings) reranker has been added to the FAQ pipeline to improve context selection quality. The reranker scores query-document pairs and selects the most relevant passages before sending them to the LLM.

## Architecture

```
User Query
    ↓
Qdrant Vector Search (embedding-based, fast retrieval)
    ↓
Top-5 candidates retrieved
    ↓
[NEW] BGE Reranker (semantic relevance scoring)
    ↓
Top-3 reranked candidates selected
    ↓
LLM (generate answer with best context)
    ↓
Response + Sources
```

## Changes Made

### 1. New File: `src/infrastructure/llm/BgeReranker.ts`

- **Model**: `BAAI/bge-reranker-v2-m3` (via HuggingFace Inference API)
- **Method**: `rerank(query, documents, topK)` - scores query-document pairs and returns top-K sorted by relevance
- **Graceful Fallback**: If reranking fails, returns original documents in order
- **Logging**: Debug logs for tracking reranker performance

### 2. Modified: `src/application/chat/handleChat.ts`

**Only the FAQ handler (`handleFaq` method) is affected:**

- Added import: `import { bgeReranker } from "../../infrastructure/llm/BgeReranker.js"`
- Integrated reranking after vector search, before LLM call:
  1. Retrieves top-5 candidates from Qdrant (unchanged)
  2. **NEW**: Reranks them using BGE to select top-3 most relevant
  3. Builds LLM context from reranked results
  4. Generates answer with improved context

**Unchanged:**
- PRODUCT_SEARCH handler (no reranking)
- OTHER handler (no reranking)
- Session management
- Logging
- Fallback logic

## Usage

No configuration needed - reranker is automatically applied to all FAQ queries.

### Example Flow

```bash
# User asks a question
curl -X POST http://localhost:3001/api/v1/chat \
  -H "x-api-key: dev-api-key" \
  -d '{"message": "Quels sont vos délais de livraison ?"}'

# Logs show:
# 1. Intent detected: FAQ
# 2. Qdrant retrieval: 5 candidates
# 3. BGE reranker applied: 3 top candidates selected
# 4. LLM generates answer with reranked context
```

## Performance Considerations

- **Latency**: ~200-400ms additional for reranking 3-5 documents (per query)
- **Cost**: Uses HuggingFace Inference API (same as embeddings client)
- **Quality**: Improves FAQ relevance, especially for ambiguous queries

## Graceful Degradation

If the reranker API is unavailable:
- Logs error but continues
- Falls back to original embedding-based ranking
- FAQ pipeline still works without reranker

## Testing

```bash
# Test 1: FAQ with good match
curl -X POST http://localhost:3001/api/v1/chat \
  -H "x-api-key: dev-api-key" \
  -d '{"message": "Quels sont vos délais de livraison ?"}'

# Test 2: Verify reranker in logs
npm run dev  # Watch console for "BGE Reranker" messages

# Test 3: Product search (unchanged, no reranking)
curl -X POST http://localhost:3001/api/v1/chat \
  -H "x-api-key: dev-api-key" \
  -d '{"message": "Je cherche un t-shirt ShopyVerse"}'
```

## No Other Changes

✅ Product search pipeline - UNCHANGED
✅ Session management - UNCHANGED  
✅ Logging - UNCHANGED
✅ LLM inference - UNCHANGED (just receives better context)
✅ Intent detection - UNCHANGED
✅ Database - UNCHANGED

## Rollback

To remove the reranker, simply:
1. Delete `src/infrastructure/llm/BgeReranker.ts`
2. Remove the import from `handleChat.ts`
3. Replace the FAQ handler with the original code (use git history)
