import client from 'prom-client';

// Dedicated registry to avoid polluting global collector
export const metricsRegistry = new client.Registry();

// Collecte les métriques par défaut (CPU, Memory)
client.collectDefaultMetrics({ prefix: 'chatbot_', register: metricsRegistry });

export const httpRequestDuration = new client.Histogram({
  name: 'chatbot_http_request_duration_seconds',
  help: 'Durée des requêtes HTTP (s)',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

export const httpRequestCounter = new client.Counter({
  name: 'chatbot_http_requests_total',
  help: 'Nombre de requêtes HTTP',
  labelNames: ['method', 'route', 'status'],
  registers: [metricsRegistry],
});

export const llmRequestCounter = new client.Counter({
  name: 'chatbot_llm_requests_total',
  help: 'Nombre de requêtes LLM',
  labelNames: ['model', 'status'],
  registers: [metricsRegistry],
});

export const llmDurationSeconds = new client.Histogram({
  name: 'chatbot_llm_duration_seconds',
  help: 'Durée des requêtes LLM (s)',
  labelNames: ['model', 'status'],
  buckets: [0.1, 0.25, 0.5, 1, 2, 4, 8, 12],
  registers: [metricsRegistry],
});

export const llmPromptChars = new client.Histogram({
  name: 'chatbot_llm_prompt_chars',
  help: 'Taille du prompt envoyé au LLM (caractères)',
  labelNames: ['model'],
  buckets: [200, 500, 1000, 2000, 4000, 8000],
  registers: [metricsRegistry],
});

export const llmResponseChars = new client.Histogram({
  name: 'chatbot_llm_response_chars',
  help: 'Taille de la réponse LLM (caractères)',
  labelNames: ['model'],
  buckets: [100, 200, 500, 1000, 2000, 4000],
  registers: [metricsRegistry],
});

export const chatbotFallbackCounter = new client.Counter({
  name: 'chatbot_fallback_total',
  help: 'Nombre de réponses fallback (non résolues)',
  labelNames: ['intent', 'reason'],
  registers: [metricsRegistry],
});