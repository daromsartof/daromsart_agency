import { describe, expect, it } from "vitest";
import { renderDocumentPdf } from "./render";
import { DEFAULT_PDF_TEMPLATE_OPTIONS, type DocumentPdfInput } from "./types";

function fixture(overrides: Partial<DocumentPdfInput> = {}): DocumentPdfInput {
  return {
    organization: {
      legalName: "Daromsart SAS",
      tradeName: "Daromsart",
      address: { street: "12 rue de la Paix", zip: "75002", city: "Paris", country: "France" },
      email: "contact@daromsart.fr",
      siret: "123 456 789 00012",
      vatNumber: "FR12345678900",
      iban: "FR7630006000011234567890189",
      bic: "AGRIFRPP",
    },
    client: {
      displayName: "Client Test SARL",
      address: { street: "1 avenue des Fleurs", zip: "69000", city: "Lyon", country: "France" },
      siret: "987 654 321 00019",
    },
    meta: {
      kind: "quote",
      number: "DEV-2026-0001",
      issueDate: new Date("2026-07-01"),
      dueOrValidUntil: new Date("2026-08-01"),
      title: "Prestation de conseil",
    },
    lines: [
      {
        description:
          "Description très longue sur plusieurs lignes pour vérifier le retour à la ligne automatique du tableau sans troncature ni chevauchement de colonnes adjacentes.",
        quantity: 2,
        unit: "jour",
        unitPriceCents: 50000,
        vatRate: 20,
        totalCents: 100000,
      },
      {
        description: "Forfait mise en place",
        quantity: 1,
        unitPriceCents: 20000,
        vatRate: 10,
        discount: { type: "percent", value: 10 },
        totalCents: 18000,
      },
    ],
    totals: {
      subtotalCents: 118000,
      discountCents: 2000,
      vatByRate: { "20": 20000, "10": 1800 },
      totalCents: 139800,
    },
    introNote: "Merci de votre confiance.",
    footerNote: "Devis valable 30 jours.",
    legalFooter: "Mentions légales de test.",
    template: DEFAULT_PDF_TEMPLATE_OPTIONS,
    publicUrl: "https://app.example.com/p/devis/abc123",
    ...overrides,
  };
}

describe("renderDocumentPdf", () => {
  it("retourne un buffer PDF valide pour un DTO complet", async () => {
    const buffer = await renderDocumentPdf(fixture());
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString("utf8")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("rend une facture avec échéance et sans zone de signature", async () => {
    const buffer = await renderDocumentPdf(
      fixture({
        meta: {
          kind: "invoice",
          number: "FAC-2026-0001",
          issueDate: new Date("2026-07-01"),
          dueOrValidUntil: new Date("2026-07-31"),
          title: null,
        },
      }),
    );
    expect(buffer.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  });

  it("rend un devis signé avec QR codes", async () => {
    const buffer = await renderDocumentPdf(
      fixture({
        qrCodes: [
          {
            label: "Paiement",
            dataUrl:
              "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          },
        ],
        signature: {
          name: "Jean Dupont",
          signedAt: new Date("2026-07-05"),
          imageDataUrl:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        },
      }),
    );
    expect(buffer.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  });

  it("rend avec la police serif et le logo à droite (options de modèle)", async () => {
    const buffer = await renderDocumentPdf(
      fixture({
        template: {
          ...DEFAULT_PDF_TEMPLATE_OPTIONS,
          font: "serif",
          logoPosition: "right",
          accentColor: "#28C76F",
        },
      }),
    );
    expect(buffer.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  });

  it("rend un document sans lignes ni notes (cas limite)", async () => {
    const buffer = await renderDocumentPdf(
      fixture({
        lines: [],
        totals: { subtotalCents: 0, discountCents: 0, vatByRate: {}, totalCents: 0 },
        introNote: null,
        footerNote: null,
        legalFooter: null,
      }),
    );
    expect(buffer.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  });
});
