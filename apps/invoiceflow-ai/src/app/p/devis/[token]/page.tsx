import { notFound } from "next/navigation";
import { isQuoteExpired } from "@daromsart/core";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  formatCentsEUR,
} from "@daromsart/ui";
import { db } from "@/db";
import { getQuoteByToken } from "@/modules/public/queries";
import { markViewed } from "@/modules/public/mutations";
import { SignDialog } from "@/modules/public/components/sign-dialog";
import { RefuseDialog } from "@/modules/public/components/refuse-dialog";

export const metadata = { title: "Votre devis" };

function formatDateLong(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default async function PublicQuotePage({
  params,
}: {
  params: { token: string };
}) {
  const quote = await getQuoteByToken(db, params.token);
  if (!quote) {
    notFound();
  }

  // Marquage "vu" (idempotent) — limite acceptée V1 : un préchargement de
  // lien par un client mail peut aussi déclencher ce marquage (plans/story-11.md).
  await markViewed(db, quote.id);

  const expired = isQuoteExpired(quote.validUntil);
  const signable = !expired && (quote.status === "sent" || quote.status === "viewed");
  const pdfUrl = `/api/p/devis/${params.token}/pdf`;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">{quote.organizationName}</p>
        <h1 className="text-2xl font-semibold">Devis {quote.number ?? ""}</h1>
        <p className="text-muted-foreground">Pour {quote.clientName}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Montant</CardTitle>
          <span className="text-xl font-semibold tabular-nums">
            {formatCentsEUR(quote.totalCents)}
          </span>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Valable jusqu'au</span>
            <span>{formatDateLong(quote.validUntil)}</span>
          </div>

          {quote.status === "signed" ? (
            <Badge variant="success">Signé</Badge>
          ) : quote.status === "refused" ? (
            <div className="space-y-1">
              <Badge variant="destructive">Refusé</Badge>
              {quote.refusalReason ? (
                <p className="text-sm text-muted-foreground">Motif : {quote.refusalReason}</p>
              ) : null}
            </div>
          ) : expired ? (
            <Badge variant="warning">Expiré</Badge>
          ) : quote.status === "viewed" ? (
            <Badge variant="default">Consulté</Badge>
          ) : (
            <Badge variant="info">En attente de votre réponse</Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aperçu</CardTitle>
        </CardHeader>
        <CardContent>
          <iframe title="Devis" src={pdfUrl} className="h-[600px] w-full rounded border" />
        </CardContent>
      </Card>

      {signable ? (
        <div className="sticky bottom-4 flex justify-center gap-3 rounded-lg border bg-background p-4 shadow-lg">
          <SignDialog token={params.token} defaultEmail={quote.clientEmail} />
          <RefuseDialog token={params.token} />
        </div>
      ) : null}
    </div>
  );
}
