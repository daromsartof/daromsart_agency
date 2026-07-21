import Link from "next/link";
import { LayoutTemplate, Plus } from "lucide-react";
import { Button, EmptyState, PageHeader } from "@daromsart/ui";
import { db } from "@/db";
import { getCurrentOrganizationId, requireSession } from "@/modules/auth/session";
import { listTemplates } from "@/modules/templates/queries";
import { TemplatesGrid } from "@/modules/templates/components/templates-grid";

export const metadata = { title: "Modèles" };

export default async function ModelesPage() {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  const templates = organizationId ? await listTemplates(db, organizationId) : [];

  return (
    <>
      <PageHeader
        title="Modèles"
        description="Personnalisez la mise en page de vos devis et factures."
      >
        <Button asChild size="sm">
          <Link href="/modeles/nouveau">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau modèle
          </Link>
        </Button>
      </PageHeader>

      {templates.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title="Aucun modèle"
          description="Créez votre premier modèle pour personnaliser vos documents."
        />
      ) : (
        <TemplatesGrid templates={templates} />
      )}
    </>
  );
}
