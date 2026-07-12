import { eq } from "drizzle-orm";
import type { Storage } from "@daromsart/storage";
import { organizations } from "../../db/schema";
import type { AppDb } from "../../db/types";
import {
  LOGO_ALLOWED_TYPES,
  LOGO_MAX_BYTES,
  addressSchema,
  bankSchema,
  identitySchema,
  legalFooterSchema,
  normalizeBankInput,
  type AddressInput,
  type BankInput,
  type IdentityInput,
  type LegalFooterInput,
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
