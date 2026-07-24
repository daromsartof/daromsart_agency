import Link from "next/link";
import { Plus, QrCode } from "lucide-react";
import { Button, EmptyState, PageHeader } from "@daromsart/ui";
import { db } from "@/db";
import { getCurrentOrganizationId, requireSession } from "@/modules/auth/session";
import { listQrCodes } from "@/modules/qr-generator/queries";
import { SavedQrGrid } from "@/modules/qr-generator/saved-qr-grid";

export const metadata = { title: "QR Code" };

export default async function QrCodeListPage() {
  const session = await requireSession();
  const organizationId = await getCurrentOrganizationId(session.user.id);
  const items = organizationId ? await listQrCodes(db, organizationId) : [];

  return (
    <>
      <PageHeader
        title="QR Code"
        description="Gérez vos QR codes sauvegardés, ou créez-en un nouveau."
      >
        <Button asChild size="sm">
          <Link href="/qrcode/nouveau">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau QR
          </Link>
        </Button>
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState
          icon={QrCode}
          title="Aucun QR code sauvegardé"
          description="Créez votre premier QR (URL, Wi‑Fi, vCard…) et enregistrez-le pour le retrouver ici."
          action={
            <Button asChild>
              <Link href="/qrcode/nouveau">Créer un QR code</Link>
            </Button>
          }
        />
      ) : (
        <SavedQrGrid items={items} />
      )}
    </>
  );
}
