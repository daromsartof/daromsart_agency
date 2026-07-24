import { eq } from "drizzle-orm";
import type { Storage } from "@daromsart/storage";
import { DEFAULT_EMAIL_DEFAULTS, FRANCHISE_MENTION, organizations, type EmailDefaults } from "../../db/schema";
import type { AppDb } from "../../db/types";
import {
  LOGO_ALLOWED_TYPES,
  LOGO_MAX_BYTES,
  addressSchema,
  bankSchema,
  delaysSchema,
  emailDefaultsSchema,
  identitySchema,
  legalFooterSchema,
  normalizeBankInput,
  numberFormatsSchema,
  vatSettingsSchema,
  type AddressInput,
  type BankInput,
  type DelaysInput,
  type EmailDefaultsInput,
  type IdentityInput,
  type LegalFooterInput,
  type NumberFormatsInput,
  type VatSettingsInput,
} from "./schemas";

/**
 * Logique métier pure (validation zod + écriture DB), sans dépendance à
 * Next.js (`server-only`, `next/headers`, `next/cache`). Testable en
 * intégration sans contexte de requête ; `actions.ts` l'enrobe avec
 * `requireAdmin()` et `revalidatePath()`.
 */
export type OrgDb = AppDb;

export type MutationResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string> };

function zodErrorsToRecord(
  issues: { path: (string | number)[]; message: string }[],
) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join(".") || "_root";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/jpeg": "jpg",
};

export interface LogoFile {
  buffer: Buffer;
  contentType: string;
  size: number;
}

export interface OrgRef {
  id: string;
  logoKey: string | null;
}

export async function applyIdentity(
  db: OrgDb,
  orgId: string,
  input: IdentityInput,
): Promise<MutationResult> {
  const parsed = identitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorsToRecord(parsed.error.issues) };
  }
  await db
    .update(organizations)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(organizations.id, orgId));
  return { ok: true };
}

export async function applyAddress(
  db: OrgDb,
  orgId: string,
  input: AddressInput,
): Promise<MutationResult> {
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorsToRecord(parsed.error.issues) };
  }
  await db
    .update(organizations)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(organizations.id, orgId));
  return { ok: true };
}

export async function applyBank(
  db: OrgDb,
  orgId: string,
  input: BankInput,
): Promise<MutationResult> {
  const parsed = bankSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorsToRecord(parsed.error.issues) };
  }
  const normalized = normalizeBankInput(parsed.data);
  await db
    .update(organizations)
    .set({ ...normalized, updatedAt: new Date() })
    .where(eq(organizations.id, orgId));
  return { ok: true };
}

export async function applyLegalFooter(
  db: OrgDb,
  orgId: string,
  input: LegalFooterInput,
): Promise<MutationResult> {
  const parsed = legalFooterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorsToRecord(parsed.error.issues) };
  }
  await db
    .update(organizations)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(organizations.id, orgId));
  return { ok: true };
}

export async function applyUploadLogo(
  db: OrgDb,
  storage: Storage,
  org: OrgRef,
  file: LogoFile,
): Promise<MutationResult> {
  if (file.size > LOGO_MAX_BYTES) {
    return { ok: false, errors: { file: "Le fichier dépasse 2 Mo." } };
  }
  if (!LOGO_ALLOWED_TYPES.includes(file.contentType)) {
    return { ok: false, errors: { file: "Formats acceptés : PNG, SVG, JPG." } };
  }

  const ext = EXTENSION_BY_MIME[file.contentType] ?? "bin";
  const key = `logos/${org.id}-${Date.now()}.${ext}`;

  await storage.put(key, file.buffer, file.contentType);
  if (org.logoKey) {
    await storage.delete(org.logoKey);
  }
  await db
    .update(organizations)
    .set({ logoKey: key, updatedAt: new Date() })
    .where(eq(organizations.id, org.id));

  return { ok: true };
}

