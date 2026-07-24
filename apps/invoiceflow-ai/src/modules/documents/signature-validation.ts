/**
 * Validation d'une data URL PNG de signature manuscrite — partagée par
 * `signQuote`, `signInvoice` (modules/public/mutations.ts) et
 * `signSignableDocument` (modules/signable-documents/mutations.ts, story 25).
 */
export const MAX_SIGNATURE_PNG_BYTES = 500 * 1024;

export type ParseSignaturePngResult =
  | { ok: true; buffer: Buffer }
  | { ok: false; reason: "invalid" | "empty" | "too_large" };

export function parseSignaturePng(dataUrl: string): ParseSignaturePngResult {
  const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
  if (!match) return { ok: false, reason: "invalid" };
  const buffer = Buffer.from(match[1], "base64");
  if (buffer.byteLength === 0) return { ok: false, reason: "empty" };
  if (buffer.byteLength > MAX_SIGNATURE_PNG_BYTES) return { ok: false, reason: "too_large" };
  return { ok: true, buffer };
}
