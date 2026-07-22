import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { DocumentEmail } from "./templates/document-email";
import { ReminderEmail } from "./templates/reminder-email";
import { ResetPasswordEmail } from "./templates/reset-password-email";
import { SignatureConfirmationEmail } from "./templates/signature-confirmation";
import { InviteEmail } from "./templates/invite-email";
import type {
  MailerConfig,
  SendDocumentEmailParams,
  SendEmailResult,
  SendInviteEmailParams,
  SendReminderEmailParams,
  SendResetPasswordEmailParams,
  SendSignatureConfirmationParams,
} from "./types";

/** Marge de sécurité sous la limite réelle de Resend (40 Mo) — nos PDF font < 1 Mo. */
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export interface Mailer {
  sendDocumentEmail(params: SendDocumentEmailParams): Promise<SendEmailResult>;
  sendResetPasswordEmail(params: SendResetPasswordEmailParams): Promise<SendEmailResult>;
  sendSignatureConfirmation(
    params: SendSignatureConfirmationParams,
  ): Promise<SendEmailResult>;
  sendReminderEmail(params: SendReminderEmailParams): Promise<SendEmailResult>;
  sendInviteEmail(params: SendInviteEmailParams): Promise<SendEmailResult>;
}

function fakeId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

interface DispatchParams {
  to: string[];
  cc?: string[];
  subject: string;
  react: React.ReactElement;
  attachment?: { filename: string; content: Buffer };
}

/**
 * `createMailer` : Resend + React Email si `apiKey` est fournie ; sinon mode
 * dev — aucun accès réseau, l'email rendu est écrit en HTML sur disque
 * (`previewDir`) et un id factice est renvoyé. Permet aux tests d'intégration
 * et à l'usage local de tourner sans clé Resend (H12).
 */
export function createMailer(config: MailerConfig): Mailer {
  const previewDir = config.previewDir ?? ".storage/emails";
  const resend = config.apiKey ? new Resend(config.apiKey) : null;

  async function dispatch(params: DispatchParams): Promise<SendEmailResult> {
    const html = await render(params.react);

    if (!resend) {
      await mkdir(previewDir, { recursive: true });
      const safeTo = (params.to[0] ?? "email").replace(/[^a-z0-9@.]/gi, "_");
      const filename = `${Date.now()}-${safeTo}.html`;
      await writeFile(join(previewDir, filename), html, "utf8");
      return { ok: true, id: fakeId("dev"), mode: "dev-preview" };
    }

    try {
      const result = await resend.emails.send({
        from: config.from,
        to: params.to,
        cc: params.cc,
        subject: params.subject,
        html,
        attachments: params.attachment
          ? [{ filename: params.attachment.filename, content: params.attachment.content }]
          : undefined,
      });
      if (result.error) {
        return { ok: false, error: result.error.message };
      }
      return { ok: true, id: result.data?.id ?? fakeId("resend"), mode: "resend" };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Erreur d'envoi inconnue.",
      };
    }
  }

  return {
    async sendDocumentEmail(params) {
      const withinLimit = params.pdfBuffer.byteLength <= MAX_ATTACHMENT_BYTES;
      return dispatch({
        to: params.to,
        cc: params.cc,
        subject: params.subject,
        react: <DocumentEmail data={params.document} />,
        attachment: withinLimit
          ? { filename: params.pdfFilename, content: params.pdfBuffer }
          : undefined,
      });
    },
    async sendResetPasswordEmail(params) {
      return dispatch({
        to: [params.to],
        subject: "Réinitialisation de votre mot de passe",
        react: <ResetPasswordEmail url={params.url} />,
      });
    },
    async sendSignatureConfirmation(params) {
      const withinLimit =
        !params.pdfBuffer || params.pdfBuffer.byteLength <= MAX_ATTACHMENT_BYTES;
      return dispatch({
        to: [params.to],
        subject: params.forOrganization
          ? `Devis ${params.quoteNumber} signé`
          : `Signature confirmée — devis ${params.quoteNumber}`,
        react: <SignatureConfirmationEmail {...params} />,
        attachment:
          withinLimit && params.pdfBuffer && params.pdfFilename
            ? { filename: params.pdfFilename, content: params.pdfBuffer }
            : undefined,
      });
    },
    async sendReminderEmail(params) {
      const withinLimit = params.pdfBuffer.byteLength <= MAX_ATTACHMENT_BYTES;
      return dispatch({
        to: params.to,
        cc: params.cc,
        subject: params.subject,
        react: <ReminderEmail data={params.reminder} />,
        attachment: withinLimit
          ? { filename: params.pdfFilename, content: params.pdfBuffer }
          : undefined,
      });
    },
    async sendInviteEmail(params) {
      return dispatch({
        to: [params.to],
        subject: `Invitation à rejoindre ${params.organizationName}`,
        react: (
          <InviteEmail
            organizationName={params.organizationName}
            inviterName={params.inviterName}
            role={params.role}
            url={params.url}
          />
        ),
      });
    },
  };
}
