# Story 13 — QR codes (paiement EPC + lien public)

**PR** : `story/13-qr-codes` · **Dépend de** : 12 · **Écrans** : aucun nouveau (PDF + options modèle)

## Objectif
Package `@daromsart/qr` ; QR de paiement EPC (virement SEPA) et QR de lien public rendus sur les PDF selon les options du modèle (H10).

## Étapes
1. `packages/qr` : dep `qrcode`. `epcQrPayload({name, iban, bic?, amountCents, remittance})` → string EPC069-12 exact :
   `BCD\n002\n1\nSCT\n{BIC}\n{name}\n{iban}\nEUR{amount décimal}\n\n{remittance}\n\n` (version 002 : BIC optionnel vide ; name ≤ 70 chars ; remittance non structurée ≤ 140 ; montant `EUR123.45`, borne 0,01–999 999 999,99 sinon `null`).
   `qrPngBuffer(text, sizePx)` et `qrSvg(text)`.
2. `@daromsart/pdf` : bloc pied de facture — si `showPaymentQr` ET IBAN org ET total > 0 ET kind=invoice : QR EPC (PNG buffer dans le DTO) + légende "Payez par virement en scannant ce code" ; si `showPublicLinkQr` : QR du lien public (devis ET factures) + légende. Les QR sont générés dans `buildInvoicePdfInput`/`buildQuotePdfInput` (app) et passés en buffers.
3. Aperçu modèle (story 09) : la preview reflète les switches QR (QR factices).
4. Avoirs : jamais de QR paiement (montant négatif) — garde dans le builder.

## Fichiers touchés
`packages/qr/src/**` (+tests), `packages/pdf/src/**` (blocs QR), `src/modules/documents/pdf.ts` (builders), `src/app/api/templates/preview/route.ts`, tests `[I]`.

## Échecs probables + parade
- **Payload EPC invalide pour les apps bancaires** → suivre le spec test : cas de référence connu (vérifié contre EPC069-12) en test unitaire caractère par caractère ; pas d'espaces parasites, LF uniquement, pas de CRLF.
- **Montant en centimes → décimal** : formatage `(cents/100).toFixed(2)` avec point (PAS de locale FR ici) ; test 1 centime, montant rond.
- **Nom org avec accents/longueur** → autorisés en UTF-8 (charset 1 implicite), tronquer à 70.
- **QR illisible sur PDF** (compression) → PNG 512px, error correction M, taille imprimée ~90pt.

## Done
- `[U]` epcQrPayload : cas de référence exact, BIC absent, montant hors bornes → null, troncatures.
- `[I]` PDF facture avec IBAN + option ON → contient les 2 QR ; option OFF ou IBAN vide → aucun ; avoir → jamais de QR paiement ; devis → uniquement QR lien.
- `[M]` scanner le QR EPC imprimé avec une app bancaire réelle (ou validateur EPC en ligne) — résultat en capture dans la PR.

## Quand s'arrêter
Pas de QR sur la page publique facture (le bloc virement de E-26 arrive en story 14 et réutilisera `@daromsart/qr`). Pas d'autres formats (Swiss QR, etc.).
