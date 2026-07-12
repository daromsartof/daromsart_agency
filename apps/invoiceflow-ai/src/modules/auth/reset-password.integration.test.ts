import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createAuth } from "@daromsart/auth";
import * as schema from "../../db/schema";

/**
 * Tests d'intégration du flux de réinitialisation de mot de passe, contre la
 * base de test (TEST_DATABASE_URL). Vérifie qu'un token valide change le mot de
 * passe et qu'un token réutilisé est refusé.
 */
const url = process.env.TEST_DATABASE_URL;

const client = postgres(url ?? "", { max: 1 });
const db = drizzle(client, { schema });

let resetToken = "";

const auth = createAuth({
  db,
  schema,
  secret: "test-secret-please-change-0123456789",
  baseURL: "http://localhost:3000",
  allowSignUp: true,
  sendResetPassword: async ({ token }) => {
    resetToken = token;
  },
});

const EMAIL = `reset-${Date.now()}@daromsart.test`;
const OLD_PASSWORD = "OldPassw0rd!";
const NEW_PASSWORD = "NewPassw0rd!";

beforeAll(async () => {
  if (!url) throw new Error("TEST_DATABASE_URL manquant");
  await auth.api.signUpEmail({
    body: { email: EMAIL, password: OLD_PASSWORD, name: "Reset Test" },
  });
});

afterAll(async () => {
  await client.end({ timeout: 5 });
});

describe("réinitialisation de mot de passe", () => {
  it("génère un token puis change le mot de passe", async () => {
    await auth.api.forgetPassword({
      body: { email: EMAIL, redirectTo: "/reinitialiser" },
    });
    expect(resetToken).not.toBe("");

    await auth.api.resetPassword({
      body: { newPassword: NEW_PASSWORD, token: resetToken },
    });

    // L'ancien mot de passe ne fonctionne plus.
    await expect(
      auth.api.signInEmail({
        body: { email: EMAIL, password: OLD_PASSWORD },
      }),
    ).rejects.toThrow();

    // Le nouveau mot de passe fonctionne.
    const signedIn = await auth.api.signInEmail({
      body: { email: EMAIL, password: NEW_PASSWORD },
    });
    expect(signedIn.user.email).toBe(EMAIL);
  });

  it("refuse un token déjà utilisé", async () => {
    await expect(
      auth.api.resetPassword({
        body: { newPassword: "Another0ne!", token: resetToken },
      }),
    ).rejects.toThrow();
  });
});
