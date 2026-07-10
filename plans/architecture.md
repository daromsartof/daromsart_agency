# Architecture — InvoiceFlow AI dans le monorepo `daromsart_agency`

> Référence des hypothèses : `plans/ledger.md`. Stack imposée : Next.js fullstack (App Router), Better Auth, Drizzle, ShadCN + Tailwind, Resend.

---

## 1. Monorepo

pnpm workspaces + Turborepo (H19). Racine = `/home/daroms/Project/daromsart_agency`.

```
daromsart_agency/
├── package.json                  # workspaces, scripts turbo (dev, build, lint, test, db:*)
├── pnpm-workspace.yaml           # apps/*, packages/*
├── turbo.json                    # pipeline: build dépend de ^build ; test dépend de build
├── .env.example                  # variables documentées (DATABASE_URL, RESEND_API_KEY, …)
├── docker-compose.yml            # postgres:16 (dev)
├── plans/                        # CE plan
├── documents/                    # existant, vide — NE PAS TOUCHER (H18)
│
├── apps/
│   └── invoiceflow-ai/           # l'app SaaS de facturation (Next.js fullstack)
│
└── packages/
    ├── config/                   # @daromsart/config — tsconfig de base, eslint flat config, prettier
    ├── theme/                    # @daromsart/theme — tokens partagés (H17)
    ├── ui/                       # @daromsart/ui — composants ShadCN + composés
    ├── core/                     # @daromsart/core — domaine pur (money, vat, statuts, zod)
    ├── auth/                     # @daromsart/auth — factory Better Auth réutilisable
    ├── storage/                  # @daromsart/storage — abstraction fichiers (fs | s3)
    ├── email/                    # @daromsart/email — client Resend + templates React Email
    ├── pdf/                      # @daromsart/pdf — rendu PDF documents (@react-pdf/renderer)
    └── qr/                       # @daromsart/qr — QR EPC paiement + QR lien (lib qrcode)
```

### 1.1 Contrats des packages partagés

Chaque package : `src/index.ts` (exports publics uniquement), `package.json` avec `"exports"`, build TS via `tsup` **ou** consommation source directe par Next (`transpilePackages`) — **décision : consommation source + `transpilePackages`** (plus simple, pas d'étape build en dev). `tsup` seulement si une app non-Next en a besoin plus tard.

| Package | Dépend de | Exporte (API publique) | Interdit |
|---|---|---|---|
| `@daromsart/config` | – | `tsconfig.base.json`, config eslint/prettier partagée | Aucune logique |
| `@daromsart/theme` | – | `tokens.css` (CSS variables light/dark), `tailwind-preset.ts`, `fonts.ts` | Composants React |
| `@daromsart/ui` | theme | Composants ShadCN générés (`button`, `input`, `table`, `dialog`, `sheet`, `select`, `badge`, `card`, `tabs`, `dropdown-menu`, `form`, `toast/sonner`, `calendar`, `popover`, `command`, `skeleton`, `avatar`, `separator`, `switch`, `textarea`, `tooltip`, `alert-dialog`) + composés maison : `DataTable` (tanstack), `PageHeader`, `EmptyState`, `StatCard`, `ConfirmDialog`, `MoneyInput`, `DatePicker`, `StatusBadge`, `AppShell` (sidebar + topbar) | Accès DB, fetch |
| `@daromsart/core` | – | `Money` (centimes : add, multiply, formatEUR), `computeDocumentTotals(lines, globalDiscount)`, `VAT_RATES`, enums de statuts + machines à états (`canTransition(from, to)`), schémas zod partagés (client, ligne, document), `formatDocumentNumber(format, seq, year)` | React, DB, IO — **pur et 100 % testé unitairement** |
| `@daromsart/auth` | – | `createAuth({ db, secret, baseUrl, sendEmail })` → instance Better Auth (email/password, désactivation signup public, plugin invitations), types `Session`/`Role` | Schéma métier |
| `@daromsart/storage` | – | `createStorage(env)` → `{ put(key, buf, mime), getSignedUrl(key), delete(key) }` ; drivers `fs` et `s3` | Logique métier |
| `@daromsart/email` | core | `createMailer({ resendKey, from })` → `sendDocumentEmail(...)`, `sendInviteEmail(...)`, `sendResetEmail(...)`, `sendReminderEmail(...)` ; templates React Email dans `src/templates/` avec layout brandé commun | Accès DB |
| `@daromsart/pdf` | core, qr | `renderDocumentPdf(doc: DocumentPdfInput): Promise<Buffer>` — l'input est un DTO **sérialisable** (pas d'entité Drizzle) : infos org, client, lignes, totaux, options du modèle (couleurs, logo URL/data, colonnes), signature éventuelle, QR éventuels | Accès DB |
| `@daromsart/qr` | – | `epcQrPayload({ iban, bic, name, amountCents, remittance })`, `qrPngDataUrl(text)`, `qrSvg(text)` | – |

