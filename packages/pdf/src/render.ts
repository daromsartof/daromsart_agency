import { renderToBuffer } from "@react-pdf/renderer";
import { DocumentPdf } from "./document";
import type { DocumentPdfInput } from "./types";

/**
 * Rend un document (devis/facture/avoir) en PDF A4. Fonction pure côté
 * données : tout ce qui apparaît vient de `input` (DTO sérialisable), aucun
 * accès réseau/disque pendant le rendu — les données binaires (logo,
 * signature, QR) sont déjà des data URLs résolues par l'appelant.
 *
 * Doit être appelée depuis un runtime Node (jamais edge) : `@react-pdf/renderer`
 * utilise des API non disponibles en edge runtime.
 */
export async function renderDocumentPdf(input: DocumentPdfInput): Promise<Buffer> {
  return renderToBuffer(DocumentPdf({ data: input }));
}
