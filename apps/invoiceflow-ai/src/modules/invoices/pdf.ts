import { eq } from "drizzle-orm";
import { renderDocumentPdf, type DocumentPdfInput } from "@daromsart/pdf";
import type { Storage } from "@daromsart/storage";
import type { AppDb } from "../../db/types";
import { organizations } from "../../db/schema";
import { getClientById } from "../clients/queries";
import { env } from "../../lib/env";
import {
  addressFrom,
  lineTotalCents,
  resolveLogoDataUrl,
  resolveTemplateOptions,
} from "../documents/pdf-helpers";
import { getInvoiceById } from "./queries";

/**
 * Construit le DTO d'entrée de `renderDocumentPdf` pour une facture (story
 * 12, miroir de `modules/documents/pdf.ts#buildQuotePdfInput`, story 08).
 * Différence clé (H7, immuabilité) : une fois ÉMISE, l'émetteur et le
 * client viennent du **snapshot** figé à l'émission — jamais des données
 * live — pour qu'une modification ultérieure du client/de l'org n'altère
 * jamais un PDF déjà émis (testé en intégration). En brouillon, les
 * données live sont utilisées (rien n'est figé).
 */
export async function buildInvoicePdfInput(
  db: AppDb,
  storage: Storage,
  organizationId: string,
  invoiceId: string,
): Promise<DocumentPdfInput | null> {
  const invoice = await getInvoiceById(db, organizationId, invoiceId);
  if (!invoice) return null;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!org) return null;

  const orgData = invoice.organizationSnapshot ?? {
    legalName: org.legalName,
    tradeName: org.tradeName,
    addressStreet: org.addressStreet,
    addressZip: org.addressZip,
    addressCity: org.addressCity,
    addressCountry: org.addressCountry,
    email: org.email,
    phone: org.phone,
    siret: org.siret,
    vatNumber: org.vatNumber,
    legalForm: org.legalForm,
    capital: org.capital,
    iban: org.iban,
    bic: org.bic,
    logoKey: org.logoKey,
  };

  let clientData = invoice.clientSnapshot;
  if (!clientData) {
    const client = await getClientById(db, organizationId, invoice.clientId);
    if (!client) return null;
    clientData = {
      displayName: client.displayName,
      legalName: client.legalName,
      addressStreet: client.addressStreet,
      addressZip: client.addressZip,
      addressCity: client.addressCity,
      addressCountry: client.addressCountry,
      siret: client.siret,
      vatNumber: client.vatNumber,
      email: client.email,
    };
  }

  const logoDataUrl = await resolveLogoDataUrl(storage, orgData.logoKey);
  const { pdf: templateOptions, headerFooter } = await resolveTemplateOptions(
    db,
    organizationId,
    invoice.templateId,
    "invoice",
  );

  return {
    organization: {
      legalName: orgData.legalName,
      tradeName: orgData.tradeName,
      address: addressFrom(orgData),
      email: orgData.email,
      phone: orgData.phone,
      siret: orgData.siret,
      vatNumber: orgData.vatNumber,
      legalForm: orgData.legalForm,
      capital: orgData.capital,
      iban: orgData.iban,
      bic: orgData.bic,
      logoDataUrl,
    },
    client: {
      displayName: clientData.displayName,
      legalName: clientData.legalName,
      address: addressFrom(clientData),
      siret: clientData.siret,
      vatNumber: clientData.vatNumber,
      email: clientData.email,
    },
    meta: {
      kind: "invoice",
      number: invoice.number,
      issueDate: invoice.issueDate,
      dueOrValidUntil: invoice.dueDate,
      title: null,
    },
    lines: invoice.lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unit: null,
      unitPriceCents: line.unitPriceCents,
      vatRate: line.vatRate,
      discount: line.discount,
      totalCents: lineTotalCents(line),
    })),
    totals: {
      subtotalCents: invoice.subtotalCents,
      discountCents: invoice.discountCents,
      vatByRate: invoice.vatByRate,
      totalCents: invoice.totalCents,
    },
    introNote: invoice.notes,
    footerNote: headerFooter,
    legalFooter: org.legalFooter,
    template: templateOptions,
    publicUrl: invoice.shareToken ? `${env.APP_URL}/p/factures/${invoice.shareToken}` : null,
  };
}

export interface InvoicePdfFile {
  buffer: Buffer;
  filename: string;
}

export async function resolveInvoicePdfBuffer(
  db: AppDb,
  storage: Storage,
  organizationId: string,
  invoiceId: string,
): Promise<InvoicePdfFile | null> {
  const invoice = await getInvoiceById(db, organizationId, invoiceId);
  if (!invoice) return null;

  const input = await buildInvoicePdfInput(db, storage, organizationId, invoiceId);
  if (!input) return null;
  const buffer = await renderDocumentPdf(input);
  return { buffer, filename: `facture-${invoice.number ?? "brouillon"}.pdf` };
}
