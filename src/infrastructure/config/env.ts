import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  // Node env
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  
  // Sécurité
  API_KEY: z.string().min(1, "API_KEY est requise pour sécuriser le service"),
  
  // IA & Vector Store
  QDRANT_URL: z.string().url(),
  QDRANT_API_KEY: z.string().optional(),
  HF_ACCESS_TOKEN: z.string().min(1, "HF_ACCESS_TOKEN est requis"),
  
  // API Core (pour les outils)
  API_CORE_URL: z.string().url().default('http://localhost:3000'),

  // Model (optional override)
  HF_MODEL: z.string().optional(),
});

// Validation
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variables d\'environnement invalides :', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;