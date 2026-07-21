import { Font } from "@react-pdf/renderer";
import {
  INTER_BOLD_BASE64,
  INTER_REGULAR_BASE64,
  LORA_BOLD_BASE64,
  LORA_REGULAR_BASE64,
} from "./font-data";

export const SANS_FONT_FAMILY = "Inter";
export const SERIF_FONT_FAMILY = "Lora";

let registered = false;

/**
 * Enregistre les polices embarquées (Inter/sans, Lora/serif) une seule fois
 * par process, depuis des données base64 embarquées dans le bundle (pas de
 * lecture disque au runtime — voir `font-data.ts`). Désactive aussi la
 * césure automatique de react-pdf, qui casse sinon les mots en fin de ligne
 * de façon peu naturelle en français.
 */
export function registerFonts(): void {
  if (registered) return;
  Font.register({
    family: SANS_FONT_FAMILY,
    fonts: [
      { src: `data:font/ttf;base64,${INTER_REGULAR_BASE64}`, fontWeight: "normal" },
      { src: `data:font/ttf;base64,${INTER_BOLD_BASE64}`, fontWeight: "bold" },
    ],
  });
  Font.register({
    family: SERIF_FONT_FAMILY,
    fonts: [
      { src: `data:font/ttf;base64,${LORA_REGULAR_BASE64}`, fontWeight: "normal" },
      { src: `data:font/ttf;base64,${LORA_BOLD_BASE64}`, fontWeight: "bold" },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

export function fontFamilyFor(font: "sans" | "serif"): string {
  return font === "serif" ? SERIF_FONT_FAMILY : SANS_FONT_FAMILY;
}
