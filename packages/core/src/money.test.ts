import { describe, expect, it } from "vitest";
import { addCents, applyPercent, formatEUR, mulQty } from "./money";

describe("mulQty", () => {
  it("multiplie un prix entier par une quantité entière", () => {
    expect(mulQty(1000, 3)).toBe(3000);
  });

  it("gère une quantité fractionnaire (0,333) sans dérive flottante", () => {
    expect(mulQty(300, 0.333)).toBe(100);
  });

  it("gère 0,1 × 3 sans l'imprécision flottante classique (0.1+0.1+0.1 !== 0.3)", () => {
    expect(mulQty(100, 0.1)).toBe(10);
    expect(mulQty(100, 0.1) * 3).toBe(30);
  });

  it("retourne 0 pour une quantité nulle", () => {
    expect(mulQty(1000, 0)).toBe(0);
  });

  it("arrondit half-up au centime le plus proche", () => {
    expect(mulQty(1, 0.5)).toBe(1);
    expect(mulQty(1, 0.4)).toBe(0);
  });
});

describe("addCents", () => {
  it("additionne plusieurs montants", () => {
    expect(addCents(100, 250, 50)).toBe(400);
  });

  it("retourne 0 sans arguments", () => {
    expect(addCents()).toBe(0);
  });
});

describe("applyPercent", () => {
  it("calcule 20 % de 1000 centimes", () => {
    expect(applyPercent(1000, 20)).toBe(200);
  });

  it("arrondit half-up avec un taux à décimale (5,5 %)", () => {
    expect(applyPercent(100, 5.5)).toBe(6);
  });

  it("retourne 0 pour un taux de 0 %", () => {
    expect(applyPercent(10000, 0)).toBe(0);
  });
});

describe("formatEUR", () => {
  it("formate en euros fr-FR avec symbole", () => {
    const result = formatEUR(123456);
    expect(result).toContain("234,56");
    expect(result).toContain("€");
  });

  it("formate un montant nul", () => {
    expect(formatEUR(0)).toContain("0,00");
  });
});
