import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { env } from "../../lib/env";
import {
  AGENT_MODELS,
  DEFAULT_AGENT_MODEL,
  agentModelProvider,
  providerApiKeyHint,
  type AgentModelId,
  type AgentProvider,
} from "./models";

export function isProviderConfigured(provider: AgentProvider): boolean {
  switch (provider) {
    case "anthropic":
      return env.ANTHROPIC_API_KEY.length > 0;
    case "google":
      return env.GOOGLE_GENERATIVE_AI_API_KEY.length > 0;
    case "openai":
      return env.OPENAI_API_KEY.length > 0;
    case "ollama":
      return env.OLLAMA_WORKER_URL.length > 0;
  }
}

/** `true` si au moins un provider LLM est configuré. */
export function isAgentEnabled(): boolean {
  return (
    isProviderConfigured("google") ||
    isProviderConfigured("openai") ||
    isProviderConfigured("anthropic") ||
    isProviderConfigured("ollama")
  );
}

/** Modèles dont la clé provider est présente. */
export function availableAgentModels(): (typeof AGENT_MODELS)[number][] {
  return AGENT_MODELS.filter((m) => isProviderConfigured(m.provider));
}

/**
 * Modèle par défaut : Gemini Flash si la clé Google est là (test gratuit),
 * sinon premier modèle dont la clé est configurée, sinon le défaut catalogue.
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
    throw new Error(`${providerApiKeyHint(provider)} manquante.`);
  }

  if (provider === "google") {
    const google = createGoogleGenerativeAI({
      apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
    });
    return google(modelId);
  }

  if (provider === "openai") {
    const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
    // `@ai-sdk/openai` v4+ utilise Responses API par défaut (openai(modelId)).
    return openai(modelId);
  }

  if (provider === "ollama") {
    // IA LOCALE via le worker Python (qui relaie vers Ollama/GPU). On réutilise
    // le provider OpenAI pointé sur le worker : Ollama expose l'API Chat
    // Completions (pas Responses) → `.chat(modelId)`. La clé est ignorée.
    const local = createOpenAI({
      baseURL: `${env.OLLAMA_WORKER_URL.replace(/\/$/, "")}/v1`,
      apiKey: "ollama",
      name: "ollama",
    });
    return local.chat(modelId);
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
- getInvoiceDetail — détail d'UNE facture (par id ou numéro) AVEC aperçu PDF dans le chat.
  Obligatoire dès que l'utilisateur consulte / ouvre / veut le détail ou le PDF d'une facture précise
  (ex. « FAC-2026-0072 », « montre-moi cette facture », « détails de la facture »).
- askUser — pose une question à l'utilisateur (avec des options cliquables si possible) quand une
  information manque ; attends sa réponse avant de continuer.
- proposeCreateClient — PROPOSE la création d'un client. Cet outil N'ÉCRIT RIEN : une carte de
  confirmation s'affiche, l'utilisateur clique « Confirmer » (ou « Annuler ») et TU reçois le résultat.
  Utilise askUser avant pour clarifier si des champs importants manquent.

Règles :
- Réponds en français, de façon concise et actionnable.
- Pour toute donnée métier précise (un client, un montant, un statut…), APPELLE l'outil approprié —
  ne fabrique jamais de chiffres. Les résultats d'outils s'affichent déjà sous forme de tableaux/cartes
  interactifs : après un appel d'outil, ajoute juste une courte synthèse en texte, ne recopie pas tout.
- Choix des outils — réfléchis avant d'appeler :
  • Lis d'abord le message : extrais tout ce qui est déjà fourni (nom, email, SIRET, montant…) au lieu
    de le redemander.
  • N'enchaîne PAS plusieurs askUser. Regroupe en UNE seule question ce qui manque VRAIMENT.
  • askUser : donne des options cliquables dès qu'il s'agit d'un choix fermé (ex. type de client :
    Entreprise / Particulier). Sans options, l'utilisateur répond au clavier — c'est ok.
  • proposeCreateClient : seuls le type et le nom (displayName) sont OBLIGATOIRES. Les autres champs
    (email, SIRET, téléphone, adresse…) sont facultatifs — ne les exige pas, propose dès que tu as le minimum.
  • Dès que tu as assez d'informations, passe à l'action (propose/affiche) sans reposer de question.
- Après getInvoiceDetail, le PDF est déjà affiché : ne liste pas toutes les lignes/montants en Markdown,
  une phrase de confirmation + proposition d'aide suffit.
- Écriture : la SEULE action possible est proposeCreateClient (création de client, avec confirmation
  humaine obligatoire). Pour toute autre modification (éditer, créer un devis/une facture…), dis que ce
  n'est pas encore possible et propose la démarche manuelle. Ne prétends jamais avoir écrit sans
  confirmation.
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
