import type { Tool } from '../../domain/types.js';
import { config } from '../config/env.js';

export class ProductSearchTool implements Tool {
  name = 'search_product';
  description = 'Rechercher un produit dans le catalogue par nom ou description.';

  async execute(args: { query: string }) {
    // Appel à l'API Core (shopyverse-api-core)
    // Dans un vrai cas, utilisez fetch ou axios
    console.log(`[Tool] Recherche produit: ${args.query} vers ${config.API_CORE_URL}`);
    
    // Simulation pour le TP
    return [
      { id: 1, name: "T-Shirt Rouge", price: 19.99 },
      { id: 2, name: "Baskets Rouges", price: 59.99 }
    ];
  }
}