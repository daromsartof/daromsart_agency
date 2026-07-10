# Design briefs — prompts prêts pour Claude Design

> Un prompt par écran (IDs de `ecrans.md`). Chaque prompt = **PRÉAMBULE COMMUN + brief écran**. Copier les deux.
> Référence visuelle : template **Vuexy** (`~/Project/vuexy`) — on reprend sa direction (sidebar verticale claire/sombre, cards à radius généreux, tableaux denses, badges pastel, stat-cards avec icône colorée) mais on **implémente en ShadCN + Tailwind** avec les tokens `@daromsart/theme` (H2).

## PRÉAMBULE COMMUN (à coller avant chaque brief)

```
Contexte : InvoiceFlow AI, outil interne de facturation (clients, devis, factures), UI en français, desktop-first mais responsive.
Design system : ShadCN/UI + Tailwind, tokens CSS variables du package @daromsart/theme.
Direction artistique (référence : template admin Vuexy) :
- Primaire violet-indigo #7367F0, succès #28C76F, warning #FF9F43, danger #EA5455, fond app gris très clair #F8F7FA (dark: #25293C, surfaces #2F3349).
- Cards blanches, radius 10px, ombre douce (0 4px 18px rgba(75,70,92,.1)), pas de bordures dures.
- Typo : Inter (ou Public Sans), titres semibold, corps 15px, texte secondaire muted #6D6B77.
- Badges de statut en pastel (fond teinte 16 %, texte teinte pleine).
- Tableaux : header uppercase 12px muted, lignes 56px, hover subtil, actions en fin de ligne (icônes ghost).
- Densité confortable, beaucoup de blanc, hiérarchie par la taille pas par les bordures.
- Dark mode obligatoire (classe .dark), toutes les couleurs via variables.
Statuts (couleurs constantes partout) : brouillon=gris, envoyé=bleu #00CFE8, vu=indigo, signé/payé=succès, refusé/annulé=danger, expiré/en retard=warning, partiellement payé=warning, facturé=indigo.
Composants imposés : Button, Card, Table, Dialog, Sheet, Tabs, Badge, Select, Command, Form (react-hook-form), Sonner, Skeleton de ShadCN — pas de lib UI additionnelle.
```

---

## E-01 Connexion
```
Écran de connexion. Layout centré plein écran sur fond app, carte 400px max : logo "InvoiceFlow" (wordmark simple), titre "Bienvenue 👋", sous-titre "Connectez-vous à votre espace", champ Email, champ Mot de passe (toggle visibilité), lien "Mot de passe oublié ?" aligné droite, bouton primaire pleine largeur "Se connecter" (état loading spinner). Erreur : Alert destructive au-dessus du formulaire ("Identifiants incorrects"). Pas de lien d'inscription (accès sur invitation uniquement — le mentionner en note discrète sous la carte). Décor : subtil dégradé radial primaire très atténué en haut de page, à la Vuexy.
```

## E-02 Mot de passe oublié
```
Même layout carte que la connexion. Titre "Mot de passe oublié", texte explicatif 1 ligne, champ Email, bouton "Envoyer le lien". Après soumission : remplacer le formulaire par un état succès (icône enveloppe, message neutre "Si un compte existe pour cette adresse, un email a été envoyé"), lien "Retour à la connexion".
```

## E-03 Réinitialisation du mot de passe
```
Même layout carte. Titre "Nouveau mot de passe", 2 champs (nouveau, confirmation) avec indicateur de règles (8 caractères min), bouton "Réinitialiser". Variante token invalide/expiré : carte avec icône warning, message, CTA "Demander un nouveau lien". Variante succès : message + CTA "Se connecter".
```

## E-04 Acceptation d'invitation
```
Même layout carte. Titre "Rejoignez {Organisation}", texte "Invitation envoyée à {email}" (email en lecture seule, badge), champs Nom complet, Mot de passe, Confirmation, bouton "Créer mon compte". Variantes : token invalide/expiré (carte warning), déjà accepté (CTA connexion).
```

