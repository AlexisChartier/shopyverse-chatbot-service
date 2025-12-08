import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../../infrastructure/config/env.js';

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const apiKey = request.headers['x-api-key'];

  if (apiKey !== config.API_KEY) {
    return reply.code(401).send({ error: 'Unauthorized: Invalid API Key' });
  }
}