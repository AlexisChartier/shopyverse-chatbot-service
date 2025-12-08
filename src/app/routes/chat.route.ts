import type { FastifyInstance } from "fastify";
import { chatService } from "../../application/chat/handleChat.js";

export async function chatRoute(fastify: FastifyInstance) {
  fastify.post("/chat", async (request, reply) => {
    const body = request.body as { message: string; sessionId?: string };

    if (!body.message) {
      return reply.code(400).send({ error: "Le champ 'message' est requis." });
    }

    try {
      const { message, sessionId } = body;
      const response = await chatService.processMessage(
        message,
        sessionId,
        request.id as string,
        request.log
      );
      return reply.send(response);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: "Une erreur est survenue lors du traitement." });
    }
  });
}