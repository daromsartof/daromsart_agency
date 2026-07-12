import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { memberships } from "../../db/schema";
import type { Role } from "@daromsart/auth";
import { auth } from "./auth";

/** Session courante ou `null` (aucune redirection). */
export async function getSession() {
  return auth.api.getSession({ headers: headers() });
}

/**
 * Exige une session valide. Redirige vers /connexion sinon.
 * Retourne l'utilisateur et sa session.
 */
export async function requireSession() {
  const session = await getSession();
  if (!session) {
    redirect("/connexion");
  }
  return session;
}

/** Rôle applicatif de l'utilisateur dans une organisation (ou `null`). */
export async function getMembershipRole(
  userId: string,
  organizationId: string,
): Promise<Role | null> {
  const [row] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.organizationId, organizationId),
      ),
    )
    .limit(1);
  return row?.role ?? null;
}

/**
 * Exige une session dont l'utilisateur est `admin` d'au moins une organisation.
 * Redirige vers /connexion sans session, sinon renvoie 403 via `notFound`-like.
 */
export async function requireAdmin() {
  const session = await requireSession();
  const [row] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, session.user.id),
        eq(memberships.role, "admin"),
      ),
    )
    .limit(1);
  if (!row) {
    redirect("/");
  }
  return session;
}
