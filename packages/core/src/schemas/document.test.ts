import { describe, expect, it } from "vitest";
import {
  creditNoteDraftSchema,
  creditNoteLineSchema,
  documentDraftSchema,
  documentLineSchema,
} from "./document";

describe("documentLineSchema", () => {
  it("accepte une ligne valide", () => {
    const result = documentLineSchema.safeParse({
      description: "Prestation de conseil",
      quantity: 2,
      unitPriceCents: 10000,
      vatRate: 20,
    });
    expect(result.success).toBe(true);
  });

  it("rejette une description vide", () => {
    const result = documentLineSchema.safeParse({
      description: "",
      quantity: 1,
      unitPriceCents: 1000,
      vatRate: 20,
    });
    expect(result.success).toBe(false);
  });

  it("rejette une quantité négative ou nulle", () => {
    expect(
      documentLineSchema.safeParse({
        description: "X",
        quantity: 0,
        unitPriceCents: 1000,
        vatRate: 20,
      }).success,
    ).toBe(false);
  });

  it("rejette un prix unitaire non entier (pas des centimes)", () => {
    expect(
      documentLineSchema.safeParse({
        description: "X",
        quantity: 1,
        unitPriceCents: 10.5,
        vatRate: 20,
      }).success,
    ).toBe(false);
  });

  it("rejette une remise en pourcentage supérieure à 100", () => {
    const result = documentLineSchema.safeParse({
      description: "X",
      quantity: 1,
      unitPriceCents: 1000,
      vatRate: 20,
      discount: { type: "percent", value: 150 },
    });
    expect(result.success).toBe(false);
  });

  it("accepte une remise en montant fixe", () => {
    const result = documentLineSchema.safeParse({
      description: "X",
      quantity: 1,
      unitPriceCents: 1000,
      vatRate: 20,
      discount: { type: "amount", value: 200 },
    });
    expect(result.success).toBe(true);
  });
});

describe("documentDraftSchema", () => {
  const baseLine = {
    description: "Prestation",
    quantity: 1,
    unitPriceCents: 1000,
    vatRate: 20,
  };

  it("accepte un brouillon valide avec au moins une ligne", () => {
    const result = documentDraftSchema.safeParse({
      clientId: "11111111-1111-1111-1111-111111111111",
      lines: [baseLine],
    });
    expect(result.success).toBe(true);
  });

  it("rejette un brouillon sans client", () => {
    const result = documentDraftSchema.safeParse({
      clientId: "",
      lines: [baseLine],
    });
    expect(result.success).toBe(false);
  });

  it("rejette un brouillon sans aucune ligne", () => {
    const result = documentDraftSchema.safeParse({
      clientId: "11111111-1111-1111-1111-111111111111",
      lines: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("creditNoteLineSchema (story 18)", () => {
  it("accepte une quantité négative", () => {
    const result = creditNoteLineSchema.safeParse({
      description: "Prestation A",
      quantity: -2,
      unitPriceCents: 10000,
      vatRate: 20,
    });
    expect(result.success).toBe(true);
  });

  it("rejette une quantité positive (un avoir ne facture jamais)", () => {
    const result = creditNoteLineSchema.safeParse({
      description: "Prestation A",
      quantity: 2,
      unitPriceCents: 10000,
      vatRate: 20,
    });
    expect(result.success).toBe(false);
  });

  it("rejette une quantité nulle", () => {
    const result = creditNoteLineSchema.safeParse({
      description: "Prestation A",
      quantity: 0,
      unitPriceCents: 10000,
      vatRate: 20,
    });
    expect(result.success).toBe(false);
  });

  it("rejette une remise en pourcentage supérieure à 100 (même garde que documentLineSchema)", () => {
    const result = creditNoteLineSchema.safeParse({
      description: "X",
      quantity: -1,
      unitPriceCents: 1000,
      vatRate: 20,
      discount: { type: "percent", value: 150 },
    });
    expect(result.success).toBe(false);
  });
});

describe("creditNoteDraftSchema (story 18)", () => {
  it("accepte un brouillon d'avoir avec des lignes à quantité négative", () => {
    const result = creditNoteDraftSchema.safeParse({
      clientId: "11111111-1111-1111-1111-111111111111",
      lines: [{ description: "Prestation", quantity: -1, unitPriceCents: 1000, vatRate: 20 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejette une ligne à quantité positive dans un avoir", () => {
    const result = creditNoteDraftSchema.safeParse({
      clientId: "11111111-1111-1111-1111-111111111111",
      lines: [{ description: "Prestation", quantity: 1, unitPriceCents: 1000, vatRate: 20 }],
    });
    expect(result.success).toBe(false);
  });
});
