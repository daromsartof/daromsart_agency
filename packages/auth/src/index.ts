import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

/** Rôles applicatifs (portés par la table `memberships`, pas par Better Auth). */
export type Role = "admin" | "member";
export const ROLES: readonly Role[] = ["admin", "member"] as const;

export interface CreateAuthParams {
  /** Instance Drizzle (postgres-js). */
  db: Parameters<typeof drizzleAdapter>[0];
  /** Schéma Drizzle contenant au moins user/session/account/verification. */
  schema: Record<string, unknown>;
  secret: string;
  baseURL: string;
  trustedOrigins?: string[];
  /**
   * Autorise l'inscription par email. Faux par défaut : l'app publique ne peut
   * pas créer de compte (accès sur invitation). Le seed et les invitations
   * utilisent une instance avec `allowSignUp: true`.
   */
  allowSignUp?: boolean;
  /** Envoi de l'email de réinitialisation (injecté par l'app). */
  sendResetPassword: (params: {
    email: string;
    url: string;
    token: string;
  }) => Promise<void>;
}

export function createAuth(params: CreateAuthParams) {
  return betterAuth({
    secret: params.secret,
    baseURL: params.baseURL,
    trustedOrigins: params.trustedOrigins,
    database: drizzleAdapter(params.db, {
      provider: "pg",
      schema: params.schema,
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !params.allowSignUp,
      sendResetPassword: async ({ user, url, token }) => {
        await params.sendResetPassword({ email: user.email, url, token });
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"];
