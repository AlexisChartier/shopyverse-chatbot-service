export type Intent = "FAQ" | "PRODUCT_SEARCH" | "OTHER";

export class IntentDetector {
  detect(message: string): Intent {
    const text = message.toLowerCase();

    // Keywords FAQ (logistique, retours, livraison, commandes...)
    const faqKeywords = [
      "livraison",
      "délais",
      "délai",
      "retour",
      "retours",
      "remboursement",
      "remboursé",
      "commande",
      "colis",
      "expédition",
      "expédier",
      "suivi",
      "track",
      "tracking",
      "annuler ma commande",
      "annulation"
    ];

    if (faqKeywords.some((kw) => text.includes(kw))) {
      return "FAQ";
    }

    // Keywords recherche produit
    const productKeywords = [
      "je cherche",
      "je recherche",
      "je voudrais",
      "je veux",
      "trouver",
      "recherche",
      "produit",
      "article",
      "t-shirt",
      "chaussure",
      "chaussures",
      "pantalon",
      "montre",
      "sac",
      "casquette"
    ];

    if (productKeywords.some((kw) => text.includes(kw))) {
      return "PRODUCT_SEARCH";
    }

    // Sinon → autre
    return "OTHER";
  }
}

export const intentDetector = new IntentDetector();