**Règle de dépendance** : `apps → packages`, `packages/ui → theme`, `packages/{pdf,email} → core`. Jamais `packages → apps`, jamais de cycle. Le schéma Drizzle et toute logique d'accès données vivent **dans l'app** (le domaine facturation n'est pas partagé ; ce qui est partagé = infra + design + domaine pur).

### 1.2 Thème partagé (H17)

`@daromsart/theme` :
- `tokens.css` : variables `--background`, `--foreground`, `--primary`, `--muted`, `--radius`, etc. au format ShadCN (HSL), pour `:root` et `.dark`.
- Palette de marque "Daromsart" : primaire violet-indigo (inspiration Vuexy `#7367F0`), succès `#28C76F`, warning `#FF9F43`, danger `#EA5455` — déclinées en HSL ShadCN.
- `tailwind-preset.ts` : preset Tailwind (couleurs mappées sur les vars, fontFamily, borderRadius, keyframes ShadCN). Chaque app fait `presets: [daromsartPreset]` et importe `tokens.css` dans son root layout.
- Dark mode : classe `dark` sur `<html>`, toggle persisté (cookie) — géré par `next-themes` dans l'app.

---

## 2. Modèle de données — niveau DOMAINE

> Pas de code Drizzle ici (Opus l'écrira selon le boilerplate). Conventions : toutes les tables ont `id` (uuid v7 ou cuid2), `created_at`, `updated_at` ; toutes les tables métier ont `organization_id` (H4). Montants en **centimes integer** (H5). Soft-delete uniquement là où indiqué (`archived_at`).

### 2.1 Vue d'ensemble

```
Organization 1─n User (via Membership)
Organization 1─n Client 1─n ClientContact
Organization 1─n DocumentTemplate
Organization 1─n Quote 1─n QuoteLine
Organization 1─n Invoice 1─n InvoiceLine
Quote 1─0..1 Signature
Quote 1─0..1 Invoice            (conversion devis → facture)
Invoice 1─n Payment
Invoice 0..1─n Invoice          (avoir → facture d'origine, self-ref)
Quote|Invoice 1─n EmailLog
Quote|Invoice 1─n DocumentEvent (timeline)
Organization 1─n NumberSequence
Organization 1─1 OrgSettings    (fusionné dans Organization, voir 2.2)
```

### 2.2 Entités

**Organization** — l'entreprise émettrice (unique en pratique, H4).
Champs : nom légal, nom commercial, adresse (rue, cp, ville, pays), email, téléphone, SIRET, n° TVA intracom, forme juridique + capital (texte libre), IBAN, BIC, `logo_key` (storage), devise (`EUR` fixe V1), taux TVA actifs (json `[0, 5.5, 10, 20]`), taux TVA par défaut, mentions légales pied de page (texte, défaut H21), conditions de paiement par défaut (jours, défaut 30), durée de validité devis par défaut (jours, défaut 30), formats de numérotation (json : `{invoice: "FAC-{YYYY}-{seq:4}", quote: "DEV-{YYYY}-{seq:4}", credit_note: "AV-{YYYY}-{seq:4}"}`), email d'envoi (reply-to), textes d'email par défaut (objet/corps devis, facture, relance).

**User** — géré par Better Auth (tables `user`, `session`, `account`, `verification` selon Better Auth). Champ ajouté : `name`.

**Membership** — lie User ↔ Organization. Champs : `user_id`, `organization_id`, `role` (`admin` | `member`). Unicité (user, org).
- `admin` : tout + paramètres + équipe. `member` : tout sauf paramètres/équipe/suppression.

**Invitation** — `email`, `role`, `token`, `expires_at`, `accepted_at`, `invited_by`.

**Client** — le client facturé.
Champs : type (`company` | `individual`), nom affiché, nom légal, SIRET (opt), n° TVA (opt), email principal, téléphone, adresse de facturation (rue, cp, ville, pays), notes internes, conditions de paiement spécifiques (jours, opt → sinon défaut org), `archived_at` (soft-delete : un client avec documents ne se supprime jamais, il s'archive).
Relations : 1─n ClientContact, 1─n Quote, 1─n Invoice.

**ClientContact** — contacts additionnels : nom, email, téléphone, rôle (texte), `is_default_recipient` (bool). L'envoi d'email propose email principal + contacts.

**DocumentTemplate** — modèle de facture / modèle de devis (rendu PDF + valeurs par défaut).
Champs : nom, type (`invoice` | `quote` | `both`), `is_default` (par type), options de rendu (json structuré, validé zod dans core) :
`{ accentColor, showLogo, logoPosition, font ("sans"|"serif"), columns: {unit, vatPerLine, discountPerLine}, headerNote, footerNote, paymentTermsText, showPaymentQr, showPublicLinkQr }`,
valeurs par défaut de contenu : notes d'intro, mentions, conditions.
Relations : référencé par Quote et Invoice (`template_id`, nullable → défaut). Suppression interdite si référencé (ou `archived_at`).

**Quote (Devis)** — cycle de vie H14.
Champs : `client_id`, `template_id`, numéro (null en draft, attribué à l'envoi/émission), statut (`draft|sent|viewed|signed|refused|expired|invoiced`), date d'émission, date de validité, objet/titre, note d'intro, note de pied, remise globale (type `percent|amount` + valeur), totaux dénormalisés (`subtotal_cents`, `discount_cents`, `vat_cents` json par taux, `total_cents`) recalculés à chaque écriture via `@daromsart/core`, `share_token` (unique, généré à l'envoi), `sent_at`, `signed_at`, `refused_at`, `refusal_reason`, `viewed_at` (première vue publique), `invoice_id` (facture issue de la conversion, nullable), `pdf_signed_key` (storage, PDF archivé après signature), `pdf_hash` (SHA-256, H9).
Relations : 1─n QuoteLine (ordre), 0..1 Signature, 1─n EmailLog, 1─n DocumentEvent.

**QuoteLine / InvoiceLine** — même forme.
Champs : `position` (int, ordre), description (multiligne), quantité (décimal ×1000 stocké int ou numeric — décision : `numeric(12,3)`), unité (texte : `h`, `jour`, `pce`, libre), prix unitaire HT centimes, taux TVA (décimal), remise ligne (percent, opt), total ligne HT centimes (dénormalisé).

**Invoice (Facture)** — cycle H15, immuable après émission (H7).
Champs : `client_id`, `template_id`, `quote_id` (origine, opt), `kind` (`invoice` | `credit_note`), `parent_invoice_id` (si avoir → facture corrigée), numéro (null en draft), statut (`draft|issued|sent|viewed|partially_paid|paid|cancelled`), date d'émission, date d'échéance, objet, notes intro/pied, remise globale, totaux dénormalisés (idem devis ; négatifs pour un avoir), `share_token`, `sent_at`, `viewed_at`, `paid_at`, `amount_paid_cents` (dénormalisé depuis Payments), `last_reminder_at` (H22), snapshot émetteur/client (json figé à l'émission : nom, adresse, SIRET, TVA — l'immuabilité survit aux modifications du client/org).
Statut `overdue` : **calculé** (échéance < today && reste dû > 0), jamais stocké.
Relations : 1─n InvoiceLine, 1─n Payment, 1─n EmailLog, 1─n DocumentEvent, 0..1 Quote (origine), 0..n avoirs enfants.

**Payment** — `invoice_id`, date, montant centimes, moyen (`transfer|card|cash|check|other`), référence, note. Somme des paiements pilote `partially_paid`/`paid`.

**Signature** (H9) — `quote_id` (unique), nom signataire, email signataire, `image_key` (PNG storage), `signed_at`, IP, user-agent, `pdf_hash` (SHA-256 du PDF au moment de la signature), `decision` (`signed|refused`), motif si refus.

**EmailLog** — `document_type` (`quote|invoice`), `document_id`, destinataires (json to/cc), objet, `resend_id`, statut (`queued|sent|delivered|opened|bounced|failed`), horodatages par statut, `kind` (`document|reminder`). Mis à jour par le webhook Resend (H12).

**DocumentEvent** — timeline unifiée : `document_type`, `document_id`, `type` (`created|updated|issued|sent|viewed|signed|refused|payment_recorded|converted|reminded|cancelled|credit_note_created|email_delivered|email_opened|email_bounced`), `actor` (`user:{id}` | `client` | `system`), payload json, horodatage. Alimente l'onglet "Activité".

**NumberSequence** (H6) — `organization_id`, `document_kind` (`invoice|quote|credit_note`), `year`, `current_value`. Incrément en transaction `SELECT … FOR UPDATE`. Unicité (org, kind, year).

### 2.3 Invariants métier (à tester unitairement dans core / en intégration dans l'app)

1. Total document = Σ lignes (qté × PU × (1 − remise ligne)) − remise globale, TVA calculée **par taux** puis arrondie au centime par taux (règle FR), total TTC = HT − remise + Σ TVA.
2. Un document émis (numéro attribué) ne peut plus modifier : lignes, client, dates, remises. Seuls statut/paiements/emails évoluent.
3. Numérotation : jamais de trou, jamais de doublon (contrainte unique (org, kind, year, seq) + verrou).
4. Un devis `signed` ne peut plus être ni modifié ni re-signé ; conversion possible une seule fois.
5. Un avoir référence obligatoirement une facture émise ; total avoir ≤ reste "annulable" de la facture.
6. `amount_paid_cents` ≤ `total_cents` ; paiement impossible sur draft/cancelled.
7. Transitions de statut uniquement via la machine à états de `@daromsart/core` (toute écriture de statut passe par `canTransition`).

---

## 3. App `apps/invoiceflow-ai` — arborescence des routes

Next.js App Router, tout en français d'URL (outil interne FR, H20).

```
src/app/
├── (auth)/                          # layout centré, sans shell
│   ├── connexion/page.tsx           # login
│   ├── mot-de-passe-oublie/page.tsx
│   ├── reinitialiser/[token]/page.tsx
│   └── invitation/[token]/page.tsx  # acceptation invitation (set password)
│
├── (app)/                           # layout AppShell (sidebar + topbar), protégé (session requise)
│   ├── page.tsx                     # Dashboard  → route "/"
│   ├── clients/
│   │   ├── page.tsx                 # liste + recherche + création (Sheet)
│   │   └── [id]/page.tsx            # fiche client (tabs: infos, devis, factures, activité)
│   ├── devis/
│   │   ├── page.tsx                 # liste filtrable par statut
│   │   ├── nouveau/page.tsx         # éditeur (aussi ?depuis=quoteId pour dupliquer)
│   │   └── [id]/
│   │       ├── page.tsx             # détail (aperçu PDF, timeline, actions)
│   │       └── modifier/page.tsx    # éditeur (draft uniquement, sinon redirect détail)
│   ├── factures/
│   │   ├── page.tsx
│   │   ├── nouvelle/page.tsx        # aussi ?depuisDevis=id (conversion) & ?avoirDe=id
│   │   └── [id]/
│   │       ├── page.tsx
│   │       └── modifier/page.tsx    # draft uniquement
│   ├── modeles/
│   │   ├── page.tsx                 # liste modèles (facture + devis)
│   │   └── [id]/page.tsx            # éditeur modèle avec aperçu live ("nouveau" = /modeles/nouveau)
│   └── parametres/                  # admin only (guard layout)
│       ├── entreprise/page.tsx      # identité, logo, IBAN/BIC, mentions
│       ├── facturation/page.tsx     # numérotation, TVA, délais par défaut
│       ├── emails/page.tsx          # textes par défaut, reply-to, historique webhook
│       ├── equipe/page.tsx          # membres + invitations
│       └── compte/page.tsx          # mon profil, mot de passe (accessible member)
│
├── p/                               # PUBLIC, layout minimal brandé, accès par token
│   ├── devis/[token]/page.tsx       # consultation + signature/refus
│   ├── factures/[token]/page.tsx    # consultation + téléchargement PDF
│   └── _invalid/                    # état lien invalide/expiré (rendu inline, pas une route)
│
└── api/
    ├── auth/[...all]/route.ts       # handler Better Auth
    ├── documents/[type]/[id]/pdf/route.ts    # GET PDF (session) — type: devis|factures
    ├── p/[type]/[token]/pdf/route.ts         # GET PDF public (token)
    └── webhooks/resend/route.ts     # POST événements Resend (signature vérifiée)
```

**Écritures** : Server Actions (mutations colocalisées par module dans `src/modules/*/actions.ts`), pas d'API REST interne. Les routes `api/` n'existent que pour : auth, PDF (binaire), webhooks.

---

## 4. Modules applicatifs (dans l'app)

```
apps/invoiceflow-ai/src/
├── app/                    # routes (ci-dessus) — pages fines, la logique vit dans modules/
├── db/
│   ├── schema/             # Drizzle : un fichier par agrégat (org, auth, clients, quotes, invoices, …)
│   ├── index.ts            # client drizzle (postgres-js)
│   └── seed.ts             # seed dev : org démo, 1 admin, 8 clients, modèles, devis/factures variés
├── modules/
│   ├── auth/               # instance createAuth(), helpers requireSession/requireAdmin, actions invitation
│   ├── organization/       # queries + actions paramètres org
│   ├── clients/            # queries, actions CRUD, zod, composants (ClientForm, ClientTable)
│   ├── documents/          # PARTAGÉ devis+factures : éditeur de lignes, calcul totaux (délègue core),
│   │                       #   numérotation (issueNumber), DTO → @daromsart/pdf, DocumentEvent, share tokens
│   ├── quotes/             # queries, actions (create/update/issue/send/sign/refuse/convert), composants
│   ├── invoices/           # queries, actions (…, recordPayment, createCreditNote, remind), composants
│   ├── templates/          # CRUD modèles + aperçu
│   ├── emails/             # orchestration envoi (compose → @daromsart/email → EmailLog), webhook handler
│   ├── public/             # accès par token (rate-limit simple, marquage viewed)
│   └── dashboard/          # agrégations stats
├── lib/                    # utils app (formatage dates fr, cn, env parsing zod)
└── middleware.ts           # protection (app)/, redirect connexion
```

**Convention par module** : `queries.ts` (lectures, server-only), `actions.ts` (`"use server"`, valident zod, vérifient session+org+rôle, retournent `{ok} | {error}`), `schemas.ts` (zod), `components/` (client components du module). Les pages composent ; elles ne contiennent pas de logique.

---

## 5. Flux critiques (séquences que Opus doit respecter)

1. **Émission** (devis ou facture) : transaction → vérifier draft + lignes ≥ 1 → geler snapshot client/org (facture) → `NumberSequence` FOR UPDATE → numéro → statut `sent`(devis)/`issued`(facture) → `share_token` → DocumentEvent.
2. **Envoi email** : document émis requis (sinon émettre d'abord dans la même action) → générer PDF (buffer) → `sendDocumentEmail` avec PDF en pièce jointe + lien public → EmailLog `sent` → DocumentEvent → statut `sent` si applicable.
3. **Signature publique** : page token → si validité dépassée → afficher expiré. POST signature : re-générer PDF, calculer SHA-256, uploader PNG signature + PDF signé (page signature ajoutée : nom, date, IP, hash), statuts + events, email de confirmation aux deux parties.
4. **Conversion devis→facture** : devis `signed` (ou `sent` avec confirmation) → nouvelle facture `draft` copiant lignes/remise/client/template + `quote_id` → devis `invoiced` après émission de la facture.
5. **Paiement** : enregistrer Payment → recalcul `amount_paid_cents` → statut `partially_paid`/`paid` → event.
6. **Avoir** : depuis facture émise → facture `kind=credit_note`, lignes pré-remplies inversées (modifiables en draft), `parent_invoice_id` → à l'émission : si avoir total, parent → `cancelled`.

---

## 6. Environnement & production

- `.env` (validé par zod au boot, module `lib/env.ts`) : `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_FROM`, `APP_URL`, `STORAGE_DRIVER` (`fs|s3`), `STORAGE_*` (bucket, endpoint, keys), `SEED_ADMIN_EMAIL/PASSWORD`.
- Scripts racine : `pnpm dev` (turbo), `pnpm db:push|generate|migrate|seed|studio` (filtrés sur l'app), `pnpm test`, `pnpm e2e`.
- Cibles déploiement : l'app tourne sur tout hôte Node (Vercel/VPS). Routes PDF en `runtime = "nodejs"`.
- Sécurité : pages publiques `p/` sans session mais token 128 bits + rate-limit en mémoire (upgrade Redis plus tard) ; webhook Resend vérifié par signature (svix) ; toutes les actions revalident org + rôle côté serveur.
