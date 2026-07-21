import { describe, expect, it } from "vitest";
import {
  canTransition,
  INVOICE_STATUSES,
  QUOTE_STATUSES,
  type InvoiceStatus,
  type QuoteStatus,
} from "./status";

const QUOTE_ALLOWED: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ["sent"],
  sent: ["viewed", "signed", "refused", "expired"],
  viewed: ["signed", "refused", "expired"],
  signed: ["invoiced"],
  refused: [],
  expired: [],
  invoiced: [],
};

const INVOICE_ALLOWED: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["issued"],
  issued: ["sent", "cancelled", "partially_paid", "paid"],
  sent: ["viewed", "overdue", "cancelled", "partially_paid", "paid"],
  viewed: ["partially_paid", "paid", "overdue", "cancelled"],
  partially_paid: ["paid", "overdue", "cancelled"],
  overdue: ["partially_paid", "paid", "cancelled"],
  paid: ["partially_paid"],
  cancelled: [],
};

describe("canTransition — devis (H14)", () => {
  for (const from of QUOTE_STATUSES) {
    for (const to of QUOTE_STATUSES) {
      const expected = from !== to && QUOTE_ALLOWED[from].includes(to);
      it(`${from} → ${to} : ${expected ? "autorisé" : "refusé"}`, () => {
        expect(canTransition("quote", from, to)).toBe(expected);
      });
    }
  }
});

describe("canTransition — facture (H15)", () => {
  for (const from of INVOICE_STATUSES) {
    for (const to of INVOICE_STATUSES) {
      const expected = from !== to && INVOICE_ALLOWED[from].includes(to);
      it(`${from} → ${to} : ${expected ? "autorisé" : "refusé"}`, () => {
        expect(canTransition("invoice", from, to)).toBe(expected);
      });
    }
  }
});

describe("canTransition — cas limites", () => {
  it("refuse une transition vers le même statut", () => {
    expect(canTransition("quote", "draft", "draft")).toBe(false);
    expect(canTransition("invoice", "paid", "paid")).toBe(false);
  });

  it("un devis refusé/expiré/facturé est un état terminal", () => {
    for (const to of QUOTE_STATUSES) {
      expect(canTransition("quote", "refused", to)).toBe(false);
      expect(canTransition("quote", "expired", to)).toBe(false);
      expect(canTransition("quote", "invoiced", to)).toBe(false);
    }
  });

  it("une facture annulée est un état terminal", () => {
    for (const to of INVOICE_STATUSES) {
      expect(canTransition("invoice", "cancelled", to)).toBe(false);
    }
  });

  it("une facture payée n'autorise que le retour à partially_paid (story 15, suppression de paiement)", () => {
    for (const to of INVOICE_STATUSES) {
      expect(canTransition("invoice", "paid", to)).toBe(to === "partially_paid");
    }
  });
});
