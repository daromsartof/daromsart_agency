"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, MoreHorizontal, Star, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
} from "@daromsart/ui";
import {
  deleteTemplateAction,
  duplicateTemplateAction,
  setDefaultTemplateAction,
} from "@/modules/templates/actions";
import type { TemplateRow } from "@/modules/templates/queries";
import { TemplateThumbnail } from "./template-thumbnail";

const TYPE_LABEL: Record<TemplateRow["type"], string> = {
  quote: "Devis",
  invoice: "Facture",
  both: "Devis + Facture",
};

export interface TemplatesGridProps {
  templates: TemplateRow[];
}

export function TemplatesGrid({ templates }: TemplatesGridProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<TemplateRow | null>(null);

  function handleSetDefault(template: TemplateRow) {
    startTransition(async () => {
      const result = await setDefaultTemplateAction(template.id);
      if (!result.ok) {
        toast.error(result.errors._root ?? "Échec de l'opération.");
        return;
      }
      toast.success(`« ${template.name} » défini par défaut.`);
      router.refresh();
    });
  }

  function handleDuplicate(template: TemplateRow) {
    startTransition(async () => {
      const result = await duplicateTemplateAction(template.id);
      if (!result.ok) {
        toast.error("Échec de la duplication.");
        return;
      }
      toast.success("Modèle dupliqué.");
      router.push(`/modeles/${result.id}`);
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    startTransition(async () => {
      const result = await deleteTemplateAction(target.id);
      if (!result.ok) {
        toast.error(result.errors._root ?? "Échec de la suppression.");
        return;
      }
      toast.success("Modèle supprimé.");
      router.refresh();
    });
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <Card key={template.id} data-testid={`template-card-${template.id}`}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div>
                <Link href={`/modeles/${template.id}`} className="font-medium hover:underline">
                  {template.name}
                </Link>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="secondary">{TYPE_LABEL[template.type]}</Badge>
                  {template.isDefault ? (
                    <Badge variant="default">
                      <Star className="mr-1 h-3 w-3" />
                      Défaut
                    </Badge>
                  ) : null}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Actions" disabled={pending}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {!template.isDefault ? (
                    <DropdownMenuItem onSelect={() => handleSetDefault(template)}>
                      <Star className="mr-2 h-4 w-4" />
                      Définir par défaut
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem onSelect={() => handleDuplicate(template)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Dupliquer
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setDeleteTarget(template)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent>
              <Link
                href={`/modeles/${template.id}`}
                className="block transition-opacity hover:opacity-90"
                aria-label={`Aperçu du modèle ${template.name}`}
              >
                <TemplateThumbnail options={template.options} />
              </Link>
            </CardContent>
            <CardFooter>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href={`/modeles/${template.id}`}>Modifier</Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Supprimer ce modèle ?"
        description={`« ${deleteTarget?.name} » sera définitivement supprimé (impossible s'il est utilisé par un document).`}
        confirmLabel="Supprimer"
        destructive
        onConfirm={confirmDelete}
      />
    </>
  );
}
