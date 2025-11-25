import 'dotenv/config'; // Charge les variables d'env
import { ingestionService } from '../src/application/ingestion/ingestDocument.js';
const faqData = [
  {
    content: "Les délais de livraison sont de 3 à 5 jours ouvrés en France métropolitaine.",
    metadata: { type: "faq", topic: "livraison" }
  },
  {
    content: "Les retours sont gratuits sous 30 jours si le produit n'a pas été porté.",
    metadata: { type: "faq", topic: "retours" }
  },
  {
    content: "Nous acceptons les paiements par carte bancaire (Visa, Mastercard) et PayPal.",
    metadata: { type: "faq", topic: "paiement" }
  },
  {
    content: "Pour contacter le support, écrivez à support@shopyverse.com.",
    metadata: { type: "faq", topic: "contact" }
  }
];

async function run() {
  console.log("Démarrage du seed FAQ...");
  try {
    await ingestionService.ingest(faqData);
    console.log("Seed terminé avec succès !");
  } catch (error) {
    console.error("Erreur durant le seed:", error);
  }
}

run();