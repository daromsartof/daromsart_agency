import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organizations } from "./organization";

/**
 * Copilote agent (mode agent, story 26) — conversations persistées en base,
 * org+user-scopées : reprise de session et historique. Aucune donnée
 * partagée entre organisations.
 */
export const agentConversations = pgTable("agent_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  title: text("title").notNull().default("Nouvelle conversation"),
  /** Modèle Claude utilisé (ex. claude-opus-4-8) — figé à la création, ajustable. */
  model: text("model").notNull(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Un message = un tour (user ou assistant). `parts` stocke les `UIMessage`
 * parts de l'AI SDK v5 (texte + tool-calls + tool-results) tels quels, pour
 * réhydrater la generative UI au rechargement sans reconstruction.
 */
export const agentMessages = pgTable("agent_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => agentConversations.id, { onDelete: "cascade" }),

  role: text("role").$type<"user" | "assistant" | "system">().notNull(),
  /** Parts sérialisées de l'AI SDK (jamais interprétées côté SQL). */
  parts: jsonb("parts").$type<unknown[]>().notNull().default([]),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});
