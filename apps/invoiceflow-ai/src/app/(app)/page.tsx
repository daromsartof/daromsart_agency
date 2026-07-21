import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  FileText,
  LayoutDashboard,
  Wallet,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  StatCard,
  StatusBadge,
  formatCentsEUR,
} from "@daromsart/ui";
import type { QuoteStatus } from "@daromsart/core";
import { db } from "@/db";
import { getCurrentOrganizationId, requireSession } from "@/modules/auth/session";
import { EventTimeline } from "@/modules/documents/components/event-timeline";
import { CaChart } from "@/modules/dashboard/components/ca-chart";
import {
  getActiviteRecente,
  getCaParMois,
  getCashflowStats,
  getDerniersDevis,
  getDevisEnCoursStats,
  getEncoursStats,
  getFacturesEnRetard,
  hasAnyDocument,
} from "@/modules/dashboard/queries";

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export default async function DashboardPage() {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) {
    return (
      <>
        <PageHeader
          title="Dashboard"
          description="Vue d'ensemble de votre activité de facturation."
        />
        <EmptyState
          icon={LayoutDashboard}
          title="Aucune organisation"
          description="Contactez un administrateur pour rejoindre une organisation."
        />
      </>
    );
  }

  const hasDocuments = await hasAnyDocument(db, organizationId);
  if (!hasDocuments) {
    return (
      <>
        <PageHeader
          title="Dashboard"
          description="Vue d'ensemble de votre activité de facturation."
        />
        <EmptyState
          icon={LayoutDashboard}
          title="Aucun document pour l'instant"
          description="Créez votre premier devis pour commencer à suivre votre activité."
          action={
            <Button asChild>
              <Link href="/devis/nouveau">Créer mon premier devis</Link>
            </Button>
          }
        />
      </>
    );
  }

  const [cashflow, encours, devisEnCours, caParMois, facturesEnRetard, derniersDevis, activite] =
    await Promise.all([
      getCashflowStats(db, organizationId),
      getEncoursStats(db, organizationId),
      getDevisEnCoursStats(db, organizationId),
      getCaParMois(db, organizationId),
      getFacturesEnRetard(db, organizationId),
      getDerniersDevis(db, organizationId),
      getActiviteRecente(db, organizationId),
    ]);

  const activiteEvents = activite.map((event) => ({
    id: event.id,
    eventType: event.eventType,
    createdAt: event.createdAt,
    payload: null,
    actorUserId: null,
    label: event.label,
    href: event.href,
  }));

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Vue d'ensemble de votre activité de facturation."
      />

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Encaissé (année)"
            value={formatCentsEUR(cashflow.encaisseAnneeCents)}
            icon={Wallet}
            tone="success"
            trend={
              cashflow.variationPercent !== null
                ? {
                    label: `${cashflow.variationPercent >= 0 ? "+" : ""}${cashflow.variationPercent} % vs année précédente`,
                    positive: cashflow.variationPercent >= 0,
                  }
                : undefined
            }
          />
          <StatCard
            label="En attente"
            value={formatCentsEUR(encours.enAttenteCents)}
            icon={Clock}
            tone="info"
          />
          <StatCard
            label="En retard"
            value={formatCentsEUR(encours.enRetardCents)}
            icon={AlertTriangle}
            tone={encours.enRetardCount > 0 ? "warning" : "default"}
            trend={
              encours.enRetardCount > 0
                ? {
                    label: `${encours.enRetardCount} facture${encours.enRetardCount > 1 ? "s" : ""}`,
                    positive: false,
                  }
                : undefined
            }
          />
          <StatCard
            label="Devis en cours"
            value={formatCentsEUR(devisEnCours.totalCents)}
            icon={FileText}
            tone="default"
            trend={
              devisEnCours.count > 0
                ? { label: `${devisEnCours.count} devis`, positive: true }
                : undefined
            }
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Chiffre d'affaires (12 derniers mois)</CardTitle>
          </CardHeader>
          <CardContent>
            <CaChart data={caParMois} />
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Factures en retard</CardTitle>
            </CardHeader>
            <CardContent>
              {facturesEnRetard.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune facture en retard.</p>
              ) : (
                <ul className="space-y-3">
                  {facturesEnRetard.map((invoice) => (
                    <li key={invoice.id} className="flex items-center justify-between text-sm">
                      <div>
                        <Link
                          href={`/factures/${invoice.id}`}
                          className="font-medium hover:underline"
                        >
                          {invoice.number ?? "Brouillon"}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {invoice.clientName} — {invoice.daysOverdue} j de retard
                        </p>
                      </div>
                      <span className="tabular-nums">{formatCentsEUR(invoice.remainingCents)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Derniers devis</CardTitle>
            </CardHeader>
            <CardContent>
              {derniersDevis.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun devis pour l'instant.</p>
              ) : (
                <ul className="space-y-3">
                  {derniersDevis.map((quote) => (
                    <li key={quote.id} className="flex items-center justify-between text-sm">
                      <div>
                        <Link
                          href={
                            quote.status === "draft"
                              ? `/devis/${quote.id}/modifier`
                              : `/devis/${quote.id}`
                          }
                          className="font-medium hover:underline"
                        >
                          {quote.number ?? "Brouillon"}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {quote.clientName} — {formatDateShort(quote.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums">{formatCentsEUR(quote.totalCents)}</span>
                        <StatusBadge status={quote.status as QuoteStatus} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activité récente</CardTitle>
            </CardHeader>
            <CardContent>
              <EventTimeline events={activiteEvents} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
