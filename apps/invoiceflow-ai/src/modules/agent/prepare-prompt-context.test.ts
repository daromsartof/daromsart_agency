import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import {
  MAX_PROMPT_UI_MESSAGES,
  preparePromptUiMessages,
} from "./prepare-prompt-context";

function user(text: string, id = crypto.randomUUID()): UIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] } as UIMessage;
}

function assistantWithTool(
  toolName: string,
  output: unknown,
  id = crypto.randomUUID(),
): UIMessage {
  return {
    id,
    role: "assistant",
    parts: [
      {
        type: `tool-${toolName}`,
        toolCallId: crypto.randomUUID(),
        state: "output-available",
        output,
      },
    ],
  } as unknown as UIMessage;
}

describe("preparePromptUiMessages", () => {
  it("déduplique les messages user identiques consécutifs", () => {
    const out = preparePromptUiMessages([
      user("creer un client Apple", "1"),
      user("creer un client Apple", "2"),
      user("creer un client Apple", "3"),
      user("autre chose", "4"),
    ]);
    expect(out.map((m) => m.id)).toEqual(["1", "4"]);
  });

  it("tronque l'historique au plafond", () => {
    const many = Array.from({ length: MAX_PROMPT_UI_MESSAGES + 10 }, (_, i) =>
      user(`msg ${i}`, String(i)),
    );
    const out = preparePromptUiMessages(many);
    expect(out).toHaveLength(MAX_PROMPT_UI_MESSAGES);
    expect(userText(out[0]!)).toBe(`msg 10`);
  });

  it("compacte les listes d'outils hors du dernier assistant", () => {
    const clients = Array.from({ length: 12 }, (_, i) => ({
      id: String(i),
      name: `C${i}`,
      email: null,
    }));
    const out = preparePromptUiMessages([
      assistantWithTool("listClients", { total: 12, clients }, "a1"),
      user("ok", "u1"),
      assistantWithTool("getDashboardStats", { encaisseMois: "1 €" }, "a2"),
    ]);
    const oldTool = out[0]!.parts[0] as { output: { clients: unknown[]; truncated?: boolean } };
    expect(oldTool.output.clients).toHaveLength(5);
    expect(oldTool.output.truncated).toBe(true);
    // Dernier assistant intact
    const lastTool = out[2]!.parts[0] as { output: { encaisseMois: string } };
    expect(lastTool.output.encaisseMois).toBe("1 €");
  });
});

function userText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}
