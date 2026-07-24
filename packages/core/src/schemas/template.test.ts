import { describe, expect, it } from "vitest";
import {
  DEFAULT_TEMPLATE_OPTIONS,
  templateAppliesToKind,
  templateOptionsSchema,
  templateSchema,
} from "./template";

describe("templateOptionsSchema", () => {
  it("applique tous les defaults sur un objet vide", () => {
    const parsed = templateOptionsSchema.parse({});
    expect(parsed).toEqual({
      accentColor: "#185FA5",
      showLogo: true,
      logoPosition: "left",
      font: "sans",
      columns: { unit: true, vatPerLine: true, discountPerLine: true },
      headerNote: "",
      footerNote: "",
      paymentTermsText: "",
      showPaymentQr: false,
      showPublicLinkQr: false,
    });
  });

  it("reste tolérant si `columns` est partiel (options non versionnées)", () => {
    const parsed = templateOptionsSchema.parse({ columns: { unit: false } });
    expect(parsed.columns).toEqual({ unit: false, vatPerLine: true, discountPerLine: true });
  });

  it("rejette une couleur d'accent invalide", () => {
    expect(() => templateOptionsSchema.parse({ accentColor: "violet" })).toThrow();
  });

  it("accepte une couleur d'accent hexadécimale", () => {
    expect(templateOptionsSchema.parse({ accentColor: "#28C76F" }).accentColor).toBe("#28C76F");
  });

  it("DEFAULT_TEMPLATE_OPTIONS correspond au parse d'un objet vide", () => {
    expect(DEFAULT_TEMPLATE_OPTIONS).toEqual(templateOptionsSchema.parse({}));
  });
});

describe("templateAppliesToKind", () => {
  it("« both » s'applique à devis et facture", () => {
    expect(templateAppliesToKind("both", "quote")).toBe(true);
    expect(templateAppliesToKind("both", "invoice")).toBe(true);
  });

  it("un type spécifique ne s'applique qu'à lui-même", () => {
    expect(templateAppliesToKind("quote", "quote")).toBe(true);
    expect(templateAppliesToKind("quote", "invoice")).toBe(false);
    expect(templateAppliesToKind("invoice", "quote")).toBe(false);
  });
});

describe("templateSchema", () => {
  it("rejette un nom vide", () => {
    const result = templateSchema.safeParse({ name: "  ", type: "quote", options: {} });
    expect(result.success).toBe(false);
  });

  it("accepte un modèle minimal et applique les defaults d'options", () => {
    const result = templateSchema.parse({ name: "Classique", type: "both", options: {} });
    expect(result.options.accentColor).toBe("#185FA5");
  });
});
