import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { getCurrentOrganizationId, getSession } from "@/modules/auth/session";
import { DEFAULT_AGENT_MODEL, isAgentModel } from "@/modules/agent/models";
import { replaceMessages } from "@/modules/agent/mutations";
import { getConversation } from "@/modules/agent/queries";
import { SYSTEM_PROMPT, isAgentEnabled, resolveModel } from "@/modules/agent/provider";

// L'AI SDK + provider Anthropic utilisent des API Node (streams, crypto) et la
// couche outils (stories suivantes) touchera Drizzle/Postgres → runtime Node.
export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatRequestBody {
  messages?: UIMessage[];
  conversationId?: string;
  model?: string;
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
      { error: "Le mode agent n'est pas configuré (ANTHROPIC_API_KEY manquante)." },
      { status: 503 },
    );
  }

  const body = (await req.json()) as ChatRequestBody;
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
        : DEFAULT_AGENT_MODEL;

  // Persiste le tour entrant AVANT le stream : le message utilisateur survit à
  // un échec de l'appel modèle. `onEnd` réécrit ensuite avec la réponse incluse.
  await replaceMessages(db, conversationId, messages);

  const result = streamText({
    model: resolveModel(model),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(1),
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onEnd: async ({ messages: finalMessages }) => {
      await replaceMessages(db, conversationId, finalMessages);
    },
  });
}
