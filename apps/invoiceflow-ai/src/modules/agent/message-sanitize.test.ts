import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import { fillMissingToolResults } from "./message-sanitize";

function assistant(parts: unknown[]): UIMessage {
  return { id: "a1", role: "assistant", parts } as unknown as UIMessage;
}

describe("fillMissingToolResults", () => {
  it("comble un askUser resté sans réponse", () => {
    const out = fillMissingToolResults([
      assistant([
        { type: "text", text: "…" },
        { type: "tool-askUser", toolCallId: "t1", state: "input-available", input: { question: "?" } },
      ]),
    ]);
    const part = (out[0].parts as Array<{ type: string; state?: string; output?: unknown }>)[1];
    expect(part.state).toBe("output-available");
    expect(typeof part.output).toBe("string");
  });

  it("marque une proposition d'écriture non tranchée comme annulée", () => {
    const out = fillMissingToolResults([
      assistant([
        { type: "tool-proposeCreateClient", toolCallId: "t2", state: "input-available", input: {} },
      ]),
    ]);
    const part = (out[0].parts as Array<{ output?: { confirmed?: boolean } }>)[0];
    expect(part.output).toEqual({ confirmed: false });
  });

  it("ne touche pas un tool-call déjà résolu", () => {
    const resolved = assistant([
      { type: "tool-askUser", toolCallId: "t3", state: "output-available", input: {}, output: "oui" },
    ]);
    const out = fillMissingToolResults([resolved]);
    expect(out[0]).toBe(resolved);
  });

  it("laisse les messages utilisateur intacts", () => {
    const user = { id: "u1", role: "user", parts: [{ type: "text", text: "hello" }] } as unknown as UIMessage;
    const out = fillMissingToolResults([user]);
    expect(out[0]).toBe(user);
  });
});
