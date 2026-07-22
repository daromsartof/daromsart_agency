import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createAuth } from "@daromsart/auth";
import type { Mailer } from "@daromsart/email";
import * as schema from "../../db/schema";
import { invitations, memberships, organizations, user } from "../../db/schema";
import {
  acceptInvite,
  countAdmins,
  getInviteByToken,
  inviteMember,
  listMembers,
  listPendingInvitations,
  removeMember,
  resendInvite,
  revokeInvite,
  updateRole,
} from "./invitations";

/**
 * Tests d'intégration du cycle invitation → acceptation → membership, contre
 * la base de test. `requireAdmin()` (garde de session, Next.js) n'est pas
 * exercé ici — nécessite un contexte de requête réel, vérifié en e2e
 * (`e2e/team.spec.ts`), même limite documentée que
 * `organization/mutations.integration.test.ts`.
 */
const url = process.env.TEST_DATABASE_URL;
const client = postgres(url ?? "", { max: 1 });
const db = drizzle(client, { schema });

const auth = createAuth({
  db,
  schema,
  secret: "test-secret-please-change-0123456789",
  baseURL: "http://localhost:3000",
  allowSignUp: true,
  sendResetPassword: async () => {},
});

let capturedInviteUrl = "";
const mailer: Mailer = {
  async sendDocumentEmail() {
    return { ok: true, id: "resend_fake_id", mode: "resend" };
  },
  async sendResetPasswordEmail() {
    return { ok: true, id: "resend_fake_id", mode: "resend" };
  },
  async sendSignatureConfirmation() {
    return { ok: true, id: "resend_fake_id", mode: "resend" };
  },
  async sendReminderEmail() {
    return { ok: true, id: "resend_fake_id", mode: "resend" };
  },
  async sendInviteEmail(params) {
    capturedInviteUrl = params.url;
    return { ok: true, id: "resend_fake_id", mode: "resend" };
  },
};

function tokenFromUrl(url: string): string {
  return url.split("/invitation/")[1];
}

let orgId = "";
let adminUserId = "";
const ADMIN_EMAIL = `admin-invit-test-${Date.now()}@daromsart.test`;

beforeAll(async () => {
  if (!url) throw new Error("TEST_DATABASE_URL manquant");
  const [org] = await db
    .insert(organizations)
    .values({ legalName: "Org Invitations Test" })
    .returning();
  orgId = org.id;

  await auth.api.signUpEmail({
    body: { email: ADMIN_EMAIL, password: "AdminPassw0rd!", name: "Admin Test" },
  });
  const [admin] = await db.select({ id: user.id }).from(user).where(eq(user.email, ADMIN_EMAIL)).limit(1);
  adminUserId = admin.id;
  await db.insert(memberships).values({ userId: adminUserId, organizationId: orgId, role: "admin" });
});

afterAll(async () => {
  await db.delete(invitations).where(eq(invitations.organizationId, orgId));
  await db.delete(memberships).where(eq(memberships.organizationId, orgId));
  await db.delete(organizations).where(eq(organizations.id, orgId));
  await client.end({ timeout: 5 });
});

describe("cycle complet invite → accept → membership", () => {
  it("invite un nouveau membre, régénère le token (resend), puis l'acceptation crée compte + membership", async () => {
    const email = `nouveau-${Date.now()}@daromsart.test`;
    const invited = await inviteMember(db, mailer, orgId, adminUserId, { email, role: "member" });
    expect(invited.ok).toBe(true);
    if (!invited.ok) return;

    const firstUrl = capturedInviteUrl;
    const resent = await resendInvite(db, mailer, orgId, invited.id);
    expect(resent.ok).toBe(true);
    // Le token a changé (re-invite = remplace le pending).
    expect(capturedInviteUrl).not.toBe(firstUrl);

    const token = tokenFromUrl(capturedInviteUrl);
    const preview = await getInviteByToken(db, token);
    expect(preview.status).toBe("valid");
    expect(preview.email).toBe(email);
    expect(preview.existingUser).toBe(false);

    const accepted = await acceptInvite(db, auth, token, { name: "Nouveau Membre", password: "Passw0rd123!" });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.existingUser).toBe(false);

    const members = await listMembers(db, orgId);
    const created = members.find((m) => m.email === email);
    expect(created?.role).toBe("member");

    const previewAfter = await getInviteByToken(db, token);
    expect(previewAfter.status).toBe("accepted");
  });

  it("refuse un token inconnu, expiré, ou déjà accepté", async () => {
    const unknownResult = await acceptInvite(db, auth, "token-inconnu", { name: "X", password: "Passw0rd123!" });
    expect(unknownResult.ok).toBe(false);

    const email = `expire-${Date.now()}@daromsart.test`;
    const invited = await inviteMember(db, mailer, orgId, adminUserId, { email, role: "member" });
    expect(invited.ok).toBe(true);
    if (!invited.ok) return;
    await db.update(invitations).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(invitations.id, invited.id));
    const token = tokenFromUrl(capturedInviteUrl);
    const expiredResult = await acceptInvite(db, auth, token, { name: "X", password: "Passw0rd123!" });
    expect(expiredResult.ok).toBe(false);

    const email2 = `deja-accepte-${Date.now()}@daromsart.test`;
    const invited2 = await inviteMember(db, mailer, orgId, adminUserId, { email: email2, role: "member" });
    expect(invited2.ok).toBe(true);
    if (!invited2.ok) return;
    const token2 = tokenFromUrl(capturedInviteUrl);
    const first = await acceptInvite(db, auth, token2, { name: "Y", password: "Passw0rd123!" });
    expect(first.ok).toBe(true);
    const replay = await acceptInvite(db, auth, token2, { name: "Y", password: "Passw0rd123!" });
    expect(replay.ok).toBe(false);
  });

  it("refuse d'inviter un email déjà membre, ou déjà en attente", async () => {
    const alreadyMember = await inviteMember(db, mailer, orgId, adminUserId, {
      email: ADMIN_EMAIL,
      role: "member",
    });
    expect(alreadyMember.ok).toBe(false);

    const email = `pending-${Date.now()}@daromsart.test`;
    const first = await inviteMember(db, mailer, orgId, adminUserId, { email, role: "member" });
    expect(first.ok).toBe(true);
    const duplicate = await inviteMember(db, mailer, orgId, adminUserId, { email, role: "member" });
    expect(duplicate.ok).toBe(false);
  });

  it("revokeInvite supprime l'invitation en attente", async () => {
    const email = `revoke-${Date.now()}@daromsart.test`;
    const invited = await inviteMember(db, mailer, orgId, adminUserId, { email, role: "member" });
    expect(invited.ok).toBe(true);
    if (!invited.ok) return;

    const pendingBefore = await listPendingInvitations(db, orgId);
    expect(pendingBefore.some((i) => i.id === invited.id)).toBe(true);

    const revoked = await revokeInvite(db, orgId, invited.id);
    expect(revoked.ok).toBe(true);

    const pendingAfter = await listPendingInvitations(db, orgId);
    expect(pendingAfter.some((i) => i.id === invited.id)).toBe(false);
  });

  it("acceptInvite pour un email déjà utilisateur (cas rare mono-org) crée seulement la membership", async () => {
    const email = `existant-${Date.now()}@daromsart.test`;
    await auth.api.signUpEmail({ body: { email, password: "Passw0rd123!", name: "Ancien Membre" } });

    const invited = await inviteMember(db, mailer, orgId, adminUserId, { email, role: "admin" });
    expect(invited.ok).toBe(true);
    if (!invited.ok) return;
    const token = tokenFromUrl(capturedInviteUrl);

    const preview = await getInviteByToken(db, token);
    expect(preview.existingUser).toBe(true);

    const accepted = await acceptInvite(db, auth, token, { name: "", password: "" });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.existingUser).toBe(true);

    const members = await listMembers(db, orgId);
    expect(members.find((m) => m.email === email)?.role).toBe("admin");
  });
});

