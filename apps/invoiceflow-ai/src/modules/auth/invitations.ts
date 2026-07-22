import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import type { Auth, Role } from "@daromsart/auth";
import type { Mailer } from "@daromsart/email";
import type { AppDb } from "../../db/types";
import { invitations, memberships, organizations, user } from "../../db/schema";
import { env } from "../../lib/env";

/**
 * Invitations d'équipe (story 21, H4). Token en clair envoyé par email
 * uniquement — jamais stocké : seul `sha256(token)` vit en base
 * (`invitations.tokenHash`, colonne déjà prévue depuis story 03), comparé au
 * hash recalculé à la lecture. Garde-fous transactionnels : dernier admin
 * jamais retirable ni rétrogradable (verrou `FOR UPDATE` sur les lignes
 * admin de l'org, même pattern que `numbering.ts`/`payments.ts`), on ne
 * peut jamais se retirer soi-même.
 */

const TOKEN_BYTES = 32;
const EXPIRY_DAYS = 7;

function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function zodErrorsToRecord(issues: { path: (string | number)[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join(".") || "_root";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export type MutationResult = { ok: true } | { ok: false; errors: Record<string, string> };

const emailSchema = z.string().trim().toLowerCase().email("Adresse email invalide.");

export type InviteMemberResult =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string> };

/** Invite un nouveau membre par email. Garde admin faite en amont (action). */
export async function inviteMember(
  db: AppDb,
  mailer: Mailer,
  organizationId: string,
  invitedByUserId: string,
  input: { email: string; role: Role },
): Promise<InviteMemberResult> {
  const parsedEmail = emailSchema.safeParse(input.email);
  if (!parsedEmail.success) {
    return { ok: false, errors: { email: parsedEmail.error.issues[0]?.message ?? "Email invalide." } };
  }
  const email = parsedEmail.data;

  const [org] = await db
    .select({ id: organizations.id, legalName: organizations.legalName })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!org) {
    return { ok: false, errors: { _root: "Organisation introuvable." } };
  }

  const [existingUser] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
  if (existingUser) {
    const [existingMembership] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(eq(memberships.userId, existingUser.id), eq(memberships.organizationId, organizationId)),
      )
      .limit(1);
    if (existingMembership) {
      return { ok: false, errors: { email: "Cette personne est déjà membre de l'organisation." } };
    }
  }

  const [pending] = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(
      and(
        eq(invitations.organizationId, organizationId),
        eq(invitations.email, email),
        isNull(invitations.acceptedAt),
      ),
    )
    .limit(1);
  if (pending) {
    return {
      ok: false,
      errors: { email: "Une invitation est déjà en attente pour cet email — utilisez « Renvoyer »." },
    };
  }

  const [inviter] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, invitedByUserId))
    .limit(1);

  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + EXPIRY_DAYS);

  const [created] = await db
    .insert(invitations)
    .values({
      organizationId,
      email,
      role: input.role,
      tokenHash: hashToken(token),
      invitedBy: invitedByUserId,
      expiresAt,
    })
    .returning({ id: invitations.id });

  const sendResult = await mailer.sendInviteEmail({
    to: email,
    organizationName: org.legalName,
    inviterName: inviter?.name ?? "Un administrateur",
    role: input.role,
    url: `${env.APP_URL}/invitation/${token}`,
  });
  if (!sendResult.ok) {
    // L'invitation existe déjà en base (H12, même choix que l'émission de
    // facture) : pas de rollback, l'admin peut "Renvoyer" depuis la liste.
    // eslint-disable-next-line no-console
    console.error(`[invitations] Échec de l'envoi de l'invitation à ${email} : ${sendResult.error}`);
  }

  return { ok: true, id: created.id };
}

/** Régénère token + expiration d'une invitation en attente et renvoie l'email. */
export async function resendInvite(
  db: AppDb,
  mailer: Mailer,
  organizationId: string,
  invitationId: string,
): Promise<InviteMemberResult> {
  const [invitation] = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.id, invitationId), eq(invitations.organizationId, organizationId)))
    .limit(1);
  if (!invitation) {
    return { ok: false, errors: { _root: "Invitation introuvable." } };
  }
  if (invitation.acceptedAt) {
    return { ok: false, errors: { _root: "Cette invitation a déjà été acceptée." } };
  }

  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + EXPIRY_DAYS);
  await db
    .update(invitations)
    .set({ tokenHash: hashToken(token), expiresAt, updatedAt: new Date() })
    .where(eq(invitations.id, invitationId));

  const [org] = await db
    .select({ legalName: organizations.legalName })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  const [inviter] = invitation.invitedBy
    ? await db.select({ name: user.name }).from(user).where(eq(user.id, invitation.invitedBy)).limit(1)
    : [];

  const sendResult = await mailer.sendInviteEmail({
    to: invitation.email,
    organizationName: org?.legalName ?? "",
    inviterName: inviter?.name ?? "Un administrateur",
    role: invitation.role,
    url: `${env.APP_URL}/invitation/${token}`,
  });
  if (!sendResult.ok) {
    return { ok: false, errors: { _root: "Échec de l'envoi de l'email d'invitation." } };
  }

  return { ok: true, id: invitationId };
}

