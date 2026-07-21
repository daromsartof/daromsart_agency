import { DEFAULT_PDF_TEMPLATE_OPTIONS, type PdfAddress, type PdfQrCode, type PdfTemplateOptions } from "@daromsart/pdf";
import { epcQrPayload, qrPngDataUrl } from "@daromsart/qr";
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
): Promise<{
  pdf: PdfTemplateOptions;
  headerFooter: string | null;
  showPaymentQr: boolean;
  showPublicLinkQr: boolean;
}> {
  const template = templateId
    ? await getTemplateById(db, organizationId, templateId)
    : await getDefaultTemplate(db, organizationId, kind);
  if (!template) {
    return {
      pdf: DEFAULT_PDF_TEMPLATE_OPTIONS,
      headerFooter: null,
      showPaymentQr: false,
      showPublicLinkQr: false,
    };
  }
  const {
    accentColor,
    showLogo,
    logoPosition,
    font,
    columns,
    footerNote,
    paymentTermsText,
    showPaymentQr,
    showPublicLinkQr,
  } = template.options;
  const combinedFooter = [footerNote, paymentTermsText].filter(Boolean).join("\n");
  return {
    pdf: { accentColor, showLogo, logoPosition, font, columns },
    headerFooter: combinedFooter || null,
    showPaymentQr,
    showPublicLinkQr,
  };
}

export interface QrCodesInput {
  showPaymentQr: boolean;
  showPublicLinkQr: boolean;
  /** Le QR de paiement n'existe jamais pour un devis ni un avoir (montant négatif) — uniquement facture. */
  kind: "quote" | "invoice" | "credit_note";
  beneficiaryName: string;
  iban?: string | null;
  bic?: string | null;
  totalCents: number;
  /** Communication du virement (numéro de facture). */
  remittance?: string | null;
  publicUrl: string | null;
}

/**
 * QR codes du pied de document (story 13) : paiement (EPC069-12, facture
 * uniquement, IBAN requis, montant > 0) et/ou lien public (devis ET
 * factures) — chacun conditionné par son interrupteur de modèle (H10).
 */
export async function buildQrCodes(input: QrCodesInput): Promise<PdfQrCode[]> {
  const codes: PdfQrCode[] = [];

  if (
    input.showPaymentQr &&
    input.kind === "invoice" &&
    input.iban &&
    input.totalCents > 0
  ) {
    const payload = epcQrPayload({
      name: input.beneficiaryName,
      iban: input.iban,
      bic: input.bic,
      amountCents: input.totalCents,
      remittance: input.remittance,
    });
    if (payload) {
      codes.push({
        label: "Payez par virement en scannant ce code",
        dataUrl: await qrPngDataUrl(payload),
      });
    }
  }

  if (input.showPublicLinkQr && input.publicUrl) {
    codes.push({
      label:
        input.kind === "quote" ? "Consulter et signer en ligne" : "Consulter la facture en ligne",
      dataUrl: await qrPngDataUrl(input.publicUrl),
    });
  }

  return codes;
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
