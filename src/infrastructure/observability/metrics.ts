import client from 'prom-client';

// Collecte les métriques par défaut (CPU, Memory)
client.collectDefaultMetrics({ prefix: 'chatbot_' });

export const chatRequestDuration = new client.Histogram({
  name: 'chatbot_request_duration_seconds',
  help: 'Durée des requêtes chat en secondes',
  labelNames: ['status'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

export const chatCounter = new client.Counter({
  name: 'chatbot_requests_total',
  help: 'Nombre total de requêtes chat',
});

export const metricsRegistry = client.register;