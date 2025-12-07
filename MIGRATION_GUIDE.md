# TypeORM Removal & PostgreSQL Migration Guide

## Summary of Changes

This document describes the migration from TypeORM to a simple `pg` client solution for the ShopyVerse Chatbot Service.

---

## 1. SQL Schema

**File**: `sql/001-create-chat-interactions.sql`

Execute this script in your `chatbot_db` PostgreSQL database:

```sql
CREATE TABLE IF NOT EXISTS chat_interactions (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  intent TEXT NOT NULL CHECK (intent IN ('FAQ', 'PRODUCT_SEARCH', 'OTHER')),
  user_message TEXT NOT NULL,
  assistant_answer TEXT NOT NULL,
  has_fallback BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_intent CHECK (intent IN ('FAQ', 'PRODUCT_SEARCH', 'OTHER'))
);

CREATE INDEX IF NOT EXISTS idx_chat_interactions_session_id 
  ON chat_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_interactions_intent 
  ON chat_interactions(intent);
CREATE INDEX IF NOT EXISTS idx_chat_interactions_created_at 
  ON chat_interactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_interactions_intent_created 
  ON chat_interactions(intent, created_at DESC);
```

---

## 2. New Files Created

### `src/infrastructure/db/pgClient.ts`

Simple PostgreSQL connection pool wrapper using `pg` library. Provides:
- `initDb()` - Initialize connection pool
- `query(text, params?)` - Execute parameterized queries
- `closeDb()` - Gracefully close pool

**Key features:**
- Singleton pool with max 10 connections
- Error logging via Pino
- Graceful connection handling

### `src/infrastructure/db/repositories/ChatLogRepository.ts`

Repository for persisting chat interactions without TypeORM. Provides:
- `log(ChatInteractionLog)` - Insert interaction into database
- `getBySessionId(sessionId)` - Retrieve session history
- `getStats()` - Get interaction statistics by intent

---

## 3. Files to Delete/Modify

### ❌ DELETE These Files:

1. **`src/infrastructure/db/ormconfig.ts`**
   - TypeORM data source configuration
   - No longer needed with simple pg client

2. **`src/infrastructure/db/entities/ChatInteraction.entity.ts`**
   - TypeORM entity definition
   - Replaced by plain SQL schema

### ⚠️ MODIFY These Files:

1. **`src/app/server.ts`**
   
   **REMOVE:**
   ```typescript
   import { AppDataSource } from "../infrastructure/db/ormconfig.js";
   import "reflect-metadata";
   
   // This initialization block:
   await AppDataSource.initialize()
     .then(() => console.log("📦 Database connected"))
     .catch((err) => console.error("❌ Database connection error:", err));
   ```

   **ADD:**
   ```typescript
   import { db } from '../infrastructure/db/pgClient.js';
   
   // Initialize PostgreSQL connection pool
   try {
     db.initDb();
     console.log("📦 Database connected");
   } catch (err) {
     console.error("❌ Database connection error:", err);
     process.exit(1);
   }
   
   // Add graceful shutdown
   process.on('SIGINT', async () => {
     console.log('\n🛑 Shutting down gracefully...');
     await db.closeDb();
     await server.close();
     process.exit(0);
   });
   
   process.on('SIGTERM', async () => {
     console.log('\n🛑 Shutting down gracefully...');
     await db.closeDb();
     await server.close();
     process.exit(0);
   });
   ```

2. **`package.json`**
   
   **REMOVE (if not used elsewhere):**
   ```json
   "typeorm": "^0.3.x",
   "reflect-metadata": "^0.1.x"
   ```

   **ENSURE these are present:**
   ```json
   "pg": "^8.x",
   "@types/pg": "^8.x"
   ```

---

## 4. Dependencies to Install

```bash
# Install pg and its types
npm install pg @types/pg

# Remove TypeORM if not used elsewhere
npm uninstall typeorm reflect-metadata
```

---

## 5. ChatService Compatibility

The `ChatService` in `src/application/chat/handleChat.ts` already calls `chatLogRepository.log(...)` in three scenarios:

1. **FAQ with no sources** (fallback) ✅
   ```typescript
   await chatLogRepository.log({
     sessionId,
     intent,
     userMessage,
     assistantAnswer: answer,
     hasFallback: true,
   });
   ```

2. **FAQ with low score** (fallback) ✅
   ```typescript
   await chatLogRepository.log({
     sessionId,
     intent,
     userMessage,
     assistantAnswer: answer,
     hasFallback: true,
   });
   ```

3. **FAQ with good results** (normal) ✅
   ```typescript
   await chatLogRepository.log({
     sessionId,
     intent,
     userMessage,
     assistantAnswer: answer,
     hasFallback: false,
   });
   ```

