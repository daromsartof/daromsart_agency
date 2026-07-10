# Story 20 — Webhooks Resend + historique des emails

**PR** : `story/20-resend-webhooks` · **Dépend de** : 14 · **Écrans** : tab Emails de E-12/E-16

## Objectif
Suivi de délivrabilité : le webhook Resend met à jour EmailLog (delivered/opened/bounced), la tab Emails l'affiche, alerte bounce.

## Étapes
1. Route `api/webhooks/resend/route.ts` : vérification signature svix (`RESEND_WEBHOOK_SECRET`, headers svix-id/timestamp/signature — lib `svix`), map events `email.delivered|opened|bounced|complained` → EmailLog par `resend_id` : maj statut (progression only : pas de retour delivered→sent), horodatages, idempotence (replay = no-op), DocumentEvent (`email_delivered|opened|bounced`). 200 systématique si signature ok (même resend_id inconnu → log warn), 401 sinon.
2. Tab "Emails" des détails devis/facture : liste EmailLog (date, destinataires, objet, badge statut : Envoyé bleu / Délivré succès / Ouvert indigo / Échec-bounce danger, kind relance en outline).
3. Alerte : bannière danger sur le détail si le dernier email est `bounced` ("L'adresse {email} semble invalide").
4. Doc `.env.example` + README : configurer l'endpoint webhook dans Resend.

## Fichiers touchés
`src/app/api/webhooks/resend/route.ts`, `src/modules/emails/{webhook.ts,queries.ts}`, composant `email-log-list.tsx`, détails devis/facture, dep `svix`, tests `[I]` (payloads simulés signés), `.env.example`, README.

## Échecs probables + parade
- **Ordre des events non garanti** (opened avant delivered) → statut = max de progression (rang sent<delivered<opened ; bounced/failed terminal), horodatages remplis indépendamment.
- **Signature svix en test** → générer de vraies signatures avec la lib svix dans les tests (pas de bypass du code de prod).
- **Body déjà parsé** → lire le body **brut** (`req.text()`) pour la vérification, parser ensuite.

## Done
- `[I]` delivered→opened→replay opened : statuts et timestamps corrects, pas de doublon d'event ; bounced → statut + event ; signature invalide → 401 ; resend_id inconnu → 200 sans crash.
- `[E]` tab Emails affiche les statuts (fixtures) ; bannière bounce visible.

## Quand s'arrêter
Pas de tracking par pixel maison, pas de stats globales d'emails, pas de retry automatique des bounces.
