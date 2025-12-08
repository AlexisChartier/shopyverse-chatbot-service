import type { FastifyInstance } from "fastify";
import { chatLogRepository } from "../../infrastructure/db/repositories/ChatLogRepository.js";
import { faqRepository, type FaqItem } from "../../infrastructure/db/repositories/FaqRepository.js";
import { faqSyncService } from "../../infrastructure/sync/FaqSyncService.js";
import { logger } from "../../infrastructure/observability/logger.js";

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

  // ==================== FAQ MANAGEMENT ====================

  /**
   * GET /api/v1/admin/faq - List all FAQs
   */
  fastify.get("/faq", async (req, reply) => {
    try {
      const faqs = await faqRepository.getAll();
      return reply.send({ faqs });
    } catch (err) {
      logger.error({ err }, "Failed to fetch FAQs");
      return reply.code(500).send({ error: "Failed to fetch FAQs" });
    }
  });

  /**
   * GET /api/v1/admin/faq/categories - Get all categories
   */
  fastify.get("/faq/categories", async (req, reply) => {
    try {
      const categories = await faqRepository.getCategories();
      return reply.send({ categories });
    } catch (err) {
      logger.error({ err }, "Failed to fetch categories");
      return reply.code(500).send({ error: "Failed to fetch categories" });
    }
  });

  /**
   * GET /api/v1/admin/faq/:id - Get a specific FAQ
   */
  fastify.get("/faq/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    try {
      const faq = await faqRepository.getById(parseInt(id, 10));
      if (!faq) {
        return reply.code(404).send({ error: "FAQ not found" });
      }
      return reply.send({ faq });
    } catch (err) {
      logger.error({ err, id }, "Failed to fetch FAQ");
      return reply.code(500).send({ error: "Failed to fetch FAQ" });
    }
  });

  /**
   * GET /api/v1/admin/faq/category/:category - Get FAQs by category
   */
  fastify.get("/faq/category/:category", async (req, reply) => {
    const { category } = req.params as { category: string };

    try {
      const faqs = await faqRepository.getByCategory(category);
      return reply.send({ category, faqs });
    } catch (err) {
      logger.error({ err, category }, "Failed to fetch FAQs by category");
      return reply.code(500).send({ error: "Failed to fetch FAQs by category" });
    }
  });

  /**
   * POST /api/v1/admin/faq - Create a new FAQ
   */
  fastify.post("/faq", async (req, reply) => {
    const { title, content, category, tags } = req.body as {
      title?: string;
      content?: string;
      category?: string;
      tags?: string[];
    };

    // Validation
    if (!title || !content) {
      return reply.code(400).send({ error: "title and content are required" });
    }

    try {
      const newFaq = await faqRepository.create({
        title,
        content,
        category: category || "general",
        tags: tags || [],
        isActive: true,
      });

      // Sync to Qdrant
      await faqSyncService.syncFaqToQdrant(newFaq);

      logger.info({ id: newFaq.id, title }, "FAQ created and synced to Qdrant");
      return reply.code(201).send({ faq: newFaq });
    } catch (err) {
      logger.error({ err, title }, "Failed to create FAQ");
      return reply.code(500).send({ error: "Failed to create FAQ" });
    }
  });

  /**
   * PUT /api/v1/admin/faq/:id - Update a FAQ
   */
  fastify.put("/faq/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { title, content, category, tags } = req.body as {
      title?: string;
      content?: string;
      category?: string;
      tags?: string[];
    };

    try {
      const updates: Partial<FaqItem> = {};
      if (title !== undefined) updates.title = title;
      if (content !== undefined) updates.content = content;
      if (category !== undefined) updates.category = category;
      if (tags !== undefined) updates.tags = tags;

      const updatedFaq = await faqRepository.update(parseInt(id, 10), updates);

      // Sync to Qdrant
      await faqSyncService.syncFaqToQdrant(updatedFaq);

      logger.info({ id: updatedFaq.id, title: updatedFaq.title }, "FAQ updated and synced to Qdrant");
      return reply.send({ faq: updatedFaq });
    } catch (err) {
      logger.error({ err, id }, "Failed to update FAQ");
      return reply.code(500).send({ error: "Failed to update FAQ" });
    }
  });

  /**
   * DELETE /api/v1/admin/faq/:id - Delete a FAQ
   */
  fastify.delete("/faq/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    try {
      const faqId = parseInt(id, 10);
      await faqRepository.delete(faqId);

      // Remove from Qdrant
      await faqSyncService.removeFaqFromQdrant(faqId);

      logger.info({ id: faqId }, "FAQ deleted and removed from Qdrant");
      return reply.send({ message: `FAQ ${faqId} deleted successfully` });
    } catch (err) {
      logger.error({ err, id }, "Failed to delete FAQ");
      return reply.code(500).send({ error: "Failed to delete FAQ" });
    }
  });

  /**
   * POST /api/v1/admin/faq/sync - Sync all FAQs to Qdrant (manual trigger)
   */
  fastify.post("/faq/sync", async (req, reply) => {
    try {
      logger.info("Triggering manual FAQ sync to Qdrant...");
      await faqSyncService.syncAllFaqsToQdrant();
      return reply.send({ message: "FAQ sync to Qdrant completed" });
    } catch (err) {
      logger.error({ err }, "Failed to sync FAQs to Qdrant");
      return reply.code(500).send({ error: "Failed to sync FAQs to Qdrant" });
    }
  });
}