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
  },
  {
    content: "Les produits audio (cat-audio) incluent casques, enceintes et barres de son avec 2 ans de garantie.",
    metadata: { type: "faq", topic: "catalogue", categoryId: "cat-audio" }
  },
  {
    content: "Les guides de tailles sont disponibles pour la catégorie mode (cat-mode) directement sur les fiches produit.",
    metadata: { type: "faq", topic: "tailles", categoryId: "cat-mode" }
  },
  {
    content: "Pour les commandes supérieures à 150€, la livraison est offerte en France.",
    metadata: { type: "faq", topic: "livraison", threshold: 150 }
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