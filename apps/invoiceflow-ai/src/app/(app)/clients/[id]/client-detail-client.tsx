"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CreditCard, FileText, Receipt, Wallet } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  StatCard,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  formatCentsEUR,
} from "@daromsart/ui";
import { ClientHeader } from "@/modules/clients/components/client-header";
import type { ClientStats, ClientWithContacts } from "@/modules/clients/queries";
import type { QuoteRow } from "@/modules/quotes/queries";
import {
  ClientSheet,
  type ClientSheetState,
} from "../client-sheet";

export interface ClientDetailClientProps {
  client: ClientWithContacts;
  stats: ClientStats;
  quotes: QuoteRow[];
}

const TABS = ["informations", "activite", "devis", "factures"] as const;
type Tab = (typeof TABS)[number];

export function ClientDetailClient({ client, stats, quotes }: ClientDetailClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sheet, setSheet] = useState<ClientSheetState>({ mode: "closed" });

  const rawTab = searchParams.get("tab");
  const tab: Tab = (TABS as readonly string[]).includes(rawTab ?? "")
    ? (rawTab as Tab)
    : "informations";

  const setTab = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="space-y-6">
      <ClientHeader client={client} onEdit={() => setSheet({ mode: "edit", clientId: client.id })} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="CA facturé"
          value={formatCentsEUR(stats.caFactureCents)}
          icon={Wallet}
        />
        <StatCard
          label="Encours"
          value={formatCentsEUR(stats.encoursCents)}
          icon={CreditCard}
        />
        <StatCard
          label="En retard"
          value={formatCentsEUR(stats.retardCents)}
          icon={Receipt}
          tone={stats.retardCents > 0 ? "warning" : "default"}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="informations">Informations</TabsTrigger>
          <TabsTrigger value="activite">Activité</TabsTrigger>
          <TabsTrigger value="devis">Devis</TabsTrigger>
          <TabsTrigger value="factures">Factures</TabsTrigger>
        </TabsList>

        <TabsContent value="informations" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Coordonnées</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Email" value={client.email} />
                <Row label="Téléphone" value={client.phone} />
                <Row
                  label="Adresse"
                  value={
                    client.addressStreet || client.addressCity
                      ? [client.addressStreet, client.addressZip, client.addressCity]
                          .filter(Boolean)
                          .join(" ")
                      : null
                  }
                />
                <Row label="Pays" value={client.addressCountry} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fiscal &amp; facturation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Nom légal" value={client.legalName} />
                <Row label="SIRET" value={client.siret} />
                <Row label="N° TVA" value={client.vatNumber} />
                <Row
                  label="Délai de paiement"
                  value={
                    client.paymentTermsDays
                      ? `${client.paymentTermsDays} jours`
                      : null
                  }
                />
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contacts</CardTitle>
            </CardHeader>
            <CardContent>
              {client.contacts.length ? (
                <ul className="divide-y">
                  {client.contacts.map((contact) => (
                    <li key={contact.id} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <p className="font-medium">{contact.name}</p>
                        <p className="text-muted-foreground">
                          {[contact.role, contact.email, contact.phone]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun contact.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activite">
          <EmptyState title="Aucune activité" description="L'historique des événements apparaîtra ici." />
        </TabsContent>

        <TabsContent value="devis">
          {quotes.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Total TTC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell>
                      <Link
                        href={
                          quote.status === "draft"
                            ? `/devis/${quote.id}/modifier`
                            : `/devis/${quote.id}`
                        }
                        className="hover:underline"
                      >
                        {quote.number ?? "Brouillon"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={quote.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCentsEUR(quote.totalCents)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={FileText}
              title="Aucun devis"
              description="Les devis créés pour ce client apparaîtront ici."
            />
          )}
        </TabsContent>

        <TabsContent value="factures">
          <EmptyState
            icon={Receipt}
            title="Disponible prochainement"
            description="La liste des factures de ce client s'affichera ici."
          />
        </TabsContent>
      </Tabs>

      <ClientSheet
        state={sheet}
        onClose={() => setSheet({ mode: "closed" })}
        onSaved={() => {
          setSheet({ mode: "closed" });
          router.refresh();
        }}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}
