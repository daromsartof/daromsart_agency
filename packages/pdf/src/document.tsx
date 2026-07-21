import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatEUR } from "@daromsart/core";
import { registerFonts, PDF_FONT_FAMILY } from "./fonts";
import type { DocumentPdfInput, PdfAddress } from "./types";

registerFonts();

const KIND_LABEL: Record<DocumentPdfInput["meta"]["kind"], string> = {
  quote: "Devis",
  invoice: "Facture",
  credit_note: "Avoir",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 9,
    color: "#1f1f29",
    paddingTop: 28,
    paddingBottom: 48,
    paddingHorizontal: 32,
  },
  accentBand: {
    height: 6,
    marginHorizontal: -32,
    marginTop: -28,
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  logo: { width: 120, height: 48, objectFit: "contain" },
  docTitleBlock: { alignItems: "flex-end" },
  docKind: { fontSize: 18, fontWeight: "bold" },
  docNumber: { fontSize: 11, marginTop: 2, color: "#52525b" },
  partiesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  partyBlock: { width: "48%" },
  partyLabel: {
    fontSize: 8,
    textTransform: "uppercase",
    color: "#71717a",
    marginBottom: 4,
  },
  partyName: { fontSize: 11, fontWeight: "bold", marginBottom: 2 },
  partyLine: { fontSize: 9, color: "#3f3f46", lineHeight: 1.4 },
  metaRow: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#f4f4f5",
    borderRadius: 4,
  },
  metaItem: { flexDirection: "column" },
  metaLabel: { fontSize: 7, textTransform: "uppercase", color: "#71717a" },
  metaValue: { fontSize: 9, fontWeight: "bold", marginTop: 1 },
  title: { fontSize: 12, fontWeight: "bold", marginBottom: 6 },
  note: { fontSize: 9, color: "#3f3f46", marginBottom: 14, lineHeight: 1.4 },
  table: { marginBottom: 12 },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#d4d4d8",
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e4e4e7",
  },
  th: { fontSize: 7, textTransform: "uppercase", color: "#71717a" },
  colDescription: { flexGrow: 1, flexBasis: 0, paddingRight: 6 },
  colUnit: { width: 40, textAlign: "right" },
  colQty: { width: 45, textAlign: "right" },
  colUnitPrice: { width: 60, textAlign: "right" },
  colVat: { width: 40, textAlign: "right" },
  colDiscount: { width: 45, textAlign: "right" },
  colTotal: { width: 65, textAlign: "right" },
  totalsBlock: {
    alignSelf: "flex-end",
    width: 220,
    marginBottom: 16,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  totalsLabel: { color: "#52525b" },
  totalsGrandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#1f1f29",
    marginTop: 4,
    paddingTop: 4,
  },
  totalsGrandLabel: { fontSize: 11, fontWeight: "bold" },
  totalsGrandValue: { fontSize: 11, fontWeight: "bold" },
  footerNote: { fontSize: 8, color: "#52525b", marginBottom: 10, lineHeight: 1.4 },
  legalFooter: { fontSize: 7, color: "#71717a", lineHeight: 1.4 },
  qrRow: { flexDirection: "row", gap: 24, marginTop: 12, marginBottom: 12 },
  qrBlock: { alignItems: "center" },
  qrImage: { width: 72, height: 72 },
  qrLabel: { fontSize: 7, color: "#71717a", marginTop: 4, textAlign: "center" },
  signatureBlock: {
    marginTop: 16,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: "#e4e4e7",
  },
  signatureImage: { width: 160, height: 60, objectFit: "contain" },
  pageFooter: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#a1a1aa",
  },
});

