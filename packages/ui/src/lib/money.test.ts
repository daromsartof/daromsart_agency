import { describe, expect, it } from "vitest";
import {
  formatCentsEUR,
  formatCentsToInput,
  parseAmountToCents,
} from "./money";

describe("parseAmountToCents", () => {
  it("parse un montant avec séparateur de milliers et virgule décimale", () => {
    expect(parseAmountToCents("1 234,56")).toBe(123456);
  });

  it("parse un entier sans décimale", () => {
    expect(parseAmountToCents("12")).toBe(1200);
  });

  it("parse une seule décimale", () => {
    expect(parseAmountToCents("0,1")).toBe(10);
  });

  it("retourne null pour une chaîne vide", () => {
    expect(parseAmountToCents("")).toBeNull();
    expect(parseAmountToCents("   ")).toBeNull();
  });

  it("gère les montants négatifs", () => {
    expect(parseAmountToCents("-5")).toBe(-500);
    expect(parseAmountToCents("-1 000,99")).toBe(-100099);
  });

  it("accepte le point comme séparateur décimal", () => {
    expect(parseAmountToCents("1234.56")).toBe(123456);
  });

  it("gère milliers avec point et décimale avec virgule", () => {
    expect(parseAmountToCents("1.234,56")).toBe(123456);
  });

  it("arrondit au centime au-delà de deux décimales", () => {
    expect(parseAmountToCents("1,005")).toBe(101);
    expect(parseAmountToCents("1,004")).toBe(100);
  });

  it("rejette une saisie non numérique", () => {
    expect(parseAmountToCents("abc")).toBeNull();
    expect(parseAmountToCents("12,ab")).toBeNull();
  });

  it("insécable et espace fine comme séparateurs de milliers", () => {
    expect(parseAmountToCents("1 000,00")).toBe(100000);
    expect(parseAmountToCents("1 000")).toBe(100000);
  });
});

describe("formatCentsToInput", () => {
  it("formate des centimes en saisie fr-FR", () => {
    expect(formatCentsToInput(123456)).toMatch(/^1.234,56$/);
    expect(formatCentsToInput(10)).toBe("0,10");
    expect(formatCentsToInput(-500)).toBe("-5,00");
  });

  it("fait un aller-retour parse ∘ format sans perte", () => {
    for (const cents of [0, 5, 10, 1200, 123456, -100099]) {
      expect(parseAmountToCents(formatCentsToInput(cents))).toBe(cents);
    }
  });
});

describe("formatCentsEUR", () => {
  it("ajoute le symbole euro", () => {
    expect(formatCentsEUR(123456)).toContain("€");
    expect(formatCentsEUR(123456)).toMatch(/1.234,56/);
  });
});
