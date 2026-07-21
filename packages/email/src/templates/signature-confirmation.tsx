import { Button, Text } from "@react-email/components";
import { EmailLayout } from "./layout";

export interface SignatureConfirmationEmailProps {
  organizationName: string;
  accentColor: string;
  quoteNumber: string;
  clientName: string;
  signerName: string;
  /** `true` → email destiné à l'organisation (notification), `false` → au client (confirmation). */
  forOrganization: boolean;
  publicUrl: string;
}

export function SignatureConfirmationEmail({
  organizationName,
  accentColor,
  quoteNumber,
  clientName,
  signerName,
  forOrganization,
  publicUrl,
}: SignatureConfirmationEmailProps) {
  const title = forOrganization
    ? `Le devis ${quoteNumber} vient d'être signé`
    : `Votre signature du devis ${quoteNumber} est confirmée`;

  return (
    <EmailLayout
      previewText={title}
      accentColor={accentColor}
      organizationName={organizationName}
    >
      <Text style={{ fontSize: "14px", color: "#1f1f29" }}>
        {forOrganization
          ? `${signerName}, pour le compte de ${clientName}, vient de signer le devis ${quoteNumber}.`
          : `Bonjour ${clientName},\n\nVotre signature du devis ${quoteNumber} par ${signerName} a bien été enregistrée. Vous trouverez le PDF signé en pièce jointe.`}
      </Text>
      <Button
        href={publicUrl}
        style={{
          backgroundColor: accentColor,
          color: "#ffffff",
          padding: "12px 20px",
          borderRadius: "6px",
          fontSize: "14px",
          fontWeight: "bold",
          textDecoration: "none",
        }}
      >
        Consulter le devis signé
      </Button>
    </EmailLayout>
  );
}
