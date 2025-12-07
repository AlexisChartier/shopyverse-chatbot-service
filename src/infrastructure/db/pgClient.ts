import { Pool } from "pg";
import { config } from "../config/env.js";
import { logger } from "../observability/logger.js";

/**
 * PostgreSQL connection pool for simple queries
 * Replaces TypeORM for minimal, direct SQL operations
 */

let pool: Pool | null = null;

/**
 * Create chat_interactions table if it doesn't exist
 */
async function initializeSchema(p: Pool): Promise<void> {
  try {
    await p.query(`
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
    `);
    
    logger.info("✅ Database schema initialized (chat_interactions table ready)");
  } catch (err) {
    logger.error({ err }, "❌ Failed to initialize database schema");
    throw err;
  }
}

/**
 * Initialize the PostgreSQL connection pool
 */
export async function initDb(): Promise<Pool> {
  if (pool) {
    return pool;
  }

  pool = new Pool({
    connectionString: config.CHATBOT_DB_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on("error", (err: unknown) => {
    logger.error({ err }, "❌ Unexpected error in PostgreSQL pool");
  });

  logger.info("✅ PostgreSQL connection pool initialized");

  // Initialize schema (create tables if they don't exist)
  await initializeSchema(pool);

  return pool;
}

/**
 * Get the current pool instance
 */
export function getDb(): Pool {
  if (!pool) {
    throw new Error("Database pool not initialized. Call initDb() first.");
  }
  return pool;
}

/**
 * Execute a query against PostgreSQL
 * @param text SQL query string
 * @param params Query parameters for parameterized queries
 * @returns Query result
 */
export async function query(text: string, params?: unknown[]) {
  const db = getDb();
  try {
    const result = await db.query(text, params);
    return result;
  } catch (err) {
    logger.error({ err, text, params }, "❌ Database query error");
    throw err;
  }
}

/**
 * Close the connection pool (call on shutdown)
 */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info("✅ PostgreSQL connection pool closed");
  }
}

export const db = {
  query,
  initDb,
  getDb,
  closeDb,
};
