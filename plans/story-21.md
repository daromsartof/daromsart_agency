# Story 21 — Équipe : rôles, invitations

**PR** : `story/21-team` · **Dépend de** : 03 (10 pour l'email réel) · **Écrans** : E-23, E-04, E-32

## Objectif
Inviter des membres par email, acceptation avec création de compte, gestion des rôles, garde-fous.

## Étapes
1. `modules/auth/invitations.ts` : `inviteMember(email, role)` (admin ; refus si déjà membre ou invitation pending ; token 32 bytes, expiration 7 j ; email E-32), `resendInvite`, `revokeInvite`, `acceptInvite(token, {name, password})` — transaction : token valide non expiré non consommé → création user (via Better Auth server API) + membership + `accepted_at` ; puis auto-login.
2. Page `/invitation/[token]` (E-04) : états valide (form), invalide/expiré, déjà accepté.
3. Page `/parametres/equipe` (E-23) : table membres (changement de rôle en select inline — action `updateRole` ; retrait — `removeMember` supprime le membership, PAS le user), invitations pending (renvoyer/révoquer), dialog Inviter.
4. Garde-fous : impossible de se retirer soi-même, de retirer/rétrograder le dernier admin (compte des admins dans la transaction), tooltips explicatifs.
5. Template email `InviteEmail` dans `packages/email`.

## Fichiers touchés
`src/modules/auth/invitations.ts` (+actions), `src/app/(auth)/invitation/[token]/page.tsx`, `src/app/(app)/parametres/equipe/page.tsx`, `packages/email/src/templates/invite.tsx`, tests `[I]`, `e2e/team.spec.ts`.

## Échecs probables + parade
- **Création de user avec signup désactivé** → passer par l'API server interne de Better Auth (même approche que le seed story 03) ; ne pas rouvrir le signup public.
- **Invitation d'un email déjà utilisateur sans membership** (cas mono-org rare) → détecter et créer directement le membership à l'acceptation (pas de doublon user).
- **Token en clair en DB** → stocker le hash (sha256) du token, comparer les hashs. 
- **Dernier admin en course** (2 rétrogradations simultanées) → count admins `FOR UPDATE`-équivalent dans la transaction.

## Done
- `[I]` cycle complet invite→accept→membership member ; token expiré/consommé/inconnu refusés ; re-invite même email remplace le pending ; dernier admin protégé (retrait ET rétrogradation) ; member ne peut pas inviter.
- `[E]` admin invite → (email dev en fichier) → ouvrir le lien → créer le compte → arrive connecté sur le dashboard ; le member ne voit pas Paramètres (sauf Mon compte, story 22).

## Quand s'arrêter
Pas de rôles supplémentaires, pas de permissions fines par module, pas de multi-org.