## E-05 AppShell (layout application)
```
Shell d'application façon Vuexy. Sidebar fixe 260px, fond surface, logo en haut, navigation verticale : Dashboard, Clients, Devis, Factures, Modèles, séparateur, Paramètres (visible admin). Item actif : fond dégradé primaire léger, texte primaire, barre/pill arrondie. Icônes lucide 20px + label 15px. Topbar 64px : titre de page + breadcrumb léger à gauche ; à droite toggle dark mode (lune/soleil) et menu avatar (initiales, dropdown : Mon compte, Déconnexion). Contenu : padding 24px, max-width 1440px. Mobile : sidebar devient Sheet gauche déclenchée par burger dans la topbar. Fournir aussi l'état skeleton du contenu.
```

## E-06 Dashboard
```
Dashboard de facturation. Rangée de 4 StatCards (icône ronde teintée à gauche façon Vuexy, valeur 24px semibold, label muted, variation vs année préc. en badge) : "Encaissé (année)", "En attente" , "En retard" (valeur en danger si >0), "Devis en cours". Ensuite grille 2/3–1/3 : à gauche card "Chiffre d'affaires" avec bar chart 12 mois (recharts, barres primaires radius top, tooltip, axe muted) ; à droite card "Factures en retard" (liste compacte : client, numéro, reste dû en danger, jours de retard en badge warning, lien). Dessous grille 1/2–1/2 : "Derniers devis" et "Activité récente" (timeline verticale : point coloré par type d'événement, texte, horodatage relatif). Empty state global si aucune donnée : illustration légère + CTA "Créer mon premier devis".
```

## E-07 Liste clients
```
Page liste. PageHeader : titre "Clients" + compteur badge, à droite bouton primaire "Nouveau client" (+). Card contenant : barre d'outils (input recherche avec icône, switch "Afficher les archivés"), DataTable colonnes : Client (avatar initiales colorées + nom + email dessous en muted), Ville, CA facturé (aligné droite, tabular-nums), Encours (droite), badge "Archivé" le cas échéant, menu actions (⋯ : Voir, Modifier, Archiver). Ligne cliquable → fiche. Pagination en pied (sélecteur par page + pages). Empty state : icône users, "Aucun client", CTA. Skeleton : 8 lignes.
```

## E-08 Formulaire client (Sheet)
```
Sheet latéral droit 520px, titre "Nouveau client" / "Modifier {nom}". Sections séparées par Separator + label de section : 1) Type : ToggleGroup Société/Particulier (conditionne SIRET/TVA). 2) Identité : Nom affiché*, Nom légal, Email*, Téléphone. 3) Adresse : Rue, CP + Ville (rangée 1/3–2/3), Pays (select, défaut France). 4) Fiscal (si société) : SIRET, N° TVA. 5) Contacts additionnels : liste dynamique de rangées (nom, email, bouton supprimer ghost) + bouton "Ajouter un contact" en dashed. 6) Facturation : Délai de paiement (select 15/30/45/60 j, "Défaut org"), Notes internes (textarea). Footer sticky : Annuler (ghost) + Enregistrer (primaire, loading). Validation inline sous les champs.
```

## E-09 Fiche client
```
Page détail. Header : avatar initiales 48px, nom en 24px + badges (Société/Particulier, Archivé), sous-ligne email · téléphone · ville ; à droite boutons "Nouveau devis", "Nouvelle facture" (primaire), menu ⋯ (Modifier, Archiver). Rangée de 3 StatCards : CA facturé, Encours, En retard. Tabs : Informations (2 cards en grille : coordonnées + fiscal/facturation, boutons modifier), Devis (DataTable réduite du module devis filtrée client), Factures (idem), Activité (timeline des DocumentEvents du client). Empty states par tab.
```

## E-10 Liste devis
```
Page liste. PageHeader "Devis" + bouton "Nouveau devis". Tabs-filtres horizontaux au-dessus de la table avec compteurs : Tous, Brouillons, Envoyés, Signés, Refusés, Expirés. Card + DataTable : Numéro (mono, "—" si brouillon), Client, Objet (tronqué), Total TTC (droite, tabular), StatusBadge, Validité (date, warning si proche/dépassée), Créé le, actions ⋯ (Voir, Modifier si brouillon, Dupliquer, Envoyer, Supprimer si brouillon). Recherche. Empty state par tab. Skeleton.
```