describe("dernier admin protégé", () => {
  async function makeOrgWithOneAdmin(legalName: string) {
    const [org] = await db.insert(organizations).values({ legalName }).returning();
    const email = `sole-admin-${Date.now()}-${Math.random()}@daromsart.test`;
    await auth.api.signUpEmail({ body: { email, password: "Passw0rd123!", name: "Seul Admin" } });
    const [u] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
    await db.insert(memberships).values({ userId: u.id, organizationId: org.id, role: "admin" });
    const [membership] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(eq(memberships.userId, u.id))
      .limit(1);
    return { orgId: org.id, userId: u.id, membershipId: membership.id };
  }

  it("refuse de rétrograder le dernier admin, autorise s'il y en a un second", async () => {
    const solo = await makeOrgWithOneAdmin("Org Dernier Admin Rétrograder Test");
    expect(await countAdmins(db, solo.orgId)).toBe(1);

    const refused = await updateRole(db, solo.orgId, solo.membershipId, "member");
    expect(refused.ok).toBe(false);

    const email = `second-admin-${Date.now()}@daromsart.test`;
    const invited = await inviteMember(db, mailer, solo.orgId, solo.userId, { email, role: "admin" });
    expect(invited.ok).toBe(true);
    if (!invited.ok) return;
    const token = tokenFromUrl(capturedInviteUrl);
    const accepted = await acceptInvite(db, auth, token, { name: "Second Admin", password: "Passw0rd123!" });
    expect(accepted.ok).toBe(true);
    expect(await countAdmins(db, solo.orgId)).toBe(2);

    const allowed = await updateRole(db, solo.orgId, solo.membershipId, "member");
    expect(allowed.ok).toBe(true);

    await db.delete(invitations).where(eq(invitations.organizationId, solo.orgId));
    await db.delete(memberships).where(eq(memberships.organizationId, solo.orgId));
    await db.delete(organizations).where(eq(organizations.id, solo.orgId));
  });

  it("refuse de se retirer soi-même", async () => {
    const solo = await makeOrgWithOneAdmin("Org Retrait Soi-Même Test");
    const selfRemoval = await removeMember(db, solo.orgId, solo.membershipId, solo.userId);
    expect(selfRemoval.ok).toBe(false);

    await db.delete(memberships).where(eq(memberships.organizationId, solo.orgId));
    await db.delete(organizations).where(eq(organizations.id, solo.orgId));
  });

  it("refuse de retirer le dernier admin (même par un autre utilisateur)", async () => {
    const solo = await makeOrgWithOneAdmin("Org Retrait Dernier Admin Test");
    const email = `member-remover-${Date.now()}@daromsart.test`;
    const invited = await inviteMember(db, mailer, solo.orgId, solo.userId, { email, role: "member" });
    expect(invited.ok).toBe(true);
    if (!invited.ok) return;
    const token = tokenFromUrl(capturedInviteUrl);
    await acceptInvite(db, auth, token, { name: "Autre Membre", password: "Passw0rd123!" });
    const [otherMember] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);

    const removal = await removeMember(db, solo.orgId, solo.membershipId, otherMember.id);
    expect(removal.ok).toBe(false);

    await db.delete(memberships).where(eq(memberships.organizationId, solo.orgId));
    await db.delete(organizations).where(eq(organizations.id, solo.orgId));
  });
});
