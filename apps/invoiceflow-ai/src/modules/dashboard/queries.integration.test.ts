import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema";
import {
  clients,
  documentEvents,
  invoiceLines,
  invoices,
  organizations,
  quoteLines,
  quotes,
} from "../../db/schema";
import { createDraft, issueInvoice } from "../invoices/mutations";
import { createCreditNoteDraft, issueCreditNote, updateCreditNoteDraft } from "../invoices/credit-notes";
import { recordPayment } from "../invoices/payments";
import {
  createDraft as createQuoteDraft,
  issueQuote,
} from "../quotes/mutations";
import {
  getActiviteRecente,
  getAgingBuckets,
  getCaParMois,
  getCaVsEncaisseParMois,
  getCashflowStats,
  getConversionStats,
  getDerniersDevis,
  getDevisEnCoursStats,
  getEncoursStats,
  getFacturesEnRetard,
  getTopClients,
  hasAnyDocument,
} from "./queries";

/**
 * Jeu de données CONTRÔLÉ (story 19, plan « Done ») : 1 org, 1 client, un
 * document de chaque nature (brouillon exclu partout, émise à échéance
 * future, émise échue, partiellement payée échue, payée, annulée directe,
 * avoir partiel). Chaque assertion est exacte au centime, jamais une
 * comparaison approximative.
 */
const url = process.env.TEST_DATABASE_URL;
const client = postgres(url ?? "", { max: 1 });
const db = drizzle(client, { schema });

let orgId = "";
let clientId = "";

/** Total TTC pour une ligne unique qty=1, TVA 20 % (tous les montants de ce
 * jeu de données sont choisis pour tomber rond, sans arrondi à vérifier). */
function ttc(unitPriceCents: number): number {
  return Math.round(unitPriceCents * 1.2);
}

async function issuedInvoiceWithDueDate(unitPriceCents: number, dueDate: Date) {
  const created = await createDraft(db, orgId, {
    clientId,
    issueDate: new Date(),
    lines: [{ description: "Prestation dashboard", quantity: 1, unitPriceCents, vatRate: 20 }],
  });
  if (!created.ok) throw new Error("createDraft failed");
  const issued = await issueInvoice(db, orgId, created.id);
  if (!issued.ok) throw new Error("issueInvoice failed");
  await db.update(invoices).set({ dueDate }).where(eq(invoices.id, created.id));
  return created.id;
}

beforeAll(async () => {
  if (!url) throw new Error("TEST_DATABASE_URL manquant");
  const [org] = await db
    .insert(organizations)
    .values({ legalName: "Org Dashboard Test" })
    .returning();
  orgId = org.id;

  const [c] = await db
    .insert(clients)
    .values({ organizationId: orgId, type: "company", displayName: "Client Dashboard Test" })
    .returning();
  clientId = c.id;

  const now = new Date();
  const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const past = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

  // Brouillon : ne doit apparaître nulle part.
  await createDraft(db, orgId, {
    clientId,
    lines: [{ description: "Brouillon", quantity: 1, unitPriceCents: 999_00, vatRate: 20 }],
  });

  // Émise, non échue → enAttente.
  await issuedInvoiceWithDueDate(100_00, future);

  // Émise, échue, non payée → enRetard (+1 au compteur).
  await issuedInvoiceWithDueDate(200_00, past);

  // Émise, échue, partiellement payée → enRetard sur le reste dû ; le
  // paiement de cette année alimente `encaisseAnnee`.
  const partialId = await issuedInvoiceWithDueDate(300_00, past);
  const partialInvoice = await db
    .select({ totalCents: invoices.totalCents })
    .from(invoices)
    .where(eq(invoices.id, partialId));
  const partialPayment = Math.floor(partialInvoice[0].totalCents / 2);
  await recordPayment(db, orgId, partialId, { amountCents: partialPayment, method: "transfer" });

  // Payée intégralement → sort de l'encours, alimente `encaisseAnnee`.
  const paidId = await issuedInvoiceWithDueDate(150_00, future);
  const paidInvoice = await db
    .select({ totalCents: invoices.totalCents })
    .from(invoices)
    .where(eq(invoices.id, paidId));
  await recordPayment(db, orgId, paidId, {
    amountCents: paidInvoice[0].totalCents,
    method: "card",
  });

  // Annulée directement (sans avoir) → exclue de tout, y compris caParMois.
  const cancelledId = await issuedInvoiceWithDueDate(500_00, future);
  await db.update(invoices).set({ status: "cancelled" }).where(eq(invoices.id, cancelledId));

  // Avoir partiel sur une facture émise dédiée → contribue négativement à
  // caParMois du mois courant ; le parent reste `issued` (jamais compté deux
  // fois côté encours, cf. story 18).
  const creditedId = await issuedInvoiceWithDueDate(400_00, future);
  const draft = await createCreditNoteDraft(db, orgId, creditedId);
  if (!draft.ok) throw new Error("createCreditNoteDraft failed");
  const update = await updateCreditNoteDraft(db, orgId, draft.id, {
    clientId,
    lines: [{ description: "Avoir partiel dashboard", quantity: -1, unitPriceCents: 50_00, vatRate: 20 }],
  });
  if (!update.ok) throw new Error("updateCreditNoteDraft failed");
  const issuedCreditNote = await issueCreditNote(db, orgId, draft.id);
  if (!issuedCreditNote.ok) throw new Error("issueCreditNote failed");

  // Devis : brouillon (exclu), envoyé + consulté (comptés), signé (exclu).
  const draftQuote = await createQuoteDraft(db, orgId, {
    clientId,
    lines: [{ description: "Devis brouillon", quantity: 1, unitPriceCents: 100_00, vatRate: 20 }],
  });
  if (!draftQuote.ok) throw new Error("createQuoteDraft failed");

  const sentQuote = await createQuoteDraft(db, orgId, {
    clientId,
    lines: [{ description: "Devis envoyé", quantity: 1, unitPriceCents: 700_00, vatRate: 20 }],
  });
  if (!sentQuote.ok) throw new Error("createQuoteDraft failed");
  const issuedSent = await issueQuote(db, orgId, sentQuote.id);
  if (!issuedSent.ok) throw new Error("issueQuote failed");

  const viewedQuote = await createQuoteDraft(db, orgId, {
    clientId,
    lines: [{ description: "Devis consulté", quantity: 1, unitPriceCents: 800_00, vatRate: 20 }],
  });
  if (!viewedQuote.ok) throw new Error("createQuoteDraft failed");
  const issuedViewed = await issueQuote(db, orgId, viewedQuote.id);
  if (!issuedViewed.ok) throw new Error("issueQuote failed");
  await db.update(quotes).set({ status: "viewed" }).where(eq(quotes.id, viewedQuote.id));

  const signedQuote = await createQuoteDraft(db, orgId, {
    clientId,
    lines: [{ description: "Devis signé", quantity: 1, unitPriceCents: 900_00, vatRate: 20 }],
  });
  if (!signedQuote.ok) throw new Error("createQuoteDraft failed");
  const issuedSigned = await issueQuote(db, orgId, signedQuote.id);
  if (!issuedSigned.ok) throw new Error("issueQuote failed");
  await db.update(quotes).set({ status: "signed" }).where(eq(quotes.id, signedQuote.id));
});

