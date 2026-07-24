/**
 * Conventions de variables de police. `--font-sans` (Outfit) et `--font-heading`
 * (Space Grotesk) sont déclarées dans `tokens.css` avec repli système ; la
 * fonte réelle est injectée par l'app via `next/font/google` (auto-hébergée,
 * pas de requête runtime vers Google Fonts) — voir `app/layout.tsx`.
 */
export const fontSansVariable = "--font-sans";
export const fontHeadingVariable = "--font-heading";
export const fontSerifVariable = "--font-serif";

/** Nom de famille CSS prêt à l'emploi (fallback inclus dans tokens.css). */
export const fontSans = `var(${fontSansVariable})`;
export const fontHeading = `var(${fontHeadingVariable})`;
export const fontSerif = `var(${fontSerifVariable})`;
