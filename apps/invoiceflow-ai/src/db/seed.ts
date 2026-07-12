import "dotenv/config";
import { eq } from "drizzle-orm";
import { createAuth } from "@daromsart/auth";
import { db } from "./index";
import * as schema from "./schema";
import { memberships, organizations, user } from "./schema";
import { env } from "../lib/env";

/**
 * Seed idempotent : crée l'organisation émettrice et le compte administrateur
 * initial (accès sur invitation ensuite). Réexécutable sans effet de bord.
 *
 * Variables requises : SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD.
 */
async function main() {
  const email = env.SEED_ADMIN_EMAIL;
  const password = env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "SEED_ADMIN_EMAIL et SEED_ADMIN_PASSWORD sont requis pour le seed (voir .env).",
    );
  }

  // Instance dédiée autorisant l'inscription (l'app publique la désactive).
  const seedAuth = createAuth({
    db,
    schema,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    allowSignUp: true,
    sendResetPassword: async () => {},
  });

  // 1. Organisation émettrice (une seule en pratique).
  let [org] = await db.select().from(organizations).limit(1);
  if (!org) {
    [org] = await db
      .insert(organizations)
      .values({ legalName: "Daromsart" })
      .returning();
    console.info(`✓ Organisation créée : ${org.legalName} (${org.id})`);
  } else {
    console.info(`• Organisation existante : ${org.legalName} (${org.id})`);
  }

  // 2. Compte administrateur.
  let [admin] = await db
    .select()
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  if (!admin) {
    await seedAuth.api.signUpEmail({
      body: { email, password, name: "Administrateur" },
    });
    [admin] = await db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    console.info(`✓ Administrateur créé : ${email}`);
  } else {
    console.info(`• Administrateur existant : ${email}`);
  }

  if (!admin) {
    throw new Error("Échec de la création de l'administrateur.");
  }

  // 3. Adhésion admin (idempotente grâce à l'index unique user+org).
  const [existingMembership] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, admin.id))
    .limit(1);
  if (!existingMembership) {
    await db.insert(memberships).values({
      userId: admin.id,
      organizationId: org.id,
      role: "admin",
    });
    console.info("✓ Adhésion admin créée.");
  } else {
    console.info("• Adhésion admin existante.");
  }

  console.info("Seed terminé.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
