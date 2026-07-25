import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { getCurrentOrganizationId, getSession } from "@/modules/auth/session";
import { isAgentModel, providerApiKeyHint, agentModelProvider } from "@/modules/agent/models";
import { replaceMessages } from "@/modules/agent/mutations";
import { getConversation } from "@/modules/agent/queries";
import { createAgentTools } from "@/modules/agent/tools";
import { fillMissingToolResults } from "@/modules/agent/message-sanitize";
import {
  preparePromptUiMessages,
  pruneModelContext,
  pruneStepContext,
} from "@/modules/agent/prepare-prompt-context";
import {
  SYSTEM_PROMPT,
  defaultAgentModel,
  isAgentEnabled,
  isModelConfigured,
  resolveModel,
} from "@/modules/agent/provider";

// L'AI SDK + providers utilisent des API Node (streams, crypto) et la
// couche outils (stories suivantes) touchera Drizzle/Postgres → runtime Node.
export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatRequestBody {
  messages?: UIMessage[];
  conversationId?: string;
  model?: string;
}

function parseClientError(raw: string): string {
  try {
    const json = JSON.parse(raw) as { error?: unknown };
    if (typeof json.error === "string" && json.error.trim()) return json.error;
  } catch {
    // texte brut
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 && trimmed.length < 400
    ? trimmed
    : "Échec de l'appel au modèle.";
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) {
    return NextResponse.json({ error: "Utilisateur sans organisation." }, { status: 403 });
  }
  if (!isAgentEnabled()) {
    return NextResponse.json(
      {
        error:
          "Le mode agent n'est pas configuré. Ajoutez GOOGLE_GENERATIVE_AI_API_KEY, OPENAI_API_KEY ou ANTHROPIC_API_KEY dans .env.",
      },
      { status: 503 },
    );
  }

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const messages = body.messages ?? [];
  const { conversationId } = body;
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId requis." }, { status: 400 });
  }

  // Vérifie l'appartenance à l'org ET à l'utilisateur (isolation).
  const conversation = await getConversation(db, organizationId, session.user.id, conversationId);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation introuvable." }, { status: 404 });
  }

  const model =
    body.model && isAgentModel(body.model)
      ? body.model
      : isAgentModel(conversation.model)
        ? conversation.model
        : defaultAgentModel();

  if (!isModelConfigured(model)) {
    return NextResponse.json(
      { error: `Le modèle ${model} nécessite ${providerApiKeyHint(agentModelProvider(model))} dans .env.` },
      { status: 503 },
    );
  }

  // Persiste le tour entrant AVANT le stream : le message utilisateur survit à
  // un échec de l'appel modèle. `onEnd` réécrit ensuite avec la réponse incluse.
  try {
    await replaceMessages(db, conversationId, messages);
  } catch (err) {
    console.error("[agent/chat] replaceMessages (pre-stream)", err);
    return NextResponse.json(
      { error: "Impossible d'enregistrer le message." },
      { status: 500 },
    );
  }

  // Fenêtre prompt allégée (dédup, trim, compact tools) — la DB garde tout.
  // Puis comble les tool-calls orphelins pour éviter MissingToolResultsError.
  const promptMessages = fillMissingToolResults(preparePromptUiMessages(messages));

  let modelMessages;
  try {
    modelMessages = pruneModelContext(await convertToModelMessages(promptMessages));
  } catch (err) {
    console.error("[agent/chat] convertToModelMessages", err);
    return NextResponse.json(
      { error: "Messages de conversation invalides." },
      { status: 400 },
    );
  }

  try {
    const result = streamText({
      model: resolveModel(model),
      system: SYSTEM_PROMPT,
      messages: modelMessages,
      tools: createAgentTools(db, organizationId),
      // Boucle agentique bornée (tokens + latence). askUser / propose* suspendent
      // jusqu'à la réponse humaine (addToolResult côté client).
      stopWhen: stepCountIs(4),
      // Cappe la longueur des réponses texte (l'UI porte déjà les données outils).
      maxOutputTokens: 1024,
      prepareStep: async ({ messages: stepMessages, stepNumber }) => {
        if (stepNumber === 0) return {};
        return { messages: pruneStepContext(stepMessages) };
      },
      onError: ({ error }) => {
        console.error("[agent/chat] streamText", error);
      },
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      onEnd: async ({ messages: finalMessages }) => {
        try {
          await replaceMessages(db, conversationId, finalMessages);
        } catch (err) {
          console.error("[agent/chat] replaceMessages (onEnd)", err);
        }
      },
    });
  } catch (err) {
    console.error("[agent/chat] setup", err);
    const message =
      err instanceof Error ? parseClientError(err.message) : "Échec de l'appel au modèle.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