## E-11 Éditeur de document (devis & facture)
```
Écran d'édition pleine largeur, LE plus travaillé. Header sticky : retour, titre "Nouveau devis"/"Facture FAC-2026-0012", badge statut Brouillon, à droite : "Enregistrer" (outline, autosave discret "Enregistré ✓"), "Émettre" ou "Émettre et envoyer" (primaire, split-button). Layout 2 colonnes : colonne principale (≈ 70 %) et panneau droit sticky (≈ 30 %).
Colonne principale, cards empilées :
1) "Informations" : Client* (Command combobox avec recherche + "Créer un client" inline), Objet, Modèle (select avec pastille couleur), Date d'émission, Validité (devis) / Échéance (facture) — presets +15/+30/+45 j.
2) "Lignes" : tableau éditable — poignée drag, Description (textarea auto-grow), Qté, Unité (select court), PU HT (MoneyInput), TVA (select %), Remise % (optionnelle, colonne activable), Total HT (calculé, lecture), suppression ghost. Bouton "Ajouter une ligne" en rangée dashed pleine largeur. Ligne active légèrement surélevée.
3) "Notes" : note d'introduction (au-dessus des lignes sur le PDF), note de pied.
Panneau droit : card "Récapitulatif" — Sous-total HT, Remise globale (input inline % ou €, toggle), TVA détaillée par taux (lignes muted), séparateur, Total TTC en 20px semibold primaire ; card "Client" (résumé, lien fiche) une fois choisi. Pour un AVOIR : bannière warning en haut "Avoir sur la facture FAC-… — les montants seront négatifs". Pour conversion : bannière info "Créée depuis le devis DEV-…". Erreurs de validation à l'émission : toast + surlignage des champs.
```

## E-12 Détail devis
```
Page détail document. Header : retour, "Devis DEV-2026-0007" + StatusBadge + client en muted, à droite actions contextuelles par statut : brouillon → Modifier, Émettre, Supprimer ; envoyé → Renvoyer, Copier le lien public, Marquer refusé, Convertir en facture (avec confirmation) ; signé → Convertir en facture (primaire), Télécharger le PDF signé ; toujours → Télécharger PDF, Dupliquer (menu ⋯).
Layout 2 colonnes : gauche (large) visionneuse PDF dans une card sombre neutre (iframe, hauteur ~80vh, toolbar minimal télécharger/ouvrir) ; droite empilée : card "Statut" (grande StatusBadge, dates clés : envoyé le, vu le, signé le, validité avec countdown), card "Montants" (HT, TVA, TTC), card "Lien public" (input readonly + bouton copier, note "le client peut consulter et signer"), card "Signature" si signée (nom, email, date, IP, miniature de la signature), Tabs en bas de colonne : Activité (timeline) / Emails (liste EmailLog avec statuts delivered/opened en badges).
```

## E-13 Dialog d'envoi par email
```
Dialog 640px, titre "Envoyer le devis DEV-2026-0007". Champ Destinataires : multi-select tokens pré-rempli avec l'email du client, suggestions = contacts du client, saisie libre validée email ; champ Cc repliable. Objet (pré-rempli depuis le template org avec variables résolues). Corps : textarea 8 lignes pré-rempli, aide "Variables : {client} {numero} {total} {lien}". Encart pièce jointe : icône PDF, "devis-DEV-2026-0007.pdf", lien Aperçu. Checkbox "M'envoyer une copie". Footer : Annuler / "Envoyer" (primaire, icône send, loading). Si document non émis : bannière info "Le devis sera émis (numéro attribué) puis envoyé".
```

## E-14 Liste factures
```
Comme la liste devis avec : tabs-filtres Tous, Brouillons, Émises/Envoyées, Partiellement payées, Payées, En retard (compteur en danger), Avoirs. Colonnes : Numéro, Client, Total TTC, Reste dû (droite, danger si en retard), StatusBadge (+ badge outline "Avoir" si kind=credit_note), Échéance (avec "J+12" en warning si dépassée), actions ⋯ (Voir, Modifier si brouillon, Enregistrer un paiement, Relancer si en retard, Créer un avoir, Dupliquer). Rangée de 3 mini-StatCards au-dessus : Encours total, En retard, Encaissé ce mois.
```

