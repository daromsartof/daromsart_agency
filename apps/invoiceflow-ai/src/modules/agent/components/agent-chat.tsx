"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowLeft, Bot, Plus, SendHorizontal } from "lucide-react";
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
import { AGENT_MODELS, type AgentModelId } from "@/modules/agent/models";
import { createConversationAction } from "@/modules/agent/actions";
import type { ConversationSummary } from "@/modules/agent/queries";

export interface AgentChatProps {
  conversationId?: string;
  initialMessages: UIMessage[];
  conversations: ConversationSummary[];
  defaultModel: AgentModelId;
}

function messageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export function AgentChat({
  conversationId: initialConversationId,
  initialMessages,
  conversations,
  defaultModel,
}: AgentChatProps) {
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [model, setModel] = useState<AgentModelId>(defaultModel);
  const [input, setInput] = useState("");
  const convIdRef = useRef(initialConversationId);
  const modelRef = useRef<AgentModelId>(defaultModel);

  const [transport] = useState(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: "/api/agent/chat",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { messages, conversationId: convIdRef.current, model: modelRef.current },
        }),
      }),
  );

  const { messages, sendMessage, status, error } = useChat<UIMessage>({
    transport,
    messages: initialMessages,
  });

  const busy = status === "submitted" || status === "streaming";

  async function submit() {
    const text = input.trim();
    if (!text || busy) return;
    if (!convIdRef.current) {
      const res = await createConversationAction(modelRef.current);
      convIdRef.current = res.id;
      setConversationId(res.id);
      // Met à jour l'URL sans navigation Next (pas de remontage du chat).
      window.history.replaceState(null, "", `/agent/${res.id}`);
    }
    setInput("");
    sendMessage({ text });
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
        <div className="flex h-16 shrink-0 items-center gap-2 px-4">
          <Bot className="h-5 w-5 text-primary" />
          <span className="font-heading font-medium">Copilote</span>
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
              Quitter le mode agent
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
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGENT_MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
            {messages.length === 0 ? (
              <div className="mt-16 text-center text-muted-foreground">
                <Bot className="mx-auto mb-3 h-10 w-10 text-primary/60" />
                <p className="font-heading text-lg">Comment puis-je aider ?</p>
                <p className="mt-1 text-sm">
                  Posez une question ou demandez de découper une fonctionnalité en stories.
                </p>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {messageText(m) || (m.role === "assistant" && busy ? "…" : "")}
                  </div>
                </div>
              ))
            )}
            {error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                Une erreur est survenue. Vérifiez que le mode agent est configuré, puis réessayez.
              </div>
            ) : null}
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
              placeholder="Écrivez votre message…"
              rows={1}
              className="max-h-40 min-h-[44px] flex-1 resize-none"
            />
            <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Envoyer">
              <SendHorizontal className="h-5 w-5" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
