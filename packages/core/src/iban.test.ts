import { describe, expect, it } from "vitest";
import { formatIban, isValidBic, isValidIban, normalizeIban } from "./iban";

describe("normalizeIban", () => {
  it("retire les espaces et met en majuscules", () => {
    expect(normalizeIban("fr76 3000 4000 03")).toBe("FR763000400003");
    expect(normalizeIban("  fr14 2004 ")).toBe("FR142004");
  });
});

describe("formatIban", () => {
  it("regroupe par blocs de 4", () => {
    expect(formatIban("FR7630006000011234567890189")).toBe(
      "FR76 3000 6000 0112 3456 7890 189",
    );
  });
});

describe("isValidIban", () => {
  it("accepte des IBAN valides", () => {
    expect(isValidIban("FR76 3000 6000 0112 3456 7890 189")).toBe(true);
    expect(isValidIban("DE89370400440532013000")).toBe(true);
    expect(isValidIban("GB29 NWBK 6016 1331 9268 19")).toBe(true);
  });

  it("rejette des IBAN invalides", () => {
    // Mauvais checksum.
    expect(isValidIban("FR76 3000 6000 0112 3456 7890 188")).toBe(false);
    // Trop court.
    expect(isValidIban("FR76")).toBe(false);
    // Caractère interdit.
    expect(isValidIban("FR76 3000 6000 0112 3456 7890 18!")).toBe(false);
  });
});

describe("isValidBic", () => {
  it("accepte 8 et 11 caractères", () => {
    expect(isValidBic("BNPAFRPP")).toBe(true);
    expect(isValidBic("bnpafrppxxx")).toBe(true);
  });

  it("rejette les formats invalides", () => {
    expect(isValidBic("BNP")).toBe(false);
    expect(isValidBic("BNPAFRPPXX")).toBe(false); // 10 caractères
    expect(isValidBic("1234FRPP")).toBe(false); // chiffres en tête
  });
});
