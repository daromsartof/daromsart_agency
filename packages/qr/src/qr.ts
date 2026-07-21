import QRCode from "qrcode";

/** Correction d'erreur M (15 %) — bon compromis lisibilité/densité pour un QR imprimé en pied de PDF (~90pt). */
const ERROR_CORRECTION_LEVEL = "M";

/** PNG carré (`sizePx` de côté) encodant `text`, en buffer brut — jamais un fichier temporaire. */
export async function qrPngBuffer(text: string, sizePx = 512): Promise<Buffer> {
  return QRCode.toBuffer(text, {
    type: "png",
    width: sizePx,
    errorCorrectionLevel: ERROR_CORRECTION_LEVEL,
    margin: 1,
  });
}

/** Variante SVG (aperçu web léger — pas utilisée dans le PDF, qui embarque un PNG). */
export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: ERROR_CORRECTION_LEVEL,
    margin: 1,
  });
}

/** Data URL PNG prête à être injectée dans le DTO PDF (`PdfQrCode.dataUrl`). */
export async function qrPngDataUrl(text: string, sizePx = 512): Promise<string> {
  const buffer = await qrPngBuffer(text, sizePx);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}
