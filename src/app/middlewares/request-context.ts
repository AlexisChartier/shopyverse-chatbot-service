import type { FastifyReply, FastifyRequest } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

export async function requestContextMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const requestId = (request.headers['x-request-id'] as string) || uuidv4();
  request.id = requestId; // Fastify gère l'ID de requête nativement
  reply.header('x-request-id', requestId);
}