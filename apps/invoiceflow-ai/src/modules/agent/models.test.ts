import { describe, expect, it } from "vitest";
import {
  AGENT_MODELS,
  DEFAULT_AGENT_MODEL,
  agentModelLabel,
  agentModelProvider,
  isAgentModel,
} from "./models";

describe("agent models", () => {
  it("le modèle par défaut fait partie de la liste", () => {
    expect(AGENT_MODELS.some((m) => m.id === DEFAULT_AGENT_MODEL)).toBe(true);
  });

  it("isAgentModel n'accepte que des ids connus", () => {
    expect(isAgentModel("gemini-flash-latest")).toBe(true);
    expect(isAgentModel("claude-opus-4-8")).toBe(true);
    expect(isAgentModel("gemini-2.5-flash")).toBe(false); // retiré (indispo nouveaux comptes)
    expect(isAgentModel("gpt-4")).toBe(false);
    expect(isAgentModel("")).toBe(false);
  });

  it("agentModelLabel renvoie le libellé connu, sinon l'id brut", () => {
    expect(agentModelLabel("gemini-flash-latest")).toBe("Gemini Flash (dernier)");
    expect(agentModelLabel("claude-opus-4-8")).toBe("Claude Opus 4.8");
    expect(agentModelLabel("modele-inconnu")).toBe("modele-inconnu");
  });

  it("agentModelProvider mappe google vs anthropic", () => {
    expect(agentModelProvider("gemini-flash-latest")).toBe("google");
    expect(agentModelProvider("claude-sonnet-5")).toBe("anthropic");
  });
});
