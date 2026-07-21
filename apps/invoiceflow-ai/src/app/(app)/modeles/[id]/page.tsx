import { notFound, redirect } from "next/navigation";
import type { TemplateInput } from "@daromsart/core";
import { PageHeader } from "@daromsart/ui";
import { db } from "@/db";
import { getCurrentOrganizationId, requireSession } from "@/modules/auth/session";
import { getTemplateById } from "@/modules/templates/queries";
import { updateTemplateAction } from "@/modules/templates/actions";
import { TemplateEditor } from "@/modules/templates/components/template-editor";

export const metadata = { title: "Modifier le modèle" };

export default async function ModeleDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) {
    redirect("/");
  }

  const template = await getTemplateById(db, organizationId, params.id);
  if (!template) {
    notFound();
  }

  const defaultValues: TemplateInput = {
    name: template.name,
    type: template.type,
    options: template.options,
  };

  return (
    <>
      <PageHeader title={template.name} description="Options de rendu appliquées au PDF." />
      <TemplateEditor
        defaultValues={defaultValues}
        onSubmit={updateTemplateAction.bind(null, template.id)}
        redirectId={template.id}
      />
    </>
  );
}
