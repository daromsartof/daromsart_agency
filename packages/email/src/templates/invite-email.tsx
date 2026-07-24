import { Button, Text } from "@react-email/components";
import { EmailLayout } from "./layout";

export interface InviteEmailProps {
  organizationName: string;
  inviterName: string;
  role: "admin" | "member";
  url: string;
}

const ROLE_LABEL: Record<InviteEmailProps["role"], string> = {
  admin: "administrateur",
  member: "membre",
};

export function InviteEmail({ organizationName, inviterName, role, url }: InviteEmailProps) {
  return (
    <EmailLayout
      previewText={`${inviterName} vous invite à rejoindre ${organizationName}`}
      accentColor="#185FA5"
      organizationName={organizationName}
    >
      <Text style={{ fontSize: "14px", color: "#1f1f29" }}>
        {inviterName} vous invite à rejoindre <strong>{organizationName}</strong> sur Daromsart Système
        en tant que {ROLE_LABEL[role]}. Ce lien est valable 7 jours.
      </Text>
      <Button
        href={url}
        style={{
          backgroundColor: "#185FA5",
          color: "#ffffff",
          padding: "12px 20px",
          borderRadius: "6px",
          fontSize: "14px",
          fontWeight: "bold",
          textDecoration: "none",
        }}
      >
        Créer mon compte
      </Button>
      <Text style={{ fontSize: "11px", color: "#a1a1aa", marginTop: "16px" }}>
        Si vous ne vous attendiez pas à cette invitation, ignorez cet email.
      </Text>
    </EmailLayout>
  );
}
