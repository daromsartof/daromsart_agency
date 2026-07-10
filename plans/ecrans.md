# Écrans — liste exhaustive

> IDs `E-xx` référencés par `design-briefs.md` et `stories.md`. Layouts : **Auth** (centré, carte), **App** (AppShell : sidebar + topbar), **Public** (page brandée sans nav), **Email** (template HTML).

## Auth (layout Auth)

| ID | Écran | Route | Contenu clé |
|----|-------|-------|-------------|
| E-01 | Connexion | `/connexion` | email + mot de passe, lien mot de passe oublié, erreurs inline |
| E-02 | Mot de passe oublié | `/mot-de-passe-oublie` | email → confirmation neutre ("si un compte existe…") |
| E-03 | Réinitialisation | `/reinitialiser/[token]` | nouveau mot de passe ×2, états token invalide/expiré |
| E-04 | Acceptation invitation | `/invitation/[token]` | nom + mot de passe, rappel de l'email invité, états invalides |

## Application (layout App)

| ID | Écran | Route | Contenu clé |
|----|-------|-------|-------------|
| E-05 | AppShell | (layout) | sidebar (Dashboard, Clients, Devis, Factures, Modèles, Paramètres), topbar (recherche cmd+K plus tard — V1 : titre page, toggle dark, menu user), responsive (sidebar → Sheet mobile) |
| E-06 | Dashboard | `/` | 4 StatCards (CA encaissé année, en attente de paiement, en retard, devis en cours), graphique CA mensuel 12 mois, liste factures en retard, derniers devis, derniers événements |
| E-07 | Liste clients | `/clients` | DataTable (nom, email, ville, CA facturé, encours, actions), recherche, filtre archivés, bouton "Nouveau client" → Sheet E-08, EmptyState |
| E-08 | Formulaire client | Sheet sur `/clients` (création + édition) | type société/particulier, identité, adresse, SIRET/TVA, contacts additionnels (liste dynamique), conditions de paiement |
| E-09 | Fiche client | `/clients/[id]` | header (nom, badges, actions : modifier, archiver, nouveau devis/facture), StatCards (CA, encours, retard), tabs : Infos / Devis / Factures / Activité |
| E-10 | Liste devis | `/devis` | DataTable (numéro, client, objet, total TTC, statut StatusBadge, validité, date), tabs-filtres par statut, recherche, "Nouveau devis", EmptyState |
| E-11 | Éditeur de document | `/devis/nouveau`, `/devis/[id]/modifier`, `/factures/nouvelle`, `/factures/[id]/modifier` | **écran partagé devis/facture** : sélecteur client (Command), dates, objet, choix modèle, tableau de lignes éditable (drag pour réordonner, qté/unité/PU/TVA/remise), remise globale, panneau totaux sticky (HT, remises, TVA par taux, TTC), notes intro/pied, actions : Enregistrer brouillon / Émettre / Émettre & envoyer |
| E-12 | Détail devis | `/devis/[id]` | 2 colonnes : aperçu PDF (iframe) + panneau latéral (statut, montants, client, validité, lien public copiable, actions : Envoyer, Télécharger PDF, Dupliquer, Convertir en facture, Marquer refusé, Supprimer si draft), timeline DocumentEvent, historique emails |
| E-13 | Dialog envoi email | Dialog sur E-12/E-16 | destinataires (email client + contacts, ajout libre), cc, objet + corps pré-remplis (template org, variables), aperçu pièce jointe, envoi |
| E-14 | Liste factures | `/factures` | idem E-10 + colonnes échéance/reste dû, indicateur retard, tabs-filtres statut (dont "En retard" calculé) |
| E-15 | (fusionné avec E-11) | – | l'éditeur facture = E-11 avec spécificités : échéance, kind avoir (bannière si `avoirDe`), bannière "issu du devis X" |
| E-16 | Détail facture | `/factures/[id]` | idem E-12 + : encart paiements (reste dû, progression, liste, bouton "Enregistrer un paiement" → E-17), bouton Relancer (si retard), Créer un avoir, lien devis d'origine, QR affichés dans l'aperçu PDF |
| E-17 | Dialog paiement | Dialog sur E-16 | date, montant (pré-rempli reste dû), moyen, référence, note |
| E-18 | Liste modèles | `/modeles` | grille de cards avec mini-aperçu, badge type (facture/devis) + "par défaut", actions dupliquer/supprimer, "Nouveau modèle" |
| E-19 | Éditeur de modèle | `/modeles/[id]`, `/modeles/nouveau` | split : formulaire à gauche (nom, type, couleur d'accent, logo on/off, police, colonnes visibles, textes par défaut, QR on/off, défaut par type) / aperçu PDF live à droite (données factices) |
| E-20 | Paramètres — Entreprise | `/parametres/entreprise` | identité légale, adresse, SIRET/TVA/forme juridique, upload logo (dropzone + aperçu), IBAN/BIC, mentions légales pied de page |
| E-21 | Paramètres — Facturation | `/parametres/facturation` | formats de numérotation (avec aperçu live du prochain numéro), taux de TVA actifs + défaut, délais par défaut (paiement, validité devis) |
| E-22 | Paramètres — Emails | `/parametres/emails` | reply-to, objets/corps par défaut (devis, facture, relance) avec variables `{client}`, `{numero}`, `{total}`, `{lien}` |
| E-23 | Paramètres — Équipe | `/parametres/equipe` | table membres (nom, email, rôle, actions), invitations en attente (renvoyer/révoquer), dialog "Inviter" |
| E-24 | Paramètres — Compte | `/parametres/compte` | mon nom, mon email (lecture), changement de mot de passe |

## Public (layout Public)

| ID | Écran | Route | Contenu clé |
|----|-------|-------|-------------|
| E-25 | Devis public | `/p/devis/[token]` | header brandé (logo org), infos essentielles (numéro, total, validité), visionneuse PDF, CTA "Signer ce devis" → panneau signature (nom, email, canvas signature, consentement) / "Refuser" (motif), états déjà signé / refusé / expiré |
| E-26 | Facture publique | `/p/factures/[token]` | header brandé, montant/échéance/reste dû, visionneuse PDF, bouton Télécharger, bloc "Payer par virement" (IBAN + QR EPC) si dispo |
| E-27 | Lien invalide/expiré | rendu inline sur `/p/*` | message + rien d'autre (pas de fuite d'info) |

## Emails transactionnels (layout Email — React Email, brandé thème)

| ID | Email | Déclencheur |
|----|-------|-------------|
| E-28 | Envoi devis | E-13 depuis un devis — corps custom + carte doc + CTA "Voir et signer" + PDF joint |
| E-29 | Envoi facture | E-13 depuis une facture — CTA "Voir la facture" + PDF joint |
| E-30 | Relance facture | bouton Relancer — ton ferme-poli, rappel échéance/reste dû |
| E-31 | Confirmation signature | post-signature, envoyé au client ET à l'org — PDF signé joint |
| E-32 | Invitation équipe | E-23 — CTA "Créer mon compte" |
| E-33 | Réinitialisation mot de passe | E-02 — CTA + expiration 1 h |

## États transverses (chaque écran App doit les définir)

- **Loading** : skeletons (`loading.tsx` par segment).
- **Empty** : `EmptyState` avec CTA (clients, devis, factures, modèles, paiements, activité).
- **Erreur** : `error.tsx` global App + toasts (sonner) sur échec d'action.
- **404** : `not-found.tsx` global + par entité introuvable.
- **Interdits** : accès `parametres/*` en `member` → redirect + toast ; édition d'un document émis → redirect détail.
