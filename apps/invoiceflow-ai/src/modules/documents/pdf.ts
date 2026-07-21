import { eq } from "drizzle-orm";
import { renderDocumentPdf, type DocumentPdfInput } from "@daromsart/pdf";
import type { Storage } from "@daromsart/storage";
import type { AppDb } from "../../db/types";
import { organizations } from "../../db/schema";
import { getClientById } from "../clients/queries";
import { getQuoteById } from "../quotes/queries";
import { env } from "../../lib/env";
import { addressFrom, lineTotalCents, resolveLogoDataUrl, resolveTemplateOptions } from "./pdf-helpers";

/**
 * Construit le DTO d'entrée de `renderDocumentPdf` (@daromsart/pdf) pour un
 * devis. Toutes les données binaires (logo) sont résolues en data URL ICI
 * (lecture storage), jamais au moment du rendu — le rendu PDF ne fait aucun
 * accès réseau/disque (parade « logo distant dans le PDF », plans/story-08.md).
 * Modèle appliqué (story 09) : `quote.templateId` s'il est défini, sinon le
 * modèle par défaut de l'organisation pour les devis, sinon les options
 * neutres codées en dur (aucun modèle configuré).
 */
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
    "quote",
  );

  return {
    organization: {
      legalName: org.legalName,
      tradeName: org.tradeName,
      address: addressFrom(org),
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
      address: addressFrom(client),
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
      totalCents: lineTotalCents(line),
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

export interface QuotePdfFile {
  buffer: Buffer;
  filename: string;
}

/**
 * PDF servi pour un devis : l'archive signée une fois `pdfSignedKey` posé
 * (jamais reconstruit — c'est le document qui fait foi, hash inclus), sinon
 * rendu à la volée (brouillon/émis non signé). Jamais l'inverse : on ne
 * stocke jamais le PDF non signé (plans/story-11.md).
 */
export async function resolveQuotePdfBuffer(
  db: AppDb,
  storage: Storage,
  organizationId: string,
  quoteId: string,
): Promise<QuotePdfFile | null> {
  const quote = await getQuoteById(db, organizationId, quoteId);
  if (!quote) return null;

  if (quote.pdfSignedKey) {
    const archived = await storage.get(quote.pdfSignedKey);
    if (archived) {
      return {
        buffer: archived,
        filename: `devis-signe-${quote.number ?? quote.id}.pdf`,
      };
    }
  }

  const input = await buildQuotePdfInput(db, storage, organizationId, quoteId);
  if (!input) return null;
  const buffer = await renderDocumentPdf(input);
  return { buffer, filename: `devis-${quote.number ?? "brouillon"}.pdf` };
}
