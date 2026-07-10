# Story 11 — Page publique devis + signature

**PR** : `story/11-public-quote-signature` · **Dépend de** : 10 · **Écrans** : E-25, E-27, E-31

## Objectif
Le client final consulte le devis via le lien tokenisé, le signe (canvas) ou le refuse. PDF signé archivé avec hash, confirmations email aux deux parties.

## Étapes
1. Schéma : `src/db/schema/signatures.ts` (`signatures`, unique `quote_id`). Champs H9.
2. `modules/public/` : `getQuoteByToken(token)` (org+client+lignes ; null si inconnu — timing-safe non requis, token 256 bits), `markViewed` (première consultation : statut `sent→viewed`, `viewed_at`, event ; idempotent), rate-limit mémoire simple (IP, 30 req/min) sur les actions publiques.
3. Layout `p/` : header logo org + footer "Propulsé par InvoiceFlow". Page `/p/devis/[token]` (E-25) : résumé, iframe PDF via `api/p/devis/[token]/pdf`, barre sticky. États : expiré (validité dépassée → statut affiché expiré + signature bloquée), signé (récap + télécharger PDF signé), refusé, token invalide → rendu E-27 (`notFound` du segment).
4. Signature : composant canvas maison (pointer events, trait lissé, Effacer, export PNG dataURL — pas de lib, ou `signature_pad` si friction) dans Dialog/Sheet ; champs nom/email/consentement.
5. Action `signQuote(token, {name, email, pngDataUrl})` : transaction — re-vérifier signable (statut ∈ sent/viewed, non expiré) → upload PNG (storage) → régénérer le PDF + **page de signature ajoutée** (nom, email, date/heure, IP, hash SHA-256 du PDF original imprimé sur la page) → hash du PDF final → upload `pdf_signed_key` → Signature row + statut `signed` + events → emails E-31 (client + org, PDF signé joint). `refuseQuote(token, motif?)` symétrique simple.
6. Détail interne (E-12) : card Signature (miniature PNG, méta), bouton "Télécharger le PDF signé", timeline enrichie.

## Fichiers touchés
`src/db/schema/signatures.ts`, `src/app/p/{layout.tsx,devis/[token]/page.tsx}`, `src/app/api/p/[type]/[token]/pdf/route.ts`, `src/modules/public/**`, `packages/pdf/src/signature-page.tsx` (page additionnelle), `packages/email/src/templates/signature-confirmation.tsx`, `src/modules/quotes/` (helpers), détail devis (card signature), tests `[I]`, `e2e/sign-quote.spec.ts`.

## Échecs probables + parade
- **Double signature concurrente** → contrainte unique `quote_id` + transaction ; 2e requête → erreur propre "déjà signé".
- **dataURL PNG énorme** (canvas retina) → limiter le canvas à ~600×200 logique, compresser, garde serveur 500 Ko max.
- **Expiration à la seconde près** → comparer sur la date (fin de journée de validité, timezone Europe/Paris) ; util `isExpired(quote)` dans core + tests.
- **markViewed par les bots d'email** (préchargement de lien) → accepté V1 (noter la limite) ; le vrai signal reste la signature.
- **PDF régénéré ≠ PDF envoyé** (org modifiée entre-temps) → accepté pour les devis V1 (pas de snapshot devis, ledger H7 ne couvre que les factures) — le hash imprimé est celui du PDF au moment de la signature, ce qui fait foi.

## Done
- `[I]` signQuote : Signature créée, statut signed, PNG + PDF signé stockés, hash cohérent (recalculer = égal), events + 2 emails logs ; re-sign refusé ; expiré refusé ; token inconnu → null.
- `[E]` parcours : interne envoie → ouvrir `/p/devis/…` (navigateur anonyme) → statut passe à "Vu" → signer (canvas tracé) → écran succès → côté interne badge "Signé" + card signature.
- `[E]` refus avec motif → badge "Refusé" + motif en timeline. `[I]` rate-limit déclenche à la 31e requête.

## Quand s'arrêter
Pas de conversion (17), pas de page publique facture (14). Pas d'OTP/vérification d'email du signataire (hors scope, H9). Ne pas stocker le PDF non signé.
