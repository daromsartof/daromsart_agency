import "server-only";
import { db } from "../../db";
import { organizations } from "../../db/schema";

/**
 * Organisation émettrice. Multi-tenant prêt en schéma (H4) mais une seule
 * organisation en pratique : on prend la première (créée par le seed).
 */
export async function getOrg() {
  const [org] = await db.select().from(organizations).limit(1);
  if (!org) {
    throw new Error("Aucune organisation en base — exécuter le seed (db:seed).");
  }
  return org;
}
