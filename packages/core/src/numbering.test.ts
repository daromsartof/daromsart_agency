import { describe, expect, it } from "vitest";
import {
  formatDocumentNumber,
  isValidDocumentNumberFormat,
  previewNextNumber,
  validateNumberFormat,
} from "./numbering";

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

describe("validateNumberFormat (story 22)", () => {
  it("accepte un format standard", () => {
    expect(validateNumberFormat("FAC-{YYYY}-{seq:4}")).toEqual({ valid: true });
  });

  it("accepte {seq} sans padding", () => {
    expect(validateNumberFormat("FAC-{YYYY}-{seq}")).toEqual({ valid: true });
  });

  it("rejette une chaîne vide", () => {
    expect(validateNumberFormat("   ").valid).toBe(false);
  });

  it("rejette un format sans {seq} (collision garantie)", () => {
    const result = validateNumberFormat("FACTURE-FIXE");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/seq/);
  });

  it("rejette plusieurs occurrences de {seq}", () => {
    expect(validateNumberFormat("FAC-{seq:4}-{seq:4}").valid).toBe(false);
  });

  it("rejette un padding hors 2..6", () => {
    expect(validateNumberFormat("FAC-{seq:1}").valid).toBe(false);
    expect(validateNumberFormat("FAC-{seq:7}").valid).toBe(false);
  });

  it("accepte les bornes 2 et 6", () => {
    expect(validateNumberFormat("FAC-{seq:2}").valid).toBe(true);
    expect(validateNumberFormat("FAC-{seq:6}").valid).toBe(true);
  });

  it("rejette un token inconnu", () => {
    expect(validateNumberFormat("FAC-{foo}-{seq:4}").valid).toBe(false);
  });

  it("rejette un format de plus de 40 caractères", () => {
    const long = `${"X".repeat(35)}-{seq:4}`;
    expect(long.length).toBeGreaterThan(40);
    expect(validateNumberFormat(long).valid).toBe(false);
  });
});

describe("previewNextNumber (story 22)", () => {
  it("résout le format avec l'année civile courante", () => {
    const year = new Date().getFullYear();
    expect(previewNextNumber("FAC-{YYYY}-{seq:4}", 8)).toBe(`FAC-${year}-0008`);
  });
});
