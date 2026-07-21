import { notFound, redirect } from "next/navigation";
import {
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
import { renderEmailVariables } from "@daromsart/core";
import { db } from "@/db";
import { env } from "@/lib/env";
import { getCurrentOrganizationId, requireSession } from "@/modules/auth/session";
import { listDocumentEvents } from "@/modules/documents/events";
import { EventTimeline } from "@/modules/documents/components/event-timeline";
import { QuoteDetailActions } from "@/modules/quotes/components/quote-detail-actions";
import { getQuoteById } from "@/modules/quotes/queries";
import { getClientById } from "@/modules/clients/queries";
import { getOrg } from "@/modules/organization/queries";

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

  return (
    <>
      <PageHeader
        title={`Devis — ${quote.clientName}`}
        description={quote.number ?? "Brouillon (numéro attribué à l'émission)"}
      >
        <QuoteDetailActions
          quote={quote}
          publicUrl={publicUrl}
          defaultRecipient={client?.email ?? null}
          defaultSubject={defaultSubject}
          defaultBody={defaultBody}
        />
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Statut</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusBadge status={quote.status} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">
                  Date d'émission
                </CardTitle>
              </CardHeader>
              <CardContent>{formatDateLong(quote.issueDate)}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">
                  Valide jusqu'au
                </CardTitle>
              </CardHeader>
              <CardContent>{formatDateLong(quote.validUntil)}</CardContent>
            </Card>
          </div>

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

          <Card>
            <CardHeader>
              <CardTitle>Aperçu PDF</CardTitle>
            </CardHeader>
            <CardContent>
              <iframe
                title="Aperçu PDF du devis"
                src={pdfUrl}
                className="h-[600px] w-full rounded border"
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Activité</CardTitle>
          </CardHeader>
          <CardContent>
            <EventTimeline events={events} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
