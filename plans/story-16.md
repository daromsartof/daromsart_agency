# Story 16 — Relance manuelle des factures en retard

**PR** : `story/16-reminders` · **Dépend de** : 15, 14 · **Écrans** : E-30 (email), boutons sur E-14/E-16

## Objectif
Relancer par email une facture en retard : email dédié, trace `last_reminder_at`, event, garde-fous.

## Étapes
1. `packages/email` : template `ReminderEmail` (E-30 : jours de retard, reste dû, CTA lien public, PDF joint).
2. `modules/invoices/actions.ts` : `remindInvoice(id, {to, subject, body})` — garde : `isOverdue` vrai sinon refus ; compose depuis le texte org "relance" (variables + `{echeance}`, `{jours_retard}` ajoutée à `renderEmailVariables`) ; envoie ; EmailLog `kind=reminder` ; event `reminded` ; `last_reminder_at`.
3. UI : bouton "Relancer" sur détail (visible si en retard, sous-texte "dernière relance le …") + menu liste ; réutilise le send-dialog (mode relance : bannière warning avec jours de retard).
4. Anti-spam léger : si `last_reminder_at` < 24 h → ConfirmDialog "déjà relancée aujourd'hui, confirmer ?".

## Fichiers touchés
`packages/email/src/templates/reminder.tsx`, `packages/core/src/email-vars.ts` (+tests), `src/modules/invoices/actions.ts`, send-dialog (mode), détail/liste factures, seed (texte relance défaut), tests `[I]`, `e2e/reminders.spec.ts` (léger).

## Échecs probables + parade
- **Relance d'une facture payée entre-temps** → la garde `isOverdue` est revérifiée côté serveur au moment de l'envoi.
- **Variables `{jours_retard}` sur un email non-relance** → variables résolues uniquement si pertinentes, sinon laissées intactes (comportement déjà testé en 10).

## Done
- `[I]` relance en retard → EmailLog reminder + event + last_reminder_at ; non en retard → refus ; < 24 h → flag `needsConfirmation` retourné.
- `[E]` facture échue (seed) → bouton visible → relancer → toast + timeline "Relance envoyée".

## Quand s'arrêter
Pas de relances automatiques/planifiées (hors scope V1, H22), pas de séquences multi-niveaux.
