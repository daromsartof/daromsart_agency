import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import type { Storage } from "@daromsart/storage";
import type { AppDb } from "../../db/types";
import { signableDocuments } from "../../db/schema";
import { parseSignaturePng } from "../documents/signature-validation";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export type MutationResult =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string> };

export interface UploadSignableDocumentInput {
  filename: string;
  buffer: Buffer;
}

/**
 * Upload d'un PDF quelconque (story 25) — validé par ses octets magiques
 * (`%PDF-`) puis chargé via pdf-lib pour en extraire `pageCount` (échec de
 * chargement = PDF corrompu/invalide, rejeté). L'id est généré en amont pour
 * servir à la fois de clé de storage et de clé primaire, sans aller-retour
 * insert-puis-update.
 */
export async function uploadSignableDocument(
  db: AppDb,
  storage: Storage,
  organizationId: string,
  input: UploadSignableDocumentInput,
): Promise<MutationResult> {
  if (input.buffer.byteLength === 0) {
    return { ok: false, errors: { file: "Fichier vide." } };
  }
  if (input.buffer.byteLength > MAX_UPLOAD_BYTES) {
    return { ok: false, errors: { file: "Le fichier dépasse 15 Mo." } };
  }
  if (input.buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return { ok: false, errors: { file: "Le fichier n'est pas un PDF valide." } };
  }

  let pageCount: number;
  try {
    const pdf = await PDFDocument.load(input.buffer);
    pageCount = pdf.getPageCount();
  } catch {
    return { ok: false, errors: { file: "PDF invalide ou corrompu." } };
  }
  if (pageCount === 0) {
    return { ok: false, errors: { file: "Le PDF ne contient aucune page." } };
  }

  const id = randomUUID();
  const originalKey = `signable/${id}/original.pdf`;
  await storage.put(originalKey, input.buffer, "application/pdf");

  await db.insert(signableDocuments).values({
    id,
    organizationId,
    title: input.filename,
    originalKey,
    pageCount,
  });

  return { ok: true, id };
}

export type SignatureAnchor =
  | "bas-gauche"
  | "bas-centre"
  | "bas-droite"
  | "haut-gauche"
  | "centre"
  | "haut-droite";

export interface SignSignableDocumentInput {
  signerName: string;
  /** Data URL PNG du tracé (canvas maison, cf. modules/public/components). */
  pngDataUrl: string;
  /** 1-indexé (page 1 = première page), comme affiché à l'utilisateur. */
  page: number;
  anchor: SignatureAnchor;
}

const STAMP_WIDTH = 160;
const STAMP_HEIGHT = 60;
const MARGIN = 24;

/**
 * Position du coin bas-gauche du tampon, dans le repère pdf-lib (origine en
 * bas-gauche de la page, axe Y croissant vers le haut — piège classique :
 * "haut" veut donc dire `y` proche de `height`, pas proche de 0).
 */
function anchorPosition(
  anchor: SignatureAnchor,
  pageWidth: number,
  pageHeight: number,
): { x: number; y: number } {
  const centerX = (pageWidth - STAMP_WIDTH) / 2;
  const centerY = (pageHeight - STAMP_HEIGHT) / 2;
  const right = pageWidth - STAMP_WIDTH - MARGIN;
  const top = pageHeight - STAMP_HEIGHT - MARGIN;

  switch (anchor) {
    case "bas-gauche":
      return { x: MARGIN, y: MARGIN };
    case "bas-centre":
      return { x: centerX, y: MARGIN };
    case "bas-droite":
      return { x: right, y: MARGIN };
    case "haut-gauche":
      return { x: MARGIN, y: top };
    case "centre":
      return { x: centerX, y: centerY };
    case "haut-droite":
      return { x: right, y: top };
  }
}

/**
 * Signe un document (story 25) : fusionne le PNG de signature directement
 * dans le PDF vectoriel via pdf-lib (jamais de rastérisation — sûr pour
 * l'image Docker Alpine du self-hosting, cf. plans). Une seule signature par
 * document (contrôle applicatif, table non partagée/racée comme
 * `signatures`).
 */
export async function signSignableDocument(
  db: AppDb,
  storage: Storage,
  organizationId: string,
  id: string,
  input: SignSignableDocumentInput,
): Promise<MutationResult> {
  const [doc] = await db
    .select()
    .from(signableDocuments)
    .where(
      and(eq(signableDocuments.id, id), eq(signableDocuments.organizationId, organizationId)),
    )
    .limit(1);
  if (!doc) {
    return { ok: false, errors: { _root: "Document introuvable." } };
  }
  if (doc.signedAt) {
    return { ok: false, errors: { _root: "Ce document a déjà été signé." } };
  }
  if (!input.signerName.trim()) {
    return { ok: false, errors: { signerName: "Le nom est requis." } };
  }
  if (!Number.isInteger(input.page) || input.page < 1 || input.page > doc.pageCount) {
    return { ok: false, errors: { page: "Numéro de page invalide." } };
  }

  const parsedPng = parseSignaturePng(input.pngDataUrl);
  if (!parsedPng.ok) {
    const messages: Record<typeof parsedPng.reason, string> = {
      invalid: "Signature invalide.",
      empty: "Signature requise.",
      too_large: "Signature trop volumineuse.",
    };
    return { ok: false, errors: { signature: messages[parsedPng.reason] } };
  }

  const originalBuffer = await storage.get(doc.originalKey);
  if (!originalBuffer) {
    return { ok: false, errors: { _root: "PDF original introuvable." } };
  }

  const pdf = await PDFDocument.load(originalBuffer);
  const pngImage = await pdf.embedPng(parsedPng.buffer);
  const page = pdf.getPage(input.page - 1);
  const { width, height } = page.getSize();
  const { x, y } = anchorPosition(input.anchor, width, height);
  page.drawImage(pngImage, { x, y, width: STAMP_WIDTH, height: STAMP_HEIGHT });

  const signedBytes = await pdf.save();
  const signedKey = `signable/${id}/signed.pdf`;
  await storage.put(signedKey, Buffer.from(signedBytes), "application/pdf");

  await db
    .update(signableDocuments)
    .set({ signedKey, signerName: input.signerName.trim(), signedAt: new Date() })
    .where(eq(signableDocuments.id, id));

  return { ok: true, id };
}
