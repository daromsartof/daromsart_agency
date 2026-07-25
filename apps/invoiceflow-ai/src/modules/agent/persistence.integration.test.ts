import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema";
import { agentConversations, organizations, user } from "../../db/schema";
import {
  createConversation,
  deleteConversation,
  replaceMessages,
  type PersistableMessage,
} from "./mutations";
import { getConversation, getConversationMessages, listConversations } from "./queries";

const url = process.env.TEST_DATABASE_URL;
const client = postgres(url ?? "", { max: 1 });
const db = drizzle(client, { schema });

let orgA = "";
let orgB = "";
let userA = "";
let userB = "";
const userIds: string[] = [];

function textMsg(role: PersistableMessage["role"], text: string): PersistableMessage {
  return { role, parts: [{ type: "text", text }] };
}

beforeAll(async () => {
  if (!url) throw new Error("TEST_DATABASE_URL manquant");
  const [a] = await db.insert(organizations).values({ legalName: "Org Agent A" }).returning();
  const [b] = await db.insert(organizations).values({ legalName: "Org Agent B" }).returning();
  orgA = a.id;
  orgB = b.id;
  userA = randomUUID();
  userB = randomUUID();
  userIds.push(userA, userB);
  await db.insert(user).values([
    { id: userA, name: "User A", email: `agent-a-${userA}@test.dev` },
    { id: userB, name: "User B", email: `agent-b-${userB}@test.dev` },
  ]);
});

afterAll(async () => {
  await db
    .delete(agentConversations)
    .where(inArray(agentConversations.organizationId, [orgA, orgB]));
  await db.delete(user).where(inArray(user.id, userIds));
  await db.delete(organizations).where(inArray(organizations.id, [orgA, orgB]));
  await client.end({ timeout: 5 });
});

describe("createConversation + replaceMessages + getConversationMessages", () => {
  it("persiste les messages dans l'ordre et dérive le titre du 1er message user", async () => {
    const id = await createConversation(db, orgA, userA, "claude-opus-4-8");
    await replaceMessages(db, id, [
      textMsg("user", "Découpe la feature export comptable en stories"),
      textMsg("assistant", "Voici trois stories…"),
    ]);

    const messages = await getConversationMessages(db, id);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[1].role).toBe("assistant");
    expect(messages[0].parts).toEqual([
      { type: "text", text: "Découpe la feature export comptable en stories" },
    ]);

    const [conv] = await db
      .select({ title: agentConversations.title })
      .from(agentConversations)
      .where(eq(agentConversations.id, id));
    expect(conv.title).toBe("Découpe la feature export comptable en stories");
  });

  it("remplace intégralement (idempotent) — les anciens messages disparaissent", async () => {
    const id = await createConversation(db, orgA, userA, "claude-opus-4-8");
    await replaceMessages(db, id, [textMsg("user", "un"), textMsg("assistant", "deux")]);
    await replaceMessages(db, id, [textMsg("user", "trois")]);

    const messages = await getConversationMessages(db, id);
    expect(messages).toHaveLength(1);
    expect(messages[0].parts).toEqual([{ type: "text", text: "trois" }]);
  });

  it("tronque un titre trop long", async () => {
    const id = await createConversation(db, orgA, userA, "claude-opus-4-8");
    const long = "x".repeat(200);
    await replaceMessages(db, id, [textMsg("user", long)]);
    const [conv] = await db
      .select({ title: agentConversations.title })
      .from(agentConversations)
      .where(eq(agentConversations.id, id));
    expect(conv.title.length).toBeLessThanOrEqual(80);
    expect(conv.title.endsWith("…")).toBe(true);
  });
});

describe("listConversations", () => {
  it("masque les conversations vides et trie par récence", async () => {
    const empty = await createConversation(db, orgA, userA, "claude-opus-4-8");
    const withMsg = await createConversation(db, orgA, userA, "claude-opus-4-8");
    await replaceMessages(db, withMsg, [textMsg("user", "coucou")]);

    const list = await listConversations(db, orgA, userA);
    const ids = list.map((c) => c.id);
    expect(ids).toContain(withMsg);
    expect(ids).not.toContain(empty);
  });

  it("ne renvoie jamais les conversations d'un autre utilisateur ou d'une autre org", async () => {
    const convOther = await createConversation(db, orgA, userB, "claude-opus-4-8");
    await replaceMessages(db, convOther, [textMsg("user", "privé")]);

    const listA = await listConversations(db, orgA, userA);
    expect(listA.map((c) => c.id)).not.toContain(convOther);

    const listB = await listConversations(db, orgB, userB);
    expect(listB.map((c) => c.id)).not.toContain(convOther);
  });
});

describe("getConversation — isolation org+user", () => {
  it("refuse l'accès depuis une autre org ou un autre user", async () => {
    const id = await createConversation(db, orgA, userA, "claude-opus-4-8");
    await replaceMessages(db, id, [textMsg("user", "secret")]);

    expect(await getConversation(db, orgA, userA, id)).not.toBeNull();
    expect(await getConversation(db, orgB, userA, id)).toBeNull();
    expect(await getConversation(db, orgA, userB, id)).toBeNull();
  });
});

describe("deleteConversation", () => {
  it("supprime la conversation et ses messages (cascade)", async () => {
    const id = await createConversation(db, orgA, userA, "claude-opus-4-8");
    await replaceMessages(db, id, [textMsg("user", "à supprimer")]);
    await deleteConversation(db, orgA, userA, id);

    expect(await getConversation(db, orgA, userA, id)).toBeNull();
    expect(await getConversationMessages(db, id)).toHaveLength(0);
  });

  it("ne supprime pas la conversation d'un autre user (no-op)", async () => {
    const id = await createConversation(db, orgA, userA, "claude-opus-4-8");
    await replaceMessages(db, id, [textMsg("user", "protégé")]);
    await deleteConversation(db, orgA, userB, id);
    expect(await getConversation(db, orgA, userA, id)).not.toBeNull();
  });
});
