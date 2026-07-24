import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button, PageHeader } from "@daromsart/ui";
import { requireSession } from "@/modules/auth/session";
import { QrGenerator } from "@/modules/qr-generator/qr-generator";

export const metadata = { title: "Nouveau QR Code" };

export default async function NouveauQrCodePage() {
  await requireSession();

  return (
    <>
      <PageHeader
        title="Nouveau QR"
        description="Créez votre QR en 3 étapes : type, contenu, puis design et enregistrement."
        back={
          <Button asChild variant="ghost" size="icon" aria-label="Retour à la liste">
            <Link href="/qrcode">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
        }
      />
      <QrGenerator />
    </>
  );
}
