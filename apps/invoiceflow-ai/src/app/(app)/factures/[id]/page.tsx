import { notFound, redirect } from "next/navigation";
import {
  Badge,
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
import { isOverdue, renderEmailVariables } from "@daromsart/core";
import { db } from "@/db";
import { env } from "@/lib/env";
import { getCurrentOrganizationId, getMembershipRole, requireSession } from "@/modules/auth/session";
import { listDocumentEvents } from "@/modules/documents/events";
import { EventTimeline } from "@/modules/documents/components/event-timeline";
import { InvoiceDetailActions } from "@/modules/invoices/components/invoice-detail-actions";
import { CreditNoteDetailActions } from "@/modules/invoices/components/credit-note-detail-actions";
import { PaymentCard } from "@/modules/invoices/components/payment-card";
import { getInvoiceById } from "@/modules/invoices/queries";
import { listPaymentsForInvoice } from "@/modules/invoices/payments";
import { listCreditNotesForParent } from "@/modules/invoices/credit-notes";
import { getQuoteById } from "@/modules/quotes/queries";
import { getClientById } from "@/modules/clients/queries";
import { getOrg } from "@/modules/organization/queries";

export const metadata = { title: "Facture" };

function formatDateLong(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function FactureDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) {
    redirect("/");
  }

  const invoice = await getInvoiceById(db, organizationId, params.id);
  if (!invoice) {
    notFound();
  }

  const events = await listDocumentEvents(db, organizationId, "invoice", invoice.id);
  const pdfUrl = `/api/documents/factures/${invoice.id}/pdf`;
  const iban = invoice.organizationSnapshot?.iban;
  const bic = invoice.organizationSnapshot?.bic;

  if (invoice.kind === "credit_note") {
    const parent = invoice.parentInvoiceId
      ? await getInvoiceById(db, organizationId, invoice.parentInvoiceId)
      : null;

    return (
      <>
        <PageHeader
          title={`Avoir — ${invoice.clientName}`}
          description={invoice.number ?? "Brouillon (numéro attribué à l'émission)"}
        >
          <CreditNoteDetailActions creditNote={invoice} />
        </PageHeader>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Statut</CardTitle>
                </CardHeader>
                <CardContent>
                  <StatusBadge status={invoice.status} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">
                    Date d'émission
                  </CardTitle>
                </CardHeader>
                <CardContent>{formatDateLong(invoice.issueDate)}</CardContent>
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
                    {invoice.lines.map((line) => (
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
                    <span className="tabular-nums">{formatCentsEUR(invoice.subtotalCents)}</span>
                  </div>
                  {Object.entries(invoice.vatByRate).map(([rate, cents]) => (
                    <div key={rate} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">TVA {rate} %</span>
                      <span className="tabular-nums">{formatCentsEUR(cents)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t pt-1 font-semibold">
                    <span>Total TTC</span>
                    <span className="tabular-nums">{formatCentsEUR(invoice.totalCents)}</span>
                  </div>
                </div>

                {iban ? (
                  <div className="mt-4 rounded bg-muted p-3 text-sm">
                    <p className="font-medium">Coordonnées bancaires</p>
                    <p className="text-muted-foreground">IBAN {iban}</p>
                    {bic ? <p className="text-muted-foreground">BIC {bic}</p> : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Aperçu PDF</CardTitle>
              </CardHeader>
              <CardContent>
                <iframe
                  title="Aperçu PDF de l'avoir"
                  src={pdfUrl}
                  className="h-[600px] w-full rounded border"
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Facture créditée</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {parent ? (
                  <div className="flex items-center justify-between">
                    <Link href={`/factures/${parent.id}`} className="font-medium hover:underline">
                      {parent.number ?? "Brouillon"}
                    </Link>
                    <StatusBadge status={parent.status} />
                  </div>
                ) : (
                  <p className="text-muted-foreground">Facture d'origine introuvable.</p>
                )}
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

  const creditNotes = await listCreditNotesForParent(db, organizationId, invoice.id);
  const cancelledByCreditNoteNumber =
    invoice.status === "cancelled"
      ? (events.find((e) => e.eventType === "cancelled")?.payload?.creditNoteNumber as
          | string
          | undefined) ?? null
      : null;
  const avoirsTotalCents = creditNotes
    .filter((c) => c.status !== "draft" && c.status !== "cancelled")
    .reduce((sum, c) => sum + Math.abs(c.totalCents), 0);

  const publicUrl = invoice.shareToken ? `${env.APP_URL}/p/factures/${invoice.shareToken}` : null;
  const [client, org, invoicePayments, role] = await Promise.all([
    getClientById(db, organizationId, invoice.clientId),
    getOrg(),
    listPaymentsForInvoice(db, invoice.id),
    getMembershipRole(session.user.id, organizationId),
  ]);
  const canRecordPayment = invoice.status !== "draft" && invoice.status !== "cancelled";
  const emailVars = {
    client: invoice.clientName,
    numero: invoice.number ?? undefined,
    total: formatCentsEUR(invoice.totalCents),
    lien: publicUrl ?? undefined,
    echeance: invoice.dueDate
      ? invoice.dueDate.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : undefined,
  };
  const defaultSubject = renderEmailVariables(org.emailDefaults.invoice.subject, emailVars);
  const defaultBody = renderEmailVariables(org.emailDefaults.invoice.body, emailVars);

  const now = new Date();
  const overdue = isOverdue(
    {
      status: invoice.status,
      dueDate: invoice.dueDate,
      totalCents: invoice.totalCents,
      amountPaidCents: invoice.amountPaidCents,
    },
    now,
  );
  const daysOverdue = invoice.dueDate
    ? Math.max(0, Math.floor((now.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const reminderVars = { ...emailVars, jours_retard: String(daysOverdue) };
  const defaultReminderSubject = renderEmailVariables(
    org.emailDefaults.reminder.subject,
    reminderVars,
  );
  const defaultReminderBody = renderEmailVariables(org.emailDefaults.reminder.body, reminderVars);

  const originQuote = invoice.quoteId
    ? await getQuoteById(db, organizationId, invoice.quoteId)
    : null;

  return (
    <>
      <PageHeader
        title={`Facture — ${invoice.clientName}`}
        description={invoice.number ?? "Brouillon (numéro attribué à l'émission)"}
      >
        <InvoiceDetailActions
          invoice={invoice}
          publicUrl={publicUrl}
          defaultRecipient={client?.email ?? null}
          defaultSubject={defaultSubject}
          defaultBody={defaultBody}
          overdue={overdue}
          daysOverdue={daysOverdue}
          remainingCents={invoice.totalCents - invoice.amountPaidCents}
          defaultReminderSubject={defaultReminderSubject}
          defaultReminderBody={defaultReminderBody}
        />
      </PageHeader>

      {invoice.status === "cancelled" && cancelledByCreditNoteNumber ? (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          Annulée par l'avoir {cancelledByCreditNoteNumber}.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Statut</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusBadge status={invoice.status} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">
                  Date d'émission
                </CardTitle>
              </CardHeader>
              <CardContent>{formatDateLong(invoice.issueDate)}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">
                  Date d'échéance
                </CardTitle>
              </CardHeader>
              <CardContent>{formatDateLong(invoice.dueDate)}</CardContent>
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
                  {invoice.lines.map((line) => (
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
                  <span className="tabular-nums">{formatCentsEUR(invoice.subtotalCents)}</span>
                </div>
                {invoice.discountCents > 0 ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Remise</span>
                    <span className="tabular-nums">
                      -{formatCentsEUR(invoice.discountCents)}
                    </span>
                  </div>
                ) : null}
                {Object.entries(invoice.vatByRate).map(([rate, cents]) => (
                  <div key={rate} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">TVA {rate} %</span>
                    <span className="tabular-nums">{formatCentsEUR(cents)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-1 font-semibold">
                  <span>Total TTC</span>
                  <span className="tabular-nums">{formatCentsEUR(invoice.totalCents)}</span>
                </div>
              </div>

              {iban ? (
                <div className="mt-4 rounded bg-muted p-3 text-sm">
                  <p className="font-medium">Coordonnées bancaires</p>
                  <p className="text-muted-foreground">IBAN {iban}</p>
                  {bic ? <p className="text-muted-foreground">BIC {bic}</p> : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <PaymentCard
            invoiceId={invoice.id}
            totalCents={invoice.totalCents}
            amountPaidCents={invoice.amountPaidCents}
            payments={invoicePayments}
            isAdmin={role === "admin"}
            canRecord={canRecordPayment}
          />

          <Card>
            <CardHeader>
              <CardTitle>Aperçu PDF</CardTitle>
            </CardHeader>
            <CardContent>
              <iframe
                title="Aperçu PDF de la facture"
                src={pdfUrl}
                className="h-[600px] w-full rounded border"
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {originQuote ? (
            <Card>
              <CardHeader>
                <CardTitle>Origine</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">Créée depuis le devis</p>
                <div className="flex items-center justify-between">
                  <Link
                    href={
                      originQuote.status === "draft"
                        ? `/devis/${originQuote.id}/modifier`
                        : `/devis/${originQuote.id}`
                    }
                    className="font-medium hover:underline"
                  >
                    {originQuote.number ?? "Brouillon"}
                  </Link>
                  <StatusBadge status={originQuote.status} />
                </div>
              </CardContent>
            </Card>
          ) : null}

          {creditNotes.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Avoirs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between font-medium">
                  <span>Total avoiré</span>
                  <span className="tabular-nums">{formatCentsEUR(avoirsTotalCents)}</span>
                </div>
                <div className="space-y-2">
                  {creditNotes.map((creditNote) => (
                    <div key={creditNote.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/factures/${creditNote.id}`}
                          className="font-medium hover:underline"
                        >
                          {creditNote.number ?? "Brouillon"}
                        </Link>
                        <Badge variant="outline">Avoir</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums text-muted-foreground">
                          {formatCentsEUR(creditNote.totalCents)}
                        </span>
                        <StatusBadge status={creditNote.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

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
