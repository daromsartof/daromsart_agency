import Link from "next/link";
import {
  AlertTriangle,
  Clock,
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
  formatCentsEUR,
} from "@daromsart/ui";
import { db } from "@/db";
import { getCurrentOrganizationId, requireSession } from "@/modules/auth/session";
import { AgingChart } from "@/modules/dashboard/components/aging-chart";
import { OverdueInvoicesList } from "@/modules/dashboard/components/overdue-invoices-list";
import { RecentActivityList } from "@/modules/dashboard/components/recent-activity-list";
import { RecentQuotesList } from "@/modules/dashboard/components/recent-quotes-list";
import { SalesChartCard } from "@/modules/dashboard/components/sales-chart-card";
import { SecondaryKpis } from "@/modules/dashboard/components/secondary-kpis";
import { TopClientsList } from "@/modules/dashboard/components/top-clients-list";
import {
  getActiviteRecente,
  getAgingBuckets,
  getCaVsEncaisseParMois,
  getCashflowStats,
  getConversionStats,
  getDerniersDevis,
  getEncoursStats,
  getFacturesEnRetard,
  getTopClients,
  hasAnyDocument,
} from "@/modules/dashboard/queries";

export default async function DashboardPage() {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) {
    return (
      <>
        <PageHeader
          title="Dashboard"
          description="Vue d'ensemble de votre activité commerciale et de trésorerie."
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
          description="Vue d'ensemble de votre activité commerciale et de trésorerie."
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

  const [
    cashflow,
    encours,
    caVsEncaisse,
    aging,
    conversion,
    topClients,
    facturesEnRetard,
    derniersDevis,
    activite,
  ] = await Promise.all([
    getCashflowStats(db, organizationId),
    getEncoursStats(db, organizationId),
    getCaVsEncaisseParMois(db, organizationId, 12),
    getAgingBuckets(db, organizationId),
    getConversionStats(db, organizationId),
    getTopClients(db, organizationId, 5),
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

  const overdueTotalCents = facturesEnRetard.reduce((sum, inv) => sum + inv.remainingCents, 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visibilité de vente et trésorerie en un coup d'œil."
      />

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Encaissé (mois)"
            value={formatCentsEUR(cashflow.encaisseMoisCents)}
            icon={Wallet}
            tone="success"
            trend={
              cashflow.variationMoisPercent !== null
                ? {
                    label: `${cashflow.variationMoisPercent >= 0 ? "+" : ""}${cashflow.variationMoisPercent} % vs mois précédent`,
                    positive: cashflow.variationMoisPercent >= 0,
                  }
                : undefined
            }
          />
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
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SalesChartCard data={caVsEncaisse} />
          </div>
          <SecondaryKpis stats={conversion} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Ancienneté des retards</CardTitle>
              <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
                <Link href="/factures">Voir tout</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <AgingChart buckets={aging} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Top clients</CardTitle>
              <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
                <Link href="/clients">Voir tout</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <TopClientsList clients={topClients} />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 border-b bg-warning/5 pb-4">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-warning/15 text-warning">
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </span>
                  Factures en retard
                </CardTitle>
                {facturesEnRetard.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {facturesEnRetard.length} affichée
                    {facturesEnRetard.length > 1 ? "s" : ""} ·{" "}
                    <span className="font-medium text-foreground">
                      {formatCentsEUR(overdueTotalCents)}
                    </span>
                  </p>
                ) : null}
              </div>
              <Button asChild variant="ghost" size="sm" className="h-8 shrink-0 text-xs">
                <Link href="/factures">Voir tout</Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-3">
              <OverdueInvoicesList invoices={facturesEnRetard} />
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b pb-4">
              <CardTitle>Derniers devis</CardTitle>
              <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
                <Link href="/devis">Voir tout</Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-3">
              <RecentQuotesList quotes={derniersDevis} />
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b pb-4">
              <CardTitle>Activité récente</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <RecentActivityList events={activiteEvents} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
