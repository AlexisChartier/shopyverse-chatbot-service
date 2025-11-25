// ... imports
import { authMiddleware } from './middlewares/auth.js';
import { metricsRoute } from './routes/metrics.route.js'; // Créez ce fichier qui appelle metricsRegistry.metrics()

// ... dans server.ts
// server.addHook('onRequest', requestContextMiddleware);
// server.addHook('onRequest', authMiddleware); // Activez si vous avez mis la clé dans le .env
// server.register(metricsRoute);