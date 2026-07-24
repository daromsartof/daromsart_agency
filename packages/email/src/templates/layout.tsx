import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export interface EmailLayoutProps {
  previewText: string;
  accentColor: string;
  organizationName: string;
  children: React.ReactNode;
}

/** Layout brandé commun à tous les emails transactionnels de l'app. */
export function EmailLayout({
  previewText,
  accentColor,
  organizationName,
  children,
}: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: "#f4f4f5", fontFamily: "Helvetica, Arial, sans-serif" }}>
        <Container
          style={{
            margin: "0 auto",
            maxWidth: "560px",
            backgroundColor: "#ffffff",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          <Section style={{ backgroundColor: accentColor, padding: "20px 24px" }}>
            <Text style={{ color: "#ffffff", fontSize: "16px", fontWeight: "bold", margin: 0 }}>
              {organizationName}
            </Text>
          </Section>
          <Section style={{ padding: "24px" }}>{children}</Section>
          <Hr style={{ borderColor: "#e4e4e7", margin: 0 }} />
          <Section style={{ padding: "16px 24px" }}>
            <Text style={{ color: "#a1a1aa", fontSize: "11px", margin: 0 }}>
              Envoyé par {organizationName} via Daromsart Système.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
