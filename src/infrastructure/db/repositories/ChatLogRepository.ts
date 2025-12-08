import { db } from "../pgClient.js";
import type { Intent } from "../../../nlu/intentDetector.js";
import { logger } from "../../observability/logger.js";

/**
 * Interface for chat interaction log entry
 */
export interface ChatInteractionLog {
  sessionId: string;
  intent: Intent;
  userMessage: string;
  assistantAnswer: string;
  hasFallback: boolean;
}

/**
 * Repository for chat interaction persistence
 * Directly uses pg without TypeORM for simplicity
 */
export class ChatLogRepository {
  /**
   * Log a chat interaction to the database
   * @param log Chat interaction data to persist
   */
  async log(log: ChatInteractionLog): Promise<void> {
    const query = `
      INSERT INTO chat_interactions 
        (session_id, intent, user_message, assistant_answer, has_fallback)
      VALUES 
        ($1, $2, $3, $4, $5)
      RETURNING id;
    `;

    const params = [
      log.sessionId,
      log.intent,
      log.userMessage,
      log.assistantAnswer,
      log.hasFallback,
    ];

    try {
      const result = await db.query(query, params);
      const insertedId = result.rows[0]?.id;
      logger.debug(
        { insertedId, sessionId: log.sessionId, intent: log.intent },
        "✅ Chat interaction logged"
      );
    } catch (err) {
      logger.error(
        { err, sessionId: log.sessionId, intent: log.intent },
        "❌ Failed to log chat interaction"
      );
      throw err;
    }
  }

  /**
   * Retrieve chat interactions for a given session (for future dashboard)
   * @param sessionId Session identifier
   * @returns Array of chat interactions
   */
  async getBySessionId(sessionId: string): Promise<ChatInteractionLog[]> {
    const query = `
        SELECT 
            session_id as "sessionId",
            intent,
            user_message as "userMessage",
            assistant_answer as "assistantAnswer",
            has_fallback as "hasFallback",
            created_at as "timestamp"
        FROM chat_interactions
        WHERE session_id = $1
        ORDER BY created_at ASC;
        `;

    try {
        const result = await db.query(query, [sessionId]);
        return result.rows as ChatInteractionLog[];
    } catch (err) {
        logger.error({ err, sessionId }, "❌ Failed to retrieve session logs");
        throw err;
    }
}

  /**
   * Get statistics about chat interactions (for dashboard)
   * @returns Statistics object with counts by intent
   */
  async getStats(): Promise<{
    totalInteractions: number;
    byIntent: Record<Intent, number>;
    fallbackCount: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total,
        intent,
        SUM(CASE WHEN has_fallback THEN 1 ELSE 0 END) as fallback_count
      FROM chat_interactions
      GROUP BY intent
      ORDER BY intent;
    `;

    try {
      const result = await db.query(query);
      
      const stats = {
        totalInteractions: 0,
        byIntent: { FAQ: 0, PRODUCT_SEARCH: 0, OTHER: 0 } as Record<Intent, number>,
        fallbackCount: 0,
      };

      for (const row of result.rows) {
        const count = parseInt(row.total, 10);
        stats.totalInteractions += count;
        stats.byIntent[row.intent as Intent] = count;
        stats.fallbackCount += parseInt(row.fallback_count || 0, 10);
      }

      return stats;
    } catch (err) {
      logger.error({ err }, "❌ Failed to retrieve chat statistics");
      throw err;
    }
  }
  /**
   * Get all distinct session IDs
   */
  async getAllSessions(): Promise<string[]> {
    const query = `
      SELECT DISTINCT session_id 
      FROM chat_interactions
      ORDER BY session_id DESC;
    `;

    try {
      const result = await db.query(query);
      return result.rows.map(r => r.session_id);
    } catch (err) {
      logger.error({ err }, "❌ Failed to fetch sessions");
      throw err;
    }
  }
  /**
   * Delete all interactions for a given session
   * @returns number of deleted rows
   */
  async deleteBySessionId(sessionId: string): Promise<number> {
    const query = `
      DELETE FROM chat_interactions
      WHERE session_id = $1;
    `;

    try {
      const result = await db.query(query, [sessionId]);
      return result.rowCount ?? 0;
    } catch (err) {
      logger.error({ err, sessionId }, "❌ Failed to delete session logs");
      throw err;
    }
  }

  /**
   * Purge all chat interactions (⚠️ irreversible)
   */
  async purgeAll(): Promise<void> {
    const query = `TRUNCATE TABLE chat_interactions;`;

    try {
      await db.query(query);
      logger.warn("⚠️ All chat_interactions have been purged");
    } catch (err) {
      logger.error({ err }, "❌ Failed to purge all chat interactions");
      throw err;
    }
  }
}

/**
 * Singleton instance of ChatLogRepository
 */
export const chatLogRepository = new ChatLogRepository();