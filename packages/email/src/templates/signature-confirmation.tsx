import { Button, Text } from "@react-email/components";
import { EmailLayout } from "./layout";

export interface SignatureConfirmationEmailProps {
  organizationName: string;
  accentColor: string;
  documentKind: "quote" | "invoice";
  documentNumber: string;
  clientName: string;
  signerName: string;
  /** `true` → email destiné à l'organisation (notification), `false` → au client (confirmation). */
  forOrganization: boolean;
  publicUrl: string;
}

export function SignatureConfirmationEmail({
  organizationName,
  accentColor,
  documentKind,
  documentNumber,
  clientName,
  signerName,
  forOrganization,
  publicUrl,
}: SignatureConfirmationEmailProps) {
  // Accords français devis (masculin) / facture (féminin) — un seul point de
  // vérité pour éviter de répéter la comparaison sur `documentKind` partout.
  const isInvoice = documentKind === "invoice";
  const article = isInvoice ? "la" : "le";
  const noun = isInvoice ? "facture" : "devis";
  const signedAdjective = isInvoice ? "signée" : "signé";
  const of = isInvoice ? "de la facture" : "du devis";

  const title = forOrganization
    ? `${article === "la" ? "La" : "Le"} ${noun} ${documentNumber} vient d'être ${signedAdjective}`
    : `Votre signature ${of} ${documentNumber} est confirmée`;

  return (
    <EmailLayout
      previewText={title}
      accentColor={accentColor}
      organizationName={organizationName}
    >
      <Text style={{ fontSize: "14px", color: "#1f1f29" }}>
        {forOrganization
          ? `${signerName}, pour le compte de ${clientName}, vient de signer ${article} ${noun} ${documentNumber}.`
          : `Bonjour ${clientName},\n\nVotre signature ${of} ${documentNumber} par ${signerName} a bien été enregistrée. Vous trouverez le PDF signé en pièce jointe.`}
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
        Consulter {article} {noun} {signedAdjective}
      </Button>
    </EmailLayout>
  );
}
