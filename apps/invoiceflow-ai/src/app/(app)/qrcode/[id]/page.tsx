import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button, PageHeader } from "@daromsart/ui";
import { db } from "@/db";
import { getCurrentOrganizationId, requireSession } from "@/modules/auth/session";
import { getQrCodeById } from "@/modules/qr-generator/queries";
import { SavedQrDetail } from "@/modules/qr-generator/saved-qr-detail";
import { QR_TYPE_META } from "@/modules/qr-generator/types";

export const metadata = { title: "QR Code" };

export default async function QrCodeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  if (!organizationId) notFound();

  const item = await getQrCodeById(db, organizationId, params.id);
  if (!item) notFound();

  const typeLabel =
    QR_TYPE_META.find((t) => t.id === item.contentType)?.label ?? item.contentType;

  return (
    <>
      <PageHeader
        title={item.name}
        description={`${typeLabel} · mis à jour le ${item.updatedAt.toLocaleDateString("fr-FR")}`}
        back={
          <Button asChild variant="ghost" size="icon" aria-label="Retour à la liste">
            <Link href="/qrcode">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
        }
      />
      <SavedQrDetail item={item} />
    </>
  );
}