function formatAddressLines(address: PdfAddress): string[] {
  const lines: string[] = [];
  if (address.street) lines.push(address.street);
  const cityLine = [address.zip, address.city].filter(Boolean).join(" ");
  if (cityLine) lines.push(cityLine);
  if (address.country && address.country !== "France") lines.push(address.country);
  return lines;
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatQuantity(qty: number): string {
  return qty.toLocaleString("fr-FR", { maximumFractionDigits: 3 });
}

function formatDiscount(discount: DocumentPdfInput["lines"][number]["discount"]): string {
  if (!discount) return "—";
  return discount.type === "percent" ? `${discount.value} %` : formatEUR(discount.value);
}

export function DocumentPdf({ data }: { data: DocumentPdfInput }) {
  const { organization, client, meta, lines, totals, template } = data;
  const kindLabel = KIND_LABEL[meta.kind];
  const dueLabel = meta.kind === "quote" ? "Valable jusqu'au" : "Échéance";

  return (
    <Document
      title={`${kindLabel} ${meta.number ?? "brouillon"}`}
      author={organization.legalName}
      producer="InvoiceFlow AI"
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={[styles.accentBand, { backgroundColor: template.accentColor }]} fixed />

        <View style={styles.headerRow}>
          {template.showLogo && organization.logoDataUrl ? (
            <Image src={organization.logoDataUrl} style={styles.logo} />
          ) : (
            <Text style={{ fontSize: 13, fontWeight: "bold" }}>
              {organization.tradeName ?? organization.legalName}
            </Text>
          )}
          <View style={styles.docTitleBlock}>
            <Text style={styles.docKind}>{kindLabel.toUpperCase()}</Text>
            <Text style={styles.docNumber}>{meta.number ?? "Brouillon"}</Text>
          </View>
        </View>

        <View style={styles.partiesRow}>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>Émetteur</Text>
            <Text style={styles.partyName}>{organization.legalName}</Text>
            {formatAddressLines(organization.address).map((line) => (
              <Text key={line} style={styles.partyLine}>
                {line}
              </Text>
            ))}
            {organization.siret ? (
              <Text style={styles.partyLine}>SIRET {organization.siret}</Text>
            ) : null}
            {organization.vatNumber ? (
              <Text style={styles.partyLine}>TVA {organization.vatNumber}</Text>
            ) : null}
            {organization.email ? (
              <Text style={styles.partyLine}>{organization.email}</Text>
            ) : null}
          </View>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>Destinataire</Text>
            <Text style={styles.partyName}>{client.displayName}</Text>
            {client.legalName && client.legalName !== client.displayName ? (
              <Text style={styles.partyLine}>{client.legalName}</Text>
            ) : null}
            {formatAddressLines(client.address).map((line) => (
              <Text key={line} style={styles.partyLine}>
                {line}
              </Text>
            ))}
            {client.siret ? <Text style={styles.partyLine}>SIRET {client.siret}</Text> : null}
            {client.vatNumber ? (
              <Text style={styles.partyLine}>TVA {client.vatNumber}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Date d'émission</Text>
            <Text style={styles.metaValue}>{formatDate(meta.issueDate)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>{dueLabel}</Text>
            <Text style={styles.metaValue}>{formatDate(meta.dueOrValidUntil)}</Text>
          </View>
        </View>

        {meta.title ? <Text style={styles.title}>{meta.title}</Text> : null}
        {data.introNote ? <Text style={styles.note}>{data.introNote}</Text> : null}

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colDescription]}>Description</Text>
            {template.columns.unit ? (
              <Text style={[styles.th, styles.colUnit]}>Unité</Text>
            ) : null}
            <Text style={[styles.th, styles.colQty]}>Qté</Text>
            <Text style={[styles.th, styles.colUnitPrice]}>PU HT</Text>
            {template.columns.discountPerLine ? (
              <Text style={[styles.th, styles.colDiscount]}>Remise</Text>
            ) : null}
            {template.columns.vatPerLine ? (
              <Text style={[styles.th, styles.colVat]}>TVA</Text>
            ) : null}
            <Text style={[styles.th, styles.colTotal]}>Total HT</Text>
          </View>
          {lines.map((line, index) => (
            <View key={index} style={styles.tableRow} wrap={false}>
              <Text style={styles.colDescription}>{line.description}</Text>
              {template.columns.unit ? (
                <Text style={styles.colUnit}>{line.unit ?? "—"}</Text>
              ) : null}
              <Text style={styles.colQty}>{formatQuantity(line.quantity)}</Text>
              <Text style={styles.colUnitPrice}>{formatEUR(line.unitPriceCents)}</Text>
              {template.columns.discountPerLine ? (
                <Text style={styles.colDiscount}>{formatDiscount(line.discount)}</Text>
              ) : null}
              {template.columns.vatPerLine ? (
                <Text style={styles.colVat}>{line.vatRate} %</Text>
              ) : null}
              <Text style={styles.colTotal}>{formatEUR(line.totalCents)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Sous-total HT</Text>
            <Text>{formatEUR(totals.subtotalCents)}</Text>
          </View>
          {totals.discountCents !== 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Remise globale</Text>
              <Text>-{formatEUR(totals.discountCents)}</Text>
            </View>
          ) : null}
          {Object.entries(totals.vatByRate).map(([rate, cents]) => (
            <View key={rate} style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>TVA {rate} %</Text>
              <Text>{formatEUR(cents)}</Text>
            </View>
          ))}
          <View style={styles.totalsGrandRow}>
            <Text style={styles.totalsGrandLabel}>Total TTC</Text>
            <Text style={styles.totalsGrandValue}>{formatEUR(totals.totalCents)}</Text>
          </View>
        </View>

        {data.footerNote ? <Text style={styles.footerNote}>{data.footerNote}</Text> : null}

        {data.qrCodes?.length ? (
          <View style={styles.qrRow}>
            {data.qrCodes.map((qr) => (
              <View key={qr.label} style={styles.qrBlock}>
                <Image src={qr.dataUrl} style={styles.qrImage} />
                <Text style={styles.qrLabel}>{qr.label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {meta.kind === "quote" ? (
          <View style={styles.signatureBlock} wrap={false}>
            {data.signature ? (
              <>
                <Text style={{ fontSize: 8, color: "#71717a", marginBottom: 4 }}>
                  Signé par {data.signature.name} le {formatDate(data.signature.signedAt)}
                </Text>
                <Image src={data.signature.imageDataUrl} style={styles.signatureImage} />
              </>
            ) : (
              <Text style={{ fontSize: 8, color: "#a1a1aa" }}>
                Bon pour accord — signature du client
              </Text>
            )}
          </View>
        ) : null}

        {data.legalFooter ? (
          <Text style={styles.legalFooter} fixed>
            {data.legalFooter}
          </Text>
        ) : null}

        <View style={styles.pageFooter} fixed>
          <Text>
            {organization.legalName}
            {data.publicUrl ? ` · ${data.publicUrl}` : ""}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
