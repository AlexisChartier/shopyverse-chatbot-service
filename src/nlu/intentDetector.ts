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
      "annulation",
      "rupture",
      "rupture de stock",
      "stock",
      "disponible",
      "disponibilité",
      "garantie",
      "taille",
      "couleur",
      "prix",
      "promo",
      "promotion",
      "coupon",
      "code promo",
      "paiement",
      "payer",
      "paiements",
      "facture",
      "invoice",
      "compte",
      "inscription",
      "inscription",
      "mdp",
      "mot de passe",
      "password",
      "politique",
      "conditions",
      "cgv",
      "contact",
      "aide",
      "données",
      "données personnelles",
      "protégées",
      "protégé",
      "sécurité",
      "sécurisé",
      "rgpd",
      "vie privée",
      "confidentialité",
      "ssl",
      "cryptage",
      "chiffrement"
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

    // Par défaut → FAQ (recherche vectorielle)
    // Toutes les questions non-produit passent par la FAQ avec recherche sémantique
    return "FAQ";
  }
}

export const intentDetector = new IntentDetector();