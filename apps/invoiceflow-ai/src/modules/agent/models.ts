/**
 * Modèles Claude proposés dans le mode agent. Sans secret — importable côté
 * client (sélecteur de modèle). L'agent raisonne par défaut en Opus 4.8 (le
 * plus fort pour le découpage) ; les stories qu'il produit visent Sonnet.
 */
export const AGENT_MODELS = [
  { id: "claude-opus-4-8", label: "Claude Opus 4.8" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
] as const;

export type AgentModelId = (typeof AGENT_MODELS)[number]["id"];

export const DEFAULT_AGENT_MODEL: AgentModelId = "claude-opus-4-8";

export function isAgentModel(value: string): value is AgentModelId {
  return AGENT_MODELS.some((m) => m.id === value);
}

export function agentModelLabel(id: string): string {
  return AGENT_MODELS.find((m) => m.id === id)?.label ?? id;
}
