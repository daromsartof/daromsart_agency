import { FileSignature } from "lucide-react";
import { EmptyState, PageHeader } from "@daromsart/ui";
import { db } from "@/db";
import { getCurrentOrganizationId, requireSession } from "@/modules/auth/session";
import { listSignableDocuments } from "@/modules/signable-documents/queries";
import { SignableDocumentsList } from "@/modules/signable-documents/components/signable-documents-list";
import { UploadButton } from "@/modules/signable-documents/components/upload-button";

export const metadata = { title: "Signatures" };

export default async function SignaturesPage() {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  const documents = organizationId ? await listSignableDocuments(db, organizationId) : [];

  return (
    <>
      <PageHeader
        title="Signatures"
        description="Importez un PDF quelconque et apposez-y votre signature manuscrite."
      >
        <UploadButton />
      </PageHeader>

      {documents.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          title="Aucun document"
          description="Importez un PDF pour commencer."
        />
      ) : (
        <SignableDocumentsList documents={documents} />
      )}
    </>
  );
}
