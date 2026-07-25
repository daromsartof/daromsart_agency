import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { env } from "../../lib/env";
import {
  AGENT_MODELS,
  DEFAULT_AGENT_MODEL,
  agentModelProvider,
  type AgentModelId,
  type AgentProvider,
} from "./models";

export function isProviderConfigured(provider: AgentProvider): boolean {
  switch (provider) {
    case "anthropic":
      return env.ANTHROPIC_API_KEY.length > 0;
    case "google":
      return env.GOOGLE_GENERATIVE_AI_API_KEY.length > 0;
  }
}

/** `true` si au moins un provider LLM est configuré. */
export function isAgentEnabled(): boolean {
  return isProviderConfigured("google") || isProviderConfigured("anthropic");
}

/** Modèles dont la clé provider est présente. */
export function availableAgentModels(): typeof AGENT_MODELS[number][] {
  return AGENT_MODELS.filter((m) => isProviderConfigured(m.provider));
}

/**
 * Modèle par défaut : Gemini Flash si la clé Google est là (test gratuit),
 * sinon premier modèle Anthropic dispo, sinon le défaut catalogue.
 */
export function defaultAgentModel(): AgentModelId {
  const available = availableAgentModels();
  if (available.some((m) => m.id === DEFAULT_AGENT_MODEL)) {
    return DEFAULT_AGENT_MODEL;
  }
  return available[0]?.id ?? DEFAULT_AGENT_MODEL;
}

export function isModelConfigured(modelId: AgentModelId): boolean {
  return isProviderConfigured(agentModelProvider(modelId));
}

export function resolveModel(modelId: AgentModelId): LanguageModel {
  const provider = agentModelProvider(modelId);
  if (!isProviderConfigured(provider)) {
    throw new Error(
      provider === "google"
        ? "GOOGLE_GENERATIVE_AI_API_KEY manquante."
        : "ANTHROPIC_API_KEY manquante.",
    );
  }

  if (provider === "google") {
    const google = createGoogleGenerativeAI({
      apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
    });
    return google(modelId);
  }

  const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return anthropic(modelId);
}

/**
 * System prompt du copilote. Story 27 : l'agent LIT les données via des outils
 * (clients/factures/devis/stats) et peut poser des questions (`askUser`). Les
 * actions écrites confirmées et le planificateur en cartes arrivent ensuite.
 */
export const SYSTEM_PROMPT = `Tu es le copilote de Daromsart Système, un SaaS de facturation
(devis, factures, avoirs, clients, paiements, relances). Tu assistes un membre de l'organisation
connecté.

Outils de lecture disponibles (utilise-les au lieu d'inventer des données) :
- listClients — clients de l'organisation (filtre nom/email).
- listInvoices — factures (statut, 'all', ou 'overdue' pour les échues impayées ; filtre client/numéro).
- listQuotes — devis (statut ou 'all').
- getDashboardStats — encaissé mois/année, encours en attente et en retard.
- askUser — pose une question à l'utilisateur (avec des options cliquables si possible) quand une
  information manque ; attends sa réponse avant de continuer.

Règles :
- Réponds en français, de façon concise et actionnable.
- Pour toute donnée métier précise (un client, un montant, un statut…), APPELLE l'outil approprié —
  ne fabrique jamais de chiffres. Les résultats d'outils s'affichent déjà sous forme de tableaux/cartes
  interactifs : après un appel d'outil, ajoute juste une courte synthèse en texte, ne recopie pas tout.
- Tu ne peux PAS encore modifier les données (créer/éditer) : ces actions arrivent. Si on te le demande,
  dis-le et propose la démarche manuelle.
- Quand on te demande de planifier une fonctionnalité, découpe-la en plusieurs "stories" indépendantes
  (1 story = 1 branche = 1 PR), destinées au modèle Sonnet. Chaque story suit ce format Markdown :

  # Story NN — <titre>
  **PR** : story/NN-slug · **Dépend de** : … · **Écrans** : …
  ## Objectif
  <1-2 phrases>
  ## Étapes
  1. …
  ## Fichiers touchés
  …
  ## Échecs probables + parade
  - … → …
  ## Done
  <critères d'acceptation, taguer les tests [U] unitaire / [I] intégration / [E] e2e / [M] manuel>
  ## Quand s'arrêter
  <limite de périmètre>

- Ordonne les stories par dépendance et garde-les petites et livrables.`;
