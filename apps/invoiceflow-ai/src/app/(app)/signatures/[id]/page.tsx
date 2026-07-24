import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@daromsart/ui";
import { db } from "@/db";
import { getCurrentOrganizationId, requireSession } from "@/modules/auth/session";
import { getSignableDocumentById } from "@/modules/signable-documents/queries";
import { SignWorkspace } from "@/modules/signable-documents/components/sign-workspace";

function formatDateLong(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default async function SignableDocumentPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) {
    redirect("/");
  }

  const doc = await getSignableDocumentById(db, organizationId, params.id);
  if (!doc) {
    notFound();
  }

  const pdfUrl = `/api/signable-documents/${doc.id}/pdf${doc.signedAt ? "?variant=signed" : ""}`;

  return (
    <>
      <PageHeader
        back={
          <Button asChild variant="ghost" size="icon" aria-label="Retour aux signatures">
            <Link href="/signatures">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
        }
        title={doc.title}
        description={`${doc.pageCount} page${doc.pageCount > 1 ? "s" : ""}`}
      >
        {doc.signedAt ? <Badge variant="success">Signé</Badge> : <Badge variant="info">En attente</Badge>}
      </PageHeader>

      {doc.signedAt ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <iframe
                  title={doc.title}
                  src={pdfUrl}
                  className="h-[min(80vh,900px)] w-full bg-muted/30"
                />
              </CardContent>
            </Card>
          </div>
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Signature</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="font-medium">{doc.signerName}</p>
                <p className="text-muted-foreground">{formatDateLong(doc.signedAt)}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <SignWorkspace
          documentId={doc.id}
          pageCount={doc.pageCount}
          pdfUrl={pdfUrl}
          title={doc.title}
        />
      )}
    </>
  );
}
