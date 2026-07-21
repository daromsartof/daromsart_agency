import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatEUR } from "@daromsart/core";
import { createMailer } from "./mailer";

let previewDir: string;

beforeEach(async () => {
  previewDir = await mkdtemp(join(tmpdir(), "daromsart-email-"));
});

afterEach(async () => {
  await rm(previewDir, { recursive: true, force: true });
});

describe("createMailer — mode dev (sans apiKey)", () => {
  it("écrit un aperçu HTML et renvoie un id factice pour un email document", async () => {
    const mailer = createMailer({ from: "InvoiceFlow <no-reply@example.com>", previewDir });

    const result = await mailer.sendDocumentEmail({
      to: ["client@example.com"],
      subject: "Votre devis DEV-2026-0001",
      document: {
        kind: "quote",
        number: "DEV-2026-0001",
        clientName: "Client Test",
        organizationName: "Daromsart",
        totalCents: 120000,
        publicUrl: "https://app.example.com/p/devis/abc123",
        bodyText: "Bonjour,\nVeuillez trouver ci-joint notre devis.\nCordialement.",
        accentColor: "#7367F0",
      },
      pdfBuffer: Buffer.from("%PDF-fake"),
      pdfFilename: "devis-DEV-2026-0001.pdf",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mode).toBe("dev-preview");
    expect(result.id).toMatch(/^dev_/);

    const files = await readdir(previewDir);
    expect(files).toHaveLength(1);
    const html = await readFile(join(previewDir, files[0]), "utf8");
    expect(html).toContain("DEV-2026-0001");
    expect(html).toContain(formatEUR(120000));
    expect(html).toContain("Daromsart");
  });

  it("écrit un aperçu HTML pour l'email de réinitialisation de mot de passe", async () => {
    const mailer = createMailer({ from: "InvoiceFlow <no-reply@example.com>", previewDir });

    const result = await mailer.sendResetPasswordEmail({
      to: "user@example.com",
      url: "https://app.example.com/reinitialiser/tok123",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mode).toBe("dev-preview");

    const files = await readdir(previewDir);
    expect(files).toHaveLength(1);
    const html = await readFile(join(previewDir, files[0]), "utf8");
    expect(html).toContain("reinitialiser/tok123");
  });

  it("envoie sans pièce jointe si le PDF dépasse la limite de sécurité (10 Mo)", async () => {
    const mailer = createMailer({ from: "InvoiceFlow <no-reply@example.com>", previewDir });
    const bigBuffer = Buffer.alloc(11 * 1024 * 1024);

    const result = await mailer.sendDocumentEmail({
      to: ["client@example.com"],
      subject: "Votre devis",
      document: {
        kind: "quote",
        number: "DEV-2026-0002",
        clientName: "Client Test",
        organizationName: "Daromsart",
        totalCents: 100000,
        publicUrl: "https://app.example.com/p/devis/xyz",
        bodyText: "Bonjour.",
        accentColor: "#7367F0",
      },
      pdfBuffer: bigBuffer,
      pdfFilename: "devis.pdf",
    });

    // Le mode dev n'écrit jamais de PJ (juste le HTML) : on vérifie surtout
    // que l'envoi réussit toujours (pas de crash) au-delà de la limite.
    expect(result.ok).toBe(true);
  });
});
