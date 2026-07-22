"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  toast,
} from "@daromsart/ui";
import type { Role } from "@daromsart/auth";
import {
  inviteMemberAction,
  removeMemberAction,
  resendInviteAction,
  revokeInviteAction,
  updateRoleAction,
} from "@/modules/auth/actions";
import type { MemberRow, PendingInvitationRow } from "@/modules/auth/invitations";

const ROLE_LABEL: Record<Role, string> = { admin: "Administrateur", member: "Membre" };

function formatDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export interface EquipeClientProps {
  members: MemberRow[];
  pendingInvitations: PendingInvitationRow[];
  currentUserId: string;
}

export function EquipeClient({ members, pendingInvitations, currentUserId }: EquipeClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("member");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<MemberRow | null>(null);

  const adminCount = members.filter((m) => m.role === "admin").length;

  function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setInviteError(null);
    startTransition(async () => {
      const result = await inviteMemberAction({ email: inviteEmail, role: inviteRole });
      if (!result.ok) {
        setInviteError(result.errors.email ?? result.errors._root ?? "Échec de l'invitation.");
        return;
      }
      toast.success(`Invitation envoyée à ${inviteEmail}.`);
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("member");
      router.refresh();
    });
  }

  function handleRoleChange(member: MemberRow, role: Role) {
    startTransition(async () => {
      const result = await updateRoleAction(member.membershipId, role);
      if (!result.ok) {
        toast.error(result.errors._root ?? "Échec du changement de rôle.");
        return;
      }
      toast.success("Rôle mis à jour.");
      router.refresh();
    });
  }

  function handleRemove() {
    if (!removeTarget) return;
    const target = removeTarget;
    setRemoveTarget(null);
    startTransition(async () => {
      const result = await removeMemberAction(target.membershipId);
      if (!result.ok) {
        toast.error(result.errors._root ?? "Échec du retrait.");
        return;
      }
      toast.success("Membre retiré.");
      router.refresh();
    });
  }

  function handleResend(invitationId: string) {
    startTransition(async () => {
      const result = await resendInviteAction(invitationId);
      if (!result.ok) {
        toast.error(result.errors._root ?? "Échec du renvoi.");
        return;
      }
      toast.success("Invitation renvoyée.");
      router.refresh();
    });
  }

  function handleRevoke(invitationId: string) {
    startTransition(async () => {
      const result = await revokeInviteAction(invitationId);
      if (!result.ok) {
        toast.error(result.errors._root ?? "Échec de la révocation.");
        return;
      }
      toast.success("Invitation révoquée.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Membres</CardTitle>
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm">Inviter un membre</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleInvite}>
                <DialogHeader>
                  <DialogTitle>Inviter un membre</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="collegue@exemple.fr"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-role">Rôle</Label>
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                      <SelectTrigger id="invite-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Membre</SelectItem>
                        <SelectItem value="admin">Administrateur</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {inviteError ? (
                    <p className="text-sm text-destructive" role="alert">
                      {inviteError}
                    </p>
                  ) : null}
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={pending}>
                    {pending ? "Envoi…" : "Envoyer l'invitation"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Depuis</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const isSelf = member.userId === currentUserId;
                const isLastAdmin = member.role === "admin" && adminCount <= 1;
                return (
                  <TableRow key={member.membershipId}>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Select
                              value={member.role}
                              disabled={pending || isLastAdmin}
                              onValueChange={(v) => handleRoleChange(member, v as Role)}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="member">Membre</SelectItem>
                                <SelectItem value="admin">Administrateur</SelectItem>
                              </SelectContent>
                            </Select>
                          </span>
                        </TooltipTrigger>
                        {isLastAdmin ? (
                          <TooltipContent>
                            Impossible de rétrograder le dernier administrateur.
                          </TooltipContent>
                        ) : null}
                      </Tooltip>
                    </TableCell>
                    <TableCell>{formatDate(member.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={pending || isSelf || isLastAdmin}
                              onClick={() => setRemoveTarget(member)}
                            >
                              Retirer
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {isSelf ? (
                          <TooltipContent>Vous ne pouvez pas vous retirer vous-même.</TooltipContent>
                        ) : isLastAdmin ? (
                          <TooltipContent>Impossible de retirer le dernier administrateur.</TooltipContent>
                        ) : null}
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {pendingInvitations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Invitations en attente</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Expire le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>{invitation.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{ROLE_LABEL[invitation.role]}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(invitation.expiresAt)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => handleResend(invitation.id)}
                      >
                        Renvoyer
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => handleRevoke(invitation.id)}
                      >
                        Révoquer
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Retirer ce membre ?"
        description={`${removeTarget?.name} perdra l'accès à l'organisation.`}
        confirmLabel="Retirer"
        destructive
        onConfirm={handleRemove}
      />
    </div>
  );
}
