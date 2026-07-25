"use client";

import { Loader2, MessageCircleQuestion } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@daromsart/ui";
import type {
  ClientsToolOutput,
  DashboardStatsOutput,
  InvoicesToolOutput,
  QuotesToolOutput,
} from "../tool-types";

/**
 * Un part d'outil tel qu'exposé à l'exécution par l'AI SDK. Le type statique
 * d'un `UIMessage` générique n'inclut PAS les parts d'outil (`tool-*`) — on
 * route donc à l'exécution sur `type` plutôt que sur les gardes typées du SDK.
 */
export interface RenderableToolPart {
  type: string;
  toolCallId: string;
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  toolName?: string;
}

/** `true` pour un part d'outil (statique `tool-*` ou dynamique). */
export function isRenderableToolPart(part: { type: string }): boolean {
  return part.type.startsWith("tool-") || part.type === "dynamic-tool";
}

function toolName(part: RenderableToolPart): string {
  if (part.type === "dynamic-tool") return part.toolName ?? "";
  return part.type.startsWith("tool-") ? part.type.slice("tool-".length) : part.type;
}

const TOOL_LOADING_LABEL: Record<string, string> = {
  listClients: "Recherche des clients…",
  listInvoices: "Recherche des factures…",
  listQuotes: "Recherche des devis…",
  getDashboardStats: "Lecture des indicateurs…",
};

export interface ToolPartProps {
  part: RenderableToolPart;
  onAnswer: (toolCallId: string, answer: string) => void;
  answerable: boolean;
}

export function ToolPart({ part, onAnswer, answerable }: ToolPartProps) {
  const name = toolName(part);

  if (name === "askUser") {
    return <AskUserCard part={part} onAnswer={onAnswer} answerable={answerable} />;
  }

  if (part.state === "input-streaming" || part.state === "input-available") {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {TOOL_LOADING_LABEL[name] ?? "Recherche…"}
      </div>
    );
  }
  if (part.state === "output-error") {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        Outil {name} : {part.errorText ?? "erreur"}
      </div>
    );
  }
  if (part.state === "output-available") {
    switch (name) {
      case "listClients":
        return <ClientsResult data={part.output as ClientsToolOutput} />;
      case "listInvoices":
        return <InvoicesResult data={part.output as InvoicesToolOutput} />;
      case "listQuotes":
        return <QuotesResult data={part.output as QuotesToolOutput} />;
      case "getDashboardStats":
        return <DashboardStatsResult data={part.output as DashboardStatsOutput} />;
      default:
        return null;
    }
  }
  return null;
}

function ResultCard({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <Card className="w-full max-w-xl overflow-hidden">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">
          {title} <span className="text-muted-foreground">· {count}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {count === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">Aucun résultat.</p>
        ) : (
          <div className="overflow-x-auto">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

function ClientsResult({ data }: { data: ClientsToolOutput }) {
  return (
    <ResultCard title="Clients" count={data.total}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Email</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.clients.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ResultCard>
  );
}

function InvoicesResult({ data }: { data: InvoicesToolOutput }) {
  return (
    <ResultCard title="Factures" count={data.total}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Numéro</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Reste dû</TableHead>
            <TableHead>Échéance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.invoices.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="font-medium">{i.number ?? "—"}</TableCell>
              <TableCell>{i.clientName}</TableCell>
              <TableCell>
                <Badge variant="outline">{i.status}</Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{i.total}</TableCell>
              <TableCell className="text-right tabular-nums">{i.reste}</TableCell>
              <TableCell className="text-muted-foreground">{i.echeance ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ResultCard>
  );
}

function QuotesResult({ data }: { data: QuotesToolOutput }) {
  return (
    <ResultCard title="Devis" count={data.total}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Numéro</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Validité</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.quotes.map((q) => (
            <TableRow key={q.id}>
              <TableCell className="font-medium">{q.number ?? "—"}</TableCell>
              <TableCell>{q.clientName}</TableCell>
              <TableCell>
                <Badge variant="outline">{q.status}</Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{q.total}</TableCell>
              <TableCell className="text-muted-foreground">{q.validite ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ResultCard>
  );
}

function StatTile({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cnTabular(muted)}>{value}</p>
    </div>
  );
}

function cnTabular(muted?: boolean): string {
  return `mt-0.5 font-heading text-lg tabular-nums ${muted ? "text-muted-foreground" : ""}`;
}

function DashboardStatsResult({ data }: { data: DashboardStatsOutput }) {
  return (
    <div className="grid w-full max-w-xl grid-cols-2 gap-3 sm:grid-cols-3">
      <StatTile label="Encaissé (mois)" value={data.encaisseMois} />
      <StatTile label="Encaissé (année)" value={data.encaisseAnnee} />
      <StatTile label="En attente" value={data.enAttente} />
      <StatTile
        label={`En retard (${data.enRetardCount})`}
        value={data.enRetard}
      />
    </div>
  );
}

function AskUserCard({
  part,
  onAnswer,
  answerable,
}: {
  part: RenderableToolPart;
  onAnswer: (toolCallId: string, answer: string) => void;
  answerable: boolean;
}) {
  const input = (part.input ?? {}) as { question?: string; options?: string[] };
  const answered = part.state === "output-available" ? String(part.output ?? "") : null;

  return (
    <Card className="w-full max-w-xl border-primary/30">
      <CardHeader className="flex flex-row items-start gap-2 py-3">
        <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <CardTitle className="text-sm font-medium">
          {input.question ?? "Question"}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {answered !== null ? (
          <p className="text-sm text-muted-foreground">
            Réponse : <span className="font-medium text-foreground">{answered}</span>
          </p>
        ) : input.options && input.options.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {input.options.map((opt) => (
              <Button
                key={opt}
                size="sm"
                variant="outline"
                disabled={!answerable}
                onClick={() => onAnswer(part.toolCallId, opt)}
              >
                {opt}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Répondez dans le champ de message ci-dessous.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
