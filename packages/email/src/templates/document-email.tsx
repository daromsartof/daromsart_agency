import { Button, Hr, Section, Text } from "@react-email/components";
import { formatEUR } from "@daromsart/core";
import { EmailLayout } from "./layout";
import type { DocumentEmailData } from "../types";

const KIND_LABEL: Record<DocumentEmailData["kind"], string> = {
  quote: "Devis",
  invoice: "Facture",
};

export interface DocumentEmailProps {
  data: DocumentEmailData;
}

/** Corps libre saisi par l'utilisateur (variables déjà résolues, story 10). */
function BodyParagraphs({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, index) => (
        <Text key={index} style={{ fontSize: "14px", color: "#1f1f29", margin: "0 0 12px" }}>
          {line || " "}
        </Text>
      ))}
    </>
  );
}

export function DocumentEmail({ data }: DocumentEmailProps) {
  const kindLabel = KIND_LABEL[data.kind];

  return (
    <EmailLayout
      previewText={`${kindLabel} ${data.number ?? ""} — ${formatEUR(data.totalCents)}`}
      accentColor={data.accentColor}
      organizationName={data.organizationName}
    >
      <BodyParagraphs text={data.bodyText} />

      <Section
        style={{
          backgroundColor: "#f4f4f5",
          borderRadius: "6px",
          padding: "16px",
          margin: "16px 0",
        }}
      >
        <Text style={{ fontSize: "12px", color: "#71717a", margin: "0 0 4px" }}>
          {kindLabel} {data.number ?? "(brouillon)"}
        </Text>
        <Text style={{ fontSize: "12px", color: "#71717a", margin: "0 0 4px" }}>
          Client : {data.clientName}
        </Text>
        <Text style={{ fontSize: "18px", fontWeight: "bold", color: "#1f1f29", margin: 0 }}>
          {formatEUR(data.totalCents)}
        </Text>
      </Section>

      <Button
        href={data.publicUrl}
        style={{
          backgroundColor: data.accentColor,
          color: "#ffffff",
          padding: "12px 20px",
          borderRadius: "6px",
          fontSize: "14px",
          fontWeight: "bold",
          textDecoration: "none",
        }}
      >
        {data.kind === "quote" ? "Consulter et signer le devis" : "Consulter la facture"}
      </Button>

      <Hr style={{ borderColor: "#e4e4e7", margin: "20px 0" }} />
      <Text style={{ fontSize: "11px", color: "#a1a1aa", margin: 0 }}>
        Si le bouton ne fonctionne pas, copiez ce lien : {data.publicUrl}
      </Text>
    </EmailLayout>
  );
}
