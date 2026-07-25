import { z } from "zod";

/**
 * Schéma des variables d'environnement. Séparé du singleton `env` pour rester
 * testable (aucun effet de bord à l'import).
 */
export const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "requis"),
  TEST_DATABASE_URL: z.string().optional(),

  BETTER_AUTH_SECRET: z.string().min(1, "requis"),
  BETTER_AUTH_URL: z.string().url(),
  APP_URL: z.string().url(),

  RESEND_API_KEY: z.string().optional().default(""),
  RESEND_WEBHOOK_SECRET: z.string().optional().default(""),
  EMAIL_FROM: z
    .string()
    .min(1)
    .default("Daromsart Système <no-reply@example.com>"),

  STORAGE_DRIVER: z.enum(["fs", "s3"]).default("fs"),
  STORAGE_BUCKET: z.string().optional().default(""),
  STORAGE_ENDPOINT: z.string().optional().default(""),
  STORAGE_REGION: z.string().optional().default("auto"),
  STORAGE_ACCESS_KEY_ID: z.string().optional().default(""),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional().default(""),
  STORAGE_PUBLIC_URL: z.string().optional().default(""),

  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),

  // Copilote agent (mode agent). Vide = provider désactivé.
  // Au moins une clé doit être renseignée pour activer le chat.
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  // Clé Google AI Studio / Gemini (free tier) — https://aistudio.google.com/apikey
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional().default(""),
  // Clé OpenAI (GPT-5.4…) — https://platform.openai.com/api-keys
  OPENAI_API_KEY: z.string().optional().default(""),
  // IA locale (Ollama/GPU) via le worker Python. URL de base du worker
  // (ex. http://localhost:8000). Vide = provider local désactivé.
  OLLAMA_WORKER_URL: z.string().optional().default(""),
});

export type Env = z.infer<typeof envSchema>;

/** Parse et valide un objet d'environnement. Lève une erreur explicite sinon. */
export function parseEnv(raw: NodeJS.ProcessEnv | Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(racine)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Variables d'environnement invalides :\n${issues}`);
  }
  return parsed.data;
}
