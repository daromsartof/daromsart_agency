import Link from "next/link";
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
import { db } from "@/db";
import { getCurrentOrganizationId, requireSession } from "@/modules/auth/session";
import { getQuoteById } from "@/modules/quotes/queries";

export const metadata = { title: "Devis" };

function formatDateLong(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Page détail minimale (E-11) : récapitulatif + bouton Modifier. Remplacée
 * par la story 08 (envoi, signature, PDF, historique des événements).
 */
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

  return (
    <>
      <PageHeader
        title={`Devis — ${quote.clientName}`}
        description={quote.number ?? "Brouillon (numéro attribué à l'envoi)"}
      >
        {quote.status === "draft" ? (
          <Button asChild size="sm">
            <Link href={`/devis/${quote.id}/modifier`}>Modifier</Link>
          </Button>
        ) : null}
      </PageHeader>

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
          <CardContent>
            {quote.issueDate
              ? formatDateLong(quote.issueDate)
              : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Valide jusqu'au
            </CardTitle>
          </CardHeader>
          <CardContent>
            {quote.validUntil
              ? formatDateLong(quote.validUntil)
              : "—"}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
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
    </>
  );
}
