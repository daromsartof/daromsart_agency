# Story 10 — Envoi de devis par email

**PR** : `story/10-quote-email` · **Dépend de** : 08 · **Écrans** : E-13, E-28 (+E-33 branché réellement)

## Objectif
`@daromsart/email` opérationnel (Resend + React Email), dialog d'envoi complet, EmailLog, variables de template, PDF en pièce jointe. Brancher aussi l'email de reset password (TODO story 03).

## Étapes
1. `packages/email` : `createMailer({apiKey, from})` ; layout React Email commun brandé (E-28→33 gabarit) ; templates : `DocumentEmail` (devis/facture, corps libre + card récap + CTA), `ResetPasswordEmail` ; `sendDocumentEmail({to, cc, subject, bodyText, doc, pdfBuffer, publicUrl})` → Resend avec attachment ; retourne `{resendId}`. Mode dev : si `RESEND_API_KEY` absent → log + fichier `.storage/emails/*.html` (préviewable), retourne id factice (permet e2e sans réseau).
2. Schéma : `src/db/schema/emails.ts` (`email_logs`). `packages/core` : `renderEmailVariables(text, vars)` (`{client} {numero} {total} {lien} {echeance}`, + tests).
3. `modules/emails/` : `sendDocument.ts` — orchestration : si draft → `issueQuote` d'abord ; génère PDF ; compose sujet/corps depuis les textes org (défauts seedés) + variables ; envoie ; EmailLog `sent` ; DocumentEvent ; option "copie à moi".
4. Dialog E-13 (`modules/documents/components/send-dialog.tsx`, réutilisable facture) : destinataires tokens (client + contacts + saisie libre), cc, sujet/corps éditables, encart PJ, bannière "sera émis puis envoyé" si draft.
5. Brancher : bouton Envoyer/Renvoyer sur détail + liste devis. Reset password : injecter `sendEmail` réel dans `createAuth`.

## Fichiers touchés
`packages/email/src/**`, `packages/core/src/email-vars.ts` (+tests), `src/db/schema/emails.ts`, `src/modules/emails/**`, `src/modules/documents/components/send-dialog.tsx`, détail/liste devis, `src/modules/auth/auth.ts` (reset réel), seed (textes email défaut org), `.env.example`, tests `[I]`, `e2e/quotes-send.spec.ts`.

## Échecs probables + parade
- **Attachment > limite Resend (40 Mo)** → nos PDF font < 1 Mo ; garde : si buffer > 10 Mo, envoyer sans PJ avec lien seulement + warning log.
- **Emails multiples mal validés** → zod `z.string().email()` par token AVANT ajout ; pas de split-virgule fragile côté serveur (le client envoie un array).
- **Échec Resend après émission** → l'émission reste acquise (numéro pris) ; EmailLog `failed` + toast explicite "Devis émis mais l'envoi a échoué — réessayez" ; PAS de rollback du numéro.
- **Mode dev sans clé** → prévu (fichier .html) ; les tests `[I]` utilisent ce mode.

## Done
- `[I]` envoi sur draft → devis émis + EmailLog sent + event + statut `sent` ; envoi échoue (mock) → EmailLog failed, devis reste émis.
- `[U]` renderEmailVariables (variables manquantes → laissées telles quelles, pas de crash).
- `[E]` dialog pré-rempli (email client, sujet avec numéro) → envoyer → toast + timeline "Email envoyé".
- `[M]` vrai envoi Resend test : rendu email + PDF joint + CTA vers lien public (404 pour l'instant, story 11 — l'URL est déjà la bonne).

## Quand s'arrêter
Pas de webhook (story 20) : le statut EmailLog reste `sent`. Pas de page publique (11). Pas de relance (16). Ne pas dupliquer le dialog pour les factures (il est déjà générique, branché en 14).
