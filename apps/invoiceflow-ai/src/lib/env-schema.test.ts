import { describe, expect, it } from "vitest";
import { parseEnv } from "./env-schema";

const base = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  BETTER_AUTH_SECRET: "secret",
  BETTER_AUTH_URL: "http://localhost:3000",
  APP_URL: "http://localhost:3000",
};

describe("parseEnv", () => {
  it("valide un environnement complet et applique les défauts", () => {
    const env = parseEnv(base);
    expect(env.DATABASE_URL).toBe(base.DATABASE_URL);
    expect(env.STORAGE_DRIVER).toBe("fs");
    expect(env.EMAIL_FROM).toContain("Daromsart Système");
    expect(env.ANTHROPIC_API_KEY).toBe("");
    expect(env.GOOGLE_GENERATIVE_AI_API_KEY).toBe("");
    expect(env.OPENAI_API_KEY).toBe("");
    expect(env.OLLAMA_WORKER_URL).toBe("");
  });

  it("lève une erreur si une variable requise manque", () => {
    const { BETTER_AUTH_SECRET: _omit, ...incomplete } = base;
    expect(() => parseEnv(incomplete)).toThrowError(/BETTER_AUTH_SECRET/);
  });

  it("rejette une URL invalide", () => {
    expect(() => parseEnv({ ...base, APP_URL: "pas-une-url" })).toThrowError(
      /APP_URL/,
    );
  });

  it("rejette un driver de stockage inconnu", () => {
    expect(() =>
      parseEnv({ ...base, STORAGE_DRIVER: "gcs" }),
    ).toThrowError(/STORAGE_DRIVER/);
  });
});
