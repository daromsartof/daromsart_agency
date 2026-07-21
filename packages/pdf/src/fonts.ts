import { Font } from "@react-pdf/renderer";
import { INTER_BOLD_BASE64, INTER_REGULAR_BASE64 } from "./font-data";

export const PDF_FONT_FAMILY = "Inter";

let registered = false;

/**
 * Enregistre Inter (regular + bold) une seule fois par process, depuis des
 * données base64 embarquées dans le bundle (pas de lecture disque au
 * runtime — voir `font-data.ts`). Désactive aussi la césure automatique de
 * react-pdf, qui casse sinon les mots en fin de ligne de façon peu naturelle
 * en français.
 */
export function registerFonts(): void {
  if (registered) return;
  Font.register({
    family: PDF_FONT_FAMILY,
    fonts: [
      { src: `data:font/ttf;base64,${INTER_REGULAR_BASE64}`, fontWeight: "normal" },
      { src: `data:font/ttf;base64,${INTER_BOLD_BASE64}`, fontWeight: "bold" },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
