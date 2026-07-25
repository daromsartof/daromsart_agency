import {
  pruneMessages,
  type ModelMessage,
  type UIMessage,
} from "ai";

/** Nombre max de messages UI gardés pour le prompt (historique long = tokens). */
export const MAX_PROMPT_UI_MESSAGES = 24;

/**
 * Prépare le contexte modèle à moindre coût tokens :
 * 1. déduplique les messages user identiques consécutifs (spam / double-envoi) ;
 * 2. coupe l'historique UI trop long ;
 * 3. compacte les sorties d'outils anciennes (listes / lignes facture) ;
 * 4. `pruneMessages` retire reasoning + tool-calls hors fenêtre récente.
 *
 * La persistance DB garde l'historique complet — seule la fenêtre modèle est
 * réduite.
 */
export function preparePromptUiMessages(messages: UIMessage[]): UIMessage[] {
  let next = dedupeConsecutiveUserMessages(messages);
  next = trimUiHistory(next, MAX_PROMPT_UI_MESSAGES);
  next = compactStaleToolOutputs(next);
  return next;
}

export function pruneModelContext(messages: ModelMessage[]): ModelMessage[] {
  return pruneMessages({
    messages,
    reasoning: "all",
    // Garde les tool-calls des 4 derniers messages ; le reste est résumé côté UI
    // déjà compacté, et ici on retire les appels trop anciens.
    toolCalls: "before-last-4-messages",
    emptyMessages: "remove",
  });
}

/** Pendant la boucle agentique : encore plus agressif entre les steps. */
export function pruneStepContext(messages: ModelMessage[]): ModelMessage[] {
  return pruneMessages({
    messages,
    reasoning: "all",
    toolCalls: "before-last-2-messages",
    emptyMessages: "remove",
  });
}

function dedupeConsecutiveUserMessages(messages: UIMessage[]): UIMessage[] {
  const out: UIMessage[] = [];
  for (const message of messages) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.role === "user" &&
      message.role === "user" &&
      userText(prev) === userText(message) &&
      userText(message).length > 0
    ) {
      continue;
    }
    out.push(message);
  }
  return out;
}

function userText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text.trim())
    .join("\n");
}

function trimUiHistory(messages: UIMessage[], max: number): UIMessage[] {
  if (messages.length <= max) return messages;
  // Garde la queue : les tours récents. Si on coupe au milieu d'une paire
  // outil, `fillMissingToolResults` (déjà appliqué en amont ou aval) + prune
  // modèle nettoient le reste.
  return messages.slice(-max);
}

function isToolPart(part: { type: string }): boolean {
  return part.type.startsWith("tool-") || part.type === "dynamic-tool";
}

function toolNameOf(part: { type: string; toolName?: string }): string {
  if (part.type === "dynamic-tool") return part.toolName ?? "";
  return part.type.startsWith("tool-") ? part.type.slice("tool-".length) : part.type;
}

/**
 * Compacte les outputs d'outils sauf ceux du dernier message assistant
 * (encore utiles pour le tour en cours). L'UI client conserve les parts
 * d'origine ; seul le prompt modèle reçoit la version compactée.
 */
function compactStaleToolOutputs(messages: UIMessage[]): UIMessage[] {
  let lastAssistantIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") {
      lastAssistantIndex = i;
      break;
    }
  }

  return messages.map((message, index) => {
    if (message.role !== "assistant" || index === lastAssistantIndex) return message;

    let changed = false;
    const parts = message.parts.map((part) => {
      if (!isToolPart(part)) return part;
      const p = part as {
        type: string;
        state?: string;
        toolName?: string;
        output?: unknown;
      };
      if (p.state !== "output-available" || p.output == null) return part;
      const compact = compactToolOutput(toolNameOf(p), p.output);
      if (compact === p.output) return part;
      changed = true;
      return { ...(part as Record<string, unknown>), output: compact };
    });

    return changed ? ({ ...message, parts } as UIMessage) : message;
  });
}

function compactToolOutput(toolName: string, output: unknown): unknown {
  if (!output || typeof output !== "object") return output;
  const o = output as Record<string, unknown>;

  switch (toolName) {
    case "listClients": {
      const clients = Array.isArray(o.clients) ? o.clients : [];
      return {
        total: o.total,
        clients: clients.slice(0, 5),
        truncated: clients.length > 5,
      };
    }
    case "listInvoices": {
      const invoices = Array.isArray(o.invoices) ? o.invoices : [];
      return {
        total: o.total,
        invoices: invoices.slice(0, 5),
        truncated: invoices.length > 5,
      };
    }
    case "listQuotes": {
      const quotes = Array.isArray(o.quotes) ? o.quotes : [];
      return {
        total: o.total,
        quotes: quotes.slice(0, 5),
        truncated: quotes.length > 5,
      };
    }
    case "getInvoiceDetail": {
      // Les lignes + PDF sont déjà dans l'UI : le modèle n'a besoin que du résumé.
      return {
        found: o.found,
        id: o.id,
        number: o.number,
        clientName: o.clientName,
        status: o.status,
        total: o.total,
        reste: o.reste,
        pdfUrl: o.pdfUrl,
        linesCount: Array.isArray(o.lines) ? o.lines.length : 0,
      };
    }
    case "getDashboardStats":
    case "askUser":
    case "proposeCreateClient":
      return output;
    default:
      return output;
  }
}
