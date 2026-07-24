import { notFound, redirect } from "next/navigation";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  formatCentsEUR,
  PageHeader,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@daromsart/ui";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { renderEmailVariables } from "@daromsart/core";
import { db } from "@/db";
import { env } from "@/lib/env";
import { storage } from "@/lib/storage";
import { getCurrentOrganizationId, requireSession } from "@/modules/auth/session";
import { listDocumentEvents } from "@/modules/documents/events";
import { EventTimeline } from "@/modules/documents/components/event-timeline";
import { QuoteDetailActions } from "@/modules/quotes/components/quote-detail-actions";
import { getQuoteById, getQuoteSignature } from "@/modules/quotes/queries";
import { getInvoiceById } from "@/modules/invoices/queries";
import { getClientById } from "@/modules/clients/queries";
import { getOrg } from "@/modules/organization/queries";
import { listEmailLogsForDocument } from "@/modules/emails/queries";
import { EmailLogList } from "@/modules/emails/components/email-log-list";

export const metadata = { title: "Devis" };

function formatDateLong(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function DevisDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) {
    redirect("/");
  }

  const quote = await getQuoteById(db, organizationId, params.id);
  if (!quote) {
    notFound();
  }

  const events = await listDocumentEvents(db, organizationId, "quote", quote.id);
  const publicUrl = quote.shareToken ? `${env.APP_URL}/p/devis/${quote.shareToken}` : null;
  const pdfUrl = `/api/documents/devis/${quote.id}/pdf`;

  const [client, org] = await Promise.all([
    getClientById(db, organizationId, quote.clientId),
    getOrg(),
  ]);
  const emailVars = {
    client: quote.clientName,
    numero: quote.number ?? undefined,
    total: formatCentsEUR(quote.totalCents),
    lien: publicUrl ?? undefined,
    echeance: quote.validUntil
      ? quote.validUntil.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : undefined,
  };
  const defaultSubject = renderEmailVariables(org.emailDefaults.quote.subject, emailVars);
  const defaultBody = renderEmailVariables(org.emailDefaults.quote.body, emailVars);

  const signature =
    quote.status === "signed" ? await getQuoteSignature(db, organizationId, quote.id) : null;
  const signatureImageUrl = signature ? await storage.getSignedUrl(signature.imageKey) : null;

  const linkedInvoice = quote.invoiceId
    ? await getInvoiceById(db, organizationId, quote.invoiceId)
    : null;

  const emailLogs = await listEmailLogsForDocument(db, organizationId, "quote", quote.id);
  const lastEmail = emailLogs[0] ?? null;

  return (
    <>
      <PageHeader
        back={
          <Button asChild variant="ghost" size="icon" aria-label="Retour aux devis">
            <Link href="/devis">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
        }
        title={quote.number ?? "Brouillon"}
        description={quote.clientName}
      >
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={quote.status} />
          <QuoteDetailActions
            quote={quote}
            publicUrl={publicUrl}
            defaultRecipient={client?.email ?? null}
            defaultSubject={defaultSubject}
            defaultBody={defaultBody}
          />
        </div>
      </PageHeader>

      {lastEmail && (lastEmail.status === "bounced" || lastEmail.status === "complained") ? (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          L&apos;adresse {lastEmail.to.join(", ")} semble invalide (email non délivré).
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <iframe
                title="Aperçu PDF du devis"
                src={pdfUrl}
                className="h-[min(80vh,900px)] w-full bg-muted/30"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lignes</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qté</TableHead>
                    <TableHead className="text-right">PU</TableHead>
                    <TableHead className="text-right">TVA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quote.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>{line.description}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {line.quantity}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCentsEUR(line.unitPriceCents)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {line.vatRate} %
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 ml-auto max-w-xs space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sous-total HT</span>
                  <span className="tabular-nums">{formatCentsEUR(quote.subtotalCents)}</span>
                </div>
                {quote.discountCents > 0 ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Remise</span>
                    <span className="tabular-nums">
                      -{formatCentsEUR(quote.discountCents)}
                    </span>
                  </div>
                ) : null}
                {Object.entries(quote.vatByRate).map(([rate, cents]) => (
                  <div key={rate} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">TVA {rate} %</span>
                    <span className="tabular-nums">{formatCentsEUR(cents)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-1 font-semibold">
                  <span>Total TTC</span>
                  <span className="tabular-nums">{formatCentsEUR(quote.totalCents)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {signature ? (
            <Card>
              <CardHeader>
                <CardTitle>Signature</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-4">
                {signatureImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data/signée, pas un asset Next Image.
                  <img
                    src={signatureImageUrl}
                    alt={`Signature de ${signature.name}`}
                    className="h-16 w-40 rounded border bg-white object-contain"
                  />
                ) : null}
                <div className="text-sm">
                  <p className="font-medium">{signature.name}</p>
                  {signature.email ? (
                    <p className="text-muted-foreground">{signature.email}</p>
                  ) : null}
                  <p className="text-muted-foreground">{formatDateLong(signature.signedAt)}</p>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Dates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Émission</span>
                <span>{formatDateLong(quote.issueDate)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Valide jusqu&apos;au</span>
                <span>{formatDateLong(quote.validUntil)}</span>
              </div>
              <div className="flex justify-between gap-4 border-t pt-3 font-semibold">
                <span>Total TTC</span>
                <span className="tabular-nums">{formatCentsEUR(quote.totalCents)}</span>
              </div>
            </CardContent>
          </Card>

          {linkedInvoice ? (
            <Card>
              <CardHeader>
                <CardTitle>Facturation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <Link
                    href={
                      linkedInvoice.status === "draft"
                        ? `/factures/${linkedInvoice.id}/modifier`
                        : `/factures/${linkedInvoice.id}`
                    }
                    className="font-medium hover:underline"
                  >
                    {linkedInvoice.number ?? "Brouillon"}
                  </Link>
                  <StatusBadge status={linkedInvoice.status} />
                </div>
                <p className="text-muted-foreground">
                  {formatCentsEUR(linkedInvoice.totalCents)}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Emails</CardTitle>
            </CardHeader>
            <CardContent>
              <EmailLogList logs={emailLogs} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activité</CardTitle>
            </CardHeader>
            <CardContent>
              <EventTimeline events={events} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
