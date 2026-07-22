import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@daromsart/ui";
import { db } from "@/db";
import { getInviteByToken } from "@/modules/auth/invitations";
import { AcceptInviteForm } from "./accept-invite-form";

export const metadata = { title: "Invitation" };

const ROLE_LABEL: Record<string, string> = { admin: "administrateur", member: "membre" };

export default async function InvitationPage({
  params,
}: {
  params: { token: string };
}) {
  const invite = await getInviteByToken(db, params.token);

  if (invite.status !== "valid") {
    const message =
      invite.status === "expired"
        ? "Cette invitation a expiré. Demandez à un administrateur de vous en renvoyer une."
        : invite.status === "accepted"
          ? "Cette invitation a déjà été acceptée. Connectez-vous avec votre compte."
          : "Ce lien d'invitation est invalide.";
    return (
      <Card>
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-lg">Invitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-destructive" role="alert">
            {message}
          </p>
          <p className="text-center text-xs text-muted-foreground">
            <Link href="/connexion" className="text-primary hover:underline">
              Retour à la connexion
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-lg">Rejoindre {invite.organizationName}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Invitation pour {invite.email} en tant que {ROLE_LABEL[invite.role]}.
        </p>
      </CardHeader>
      <CardContent>
        <AcceptInviteForm
          token={params.token}
          email={invite.email}
          existingUser={invite.existingUser}
        />
      </CardContent>
    </Card>
  );
}
