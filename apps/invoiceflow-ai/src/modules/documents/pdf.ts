import { eq } from "drizzle-orm";
import {
  DEFAULT_PDF_TEMPLATE_OPTIONS,
  type DocumentPdfInput,
  type PdfAddress,
  type PdfTemplateOptions,
} from "@daromsart/pdf";
import type { Storage } from "@daromsart/storage";
import type { AppDb } from "../../db/types";
import { organizations } from "../../db/schema";
import { getClientById } from "../clients/queries";
import { getQuoteById } from "../quotes/queries";
import { getDefaultTemplate, getTemplateById } from "../templates/queries";
import { env } from "../../lib/env";

/**
 * Construit le DTO d'entrée de `renderDocumentPdf` (@daromsart/pdf) pour un
 * devis. Toutes les données binaires (logo) sont résolues en data URL ICI
 * (lecture storage), jamais au moment du rendu — le rendu PDF ne fait aucun
 * accès réseau/disque (parade « logo distant dans le PDF », plans/story-08.md).
 * Modèle appliqué (story 09) : `quote.templateId` s'il est défini, sinon le
 * modèle par défaut de l'organisation pour les devis, sinon les options
 * neutres codées en dur (aucun modèle configuré).
 */

async function resolveTemplateOptions(
  db: AppDb,
  organizationId: string,
  templateId: string | null,
): Promise<{ pdf: PdfTemplateOptions; headerFooter: string | null }> {
  const template = templateId
    ? await getTemplateById(db, organizationId, templateId)
    : await getDefaultTemplate(db, organizationId, "quote");
  if (!template) {
    return { pdf: DEFAULT_PDF_TEMPLATE_OPTIONS, headerFooter: null };
  }
  const { accentColor, showLogo, logoPosition, font, columns, footerNote, paymentTermsText } =
    template.options;
  const combinedFooter = [footerNote, paymentTermsText].filter(Boolean).join("\n");
  return {
    pdf: { accentColor, showLogo, logoPosition, font, columns },
    headerFooter: combinedFooter || null,
  };
}

function mimeFromKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

async function resolveLogoDataUrl(
  storage: Storage,
  logoKey: string | null,
): Promise<string | null> {
  if (!logoKey) return null;
  const bytes = await storage.get(logoKey);
  if (!bytes) return null;
  return `data:${mimeFromKey(logoKey)};base64,${bytes.toString("base64")}`;
}

function orgAddress(org: {
  addressStreet: string | null;
  addressZip: string | null;
  addressCity: string | null;
  addressCountry: string;
}): PdfAddress {
  return {
    street: org.addressStreet,
    zip: org.addressZip,
    city: org.addressCity,
    country: org.addressCountry,
  };
}

function clientAddress(client: {
  addressStreet: string | null;
  addressZip: string | null;
  addressCity: string | null;
  addressCountry: string;
}): PdfAddress {
  return {
    street: client.addressStreet,
    zip: client.addressZip,
    city: client.addressCity,
    country: client.addressCountry,
  };
}

export async function buildQuotePdfInput(
  db: AppDb,
  storage: Storage,
  organizationId: string,
  quoteId: string,
): Promise<DocumentPdfInput | null> {
  const quote = await getQuoteById(db, organizationId, quoteId);
  if (!quote) return null;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!org) return null;

  const client = await getClientById(db, organizationId, quote.clientId);
  if (!client) return null;

  const logoDataUrl = await resolveLogoDataUrl(storage, org.logoKey);
  const { pdf: templateOptions, headerFooter } = await resolveTemplateOptions(
    db,
    organizationId,
    quote.templateId,
  );

  return {
    organization: {
      legalName: org.legalName,
      tradeName: org.tradeName,
      address: orgAddress(org),
      email: org.email,
      phone: org.phone,
      siret: org.siret,
      vatNumber: org.vatNumber,
      legalForm: org.legalForm,
      capital: org.capital,
      iban: org.iban,
      bic: org.bic,
      logoDataUrl,
    },
    client: {
      displayName: client.displayName,
      legalName: client.legalName,
      address: clientAddress(client),
      siret: client.siret,
      vatNumber: client.vatNumber,
      email: client.email,
    },
    meta: {
      kind: "quote",
      number: quote.number,
      issueDate: quote.issueDate,
      dueOrValidUntil: quote.validUntil,
      title: null,
    },
    lines: quote.lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unit: null,
      unitPriceCents: line.unitPriceCents,
      vatRate: line.vatRate,
      discount: line.discount,
      totalCents:
        line.unitPriceCents * line.quantity -
        (line.discount
          ? line.discount.type === "percent"
            ? Math.round((line.unitPriceCents * line.quantity * line.discount.value) / 100)
            : line.discount.value
          : 0),
    })),
    totals: {
      subtotalCents: quote.subtotalCents,
      discountCents: quote.discountCents,
      vatByRate: quote.vatByRate,
      totalCents: quote.totalCents,
    },
    introNote: quote.notes,
    footerNote: headerFooter,
    legalFooter: org.legalFooter,
    template: templateOptions,
    publicUrl: quote.shareToken ? `${env.APP_URL}/p/devis/${quote.shareToken}` : null,
  };
}