/** Révoque une invitation en attente (supprime la ligne — jamais consommée). */
export async function revokeInvite(
  db: AppDb,
  organizationId: string,
  invitationId: string,
): Promise<MutationResult> {
  const [invitation] = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(and(eq(invitations.id, invitationId), eq(invitations.organizationId, organizationId)))
    .limit(1);
  if (!invitation) {
    return { ok: false, errors: { _root: "Invitation introuvable." } };
  }
  await db.delete(invitations).where(eq(invitations.id, invitationId));
  return { ok: true };
}

export interface InvitePreview {
  email: string;
  role: Role;
  organizationName: string;
  status: "valid" | "expired" | "accepted" | "not_found";
  /** Compte déjà existant (cas rare mono-org : ex. ancien membre retiré puis
   * réinvité) — l'acceptation ne recrée pas de compte, juste la membership. */
  existingUser: boolean;
}

/** État d'un token d'invitation pour la page publique `/invitation/[token]`. */
export async function getInviteByToken(db: AppDb, token: string): Promise<InvitePreview> {
  const notFound: InvitePreview = {
    email: "",
    role: "member",
    organizationName: "",
    status: "not_found",
    existingUser: false,
  };
  const [invitation] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.tokenHash, hashToken(token)))
    .limit(1);
  if (!invitation) return notFound;

  const [org] = await db
    .select({ legalName: organizations.legalName })
    .from(organizations)
    .where(eq(organizations.id, invitation.organizationId))
    .limit(1);
  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, invitation.email))
    .limit(1);

  const base = {
    email: invitation.email,
    role: invitation.role,
    organizationName: org?.legalName ?? "",
    existingUser: Boolean(existingUser),
  };

  if (invitation.acceptedAt) return { ...base, status: "accepted" };
  if (invitation.expiresAt.getTime() < Date.now()) return { ...base, status: "expired" };
  return { ...base, status: "valid" };
}

const acceptInviteSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis."),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères."),
});
export type AcceptInviteInput = z.input<typeof acceptInviteSchema>;

export type AcceptInviteResult =
  | { ok: true; existingUser: boolean }
  | { ok: false; errors: Record<string, string> };

/**
 * Accepte une invitation : token valide/non expiré/non consommé → création
 * du compte (instance `allowSignUp: true` injectée, jamais l'instance
 * principale) + membership, dans cet ordre. Cas rare (H4, mono-org) : un
 * compte existe déjà pour cet email (ex. ancien membre retiré, réinvité) →
 * pas de nouveau compte, juste la membership (l'utilisateur garde son mot
 * de passe existant, se connecte ensuite normalement — pas d'auto-login
 * possible dans ce cas précis, contrairement au flux nominal).
 */
export async function acceptInvite(
  db: AppDb,
  auth: Auth,
  token: string,
  input: AcceptInviteInput,
): Promise<AcceptInviteResult> {
  const [invitation] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.tokenHash, hashToken(token)))
    .limit(1);
  if (!invitation) {
    return { ok: false, errors: { _root: "Invitation introuvable." } };
  }
  if (invitation.acceptedAt) {
    return { ok: false, errors: { _root: "Cette invitation a déjà été acceptée." } };
  }
  if (invitation.expiresAt.getTime() < Date.now()) {
    return { ok: false, errors: { _root: "Cette invitation a expiré." } };
  }

  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, invitation.email))
    .limit(1);

  if (existingUser) {
    await db
      .insert(memberships)
      .values({ userId: existingUser.id, organizationId: invitation.organizationId, role: invitation.role })
      .onConflictDoNothing({ target: [memberships.userId, memberships.organizationId] });
    await db
      .update(invitations)
      .set({ acceptedAt: new Date(), updatedAt: new Date() })
      .where(eq(invitations.id, invitation.id));
    return { ok: true, existingUser: true };
  }

  const parsed = acceptInviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: zodErrorsToRecord(parsed.error.issues) };
  }

  try {
    await auth.api.signUpEmail({
      body: { email: invitation.email, password: parsed.data.password, name: parsed.data.name },
    });
  } catch {
    return { ok: false, errors: { _root: "Échec de la création du compte." } };
  }

  const [newUser] = await db.select({ id: user.id }).from(user).where(eq(user.email, invitation.email)).limit(1);
  if (!newUser) {
    return { ok: false, errors: { _root: "Échec de la création du compte." } };
  }

  await db
    .insert(memberships)
    .values({ userId: newUser.id, organizationId: invitation.organizationId, role: invitation.role });
  await db
    .update(invitations)
    .set({ acceptedAt: new Date(), updatedAt: new Date() })
    .where(eq(invitations.id, invitation.id));

  return { ok: true, existingUser: false };
}

