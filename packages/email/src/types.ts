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

export interface ReminderEmailData {
  number: string;
  clientName: string;
  organizationName: string;
  remainingCents: number;
  daysOverdue: number;
  publicUrl: string;
  /** Corps libre (déjà résolu : variables `{client}/{numero}/.../{jours_retard}` substituées). */
  bodyText: string;
  accentColor: string;
}

export interface SendReminderEmailParams {
  to: string[];
  cc?: string[];
  subject: string;
  reminder: ReminderEmailData;
  pdfBuffer: Buffer;
  pdfFilename: string;
}

export interface SendResetPasswordEmailParams {
  to: string;
  url: string;
}

export interface SendSignatureConfirmationParams {
  to: string;
  organizationName: string;
  accentColor: string;
  quoteNumber: string;
  clientName: string;
  signerName: string;
  forOrganization: boolean;
  publicUrl: string;
  /** PDF signé joint (facultatif — l'email interne à l'org peut s'en passer). */
  pdfBuffer?: Buffer;
  pdfFilename?: string;
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
