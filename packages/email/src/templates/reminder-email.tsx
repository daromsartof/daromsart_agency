import { Button, Section, Text } from "@react-email/components";
import { formatEUR } from "@daromsart/core";
import { EmailLayout } from "./layout";
import type { ReminderEmailData } from "../types";

/** Corps libre saisi par l'utilisateur (variables déjà résolues, story 10/16). */
function BodyParagraphs({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, index) => (
        <Text key={index} style={{ fontSize: "14px", color: "#1f1f29", margin: "0 0 12px" }}>
          {line || " "}
        </Text>
      ))}
    </>
  );
}

/** Email de relance (E-30, story 16) : jours de retard, reste dû, CTA lien public, PDF joint. */
export function ReminderEmail({ data }: { data: ReminderEmailData }) {
  return (
    <EmailLayout
      previewText={`Relance — facture ${data.number} (${data.daysOverdue} j de retard)`}
      accentColor={data.accentColor}
      organizationName={data.organizationName}
    >
      <BodyParagraphs text={data.bodyText} />

      <Section
        style={{
          backgroundColor: "#FAEEDA",
          borderRadius: "6px",
          padding: "16px",
          margin: "16px 0",
        }}
      >
        <Text style={{ fontSize: "12px", color: "#854F0B", margin: "0 0 4px", fontWeight: "bold" }}>
          Facture {data.number} — en retard de {data.daysOverdue} jour{data.daysOverdue > 1 ? "s" : ""}
        </Text>
        <Text style={{ fontSize: "12px", color: "#71717a", margin: "0 0 4px" }}>
          Client : {data.clientName}
        </Text>
        <Text style={{ fontSize: "18px", fontWeight: "bold", color: "#1f1f29", margin: 0 }}>
          Reste dû : {formatEUR(data.remainingCents)}
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
        Consulter et régler la facture
      </Button>
    </EmailLayout>
  );
}
