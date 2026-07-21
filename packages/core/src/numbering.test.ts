import { describe, expect, it } from "vitest";
import { formatDocumentNumber, isValidDocumentNumberFormat } from "./numbering";

describe("formatDocumentNumber", () => {
  it("résout {YYYY} et {seq:n}", () => {
    expect(formatDocumentNumber("FAC-{YYYY}-{seq:4}", { year: 2026, seq: 7 })).toBe(
      "FAC-2026-0007",
    );
  });

  it("résout {YY}", () => {
    expect(formatDocumentNumber("DEV-{YY}-{seq:3}", { year: 2026, seq: 12 })).toBe(
      "DEV-26-012",
    );
  });

  it("ne complète pas la séquence sans précision", () => {
    expect(formatDocumentNumber("AV-{YYYY}-{seq}", { year: 2026, seq: 42 })).toBe(
      "AV-2026-42",
    );
  });

  it("ne tronque pas une séquence plus longue que le padding demandé", () => {
    expect(formatDocumentNumber("FAC-{YYYY}-{seq:4}", { year: 2026, seq: 123456 })).toBe(
      "FAC-2026-123456",
    );
  });

  it("supporte plusieurs occurrences du même token", () => {
    expect(formatDocumentNumber("{YYYY}/{YYYY}-{seq:2}", { year: 2027, seq: 1 })).toBe(
      "2027/2027-01",
    );
  });

  it("rejette un token inconnu", () => {
    expect(() =>
      formatDocumentNumber("FAC-{foo}-{seq:4}", { year: 2026, seq: 1 }),
    ).toThrow(/invalide/);
  });

  it("rejette une accolade non fermée", () => {
    expect(() => formatDocumentNumber("FAC-{YYYY", { year: 2026, seq: 1 })).toThrow();
  });
});

describe("isValidDocumentNumberFormat", () => {
  it("accepte un format sans token (constant)", () => {
    expect(isValidDocumentNumberFormat("FACTURE-FIXE")).toBe(true);
  });

  it("rejette une chaîne vide", () => {
    expect(isValidDocumentNumberFormat("")).toBe(false);
    expect(isValidDocumentNumberFormat("   ")).toBe(false);
  });

  it("rejette un token malformé", () => {
    expect(isValidDocumentNumberFormat("FAC-{seq:}-{YYYY}")).toBe(false);
  });
});
