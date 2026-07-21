import { NextResponse, type NextRequest } from "next/server";
import { renderDocumentPdf, type DocumentPdfInput } from "@daromsart/pdf";
import { templateOptionsSchema, type TemplateOptions } from "@daromsart/core";
import { requireSession } from "@/modules/auth/session";

// @react-pdf/renderer utilise des API Node indisponibles en edge runtime.
export const runtime = "nodejs";

const FIXTURE_DATE = new Date("2026-06-15");
const FIXTURE_DUE = new Date("2026-07-15");

/** Données factices fixes (E-19) : l'aperçu ne dépend d'aucune donnée réelle. */
function fixtureInput(options: TemplateOptions): DocumentPdfInput {
  const { accentColor, showLogo, logoPosition, font, columns, footerNote, paymentTermsText } =
    options;
  const combinedFooter = [footerNote, paymentTermsText].filter(Boolean).join("\n");

  return {
    organization: {
      legalName: "Votre Entreprise SAS",
      tradeName: "Votre Entreprise",
      address: { street: "12 rue de l'Exemple", zip: "75000", city: "Paris", country: "France" },
      email: "contact@exemple.fr",
      siret: "123 456 789 00012",
      vatNumber: "FR12345678900",
    },
    client: {
      displayName: "Client Démo SARL",
      address: { street: "4 avenue de la Démonstration", zip: "69000", city: "Lyon", country: "France" },
      siret: "987 654 321 00019",
    },
    meta: {
      kind: "quote",
      number: "DEV-2026-0001",
      issueDate: FIXTURE_DATE,
      dueOrValidUntil: FIXTURE_DUE,
      title: "Prestation de conseil",
    },
    lines: [
      {
        description: "Développement — module de facturation",
        quantity: 3,
        unit: "jour",
        unitPriceCents: 55000,
        vatRate: 20,
        totalCents: 165000,
      },
      {
        description: "Formation équipe",
        quantity: 1,
        unitPriceCents: 45000,
        vatRate: 10,
        discount: { type: "percent", value: 10 },
        totalCents: 40500,
      },
    ],
    totals: {
      subtotalCents: 205500,
      discountCents: 4500,
      vatByRate: { "20": 33000, "10": 4050 },
      totalCents: 238050,
    },
    introNote: "Merci de votre confiance.",
    footerNote: combinedFooter || null,
    legalFooter:
      "En cas de retard de paiement, une pénalité au taux de trois fois le taux d'intérêt légal est exigible, ainsi qu'une indemnité forfaitaire pour frais de recouvrement de 40 € (art. L441-10 et D441-5 du Code de commerce).",
    template: { accentColor, showLogo, logoPosition, font, columns },
    publicUrl: "https://app.exemple.fr/p/devis/apercu",
  };
}

export async function GET(request: NextRequest) {
  await requireSession();

  const raw = request.nextUrl.searchParams.get("options");
  let optionsJson: unknown = {};
  if (raw) {
    try {
      optionsJson = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    } catch {
      optionsJson = {};
    }
  }
  // Tolérant : une valeur invalide retombe sur les defaults plutôt que de
  // faire échouer l'aperçu (parade « options non versionnées »).
  const parsed = templateOptionsSchema.safeParse(optionsJson);
  const options = parsed.success ? parsed.data : templateOptionsSchema.parse({});

  const buffer = await renderDocumentPdf(fixtureInput(options));

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=\"apercu-modele.pdf\"",
    },
  });
}
