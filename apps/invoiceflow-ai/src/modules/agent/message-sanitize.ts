import type { UIMessage } from "ai";

/**
 * Comble les appels d'outil restés SANS résultat avant l'envoi au modèle.
 *
 * Le SDK exige que chaque tool-call d'un message assistant ait un tool-result
 * correspondant, sinon `convertToModelMessages`/`streamText` lève
 * `MissingToolResultsError` (crash « An error occurred »). Cas typique : l'agent
 * pose une question `askUser` (sans `execute`, donc résolue côté humain) mais
 * l'utilisateur tape un nouveau message au lieu de répondre à la carte → le
 * tool-call reste « input-available ».
 *
 * Plutôt que de planter, on injecte un résultat de repli : l'agent voit que la
 * question est restée sans réponse (et peut reformuler / continuer avec le
 * message suivant de l'utilisateur), au lieu de renvoyer une erreur.
 */
function isToolPart(part: { type: string }): boolean {
  return part.type.startsWith("tool-") || part.type === "dynamic-tool";
}

function toolNameOf(part: { type: string; toolName?: string }): string {
  if (part.type === "dynamic-tool") return part.toolName ?? "";
  return part.type.startsWith("tool-") ? part.type.slice("tool-".length) : part.type;
}

function fallbackOutput(toolName: string): unknown {
  switch (toolName) {
    // Confirmation d'écriture non tranchée → considérée comme annulée (jamais
    // d'écriture implicite).
    case "proposeCreateClient":
      return { confirmed: false };
    case "askUser":
      return "(Question laissée sans réponse par l'utilisateur. Ne répète pas la même question : appuie-toi sur son dernier message, ou propose la suite.)";
    default:
      return "(Résultat d'outil indisponible.)";
  }
}

export function fillMissingToolResults(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) => {
    if (message.role !== "assistant") return message;

    let changed = false;
    const parts = message.parts.map((part) => {
      if (!isToolPart(part)) return part;
      const p = part as { type: string; state?: string; toolName?: string };
      if (p.state === "output-available" || p.state === "output-error") {
        return part;
      }
      changed = true;
      return {
        ...(part as Record<string, unknown>),
        state: "output-available",
        output: fallbackOutput(toolNameOf(p)),
      };
    });

    return changed ? ({ ...message, parts } as UIMessage) : message;
  });
}