## E-16 Détail facture
```
Comme le détail devis avec en plus, en tête de colonne droite : card "Paiement" — grande valeur "Reste dû", Progress bar (payé/total), liste des paiements (date, moyen en badge outline, montant, référence muted), bouton "Enregistrer un paiement" (primaire si reste dû), lien "Relancer" avec compteur de jours de retard en danger. Card "Origine" si issue d'un devis (lien) ; card "Avoirs" listant les avoirs liés ; bannière danger "Annulée par l'avoir AV-…" si cancelled. Le PDF affiché inclut les QR (paiement EPC + lien) — rien à designer de plus, mentionner leur présence.
```

## E-17 Dialog paiement
```
Dialog 480px "Enregistrer un paiement". Montant (MoneyInput, pré-rempli reste dû, aide "Reste dû : 1 240,00 €"), Date (DatePicker, défaut aujourd'hui), Moyen (select : Virement, Carte, Espèces, Chèque, Autre), Référence (optionnel), Note (optionnel). Alerte si montant > reste dû (bloquant). Footer Annuler / Enregistrer. Après succès : toast "Paiement enregistré — facture payée 🎉" si soldée.
```

## E-18 Liste modèles
```
PageHeader "Modèles de documents" + "Nouveau modèle". Grille de cards (3 col desktop) : chaque card = mini-aperçu du PDF (vignette 4:3 rendue avec données factices, bord muted), nom, badges (Facture/Devis/Les deux, "Par défaut" en primaire), footer d'actions : Modifier, ⋯ (Dupliquer, Définir par défaut, Supprimer — désactivé si utilisé avec tooltip). Card fantôme dashed "Créer un modèle" en fin de grille. Empty state si zéro.
```

## E-19 Éditeur de modèle
```
Split screen : gauche 420px formulaire scrollable, droite aperçu PDF live (fond neutre sombre, page A4 centrée avec ombre, données factices, se met à jour à chaque changement, ~500ms debounce). Formulaire en sections : Général (Nom, Type facture/devis/les deux, checkbox "Modèle par défaut") ; Apparence (Couleur d'accent — palette de pastilles + picker, Police sans/serif en radio-cards, Logo on/off + position gauche/droite) ; Colonnes (switches : Unité, TVA par ligne, Remise par ligne) ; Textes par défaut (note d'intro, note de pied, conditions de paiement) ; Options (switch QR de paiement, switch QR lien public). Header : retour, nom éditable inline, bouton Enregistrer. Mobile : tabs Formulaire/Aperçu.
```

## E-20 Paramètres — Entreprise
```
Layout paramètres : sous-navigation verticale gauche (Entreprise, Facturation, Emails, Équipe, Mon compte) — items avec icônes, actif en primaire ; contenu à droite max 760px. Page Entreprise : card "Identité" (Nom légal*, Nom commercial, Forme juridique + capital, SIRET, N° TVA) ; card "Coordonnées" (adresse complète, email, téléphone) ; card "Logo" (dropzone avec aperçu 160px, formats png/svg, bouton supprimer) ; card "Coordonnées bancaires" (IBAN avec formatage par groupes, BIC, note "utilisés pour le QR de paiement") ; card "Mentions légales" (textarea, texte par défaut FR fourni, aide sur les mentions obligatoires). Chaque card a son bouton Enregistrer (ou un save global sticky en bas — choisir le save par card).
```

## E-21 Paramètres — Facturation
```
Même layout. Card "Numérotation" : 3 rangées (Factures, Devis, Avoirs) avec input de format (`FAC-{YYYY}-{seq:4}`) + aperçu live du prochain numéro en badge mono ("FAC-2026-0013"), aide sur les tokens disponibles, warning "ne modifiez pas en cours d'année". Card "TVA" : taux actifs en checkboxes chips (0, 5.5, 10, 20 %), select taux par défaut, checkbox "Franchise en base (TVA non applicable art. 293 B)" qui force 0 % + mention auto. Card "Délais par défaut" : délai de paiement (jours), validité des devis (jours).
```

## E-22 Paramètres — Emails
```
Même layout. Card "Expéditeur" : adresse d'envoi (lecture seule, vient de l'env, badge "vérifié"), Reply-to éditable. 3 cards "Modèle d'email" (Devis, Facture, Relance) : input Objet + textarea Corps, chips cliquables des variables ({client}, {numero}, {total}, {lien}, {echeance}) qui s'insèrent au curseur, bouton "Réinitialiser le texte par défaut", aperçu repliable du rendu.
```

