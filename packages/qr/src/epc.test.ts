import { describe, expect, it } from "vitest";
import { epcQrPayload } from "./epc";

describe("epcQrPayload", () => {
  it("cas de référence exact (EPC069-12, BIC présent) — caractère par caractère", () => {
    const payload = epcQrPayload({
      name: "Daromsart SAS",
      iban: "FR7630006000011234567890189",
      bic: "AGRIFRPP",
      amountCents: 123456,
      remittance: "Facture FAC-2026-0001",
    });

    expect(payload).toBe(
      [
        "BCD",
        "002",
        "1",
        "SCT",
        "AGRIFRPP",
        "Daromsart SAS",
        "FR7630006000011234567890189",
        "EUR1234.56",
        "",
        "Facture FAC-2026-0001",
        "",
        "",
      ].join("\n"),
    );
    expect(payload).not.toContain("\r");
    expect(payload?.split("\n")).toHaveLength(12);
  });

  it("BIC absent (version 002) : champ vide, pas de ligne omise", () => {
    const payload = epcQrPayload({
      name: "Daromsart SAS",
      iban: "FR7630006000011234567890189",
      amountCents: 5000,
      remittance: "Acompte",
    });
    expect(payload?.split("\n")[4]).toBe("");
    expect(payload?.split("\n")).toHaveLength(12);
  });

  it("montant à 1 centime (borne basse valide)", () => {
    const payload = epcQrPayload({
      name: "Test",
      iban: "FR7630006000011234567890189",
      amountCents: 1,
    });
    expect(payload).toContain("EUR0.01");
  });

  it("montant rond formaté avec 2 décimales", () => {
    const payload = epcQrPayload({
      name: "Test",
      iban: "FR7630006000011234567890189",
      amountCents: 100000,
    });
    expect(payload).toContain("EUR1000.00");
  });

  it("montant nul ou négatif → null (jamais de QR de paiement pour un avoir)", () => {
    expect(
      epcQrPayload({ name: "Test", iban: "FR76...", amountCents: 0 }),
    ).toBeNull();
    expect(
      epcQrPayload({ name: "Test", iban: "FR76...", amountCents: -500 }),
    ).toBeNull();
  });

  it("montant hors borne haute (> 999 999 999,99 €) → null", () => {
    expect(
      epcQrPayload({ name: "Test", iban: "FR76...", amountCents: 100_000_000_000 }),
    ).toBeNull();
  });

  it("nom tronqué à 70 caractères", () => {
    const longName = "A".repeat(100);
    const payload = epcQrPayload({
      name: longName,
      iban: "FR7630006000011234567890189",
      amountCents: 1000,
    });
    expect(payload?.split("\n")[5]).toHaveLength(70);
  });

  it("communication tronquée à 140 caractères", () => {
    const longRemittance = "B".repeat(200);
    const payload = epcQrPayload({
      name: "Test",
      iban: "FR7630006000011234567890189",
      amountCents: 1000,
      remittance: longRemittance,
    });
    expect(payload?.split("\n")[9]).toHaveLength(140);
  });

  it("nom avec accents (UTF-8, charset 1) conservé tel quel", () => {
    const payload = epcQrPayload({
      name: "Ébénisterie Léa & Associés",
      iban: "FR7630006000011234567890189",
      amountCents: 1000,
    });
    expect(payload?.split("\n")[5]).toBe("Ébénisterie Léa & Associés");
  });

  it("IBAN et BIC : espaces retirés, mis en majuscules", () => {
    const payload = epcQrPayload({
      name: "Test",
      iban: "fr76 3000 6000 0112 3456 7890 189",
      bic: "agri frpp",
      amountCents: 1000,
    });
    const lines = payload?.split("\n") ?? [];
    expect(lines[4]).toBe("AGRIFRPP");
    expect(lines[6]).toBe("FR7630006000011234567890189");
  });

  it("communication absente : champ vide, pas d'erreur", () => {
    const payload = epcQrPayload({
      name: "Test",
      iban: "FR7630006000011234567890189",
      amountCents: 1000,
    });
    expect(payload?.split("\n")[9]).toBe("");
  });
});
