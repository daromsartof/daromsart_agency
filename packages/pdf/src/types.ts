/**
 * DTO d'entrée du rendu PDF — 100 % sérialisable (aucune entité Drizzle,
 * aucune fonction). Toutes les données affichées viennent de cet objet ; le
 * rendu ne fait aucun accès réseau/disque (logo et signature sont déjà des
 * data URLs résolues en amont par l'app, cf. `modules/documents/pdf.ts`).
 */

export interface PdfAddress {
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  country?: string | null;
}

export interface PdfOrganization {
  legalName: string;
  tradeName?: string | null;
  address: PdfAddress;
  email?: string | null;
  phone?: string | null;
  siret?: string | null;
  vatNumber?: string | null;
  legalForm?: string | null;
  capital?: string | null;
  iban?: string | null;
  bic?: string | null;
  /** Data URL (`data:image/png;base64,...`) — jamais une URL réseau. */
  logoDataUrl?: string | null;
}

export interface PdfClient {
  displayName: string;
  legalName?: string | null;
  address: PdfAddress;
  siret?: string | null;
  vatNumber?: string | null;
  email?: string | null;
}

export interface PdfDiscount {
  type: "percent" | "amount";
  value: number;
}

export interface PdfLine {
  description: string;
  quantity: number;
  unit?: string | null;
  unitPriceCents: number;
  vatRate: number;
  discount?: PdfDiscount | null;
  /** Total HT de la ligne, après remise ligne (avant remise globale). */
  totalCents: number;
}

export type PdfDocumentKind = "quote" | "invoice" | "credit_note";

export interface PdfMeta {
  kind: PdfDocumentKind;
  number: string | null;
  issueDate: Date | null;
  /** Devis : date de validité. Facture/avoir : date d'échéance. */
  dueOrValidUntil: Date | null;
  title?: string | null;
}

export interface PdfTotals {
  subtotalCents: number;
  discountCents: number;
  vatByRate: Record<string, number>;
  totalCents: number;
}

export interface PdfQrCode {
  label: string;
  /** Data URL PNG déjà rendue (`@daromsart/qr`, story 13). */
  dataUrl: string;
}

export interface PdfSignature {
  name: string;
  signedAt: Date;
  /** Data URL PNG du tracé signé. */
  imageDataUrl: string;
}

export interface PdfTemplateOptions {
  accentColor: string;
  showLogo: boolean;
  columns: {
    unit: boolean;
    vatPerLine: boolean;
    discountPerLine: boolean;
  };
}

export interface DocumentPdfInput {
  organization: PdfOrganization;
  client: PdfClient;
  meta: PdfMeta;
  lines: PdfLine[];
  totals: PdfTotals;
  introNote?: string | null;
  footerNote?: string | null;
  legalFooter?: string | null;
  template: PdfTemplateOptions;
  qrCodes?: PdfQrCode[];
  signature?: PdfSignature | null;
  /** Lien public (`/p/...`), affiché en pied de page si fourni. */
  publicUrl?: string | null;
}

/** Options neutres par défaut (story 08 ; les vrais modèles arrivent en 09). */
export const DEFAULT_PDF_TEMPLATE_OPTIONS: PdfTemplateOptions = {
  accentColor: "#7367F0",
  showLogo: true,
  columns: { unit: true, vatPerLine: true, discountPerLine: true },
};
