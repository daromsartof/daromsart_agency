/**
 * Catalogue des modèles du mode agent. Sans secret — importable côté client
 * (sélecteur). `provider` indique quelle clé env est requise pour appeler le
 * modèle ; la résolution concrète se fait dans `provider.ts` (server-only).
 */
export type AgentProvider = "anthropic" | "google";

export const AGENT_MODELS = [
  // Gemini en tête : gratuit / free tier pour tester sans crédit Anthropic.
  // `gemini-flash-latest` = alias vers le Flash courant → jamais frappé par
  // le retrait "no longer available to new users" (contrairement aux ids
  // datés comme gemini-2.5-flash, désormais indisponibles aux nouveaux comptes).
  { id: "gemini-flash-latest", label: "Gemini Flash (dernier)", provider: "google" as const },
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", provider: "google" as const },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", provider: "anthropic" as const },
  { id: "claude-opus-4-8", label: "Claude Opus 4.8", provider: "anthropic" as const },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", provider: "anthropic" as const },
] as const;

export type AgentModelId = (typeof AGENT_MODELS)[number]["id"];

/** Défaut "gratuit" ; surchargé par `defaultAgentModel()` selon les clés dispo. */
export const DEFAULT_AGENT_MODEL: AgentModelId = "gemini-flash-latest";

export function isAgentModel(value: string): value is AgentModelId {
  return AGENT_MODELS.some((m) => m.id === value);
}

export function agentModelLabel(id: string): string {
  return AGENT_MODELS.find((m) => m.id === id)?.label ?? id;
}

export function agentModelProvider(id: AgentModelId): AgentProvider {
  return AGENT_MODELS.find((m) => m.id === id)!.provider;
}
