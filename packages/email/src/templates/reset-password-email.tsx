import { Button, Text } from "@react-email/components";
import { EmailLayout } from "./layout";

export interface ResetPasswordEmailProps {
  url: string;
}

export function ResetPasswordEmail({ url }: ResetPasswordEmailProps) {
  return (
    <EmailLayout
      previewText="Réinitialisation de votre mot de passe"
      accentColor="#185FA5"
      organizationName="Daromsart Système"
    >
      <Text style={{ fontSize: "14px", color: "#1f1f29" }}>
        Vous avez demandé la réinitialisation de votre mot de passe. Ce lien est valable
        1 heure.
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
        Réinitialiser mon mot de passe
      </Button>
      <Text style={{ fontSize: "11px", color: "#a1a1aa", marginTop: "16px" }}>
        Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
      </Text>
    </EmailLayout>
  );
}
