/**
 * Catalogue des modèles du mode agent. Sans secret — importable côté client
 * (sélecteur). `provider` indique quelle clé env est requise pour appeler le
 * modèle ; la résolution concrète se fait dans `provider.ts` (server-only).
 */
export type AgentProvider = "anthropic" | "google" | "openai" | "ollama";

export const AGENT_MODELS = [
  // Gemini en tête : gratuit / free tier pour tester sans crédit.
  // `gemini-flash-latest` = alias vers le Flash courant → jamais frappé par
  // le retrait "no longer available to new users" (contrairement aux ids
  // datés comme gemini-2.5-flash, désormais indisponibles aux nouveaux comptes).
  { id: "gemini-flash-latest", label: "Gemini Flash (dernier)", provider: "google" as const },
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", provider: "google" as const },
  // OpenAI (Responses API via @ai-sdk/openai) — lineup 2026.
  { id: "gpt-5.4", label: "GPT-5.4", provider: "openai" as const },
  { id: "gpt-5.4-mini", label: "GPT-5.4 Mini", provider: "openai" as const },
  { id: "gpt-5.4-nano", label: "GPT-5.4 Nano", provider: "openai" as const },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", provider: "anthropic" as const },
  { id: "claude-opus-4-8", label: "Claude Opus 4.8", provider: "anthropic" as const },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", provider: "anthropic" as const },
  // Local (Ollama via le worker Python + GPU). L'id DOIT correspondre à un
  // modèle `ollama pull`é. Choisis des modèles compatibles function-calling et
  // ~8 Go de VRAM (RTX 2070 Super). Adapte librement à ta bibliothèque locale.
  { id: "qwen2.5:7b", label: "Qwen2.5 7B (local)", provider: "ollama" as const },
  { id: "llama3.1:8b", label: "Llama 3.1 8B (local)", provider: "ollama" as const },
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

/** Message d'env manquante pour un provider (route 503 / erreurs resolveModel). */
export function providerApiKeyHint(provider: AgentProvider): string {
  switch (provider) {
    case "google":
      return "GOOGLE_GENERATIVE_AI_API_KEY";
    case "openai":
      return "OPENAI_API_KEY";
    case "anthropic":
      return "ANTHROPIC_API_KEY";
    case "ollama":
      return "OLLAMA_WORKER_URL";
  }
}