export interface MemberRow {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
}

/** Membres actifs de l'organisation (table de `/parametres/equipe`). */
export async function listMembers(db: AppDb, organizationId: string): Promise<MemberRow[]> {
  const rows = await db
    .select({
      membershipId: memberships.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      role: memberships.role,
      createdAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(user, eq(user.id, memberships.userId))
    .where(eq(memberships.organizationId, organizationId))
    .orderBy(memberships.createdAt);
  return rows;
}

export interface PendingInvitationRow {
  id: string;
  email: string;
  role: Role;
  expiresAt: Date;
  createdAt: Date;
}

/** Invitations en attente (ni acceptées, ni expirées) — la liste "en cours" affichée à l'admin. */
export async function listPendingInvitations(
  db: AppDb,
  organizationId: string,
): Promise<PendingInvitationRow[]> {
  const rows = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
      createdAt: invitations.createdAt,
    })
    .from(invitations)
    .where(and(eq(invitations.organizationId, organizationId), isNull(invitations.acceptedAt)))
    .orderBy(invitations.createdAt);
  return rows;
}

/** Nombre d'admins actifs de l'organisation (affichage tooltip "dernier admin"). */
export async function countAdmins(db: AppDb, organizationId: string): Promise<number> {
  const rows = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.organizationId, organizationId), eq(memberships.role, "admin")));
  return rows.length;
}

export type UpdateRoleResult = { ok: true } | { ok: false; errors: Record<string, string> };

/** Change le rôle d'un membre — refuse de rétrograder le dernier admin (verrou `FOR UPDATE`). */
export async function updateRole(
  db: AppDb,
  organizationId: string,
  membershipId: string,
  newRole: Role,
): Promise<UpdateRoleResult> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(memberships)
      .where(and(eq(memberships.id, membershipId), eq(memberships.organizationId, organizationId)))
      .limit(1);
    if (!target) {
      return { ok: false, errors: { _root: "Membre introuvable." } };
    }
    if (target.role === newRole) {
      return { ok: true };
    }

    if (target.role === "admin" && newRole === "member") {
      const admins = await tx
        .select({ id: memberships.id })
        .from(memberships)
        .where(and(eq(memberships.organizationId, organizationId), eq(memberships.role, "admin")))
        .for("update");
      if (admins.length <= 1) {
        return {
          ok: false,
          errors: { _root: "Impossible de rétrograder le dernier administrateur." },
        };
      }
    }

    await tx
      .update(memberships)
      .set({ role: newRole, updatedAt: new Date() })
      .where(eq(memberships.id, membershipId));
    return { ok: true };
  });
}

export type RemoveMemberResult = { ok: true } | { ok: false; errors: Record<string, string> };

/** Retire un membre de l'organisation (supprime la membership, jamais le user) — jamais soi-même, jamais le dernier admin. */
export async function removeMember(
  db: AppDb,
  organizationId: string,
  membershipId: string,
  requestingUserId: string,
): Promise<RemoveMemberResult> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(memberships)
      .where(and(eq(memberships.id, membershipId), eq(memberships.organizationId, organizationId)))
      .limit(1);
    if (!target) {
      return { ok: false, errors: { _root: "Membre introuvable." } };
    }
    if (target.userId === requestingUserId) {
      return { ok: false, errors: { _root: "Vous ne pouvez pas vous retirer vous-même." } };
    }

    if (target.role === "admin") {
      const admins = await tx
        .select({ id: memberships.id })
        .from(memberships)
        .where(and(eq(memberships.organizationId, organizationId), eq(memberships.role, "admin")))
        .for("update");
      if (admins.length <= 1) {
        return { ok: false, errors: { _root: "Impossible de retirer le dernier administrateur." } };
      }
    }

    await tx.delete(memberships).where(eq(memberships.id, membershipId));
    return { ok: true };
  });
}
