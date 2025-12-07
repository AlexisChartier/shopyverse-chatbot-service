import type { FastifyInstance } from "fastify";
import { chatLogRepository } from "../../infrastructure/db/repositories/ChatLogRepository.js";

export async function adminRoute(fastify: FastifyInstance) {

  /**
   * List all sessions
   */
  fastify.get("/chat/sessions", async (req, reply) => {
    try {
      const sessions = await chatLogRepository.getAllSessions();
      return reply.send({ sessions });
    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({ error: "Failed to fetch sessions" });
    }
  });

  /**
   * Logs for a specific session
   */
  fastify.get("/chat/logs", async (req, reply) => {
    const sessionId = (req.query as any)?.sessionId;

    if (!sessionId) {
      return reply.code(400).send({ error: "sessionId is required" });
    }

    try {
      const logs = await chatLogRepository.getBySessionId(sessionId);
      return reply.send({ sessionId, logs });
    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({ error: "Failed to fetch logs" });
    }
  });

  /**
   * Global stats
   */
  fastify.get("/chat/stats", async (req, reply) => {
    try {
      const stats = await chatLogRepository.getStats();
      return reply.send(stats);
    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({ error: "Failed to fetch stats" });
    }
  });
    /**
   * Delete logs for a specific session
   */
  fastify.delete("/chat/logs/:sessionId", async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };

    if (!sessionId) {
      return reply.code(400).send({ error: "sessionId is required" });
    }

    try {
      const deleted = await chatLogRepository.deleteBySessionId(sessionId);
      return reply.send({
        sessionId,
        deleted,
        message: `Deleted ${deleted} log(s) for session ${sessionId}`,
      });
    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({ error: "Failed to delete session logs" });
    }
  });

  /**
   * Purge ALL chat logs
   */
  fastify.delete("/chat/logs", async (req, reply) => {
    try {
      await chatLogRepository.purgeAll();
      return reply.send({
        message: "All chat interactions have been purged",
      });
    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({ error: "Failed to purge all chat logs" });
    }
  });
}