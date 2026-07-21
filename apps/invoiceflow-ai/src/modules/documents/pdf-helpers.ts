import { DEFAULT_PDF_TEMPLATE_OPTIONS, type PdfAddress, type PdfTemplateOptions } from "@daromsart/pdf";
import type { Storage } from "@daromsart/storage";
import type { AppDb } from "../../db/types";
import { getDefaultTemplate, getTemplateById } from "../templates/queries";

/**
 * Helpers de construction du DTO PDF partagés entre devis et factures
 * (story 12) — extraits de `modules/documents/pdf.ts` (devis, story 08) sans
 * changement de comportement (mêmes fonctions, juste rendues réutilisables).
 */

export async function resolveTemplateOptions(
  db: AppDb,
  organizationId: string,
  templateId: string | null,
  kind: "quote" | "invoice",
): Promise<{ pdf: PdfTemplateOptions; headerFooter: string | null }> {
  const template = templateId
    ? await getTemplateById(db, organizationId, templateId)
    : await getDefaultTemplate(db, organizationId, kind);
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

export async function resolveLogoDataUrl(
  storage: Storage,
  logoKey: string | null,
): Promise<string | null> {
  if (!logoKey) return null;
  const bytes = await storage.get(logoKey);
  if (!bytes) return null;
  return `data:${mimeFromKey(logoKey)};base64,${bytes.toString("base64")}`;
}

export function addressFrom(entity: {
  addressStreet: string | null;
  addressZip: string | null;
  addressCity: string | null;
  addressCountry: string;
}): PdfAddress {
  return {
    street: entity.addressStreet,
    zip: entity.addressZip,
    city: entity.addressCity,
    country: entity.addressCountry,
  };
}

/** Total HT d'une ligne, remise ligne appliquée (utilisé pour l'affichage PDF). */
export function lineTotalCents(line: {
  unitPriceCents: number;
  quantity: number;
  discount?: { type: "percent" | "amount"; value: number } | null;
}): number {
  const gross = line.unitPriceCents * line.quantity;
  if (!line.discount) return gross;
  const discountAmount =
    line.discount.type === "percent"
      ? Math.round((gross * line.discount.value) / 100)
      : line.discount.value;
  return gross - discountAmount;
}
