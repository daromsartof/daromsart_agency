import { notFound } from "next/navigation";
import { isOverdue } from "@daromsart/core";
import { epcQrPayload, qrPngDataUrl } from "@daromsart/qr";
import { Badge, Card, CardContent, CardHeader, CardTitle, formatCentsEUR } from "@daromsart/ui";
import { db } from "@/db";
import { getInvoiceByToken } from "@/modules/public/queries";
import { markInvoiceViewed } from "@/modules/public/mutations";
import { CopyButton } from "@/modules/public/components/copy-button";
import { SignDialog } from "@/modules/public/components/sign-dialog";

export const metadata = { title: "Votre facture" };
// Le "reste dû" (et donc l'amount encodé dans le QR EPC) doit toujours
// refléter l'état courant de la facture, jamais un rendu mis en cache
// (plans/story-14.md).
export const dynamic = "force-dynamic";

function formatDateLong(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default async function PublicInvoicePage({
  params,
}: {
  params: { token: string };
}) {
  const invoice = await getInvoiceByToken(db, params.token);
  if (!invoice) {
    notFound();
  }

  // Marquage "vue" (idempotent, cf. `markViewed` pour les devis, story 11) —
  // même limite acceptée V1 : un préchargement de lien peut le déclencher.
  await markInvoiceViewed(db, invoice.id);

  const remainingCents = invoice.totalCents - invoice.amountPaidCents;
  const paid = remainingCents <= 0;
  const overdue = isOverdue({
    status: invoice.status,
    dueDate: invoice.dueDate,
    totalCents: invoice.totalCents,
    amountPaidCents: invoice.amountPaidCents,
  });
  const pdfUrl = `/api/p/factures/${params.token}/pdf`;
  const signable = invoice.status !== "draft" && invoice.status !== "cancelled" && !invoice.signedAt;

  const showPaymentBlock = !paid && invoice.status !== "cancelled" && Boolean(invoice.iban);
  let qrDataUrl: string | null = null;
  if (showPaymentBlock && invoice.iban) {
    const payload = epcQrPayload({
      name: invoice.organizationName,
      iban: invoice.iban,
      bic: invoice.bic,
      amountCents: remainingCents,
      remittance: invoice.number,
    });
    if (payload) {
      qrDataUrl = await qrPngDataUrl(payload);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">{invoice.organizationName}</p>
        <h1 className="text-2xl font-semibold">Facture {invoice.number ?? ""}</h1>
        <p className="text-muted-foreground">Pour {invoice.clientName}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Montant</CardTitle>
          <span className="text-xl font-semibold tabular-nums">
            {formatCentsEUR(invoice.totalCents)}
          </span>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Échéance</span>
            <span>{formatDateLong(invoice.dueDate)}</span>
          </div>
          {!paid ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Reste dû</span>
              <span className="font-medium tabular-nums">
                {formatCentsEUR(remainingCents)}
              </span>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {paid ? (
              <Badge variant="success">Réglée</Badge>
            ) : invoice.status === "cancelled" ? (
              <Badge variant="destructive">Annulée</Badge>
            ) : overdue ? (
              <Badge variant="warning">En retard</Badge>
            ) : invoice.status === "viewed" ? (
              <Badge variant="default">Consultée</Badge>
            ) : (
              <Badge variant="info">En attente de règlement</Badge>
            )}
            {invoice.signedAt ? <Badge variant="success">Signée</Badge> : null}
          </div>
        </CardContent>
      </Card>

      {paid ? (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="py-4 text-center text-sm font-medium text-success">
            Cette facture a été réglée intégralement. Merci !
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Aperçu</CardTitle>
        </CardHeader>
        <CardContent>
          <iframe title="Facture" src={pdfUrl} className="h-[600px] w-full rounded border" />
        </CardContent>
      </Card>

      {showPaymentBlock ? (
        <Card>
          <CardHeader>
            <CardTitle>Régler par virement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">IBAN</p>
                <p className="font-mono text-sm">{invoice.iban}</p>
              </div>
              <CopyButton value={invoice.iban ?? ""} label="Copier l'IBAN" />
            </div>
            {invoice.bic ? (
              <div>
                <p className="text-xs text-muted-foreground">BIC</p>
                <p className="font-mono text-sm">{invoice.bic}</p>
              </div>
            ) : null}
            <div>
              <p className="text-xs text-muted-foreground">Référence à indiquer</p>
              <p className="font-mono text-sm">{invoice.number}</p>
            </div>
            {qrDataUrl ? (
              <div className="flex flex-col items-center gap-2 pt-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL générée, pas un asset Next Image. */}
                <img src={qrDataUrl} alt="QR code de paiement SEPA" className="h-32 w-32" />
                <p className="text-xs text-muted-foreground">
                  Scannez avec votre application bancaire pour pré-remplir le virement.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {signable ? (
        <div className="sticky bottom-4 flex justify-center rounded-lg border bg-background p-4 shadow-lg">
          <SignDialog token={params.token} kind="invoice" defaultEmail={invoice.clientEmail} />
        </div>
      ) : null}
    </div>
  );
}