4. **PRODUCT_SEARCH with no results** (fallback) ✅
   ```typescript
   await chatLogRepository.log({
     sessionId,
     intent,
     userMessage,
     assistantAnswer: answer,
     hasFallback: true,
   });
   ```

5. **PRODUCT_SEARCH with results** (normal) ✅
   ```typescript
   await chatLogRepository.log({
     sessionId,
     intent,
     userMessage,
     assistantAnswer: answer,
     hasFallback: false,
   });
   ```

6. **OTHER intent** (fallback) ✅
   ```typescript
   await chatLogRepository.log({
     sessionId,
     intent,
     userMessage,
     assistantAnswer: answer,
     hasFallback: true,
   });
   ```

**No changes needed to `handleChat.ts`** — the new repository API is fully compatible.

---

## 6. Testing Checklist

### Prerequisites
```bash
# Ensure Docker Compose services are running
docker compose up -d

# Create the database schema
psql -h localhost -p 5433 -U chatbot -d chatbot_db < sql/001-create-chat-interactions.sql

# Install dependencies
npm install

# Start the service
npm run dev
```

### Test 1: FAQ Question (should log with hasFallback=false)
```bash
curl -X POST http://localhost:3001/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-api-key" \
  -d '{"message": "Quels sont vos délais de livraison ?"}'
```

### Test 2: Product Search (should log with hasFallback=false if products found)
```bash
curl -X POST http://localhost:3001/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-api-key" \
  -d '{"message": "Je cherche un t-shirt ShopyVerse pour homme."}'
```

### Test 3: Out-of-Scope Question (should log with hasFallback=true, intent=OTHER)
```bash
curl -X POST http://localhost:3001/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-api-key" \
  -d '{"message": "Explique-moi la relativité générale."}'
```

### Verify Logs in PostgreSQL

```bash
# Connect to the database
psql -h localhost -p 5433 -U chatbot -d chatbot_db

# View all interactions
SELECT id, session_id, intent, has_fallback, created_at 
FROM chat_interactions 
ORDER BY created_at DESC;

# View interactions by intent
SELECT intent, COUNT(*) as count, SUM(CASE WHEN has_fallback THEN 1 ELSE 0 END) as fallback_count
FROM chat_interactions
GROUP BY intent;

# View a specific session
SELECT session_id, intent, user_message, assistant_answer, has_fallback 
FROM chat_interactions 
WHERE session_id = 'YOUR_SESSION_ID'
ORDER BY created_at ASC;
```

### Expected Results

**After running all 3 tests**, the database should show:
- ✅ At least 1 FAQ interaction (intent='FAQ', hasFallback=false or true depending on sources)
- ✅ At least 1 PRODUCT_SEARCH interaction (intent='PRODUCT_SEARCH')
- ✅ At least 1 OTHER interaction (intent='OTHER', hasFallback=true always)
- ✅ Timestamps incrementing (created_at)
- ✅ All sessions properly recorded

---

## 7. Rollback Plan

If you need to revert to TypeORM:

1. Restore deleted files from git:
   ```bash
   git restore src/infrastructure/db/ormconfig.ts
   git restore src/infrastructure/db/entities/ChatInteraction.entity.ts
   ```

2. Revert `src/app/server.ts` to use `AppDataSource.initialize()`

3. Restore old `ChatLogRepository` version from git

4. Reinstall TypeORM:
   ```bash
   npm install typeorm reflect-metadata
   ```

---

## 8. Future Enhancements

The new repository supports additional methods for the dashboard:

- **`getBySessionId(sessionId)`** - Retrieve full conversation history
- **`getStats()`** - Get summary stats by intent and fallback rate

Example dashboard query:
```typescript
const stats = await chatLogRepository.getStats();
console.log(stats);
// Output:
// {
//   totalInteractions: 15,
//   byIntent: { FAQ: 8, PRODUCT_SEARCH: 5, OTHER: 2 },
//   fallbackCount: 4
// }
```

---

## 9. Environment Variables

Ensure `CHATBOT_DB_URL` is set correctly:

**Local (host machine):**
```
CHATBOT_DB_URL=postgres://chatbot:chatbot@localhost:5433/chatbot_db
```

**Docker Compose (from container):**
```
CHATBOT_DB_URL=postgres://chatbot:chatbot@postgres:5432/chatbot_db
```

---

## 10. Migration Complete ✅

You've successfully migrated from TypeORM to a lightweight `pg` solution:
- ✅ Simple, direct SQL via `pg`
- ✅ No ORM complexity or metadata issues
- ✅ Fully typed with TypeScript
- ✅ Ready for dashboard integration
- ✅ Graceful error handling and logging
- ✅ Proper connection pool management
