/** Rect du tampon en points PDF (origine bas-gauche, comme pdf-lib). */
export interface SignaturePlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type SignatureAnchor =
  | "bas-gauche"
  | "bas-centre"
  | "bas-droite"
  | "haut-gauche"
  | "centre"
  | "haut-droite";

/** Taille par défaut du tampon (points PDF). */
export const STAMP_WIDTH = 160;
export const STAMP_HEIGHT = 60;