## E-23 Paramètres — Équipe
```
Même layout. Card "Membres" : table (Avatar+Nom, Email, Rôle en select inline si admin — Admin/Membre, Statut Actif, ⋯ : Retirer avec ConfirmDialog ; on ne peut pas se retirer soi-même ni retirer le dernier admin — tooltips). Card "Invitations en attente" : table (Email, Rôle, Envoyée le, Expire, actions Renvoyer / Révoquer), au-dessus bouton "Inviter un membre" → Dialog (Email, Rôle radio Admin/Membre avec descriptions, bouton Envoyer l'invitation).
```

## E-24 Paramètres — Mon compte
```
Même layout. Card "Profil" : Nom, Email (lecture seule). Card "Mot de passe" : actuel, nouveau, confirmation, bouton "Mettre à jour". Card "Apparence" : radio-cards Clair / Sombre / Système avec mini-vignettes.
```

## E-25 Devis public (consultation + signature)
```
Page publique SANS navigation d'app, fond app, colonne centrée 880px. Header : logo de l'organisation + nom, à droite badge statut. Card résumé : "Devis DEV-2026-0007" en titre, Objet, Total TTC en très grand, "Valable jusqu'au {date}" (warning si < 5 j). Visionneuse PDF (pleine largeur, ~70vh). Barre d'actions sticky en bas : "Télécharger" (outline) + "Refuser" (ghost danger) + "Signer ce devis" (primaire, grand). Panneau signature (Sheet bas sur mobile, Dialog desktop) : Nom complet*, Email*, canvas de signature (cadre dashed, bouton Effacer, tracé encre foncée), checkbox consentement "J'accepte ce devis et reconnais que cette signature m'engage", bouton "Signer et accepter". Refus : dialog avec motif optionnel. États pleine page : Signé (icône succès, "Devis signé le {date}", téléchargement PDF signé), Refusé, Expiré (warning, "contactez {email org}"). Footer discret : "Propulsé par InvoiceFlow".
```

## E-26 Facture publique
```
Même gabarit que E-25 sans signature. Card résumé : numéro, Total TTC grand, échéance (badge danger "En retard de X jours" le cas échéant), reste dû si paiement partiel. Bloc "Régler par virement" (si IBAN org) : card avec IBAN formaté + bouton copier, BIC, référence à indiquer (numéro de facture), QR code EPC 180px avec légende "Scannez avec votre application bancaire". Visionneuse PDF + bouton Télécharger. État Payée : bannière succès "Facture réglée — merci !".
```

## E-27 Lien invalide/expiré
```
Pleine page centrée : icône lien brisé dans un cercle muted, titre "Ce lien n'est plus valide", texte "Le document a peut-être été retiré ou le lien a expiré. Contactez votre interlocuteur.", aucun autre élément (aucune fuite d'information). Footer "Propulsé par InvoiceFlow".
```

## E-28 → E-33 Emails transactionnels (React Email, un brief commun)
```
Famille de 6 emails transactionnels cohérents (React Email). Gabarit commun : fond #F8F7FA, container 560px blanc radius 12, header avec logo de l'organisation (fallback wordmark), footer muted (coordonnées org + "Propulsé par InvoiceFlow"). Boutons pleine largeur primaire #7367F0. Styles inline uniquement (contrainte email), pas de dark mode.
- Envoi de devis : corps personnalisé (texte de l'expéditeur), puis card récap (Devis {numero}, total TTC, validité), CTA "Voir et signer le devis", mention PDF joint.
- Envoi de facture : idem avec échéance, CTA "Voir la facture".
- Relance : bandeau warning léger, "Facture {numero} — échéance dépassée de {n} jours", reste dû en évidence, CTA "Voir la facture", ton courtois mais ferme.
- Confirmation de signature (2 variantes client/organisation) : bandeau succès, récap signature (nom, date), PDF signé joint.
- Invitation équipe : "{inviteur} vous invite à rejoindre {org} sur InvoiceFlow", rôle, CTA "Créer mon compte", expiration 7 j.
- Réinitialisation mot de passe : CTA unique, note expiration 1 h, "ignorez cet email si vous n'êtes pas à l'origine de la demande".
```