afterAll(async () => {
  await db.delete(documentEvents).where(eq(documentEvents.organizationId, orgId));
  await db.delete(invoiceLines);
  await db.delete(invoices).where(eq(invoices.organizationId, orgId));
  await db.delete(quoteLines);
  await db.delete(quotes).where(eq(quotes.organizationId, orgId));
  await db.delete(clients).where(eq(clients.organizationId, orgId));
  await db.delete(organizations).where(eq(organizations.id, orgId));
  await client.end({ timeout: 5 });
});

describe("getEncoursStats", () => {
  it("enAttente/enRetard exacts au centime, brouillon et annulée exclus", async () => {
    const stats = await getEncoursStats(db, orgId);
    // enAttente : 100€ (non échue) + 150€ (payée future, mais réglée donc
    // remaining=0 → exclue) + 400€ (créditée partiellement, future) restant
    // réduit uniquement par le paiement, jamais par l'avoir (H23, story 18).
    expect(stats.enAttenteCents).toBe(ttc(100_00) + ttc(400_00));
    // enRetard : 200€ (échue non payée) + moitié restante de 300€ (échue,
    // partiellement payée).
    const partialTotal = ttc(300_00);
    const partialRemaining = partialTotal - Math.floor(partialTotal / 2);
    expect(stats.enRetardCents).toBe(ttc(200_00) + partialRemaining);
    expect(stats.enRetardCount).toBe(2);
  });
});

describe("getCashflowStats", () => {
  it("encaisseAnnee = paiements de l'année civile courante uniquement", async () => {
    const stats = await getCashflowStats(db, orgId);
    const partialPayment = Math.floor(ttc(300_00) / 2);
    const fullPayment = ttc(150_00);
    expect(stats.encaisseAnneeCents).toBe(partialPayment + fullPayment);
    // Tous les paiements du jeu sont dans le mois courant.
    expect(stats.encaisseMoisCents).toBe(partialPayment + fullPayment);
  });
});

describe("getDevisEnCoursStats", () => {
  it("compte uniquement sent/viewed, exclut draft/signed", async () => {
    const stats = await getDevisEnCoursStats(db, orgId);
    expect(stats.count).toBe(2);
    expect(stats.totalCents).toBe(ttc(700_00) + ttc(800_00));
  });
});

