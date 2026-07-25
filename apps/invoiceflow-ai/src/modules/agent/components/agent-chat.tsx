"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";
import { ToolPart, isRenderableToolPart, type RenderableToolPart } from "./tool-parts";
import { MessageContent } from "./message-content";
import { ArrowLeft, Loader2, Plus, SendHorizontal } from "lucide-react";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  cn,
} from "@daromsart/ui";
import type { ClientInput } from "@daromsart/core";
import { AGENT_MODELS, type AgentModelId } from "@/modules/agent/models";
import { createConversationAction } from "@/modules/agent/actions";
import { createClientAction } from "@/modules/clients/actions";
import type { ConversationSummary } from "@/modules/agent/queries";

export interface AgentChatProps {
  conversationId?: string;
  initialMessages: UIMessage[];
  conversations: ConversationSummary[];
  defaultModel: AgentModelId;
  /** IDs dont la clé provider est configurée côté serveur. */
  availableModelIds: AgentModelId[];
}

function messageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

/**
 * Regroupe les parts d'un message pour l'affichage : les textes consécutifs
 * sont fusionnés (un seul bubble Markdown), les outils restent séparés.
 */
type DisplayChunk =
  | { kind: "text"; text: string; key: string }
  | { kind: "tool"; part: RenderableToolPart; key: string };

function displayChunks(message: UIMessage): DisplayChunk[] {
  const chunks: DisplayChunk[] = [];
  let textBuf = "";
  let textStart = 0;

  const flushText = (endIndex: number) => {
    if (!textBuf) return;
    chunks.push({ kind: "text", text: textBuf, key: `text-${textStart}-${endIndex}` });
    textBuf = "";
  };

  message.parts.forEach((part, i) => {
    if (part.type === "text") {
      if (!textBuf) textStart = i;
      textBuf += part.text;
      return;
    }
    flushText(i);
    if (isRenderableToolPart(part)) {
      chunks.push({
        kind: "tool",
        part: part as unknown as RenderableToolPart,
        key: `tool-${i}`,
      });
    }
  });
  flushText(message.parts.length);
  return chunks;
}

function formatChatError(error: Error): string {
  const raw = error.message?.trim() || "";
  try {
    const json = JSON.parse(raw) as { error?: unknown };
    if (typeof json.error === "string" && json.error.trim()) return json.error;
  } catch {
    // texte brut
  }
  if (raw && !raw.startsWith("Failed to fetch") && raw.length < 500) return raw;
  return "Une erreur est survenue. Vérifiez la clé API du modèle sélectionné, puis réessayez.";
}

