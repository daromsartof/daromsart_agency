/**
 * Conventions de variables de police. La valeur concrète est injectée par
 * l'application via `next/font` (ex. Inter → `--font-sans`). Le preset Tailwind
 * et `tokens.css` consomment ces noms.
 */
export const fontSansVariable = "--font-sans";
export const fontSerifVariable = "--font-serif";

/** Nom de famille CSS prêt à l'emploi (fallback inclus dans tokens.css). */
export const fontSans = `var(${fontSansVariable})`;
export const fontSerif = `var(${fontSerifVariable})`;