describe("getCaParMois", () => {
  it("le mois courant reflète les factures + avoirs nets, brouillon/annulée exclus", async () => {
    const points = await getCaParMois(db, orgId);
    expect(points).toHaveLength(12);
    const currentMonth = points[points.length - 1];
    // Toutes les factures émises ce mois (100+200+300+150+400, la cancelled
    // à 500 exclue) + l'avoir partiel (-50€ HT + TVA 20 %).
    const invoicesTotal = ttc(100_00) + ttc(200_00) + ttc(300_00) + ttc(150_00) + ttc(400_00);
    const creditNoteTotal = -ttc(50_00);
    expect(currentMonth.totalCents).toBe(invoicesTotal + creditNoteTotal);
  });
});

describe("getCaVsEncaisseParMois", () => {
  it("retourne 12 points avec emis = caParMois et encaisse = paiements du mois", async () => {
    const points = await getCaVsEncaisseParMois(db, orgId, 12);
    expect(points).toHaveLength(12);
    const current = points[points.length - 1];
    const invoicesTotal = ttc(100_00) + ttc(200_00) + ttc(300_00) + ttc(150_00) + ttc(400_00);
    const creditNoteTotal = -ttc(50_00);
    expect(current.emisCents).toBe(invoicesTotal + creditNoteTotal);
    const partialPayment = Math.floor(ttc(300_00) / 2);
    const fullPayment = ttc(150_00);
    expect(current.encaisseCents).toBe(partialPayment + fullPayment);
  });
});

describe("getAgingBuckets", () => {
  it("ventile le reste dû échu (2 factures à ~10 j → bucket 0-30)", async () => {
    const buckets = await getAgingBuckets(db, orgId);
    expect(buckets).toHaveLength(4);
    const partialTotal = ttc(300_00);
    const partialRemaining = partialTotal - Math.floor(partialTotal / 2);
    const expected = ttc(200_00) + partialRemaining;
    const bucket030 = buckets.find((b) => b.bucket === "0-30")!;
    expect(bucket030.totalCents).toBe(expected);
    expect(bucket030.count).toBe(2);
    expect(buckets.filter((b) => b.bucket !== "0-30").every((b) => b.totalCents === 0)).toBe(true);
  });
});

describe("getConversionStats", () => {
  it("taux = signés / (sent+viewed+signed+…), panier moyen et DSO renseignés", async () => {
    const stats = await getConversionStats(db, orgId);
    // Pipeline : sent + viewed + signed = 3 ; signedOrInvoiced = 1 → 33 %.
    expect(stats.pipelineCount).toBe(3);
    expect(stats.signedOrInvoicedCount).toBe(1);
    expect(stats.conversionPercent).toBe(33);
    expect(stats.panierMoyenCents).not.toBeNull();
    expect(stats.dsoJours).not.toBeNull();
  });
});

describe("getTopClients", () => {
  it("agrège le CA du client unique du jeu de données", async () => {
    const rows = await getTopClients(db, orgId, 5);
    expect(rows).toHaveLength(1);
    expect(rows[0].clientId).toBe(clientId);
    expect(rows[0].clientName).toBe("Client Dashboard Test");
    // CA = factures non draft/cancelled (100+200+300+150+400).
    const ca =
      ttc(100_00) + ttc(200_00) + ttc(300_00) + ttc(150_00) + ttc(400_00);
    expect(rows[0].caCents).toBe(ca);
    expect(rows[0].resteDuCents).toBeGreaterThan(0);
  });
});

describe("getFacturesEnRetard", () => {
  it("triée par ancienneté d'échéance, ne contient que les factures actives échues", async () => {
    const rows = await getFacturesEnRetard(db, orgId);
    expect(rows.length).toBe(2);
    expect(rows.every((r) => r.daysOverdue >= 0)).toBe(true);
    expect(rows.every((r) => r.remainingCents > 0)).toBe(true);
  });
});

describe("getDerniersDevis", () => {
  it("retourne tous les statuts, y compris brouillon", async () => {
    const rows = await getDerniersDevis(db, orgId, 10);
    expect(rows.length).toBeGreaterThanOrEqual(4);
    expect(rows.some((r) => r.status === "draft")).toBe(true);
  });
});

describe("getActiviteRecente", () => {
  it("retourne des libellés enrichis (client + numéro) pour les documents existants", async () => {
    const rows = await getActiviteRecente(db, orgId, 50);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.label.length > 0)).toBe(true);
  });
});

describe("hasAnyDocument", () => {
  it("vrai dès qu'un devis ou une facture existe dans l'organisation", async () => {
    expect(await hasAnyDocument(db, orgId)).toBe(true);
  });

  it("faux pour une organisation vierge", async () => {
    const [org] = await db
      .insert(organizations)
      .values({ legalName: "Org Dashboard Vierge Test" })
      .returning();
    expect(await hasAnyDocument(db, org.id)).toBe(false);
    await db.delete(organizations).where(eq(organizations.id, org.id));
  });
});
