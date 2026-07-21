/**
 * EPC069-12 ("QR-facture" / SEPA Credit Transfer) payload — le texte encodé
 * dans le QR de paiement (story 13). Format fixe à 12 champs LF-only (jamais
 * CRLF), voir plans/story-13.md pour le gabarit de référence exact.
 */
export interface EpcQrPayloadInput {
  /** Nom du bénéficiaire (organisation émettrice). Tronqué à 70 caractères. */
  name: string;
  iban: string;
  /** Optionnel en version 002 (BIC obligatoire seulement pour certains pays hors zone SEPA). */
  bic?: string | null;
  amountCents: number;
  /** Communication non structurée (ex. numéro de facture). Tronquée à 140 caractères. */
  remittance?: string | null;
}

const MAX_NAME_LENGTH = 70;
const MAX_REMITTANCE_LENGTH = 140;
/** 0,01 € — un virement de montant nul n'a pas de sens. */
const MIN_AMOUNT_CENTS = 1;
/** 999 999 999,99 € — borne du champ montant EPC069-12. */
const MAX_AMOUNT_CENTS = 99_999_999_999;

function formatAmount(amountCents: number): string {
  return `EUR${(amountCents / 100).toFixed(2)}`;
}

/**
 * Construit le payload EPC069-12 (virement SEPA), ou `null` si le montant est
 * hors bornes (0,01–999 999 999,99 €) — jamais de QR de paiement invalide.
 */
export function epcQrPayload(input: EpcQrPayloadInput): string | null {
  if (input.amountCents < MIN_AMOUNT_CENTS || input.amountCents > MAX_AMOUNT_CENTS) {
    return null;
  }

  const iban = input.iban.replace(/\s+/g, "").toUpperCase();
  const bic = (input.bic ?? "").replace(/\s+/g, "").toUpperCase();
  const name = input.name.slice(0, MAX_NAME_LENGTH);
  const remittance = (input.remittance ?? "").slice(0, MAX_REMITTANCE_LENGTH);

  return [
    "BCD",
    "002",
    "1",
    "SCT",
    bic,
    name,
    iban,
    formatAmount(input.amountCents),
    "",
    remittance,
    "",
    "",
  ].join("\n");
}
