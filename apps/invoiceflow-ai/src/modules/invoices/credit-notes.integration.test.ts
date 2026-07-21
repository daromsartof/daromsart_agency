import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema";
import { clients, invoiceLines, invoices, numberSequences, organizations } from "../../db/schema";
import { createDraft, duplicate, issueInvoice, updateDraft } from "./mutations";
import { getInvoiceById, getClientInvoiceStats } from "./queries";
import { recordPayment } from "./payments";
import {
  createCreditNoteDraft,
  issueCreditNote,
  updateCreditNoteDraft,
} from "./credit-notes";

const url = process.env.TEST_DATABASE_URL;
const client = postgres(url ?? "", { max: 1 });
const db = drizzle(client, { schema });

let orgId = "";
let clientId = "";

beforeAll(async () => {
  if (!url) throw new Error("TEST_DATABASE_URL manquant");
  const [org] = await db
    .insert(organizations)
    .values({ legalName: "Org Credit Notes Test" })
    .returning();
  orgId = org.id;

  const [c] = await db
    .insert(clients)
    .values({ organizationId: orgId, type: "company", displayName: "Client Credit Notes Test" })
    .returning();
  clientId = c.id;
});

afterAll(async () => {
  await db.delete(invoiceLines);
  await db.delete(invoices).where(eq(invoices.organizationId, orgId));
  await db.delete(clients).where(eq(clients.organizationId, orgId));
  await db.delete(organizations).where(eq(organizations.id, orgId));
  await client.end({ timeout: 5 });
});

async function issuedInvoice(unitPriceCents = 100000) {
  const created = await createDraft(db, orgId, {
    clientId,
    lines: [
      { description: "Prestation A", quantity: 2, unitPriceCents, vatRate: 20 },
      { description: "Prestation B", quantity: 1, unitPriceCents: 5000, vatRate: 10 },
    ],
  });
  if (!created.ok) throw new Error("createDraft failed");
  const issued = await issueInvoice(db, orgId, created.id);
  if (!issued.ok) throw new Error("issueInvoice failed");
  const invoice = await getInvoiceById(db, orgId, created.id);
  if (!invoice) throw new Error("invoice not found");
  return invoice;
}

