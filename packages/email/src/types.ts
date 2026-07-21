export interface DocumentEmailData {
  kind: "quote" | "invoice";
  number: string | null;
  clientName: string;
  organizationName: string;
  totalCents: number;
  publicUrl: string;
  /** Corps libre (déjà résolu : variables `{client}/{numero}/...` substituées). */
  bodyText: string;
  accentColor: string;
}

export interface SendDocumentEmailParams {
  to: string[];
  cc?: string[];
  subject: string;
  document: DocumentEmailData;
  pdfBuffer: Buffer;
  pdfFilename: string;
}

export interface SendResetPasswordEmailParams {
  to: string;
  url: string;
}

export type SendEmailResult =
  | { ok: true; id: string; mode: "resend" | "dev-preview" }
  | { ok: false; error: string };

export interface MailerConfig {
  /** Absente/vide → mode dev (aucun appel réseau, aperçu HTML sur disque). */
  apiKey?: string;
  from: string;
  /** Dossier de prévisualisation en mode dev. Défaut `.storage/emails`. */
  previewDir?: string;
}
