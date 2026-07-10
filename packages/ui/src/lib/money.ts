/**
 * Conversion saisie texte ↔ centimes (integer). Format d'affichage : fr-FR.
 * Aucune manipulation de float pour les montants : on parse en entier de centimes.
 *
 * Règles de parsing :
 * - espaces (normal, insécable, fine) = séparateurs de milliers → ignorés ;
 * - virgule OU point = séparateur décimal (le dernier rencontré fait foi si les
 *   deux sont présents) ;
 * - au-delà de 2 décimales, arrondi au centime le plus proche (half-up) ;
 * - chaîne vide / invalide → `null`.
 */
export function parseAmountToCents(input: string): number | null {
  if (typeof input !== "string") return null;
  let s = input.trim();
  if (s === "") return null;

  s = s.replace(/[\s\u00A0\u202F]/g, "");

  let negative = false;
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  if (s === "") return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let decimalSep: "" | "," | "." = "";
  if (lastComma !== -1 && lastDot !== -1) {
    decimalSep = lastComma > lastDot ? "," : ".";
  } else if (lastComma !== -1) {
    decimalSep = ",";
  } else if (lastDot !== -1) {
    decimalSep = ".";
  }

  let intPart = s;
  let fracPart = "";
  if (decimalSep) {
    const idx = s.lastIndexOf(decimalSep);
    intPart = s.slice(0, idx);
    fracPart = s.slice(idx + 1);
  }

  // Les séparateurs restants dans la partie entière sont des milliers.
  intPart = intPart.replace(/[.,]/g, "");
  if (intPart === "") intPart = "0";

  if (!/^\d+$/.test(intPart)) return null;
  if (fracPart !== "" && !/^\d+$/.test(fracPart)) return null;

  const whole = Number.parseInt(intPart, 10);
  const frac2 = (fracPart + "00").slice(0, 2);
  let cents = whole * 100 + Number.parseInt(frac2, 10);

  if (fracPart.length > 2) {
    const third = fracPart.charCodeAt(2) - 48;
    if (third >= 5) cents += 1;
  }

  return negative ? -cents : cents;
}

/** Formate des centimes en saisie fr-FR sans symbole (« 1 234,56 »). */
export function formatCentsToInput(cents: number): string {
  if (!Number.isFinite(cents)) return "";
  const rounded = Math.round(cents);
  const negative = rounded < 0;
  const abs = Math.abs(rounded);
  const euros = Math.floor(abs / 100);
  const remainder = abs % 100;
  const eurosStr = euros.toLocaleString("fr-FR");
  const centsStr = remainder.toString().padStart(2, "0");
  return `${negative ? "-" : ""}${eurosStr},${centsStr}`;
}

/** Formate des centimes en euros avec symbole (« 1 234,56 € »). */
export function formatCentsEUR(cents: number): string {
  if (!Number.isFinite(cents)) return "";
  return (Math.round(cents) / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
  });
}