export function AgentChat({
  conversationId: initialConversationId,
  initialMessages,
  conversations,
  defaultModel,
  availableModelIds,
}: AgentChatProps) {
  const selectableModels = AGENT_MODELS.filter((m) => availableModelIds.includes(m.id));
  const models = selectableModels.length > 0 ? selectableModels : AGENT_MODELS;

  const [conversationId, setConversationId] = useState(initialConversationId);
  const [model, setModel] = useState<AgentModelId>(
    models.some((m) => m.id === defaultModel) ? defaultModel : models[0]!.id,
  );
  const [input, setInput] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const convIdRef = useRef(initialConversationId);
  const modelRef = useRef<AgentModelId>(model);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const [transport] = useState(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: "/api/agent/chat",
        credentials: "include",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            messages,
            conversationId: convIdRef.current,
            model: modelRef.current,
          },
        }),
      }),
  );

  const { messages, sendMessage, status, error, addToolResult } = useChat<UIMessage>({
    transport,
    messages: initialMessages,
    // Quand l'utilisateur répond à un `askUser` (addToolResult), relance
    // automatiquement le tour pour que l'agent poursuive avec la réponse.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  const busy = status === "submitted" || status === "streaming";
  const displayError = localError ?? (error ? formatChatError(error) : null);

  // Suit le bas de la conversation pendant le stream ; si l'utilisateur
  // remonte manuellement, on arrête de forcer le scroll.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      stickToBottomRef.current = distance < 96;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!stickToBottomRef.current && !busy) return;
    bottomRef.current?.scrollIntoView({
      behavior: busy ? "auto" : "smooth",
      block: "end",
    });
  }, [messages, busy, displayError]);

  function handleAskUserAnswer(toolCallId: string, answer: string) {
    stickToBottomRef.current = true;
    void addToolResult({ tool: "askUser", toolCallId, output: answer });
  }

  // Confirmation d'une action écrite proposée (proposeCreateClient). L'ÉCRITURE
  // n'a lieu qu'ici, au clic « Confirmer » — jamais automatiquement. Le résultat
  // est renvoyé au modèle (addToolResult) pour qu'il conclue le tour.
  async function handleConfirmAction(part: RenderableToolPart, confirmed: boolean) {
    stickToBottomRef.current = true;
    const name = part.type.startsWith("tool-") ? part.type.slice("tool-".length) : part.type;
    if (!confirmed) {
      await addToolResult({ tool: name, toolCallId: part.toolCallId, output: { confirmed: false } });
      return;
    }
    if (name === "proposeCreateClient") {
      const res = await createClientAction(part.input as ClientInput);
      await addToolResult({
        tool: name,
        toolCallId: part.toolCallId,
        output: res.ok
          ? { confirmed: true, ok: true, clientId: res.id }
          : { confirmed: true, ok: false, error: Object.values(res.errors)[0] ?? "création impossible" },
      });
    }
  }

  function handleOpenInvoice(ref: { id: string; number: string | null }) {
    if (busy) return;
    stickToBottomRef.current = true;
    const label = ref.number ?? ref.id;
    void sendMessage({
      text: `Montre-moi le détail et le PDF de la facture ${label}`,
    });
  }

  /**
   * Appel d'outil « humain » (askUser / proposeCreateClient) non encore résolu
   * dans le dernier message assistant. Un tel appel DOIT recevoir un résultat
   * (clic ou réponse tapée) avant tout nouveau tour, sinon l'API échoue
   * (`MissingToolResultsError`).
   */
  function pendingHumanToolCall(): { toolName: string; toolCallId: string } | null {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return null;
    let found: { toolName: string; toolCallId: string } | null = null;
    for (const part of last.parts) {
      if (!isRenderableToolPart(part)) continue;
      const p = part as unknown as RenderableToolPart;
      if (p.state !== "input-available") continue;
      const name = p.type.startsWith("tool-") ? p.type.slice("tool-".length) : p.type;
      if (name === "askUser" || name === "proposeCreateClient") {
        found = { toolName: name, toolCallId: p.toolCallId };
      }
    }
    return found;
  }
  const pendingTool = pendingHumanToolCall();
  // Une confirmation d'écriture doit être tranchée par un clic (Confirmer/
  // Annuler), pas au clavier → on verrouille le champ tant qu'elle est en attente.
  const awaitingConfirmation = pendingTool?.toolName === "proposeCreateClient";

  async function submit() {
    const text = input.trim();
    if (!text || busy || awaitingConfirmation) return;
    setLocalError(null);
    stickToBottomRef.current = true;

    // Si l'agent a posé une question (askUser), la réponse tapée résout cet
    // appel d'outil au lieu d'ouvrir un nouveau tour (sinon appel sans résultat).
    if (pendingTool?.toolName === "askUser") {
      setInput("");
      try {
        await addToolResult({ tool: "askUser", toolCallId: pendingTool.toolCallId, output: text });
      } catch (err) {
        setLocalError(
          err instanceof Error ? formatChatError(err) : "Impossible d'envoyer la réponse.",
        );
      }
      return;
    }

    try {
      if (!convIdRef.current) {
        const res = await createConversationAction(modelRef.current);
        convIdRef.current = res.id;
        setConversationId(res.id);
        // Met à jour l'URL sans navigation Next (pas de remontage du chat).
        window.history.replaceState(null, "", `/agent/${res.id}`);
      }
      setInput("");
      await sendMessage({ text });
    } catch (err) {
      const message =
        err instanceof Error
          ? formatChatError(err)
          : "Impossible d'envoyer le message.";
      setLocalError(message);
    }
  }

  function onModelChange(value: string) {
    const next = value as AgentModelId;
    setModel(next);
    modelRef.current = next;
  }

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      {/* Historique */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex h-16 shrink-0 items-center gap-2.5 px-4">
          <Image
            src="/logo/qr-default-icon.png"
            alt=""
            width={128}
            height={128}
            className="h-8 w-8"
            priority
          />
          <span className="font-heading text-base font-medium tracking-tight">Daroms Chat</span>
        </div>
        <div className="px-3">
          <Button asChild variant="outline" className="w-full justify-start">
            <Link href="/agent">
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle conversation
            </Link>
          </Button>
        </div>
        <nav className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-3">
          {conversations.map((c) => (
            <Link
              key={c.id}
              href={`/agent/${c.id}`}
              className={cn(
                "block truncate rounded-md px-3 py-2 text-sm transition-colors",
                c.id === conversationId
                  ? "bg-primary/10 text-primary"
                  : "text-foreground/70 hover:bg-accent hover:text-foreground",
              )}
              title={c.title}
            >
              {c.title}
            </Link>
          ))}
        </nav>
        <div className="border-t p-3">
          <Button asChild variant="ghost" className="w-full justify-start">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Quitter Daroms Chat
            </Link>
          </Button>
        </div>
      </aside>

      {/* Conversation */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b bg-card px-4">
          <Button asChild variant="ghost" size="icon" className="md:hidden" aria-label="Quitter">
            <Link href="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1" />
          <Select value={model} onValueChange={onModelChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
            {availableModelIds.length === 0 ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                Aucune clé LLM configurée. Ajoutez{" "}
                <code className="text-xs">GOOGLE_GENERATIVE_AI_API_KEY</code>,{" "}
                <code className="text-xs">OPENAI_API_KEY</code> ou{" "}
                <code className="text-xs">ANTHROPIC_API_KEY</code> dans{" "}
                <code className="text-xs">apps/invoiceflow-ai/.env</code>, puis
                redémarrez le serveur.
              </div>
            ) : null}

            {messages.length === 0 && availableModelIds.length > 0 ? (
              <div className="mt-16 text-center text-muted-foreground">
                <Image
                  src="/logo/qr-default-icon.png"
                  alt=""
                  width={160}
                  height={160}
                  className="mx-auto mb-3 h-12 w-12"
                />
                <p className="font-heading text-lg">Comment puis-je aider ?</p>
                <p className="mt-1 text-sm">
                  Posez une question ou demandez de découper une fonctionnalité en stories.
                </p>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex flex-col gap-2",
                    m.role === "user" ? "items-end" : "items-start",
                  )}
                >
                  {displayChunks(m).map((chunk) => {
                    if (chunk.kind === "text") {
                      return (
                        <div
                          key={chunk.key}
                          className={cn(
                            "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                            m.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground",
                          )}
                        >
                          <MessageContent
                            text={chunk.text}
                            markdown={m.role === "assistant"}
                          />
                        </div>
                      );
                    }
                    return (
                      <ToolPart
                        key={chunk.key}
                        part={chunk.part}
                        onAnswer={handleAskUserAnswer}
                        onOpenInvoice={handleOpenInvoice}
                        onConfirm={handleConfirmAction}
                        answerable={!busy}
                      />
                    );
                  })}
                </div>
              ))
            )}

            {busy && !messages.some((m) => m.role === "assistant" && !messageText(m)) ? (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-2xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Réflexion…
                </div>
              </div>
            ) : null}

            {displayError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                {displayError}
              </div>
            ) : null}
            <div ref={bottomRef} aria-hidden className="h-px w-full shrink-0" />
          </div>
        </div>

        <div className="border-t bg-card">
          <form
            className="mx-auto flex w-full max-w-3xl items-end gap-2 px-4 py-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder={
                awaitingConfirmation
                  ? "Cliquez « Confirmer » ou « Annuler » ci-dessus…"
                  : "Écrivez votre message…"
              }
              rows={1}
              className="max-h-40 min-h-[44px] flex-1 resize-none"
              disabled={availableModelIds.length === 0 || awaitingConfirmation}
            />
            <Button
              type="submit"
              size="icon"
              disabled={
                busy || !input.trim() || availableModelIds.length === 0 || awaitingConfirmation
              }
              aria-label="Envoyer"
            >
              <SendHorizontal className="h-5 w-5" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