export async function applyDeleteLogo(
  db: OrgDb,
  storage: Storage,
  org: OrgRef,
): Promise<MutationResult> {
  if (org.logoKey) {
    await storage.delete(org.logoKey);
    await db
      .update(organizations)
      .set({ logoKey: null, updatedAt: new Date() })
      .where(eq(organizations.id, org.id));
  }
  return { ok: true };
}

/** Formats de numérotation (H6, story 22) — n'affecte que les futures
 * émissions (le compteur `number_sequences` continue sans interruption, seul
 * le libellé change ; avertissement affiché côté UI si la séquence de
 * l'année a déjà démarré, pas une garde bloquante). */
export async function applyNumberFormats(
  db: OrgDb,
  orgId: string,
  input: NumberFormatsInput,
): Promise<MutationResult> {
  const parsed = numberFormatsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorsToRecord(parsed.error.issues) };
  }
  await db
    .update(organizations)
    .set({ numberFormats: parsed.data, updatedAt: new Date() })
    .where(eq(organizations.id, orgId));
  return { ok: true };
}

/** Taux de TVA actifs/par défaut + franchise en base (H5, story 22). Activer
 * la franchise force le défaut à 0 % et COMPOSE la mention légale (ajoutée
 * une seule fois — jamais d'écrasement du texte custom existant). */
export async function applyVatSettings(
  db: OrgDb,
  orgId: string,
  input: VatSettingsInput,
): Promise<MutationResult> {
  const parsed = vatSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorsToRecord(parsed.error.issues) };
  }
  const data = parsed.data;
  const defaultRate = data.franchiseEnabled ? 0 : data.defaultRate;

  const [org] = await db
    .select({ legalFooter: organizations.legalFooter, franchiseEnabled: organizations.franchiseEnabled })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  if (!org) {
    return { ok: false, errors: { _root: "Organisation introuvable." } };
  }

  const shouldAppendMention =
    data.franchiseEnabled && !org.franchiseEnabled && !org.legalFooter.includes(FRANCHISE_MENTION);
  const legalFooter = shouldAppendMention ? `${org.legalFooter}\n\n${FRANCHISE_MENTION}` : undefined;

  await db
    .update(organizations)
    .set({
      vatRatesActive: data.activeRates,
      vatRateDefault: String(defaultRate),
      franchiseEnabled: data.franchiseEnabled,
      ...(legalFooter !== undefined ? { legalFooter } : {}),
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));
  return { ok: true };
}

/** Délais par défaut (paiement, validité devis) — n'affecte que les
 * nouveaux documents créés après l'enregistrement. */
export async function applyDelays(
  db: OrgDb,
  orgId: string,
  input: DelaysInput,
): Promise<MutationResult> {
  const parsed = delaysSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorsToRecord(parsed.error.issues) };
  }
  await db
    .update(organizations)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(organizations.id, orgId));
  return { ok: true };
}

/** Textes d'emails par défaut (H12, story 22) : reply-to + les 3 blocs
 * objet/corps (devis, facture, relance). */
export async function applyEmailDefaults(
  db: OrgDb,
  orgId: string,
  input: EmailDefaultsInput,
): Promise<MutationResult> {
  const parsed = emailDefaultsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorsToRecord(parsed.error.issues) };
  }
  const { replyTo, ...emailDefaults } = parsed.data;
  await db
    .update(organizations)
    .set({
      emailReplyTo: replyTo || null,
      emailDefaults: emailDefaults as EmailDefaults,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));
  return { ok: true };
}

/** Réinitialise un seul bloc email (devis/facture/relance) à sa valeur par
 * défaut — les deux autres blocs restent inchangés. */
export async function resetEmailDefault(
  db: OrgDb,
  orgId: string,
  kind: keyof EmailDefaults,
): Promise<MutationResult> {
  const [org] = await db
    .select({ emailDefaults: organizations.emailDefaults })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  if (!org) {
    return { ok: false, errors: { _root: "Organisation introuvable." } };
  }
  await db
    .update(organizations)
    .set({
      emailDefaults: { ...org.emailDefaults, [kind]: DEFAULT_EMAIL_DEFAULTS[kind] },
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));
  return { ok: true };
}
