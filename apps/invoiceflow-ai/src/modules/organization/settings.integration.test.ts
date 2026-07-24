import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema";
import { DEFAULT_EMAIL_DEFAULTS, FRANCHISE_MENTION, organizations } from "../../db/schema";
import { getCurrentSequenceStatus } from "./sequence-status";
import {
  applyDelays,
  applyEmailDefaults,
  applyNumberFormats,
  applyVatSettings,
  resetEmailDefault,
} from "./mutations";

/**
 * Tests d'intégration des paramètres facturation/emails (story 22) — même
 * limite que `mutations.integration.test.ts` : pas de garde admin/session
 * exercée ici (contexte de requête Next.js), vérifiée en e2e.
 */
const url = process.env.TEST_DATABASE_URL;
const client = postgres(url ?? "", { max: 1 });
const db = drizzle(client, { schema });

let orgId = "";

beforeAll(async () => {
  if (!url) throw new Error("TEST_DATABASE_URL manquant");
  const [org] = await db
    .insert(organizations)
    .values({ legalName: "Test Org Settings" })
    .returning();
  orgId = org.id;
});

afterAll(async () => {
  await db.delete(organizations).where(eq(organizations.id, orgId));
  await client.end({ timeout: 5 });
});

describe("applyNumberFormats", () => {
  it("persiste des formats valides", async () => {
    const result = await applyNumberFormats(db, orgId, {
      quote: "DEV-{YYYY}-{seq:5}",
      invoice: "FAC-{YYYY}-{seq:5}",
      creditNote: "AV-{YYYY}-{seq:5}",
    });
    expect(result.ok).toBe(true);

    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    expect(org.numberFormats.invoice).toBe("FAC-{YYYY}-{seq:5}");
  });

  it("refuse un format sans {seq}", async () => {
    const result = await applyNumberFormats(db, orgId, {
      quote: "DEV-FIXE",
      invoice: "FAC-{YYYY}-{seq:4}",
      creditNote: "AV-{YYYY}-{seq:4}",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.quote).toBeTruthy();
  });
});

describe("getCurrentSequenceStatus", () => {
  it("renvoie 0 pour une organisation sans émission cette année", async () => {
    const status = await getCurrentSequenceStatus(db, orgId);
    expect(status).toEqual({ quote: 0, invoice: 0, credit_note: 0 });
  });
});

describe("applyVatSettings", () => {
  it("persiste des taux actifs et un défaut cohérent", async () => {
    const result = await applyVatSettings(db, orgId, {
      activeRates: [0, 20],
      defaultRate: 20,
      franchiseEnabled: false,
    });
    expect(result.ok).toBe(true);
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    expect(org.vatRatesActive).toEqual([0, 20]);
    expect(Number(org.vatRateDefault)).toBe(20);
  });

  it("refuse un défaut hors des taux actifs", async () => {
    const result = await applyVatSettings(db, orgId, {
      activeRates: [20],
      defaultRate: 10,
      franchiseEnabled: false,
    });
    expect(result.ok).toBe(false);
  });

  it("la franchise force le défaut à 0 % et compose la mention légale (une seule fois)", async () => {
    const before = await db.select().from(organizations).where(eq(organizations.id, orgId));
    const footerBefore = before[0].legalFooter;
    expect(footerBefore).not.toContain(FRANCHISE_MENTION);

    const result = await applyVatSettings(db, orgId, {
      activeRates: [0, 20],
      // Soumettre 20 alors que la franchise est activée : le défaut est
      // quand même forcé à 0 (garde serveur, jamais confiance dans le form).
      defaultRate: 20,
      franchiseEnabled: true,
    });
    expect(result.ok).toBe(true);

    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    expect(Number(org.vatRateDefault)).toBe(0);
    expect(org.franchiseEnabled).toBe(true);
    expect(org.legalFooter).toContain(FRANCHISE_MENTION);
    expect(org.legalFooter.startsWith(footerBefore)).toBe(true);

    // Un second appel avec franchise déjà active ne duplique pas la mention.
    const again = await applyVatSettings(db, orgId, {
      activeRates: [0, 20],
      defaultRate: 0,
      franchiseEnabled: true,
    });
    expect(again.ok).toBe(true);
    const [orgAfter] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    const occurrences = orgAfter.legalFooter.split(FRANCHISE_MENTION).length - 1;
    expect(occurrences).toBe(1);
  });
});

describe("applyDelays", () => {
  it("persiste des délais valides, lus par les futures créations", async () => {
    const result = await applyDelays(db, orgId, { paymentTermsDays: 45, quoteValidityDays: 60 });
    expect(result.ok).toBe(true);
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    expect(org.paymentTermsDays).toBe(45);
    expect(org.quoteValidityDays).toBe(60);
  });

  it("refuse un délai négatif ou nul", async () => {
    const result = await applyDelays(db, orgId, { paymentTermsDays: 0, quoteValidityDays: -5 });
    expect(result.ok).toBe(false);
  });
});

describe("applyEmailDefaults / resetEmailDefault", () => {
  it("persiste un texte custom, utilisé par les envois suivants", async () => {
    const result = await applyEmailDefaults(db, orgId, {
      replyTo: "compta@example.fr",
      quote: { subject: "Votre devis perso {numero}", body: "Corps custom devis" },
      invoice: { subject: "Votre facture {numero}", body: "Corps custom facture" },
      reminder: { subject: "Rappel {numero}", body: "Corps custom relance" },
    });
    expect(result.ok).toBe(true);

    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    expect(org.emailReplyTo).toBe("compta@example.fr");
    expect(org.emailDefaults.quote.subject).toBe("Votre devis perso {numero}");
    expect(org.emailDefaults.invoice.body).toBe("Corps custom facture");
  });

  it("resetEmailDefault ne réinitialise qu'un seul bloc", async () => {
    const reset = await resetEmailDefault(db, orgId, "quote");
    expect(reset.ok).toBe(true);

    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    expect(org.emailDefaults.quote).toEqual(DEFAULT_EMAIL_DEFAULTS.quote);
    // Le bloc facture, non réinitialisé, garde le texte custom précédent.
    expect(org.emailDefaults.invoice.body).toBe("Corps custom facture");
  });
});