describe("createCreditNoteDraft", () => {
  it("copie intégrale négative : lignes, totaux au centime, kind/parent posés", async () => {
    const invoice = await issuedInvoice();
    const result = await createCreditNoteDraft(db, orgId, invoice.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const creditNote = await getInvoiceById(db, orgId, result.id);
    expect(creditNote?.kind).toBe("credit_note");
    expect(creditNote?.parentInvoiceId).toBe(invoice.id);
    expect(creditNote?.status).toBe("draft");
    expect(creditNote?.lines).toHaveLength(2);
    expect(creditNote?.lines.every((l) => l.quantity < 0)).toBe(true);
    expect(creditNote?.subtotalCents).toBe(-invoice.subtotalCents);
    // `invoice.discountCents` vaut 0 ici (pas de remise) : `-0 !== 0` pour
    // `Object.is` (utilisé par `toBe`) — `||` normalise -0 en 0 (falsy).
    expect(creditNote?.discountCents || 0).toBe(0);
    expect(creditNote?.totalCents).toBe(-invoice.totalCents);
    for (const rate of Object.keys(invoice.vatByRate)) {
      expect(creditNote?.vatByRate[rate]).toBe(-invoice.vatByRate[rate]);
    }
  });

  it("refuse un avoir sur un avoir (kind doit être invoice)", async () => {
    const invoice = await issuedInvoice();
    const firstCreditNote = await createCreditNoteDraft(db, orgId, invoice.id);
    expect(firstCreditNote.ok).toBe(true);
    if (!firstCreditNote.ok) return;

    const result = await createCreditNoteDraft(db, orgId, firstCreditNote.id);
    expect(result.ok).toBe(false);
  });

  it("refuse un avoir sur une facture brouillon", async () => {
    const created = await createDraft(db, orgId, {
      clientId,
      lines: [{ description: "Prestation", quantity: 1, unitPriceCents: 10000, vatRate: 20 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await createCreditNoteDraft(db, orgId, created.id);
    expect(result.ok).toBe(false);
  });

  it("refuse un avoir sur une facture déjà annulée", async () => {
    const invoice = await issuedInvoice();
    await db.update(invoices).set({ status: "cancelled" }).where(eq(invoices.id, invoice.id));

    const result = await createCreditNoteDraft(db, orgId, invoice.id);
    expect(result.ok).toBe(false);
  });
});

describe("issueCreditNote — avoir total", () => {
  it("émet l'avoir total : séquence AV, parent passe à cancelled + event", async () => {
    const invoice = await issuedInvoice();
    const draft = await createCreditNoteDraft(db, orgId, invoice.id);
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;

    const result = await issueCreditNote(db, orgId, draft.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.number).toMatch(/^AV-\d{4}-\d{4}$/);
    expect(result.parentCancelled).toBe(true);

    const parentAfter = await getInvoiceById(db, orgId, invoice.id);
    expect(parentAfter?.status).toBe("cancelled");

    const creditNoteAfter = await getInvoiceById(db, orgId, draft.id);
    expect(creditNoteAfter?.status).toBe("issued");
  });

  it("séquences indépendantes : émettre un avoir n'incrémente jamais le compteur 'invoice'", async () => {
    const year = new Date().getFullYear();
    const invoiceSeqBefore = await db
      .select({ lastNumber: numberSequences.lastNumber })
      .from(numberSequences)
      .where(
        and(
          eq(numberSequences.organizationId, orgId),
          eq(numberSequences.documentType, "invoice"),
          eq(numberSequences.year, year),
        ),
      );

    const invoice = await issuedInvoice();
    const draft = await createCreditNoteDraft(db, orgId, invoice.id);
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    const result = await issueCreditNote(db, orgId, draft.id);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.number).toMatch(/^AV-\d{4}-\d{4}$/);

    const [invoiceSeqAfter] = await db
      .select({ lastNumber: numberSequences.lastNumber })
      .from(numberSequences)
      .where(
        and(
          eq(numberSequences.organizationId, orgId),
          eq(numberSequences.documentType, "invoice"),
          eq(numberSequences.year, year),
        ),
      );
    // La facture ISSUE ce test A incrémenté le compteur "invoice" de 1 (elle
    // est bien une facture) — mais l'émission de l'AVOIR qui suit ne doit
    // JAMAIS le toucher davantage.
    expect(invoiceSeqAfter.lastNumber).toBe((invoiceSeqBefore[0]?.lastNumber ?? 0) + 1);
  });
});

describe("issueCreditNote — avoir partiel", () => {
  it("un avoir partiel émis laisse le parent inchangé et borne le cumul", async () => {
    const invoice = await issuedInvoice(100000);
    const draft = await createCreditNoteDraft(db, orgId, invoice.id);
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;

    // Avoir partiel : une seule des deux lignes, montant strictement inférieur au parent.
    const partialInput = {
      clientId,
      lines: [{ description: "Avoir partiel", quantity: -1, unitPriceCents: 10000, vatRate: 20 }],
    };
    const updateResult = await updateCreditNoteDraft(db, orgId, draft.id, partialInput);
    expect(updateResult.ok).toBe(true);

    const result = await issueCreditNote(db, orgId, draft.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.parentCancelled).toBe(false);

    const parentAfter = await getInvoiceById(db, orgId, invoice.id);
    expect(parentAfter?.status).toBe("issued");
  });

  it("refuse un brouillon d'avoir dont le montant dépasse le reste créditable", async () => {
    const invoice = await issuedInvoice(100000);
    const draft = await createCreditNoteDraft(db, orgId, invoice.id);
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;

    // Le total du parent est déjà entièrement crédité par défaut (avoir
    // total) : toute tentative de le faire dépasser doit être refusée.
    const tooMuchInput = {
      clientId,
      lines: [
        {
          description: "Trop",
          quantity: -1,
          unitPriceCents: invoice.totalCents + 100000,
          vatRate: 0,
        },
      ],
    };
    const result = await updateCreditNoteDraft(db, orgId, draft.id, tooMuchInput);
    expect(result.ok).toBe(false);
  });

  it("2 avoirs partiels successifs : le second ne peut pas dépasser le reste après le premier", async () => {
    const invoice = await issuedInvoice(100000); // total TTC connu via invoice.totalCents

    // Premier avoir : partiel, la moitié du total.
    const firstDraft = await createCreditNoteDraft(db, orgId, invoice.id);
    expect(firstDraft.ok).toBe(true);
    if (!firstDraft.ok) return;
    const halfCents = Math.floor(invoice.totalCents / 2);
    const firstUpdate = await updateCreditNoteDraft(db, orgId, firstDraft.id, {
      clientId,
      lines: [
        { description: "Avoir partiel 1", quantity: -1, unitPriceCents: halfCents, vatRate: 0 },
      ],
    });
    expect(firstUpdate.ok).toBe(true);
    const firstIssued = await issueCreditNote(db, orgId, firstDraft.id);
    expect(firstIssued.ok).toBe(true);
    if (firstIssued.ok) expect(firstIssued.parentCancelled).toBe(false);

    // Second avoir : tente de créditer PLUS que ce qu'il reste (le parent
    // total moins ce que le premier avoir a déjà crédité).
    const secondDraft = await createCreditNoteDraft(db, orgId, invoice.id);
    expect(secondDraft.ok).toBe(true);
    if (!secondDraft.ok) return;
    const secondUpdate = await updateCreditNoteDraft(db, orgId, secondDraft.id, {
      clientId,
      lines: [
        {
          description: "Avoir partiel 2 (trop)",
          quantity: -1,
          unitPriceCents: invoice.totalCents - halfCents + 100,
          vatRate: 0,
        },
      ],
    });
    expect(secondUpdate.ok).toBe(false);
  });
});

describe("recordPayment sur un avoir", () => {
  it("refuse tout paiement sur un avoir (décision V1, plans/ledger.md)", async () => {
    const invoice = await issuedInvoice();
    const draft = await createCreditNoteDraft(db, orgId, invoice.id);
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    const issued = await issueCreditNote(db, orgId, draft.id);
    expect(issued.ok).toBe(true);

    const result = await recordPayment(db, orgId, draft.id, { amountCents: 100, method: "cash" });
    expect(result.ok).toBe(false);
  });
});

describe("stats client avec avoirs", () => {
  it("un avoir partiel émis réduit le CA facturé du montant crédité (jamais compté en positif)", async () => {
    const invoice = await issuedInvoice(100000);
    const before = await getClientInvoiceStats(db, orgId, clientId);

    const draft = await createCreditNoteDraft(db, orgId, invoice.id);
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    const partialUpdate = await updateCreditNoteDraft(db, orgId, draft.id, {
      clientId,
      lines: [
        { description: "Avoir partiel stats", quantity: -1, unitPriceCents: 10000, vatRate: 20 },
      ],
    });
    expect(partialUpdate.ok).toBe(true);
    const issued = await issueCreditNote(db, orgId, draft.id);
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    expect(issued.parentCancelled).toBe(false);

    const creditNote = await getInvoiceById(db, orgId, draft.id);
    expect(creditNote?.totalCents).toBeLessThan(0);

    const after = await getClientInvoiceStats(db, orgId, clientId);
    // `before` est capturé APRÈS l'émission de la facture (déjà comptée) :
    // le seul delta attendu est la contribution de l'avoir, NÉGATIVE — jamais
    // en positif comme une facture normale l'aurait fait.
    expect(after.caFactureCents).toBe(before.caFactureCents + creditNote!.totalCents);
  });
});

describe("garde-fous : les mutations facture standard refusent un avoir", () => {
  it("issueInvoice refuse un avoir brouillon", async () => {
    const invoice = await issuedInvoice();
    const draft = await createCreditNoteDraft(db, orgId, invoice.id);
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;

    const result = await issueInvoice(db, orgId, draft.id);
    expect(result.ok).toBe(false);
  });

  it("updateDraft refuse un avoir brouillon", async () => {
    const invoice = await issuedInvoice();
    const draft = await createCreditNoteDraft(db, orgId, invoice.id);
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;

    const result = await updateDraft(db, orgId, draft.id, {
      clientId,
      lines: [{ description: "X", quantity: 1, unitPriceCents: 1000, vatRate: 20 }],
    });
    expect(result.ok).toBe(false);
  });

  it("duplicate refuse un avoir", async () => {
    const invoice = await issuedInvoice();
    const draft = await createCreditNoteDraft(db, orgId, invoice.id);
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    const issued = await issueCreditNote(db, orgId, draft.id);
    expect(issued.ok).toBe(true);

    const result = await duplicate(db, orgId, draft.id);
    expect(result.ok).toBe(false);
  });
});
