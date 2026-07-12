import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { createAuth } from "@daromsart/auth";
import { db } from "./index";
import * as schema from "./schema";
import { clientContacts, clients, memberships, organizations, user } from "./schema";
import { env } from "../lib/env";

interface SeedClient {
  type: "company" | "individual";
  displayName: string;
  legalName?: string;
  siret?: string;
  vatNumber?: string;
  email?: string;
  phone?: string;
  addressCity?: string;
  archivedAt?: Date;
  contacts?: { name: string; email?: string; role?: string }[];
}

const SEED_CLIENTS: SeedClient[] = [
  {
    type: "company",
    displayName: "Atelier Lumière SARL",
    legalName: "Atelier Lumière SARL",
    siret: "48012345600025",
    vatNumber: "FR40480123456",
    email: "contact@atelier-lumiere.fr",
    phone: "0145670001",
    addressCity: "Lyon",
    contacts: [
      { name: "Claire Dupont", email: "claire@atelier-lumiere.fr", role: "Comptabilité" },
      { name: "Marc Ferrand", email: "marc@atelier-lumiere.fr", role: "Direction" },
    ],
  },
  {
    type: "company",
    displayName: "Nova Digital",
    legalName: "Nova Digital SAS",
    siret: "52098765400012",
    vatNumber: "FR23520987654",
    email: "hello@novadigital.io",
    phone: "0148990002",
    addressCity: "Paris",
    contacts: [{ name: "Sophie Martin", email: "sophie@novadigital.io", role: "Achats" }],
  },
  {
    type: "company",
    displayName: "Boulangerie du Marché",
    legalName: "Boulangerie du Marché EURL",
    siret: "39056781200019",
    email: "contact@boulangerie-marche.fr",
    phone: "0472330003",
    addressCity: "Villeurbanne",
  },
  {
    type: "individual",
    displayName: "Jean Petit",
    email: "jean.petit@example.com",
    phone: "0611220004",
    addressCity: "Marseille",
  },
  {
    type: "individual",
    displayName: "Amandine Roy",
    email: "amandine.roy@example.com",
    phone: "0622330005",
    addressCity: "Bordeaux",
    contacts: [{ name: "Amandine Roy (pro)", email: "a.roy@proweb.fr", role: "Facturation" }],
  },
  {
    type: "company",
    displayName: "Studio Pixel",
    legalName: "Studio Pixel SAS",
    siret: "51234567800021",
    vatNumber: "FR11512345678",
    email: "compta@studiopixel.fr",
    phone: "0155440006",
    addressCity: "Nantes",
  },
  {
    type: "individual",
    displayName: "Nicolas Blanc",
    email: "nicolas.blanc@example.com",
    addressCity: "Toulouse",
  },
  {
    type: "company",
    displayName: "Ancien Client SARL",
    legalName: "Ancien Client SARL",
    email: "archive@ancien-client.fr",
    addressCity: "Lille",
    archivedAt: new Date("2025-01-15"),
  },
];

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

  // 4. Clients de démonstration (sociétés/particuliers, avec/sans contacts).
  const [{ count: existingClientCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clients)
    .where(eq(clients.organizationId, org.id));
  if (existingClientCount === 0) {
    for (const seedClient of SEED_CLIENTS) {
      const [created] = await db
        .insert(clients)
        .values({
          organizationId: org.id,
          type: seedClient.type,
          displayName: seedClient.displayName,
          legalName: seedClient.legalName,
          siret: seedClient.siret,
          vatNumber: seedClient.vatNumber,
          email: seedClient.email,
          phone: seedClient.phone,
          addressCity: seedClient.addressCity,
          archivedAt: seedClient.archivedAt,
        })
        .returning();
      if (seedClient.contacts?.length) {
        await db.insert(clientContacts).values(
          seedClient.contacts.map((c) => ({
            clientId: created.id,
            name: c.name,
            email: c.email,
            role: c.role,
          })),
        );
      }
    }
    console.info(`✓ ${SEED_CLIENTS.length} clients de démonstration créés.`);
  } else {
    console.info(`• ${existingClientCount} client(s) déjà présents.`);
  }

  console.info("Seed terminé.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
