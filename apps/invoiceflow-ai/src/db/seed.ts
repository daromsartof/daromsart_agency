import "dotenv/config";
import { and, eq, sql } from "drizzle-orm";
import { DEFAULT_TEMPLATE_OPTIONS } from "@daromsart/core";
import { db } from "./index";
import { bootstrapAdmin } from "./bootstrap-admin";
import {
  clientContacts,
  clients,
  documentTemplates,
  invoices,
  payments,
  quotes,
} from "./schema";
import { createDraft, issueQuote } from "../modules/quotes/mutations";
import {
  createDraft as createInvoiceDraft,
  issueInvoice,
} from "../modules/invoices/mutations";
import { createTemplate, setDefaultTemplate } from "../modules/templates/mutations";

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
 * Seed idempotent : bootstrap admin (voir `bootstrap-admin.ts`, partagé avec
 * le démarrage self-hosted en production) + données de démonstration
 * (clients/modèles/devis/factures — dev uniquement, jamais en prod).
 * Réexécutable sans effet de bord.
 */
async function main() {
  const { org } = await bootstrapAdmin(db);

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

  // 5. Modèles de documents (défaut "Classique" + variante "Moderne").
  const [{ count: existingTemplateCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(documentTemplates)
    .where(eq(documentTemplates.organizationId, org.id));
  let defaultTemplateId: string | null = null;
  if (existingTemplateCount === 0) {
    const classique = await createTemplate(db, org.id, {
      name: "Classique",
      type: "both",
      options: DEFAULT_TEMPLATE_OPTIONS,
    });
    if (classique.ok) {
      await setDefaultTemplate(db, org.id, classique.id);
      defaultTemplateId = classique.id;
    }
    await createTemplate(db, org.id, {
      name: "Moderne",
      type: "both",
      options: { ...DEFAULT_TEMPLATE_OPTIONS, accentColor: "#28C76F", font: "serif" },
    });
    console.info("✓ 2 modèles de démonstration créés (Classique = défaut, Moderne).");
  } else {
    console.info(`• ${existingTemplateCount} modèle(s) déjà présents.`);
    const [existingDefault] = await db
      .select({ id: documentTemplates.id })
      .from(documentTemplates)
      .where(
        and(eq(documentTemplates.organizationId, org.id), eq(documentTemplates.isDefault, true)),
      )
      .limit(1);
    defaultTemplateId = existingDefault?.id ?? null;
  }

  // 6. Devis de démonstration (brouillons variés : mono/multi-taux, remises).
  const [{ count: existingQuoteCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(quotes)
    .where(eq(quotes.organizationId, org.id));
  if (existingQuoteCount === 0) {
    const seedClients = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.organizationId, org.id))
      .limit(6);

    if (seedClients.length < 6) {
      console.warn("• Pas assez de clients pour semer 6 devis — étape ignorée.");
    } else {
      const [c1, c2, c3, c4, c5, c6] = seedClients;
      const issueDate = new Date();
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 30);

      const quote1 = await createDraft(db, org.id, {
        clientId: c1.id,
        templateId: defaultTemplateId,
        issueDate,
        validUntil,
        lines: [
          { description: "Développement site vitrine", quantity: 1, unitPriceCents: 350000, vatRate: 20 },
        ],
      });
      const quote2 = await createDraft(db, org.id, {
        clientId: c2.id,
        issueDate,
        validUntil,
        lines: [
          { description: "Prestation de conseil", quantity: 5, unitPriceCents: 60000, vatRate: 20 },
          { description: "Formation équipe (1 jour)", quantity: 1, unitPriceCents: 80000, vatRate: 10 },
        ],
      });
      // 2 devis émis (numéro + share_token) pour peupler la story 08 (PDF, détail, activité).
      if (quote1.ok) await issueQuote(db, org.id, quote1.id);
      if (quote2.ok) await issueQuote(db, org.id, quote2.id);
      await createDraft(db, org.id, {
        clientId: c3.id,
        issueDate,
        validUntil,
        globalDiscount: { type: "percent", value: 10 },
        lines: [
          { description: "Maintenance mensuelle", quantity: 12, unitPriceCents: 15000, vatRate: 20 },
        ],
      });
      await createDraft(db, org.id, {
        clientId: c4.id,
        issueDate,
        validUntil,
        lines: [
          {
            description: "Audit sécurité",
            quantity: 1,
            unitPriceCents: 120000,
            vatRate: 20,
            discount: { type: "amount", value: 10000 },
          },
        ],
      });
      await createDraft(db, org.id, {
        clientId: c5.id,
        issueDate,
        validUntil,
        notes: "Devis pour association loi 1901 — franchise en base de TVA.",
        lines: [
          { description: "Refonte identité visuelle", quantity: 1, unitPriceCents: 90000, vatRate: 0 },
        ],
      });
      await createDraft(db, org.id, {
        clientId: c6.id,
        issueDate,
        validUntil,
        globalDiscount: { type: "amount", value: 5000 },
        lines: [
          { description: "Prestation A", quantity: 0.5, unitPriceCents: 100000, vatRate: 20 },
          { description: "Prestation B", quantity: 3, unitPriceCents: 25000, vatRate: 5.5 },
        ],
      });
      console.info("✓ 6 devis de démonstration créés (dont 2 émis).");
    }
  } else {
    console.info(`• ${existingQuoteCount} devis déjà présents.`);
  }

  // 7. Factures de démonstration (brouillons, émises à échéance future, échues, payée, annulée).
  const [{ count: existingInvoiceCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(invoices)
    .where(eq(invoices.organizationId, org.id));
  if (existingInvoiceCount === 0) {
    const invoiceClients = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.organizationId, org.id), sql`${clients.archivedAt} is null`))
      .limit(7);

    if (invoiceClients.length < 7) {
      console.warn("• Pas assez de clients pour semer 10 factures — étape ignorée.");
    } else {
      const [c1, c2, c3, c4, c5, c6, c7] = invoiceClients;
      const issueDate = new Date();
      const dueInFuture = new Date();
      dueInFuture.setDate(dueInFuture.getDate() + 30);
      const dueOverdue = new Date();
      dueOverdue.setDate(dueOverdue.getDate() - 15);

      // 3 brouillons.
      await createInvoiceDraft(db, org.id, {
        clientId: c1.id,
        templateId: defaultTemplateId,
        issueDate,
        validUntil: dueInFuture,
        lines: [
          { description: "Développement fonctionnalité sur-mesure", quantity: 1, unitPriceCents: 280000, vatRate: 20 },
        ],
      });
      await createInvoiceDraft(db, org.id, {
        clientId: c2.id,
        issueDate,
        validUntil: dueInFuture,
        lines: [
          { description: "Prestation de conseil", quantity: 3, unitPriceCents: 60000, vatRate: 20 },
        ],
      });
      await createInvoiceDraft(db, org.id, {
        clientId: c3.id,
        issueDate,
        validUntil: dueInFuture,
        globalDiscount: { type: "percent", value: 5 },
        lines: [
          { description: "Maintenance mensuelle", quantity: 1, unitPriceCents: 15000, vatRate: 20 },
        ],
      });

      // 2 émises, échéance à venir (pas en retard).
      const invoice4 = await createInvoiceDraft(db, org.id, {
        clientId: c4.id,
        issueDate,
        validUntil: dueInFuture,
        lines: [
          { description: "Audit sécurité", quantity: 1, unitPriceCents: 120000, vatRate: 20 },
        ],
      });
      if (invoice4.ok) await issueInvoice(db, org.id, invoice4.id);

      const invoice5 = await createInvoiceDraft(db, org.id, {
        clientId: c5.id,
        issueDate,
        validUntil: dueInFuture,
        lines: [
          { description: "Refonte identité visuelle", quantity: 1, unitPriceCents: 90000, vatRate: 0 },
        ],
      });
      if (invoice5.ok) await issueInvoice(db, org.id, invoice5.id);

      // 3 émises, échues (en retard — calculé, jamais stocké tel quel).
      const invoice6 = await createInvoiceDraft(db, org.id, {
        clientId: c6.id,
        issueDate,
        validUntil: dueOverdue,
        lines: [
          { description: "Formation équipe (1 jour)", quantity: 1, unitPriceCents: 80000, vatRate: 10 },
        ],
      });
      if (invoice6.ok) await issueInvoice(db, org.id, invoice6.id);

      const invoice7 = await createInvoiceDraft(db, org.id, {
        clientId: c7.id,
        issueDate,
        validUntil: dueOverdue,
        globalDiscount: { type: "amount", value: 5000 },
        lines: [
          { description: "Prestation A", quantity: 2, unitPriceCents: 45000, vatRate: 20 },
        ],
      });
      if (invoice7.ok) await issueInvoice(db, org.id, invoice7.id);

      const invoice8 = await createInvoiceDraft(db, org.id, {
        clientId: c1.id,
        issueDate,
        validUntil: dueOverdue,
        lines: [
          { description: "Développement site vitrine", quantity: 1, unitPriceCents: 350000, vatRate: 20 },
        ],
      });
      if (invoice8.ok) await issueInvoice(db, org.id, invoice8.id);

      // 1 payée (règlement seed direct — pas de flux paiement avant la story 15).
      const invoice9 = await createInvoiceDraft(db, org.id, {
        clientId: c2.id,
        issueDate,
        validUntil: dueInFuture,
        lines: [
          { description: "Prestation B", quantity: 4, unitPriceCents: 25000, vatRate: 5.5 },
        ],
      });
      if (invoice9.ok) {
        await issueInvoice(db, org.id, invoice9.id);
        const [row] = await db
          .select({ totalCents: invoices.totalCents })
          .from(invoices)
          .where(eq(invoices.id, invoice9.id));
        const paidAt = new Date();
        await db
          .update(invoices)
          .set({ status: "paid", amountPaidCents: row.totalCents, paidAt })
          .where(eq(invoices.id, invoice9.id));
        // Ligne `payments` (structure posée story 12, flux réel story 15) —
        // alimente "Encaissé ce mois-ci" sur `/factures` dès la démo.
        await db.insert(payments).values({
          invoiceId: invoice9.id,
          paidAt,
          amountCents: row.totalCents,
          method: "transfer",
        });
      }

      // 1 annulée.
      const invoice10 = await createInvoiceDraft(db, org.id, {
        clientId: c3.id,
        issueDate,
        validUntil: dueInFuture,
        lines: [
          { description: "Prestation ponctuelle annulée", quantity: 1, unitPriceCents: 50000, vatRate: 20 },
        ],
      });
      if (invoice10.ok) {
        await issueInvoice(db, org.id, invoice10.id);
        await db
          .update(invoices)
          .set({ status: "cancelled", cancelledAt: new Date() })
          .where(eq(invoices.id, invoice10.id));
      }

      console.info("✓ 10 factures de démonstration créées (brouillons, émises, échues, payée, annulée).");
    }
  } else {
    console.info(`• ${existingInvoiceCount} facture(s) déjà présentes.`);
  }

  console.info("Seed terminé.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
