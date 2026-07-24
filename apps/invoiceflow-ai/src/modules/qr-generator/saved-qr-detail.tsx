"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@daromsart/ui";
import { deleteQrCodeAction } from "./actions";
import { DownloadActions } from "./download-actions";
import { QrPreview, type QrPreviewHandle } from "./qr-preview";
import type { QrCodeRow } from "./queries";
import { QR_TYPE_META, type QrDesignOptions } from "./types";

export interface SavedQrDetailProps {
  item: QrCodeRow;
}

export function SavedQrDetail({ item }: SavedQrDetailProps) {
  const router = useRouter();
  const previewRef = React.useRef<QrPreviewHandle>(null);
  const [deleting, setDeleting] = React.useState(false);

  const design: QrDesignOptions = {
    dotsColor: item.design.dotsColor,
    backgroundColor: item.design.backgroundColor,
    margin: item.design.margin,
    logoDataUrl: item.design.logoDataUrl,
  };

  const typeLabel =
    QR_TYPE_META.find((t) => t.id === item.contentType)?.label ?? item.contentType;

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteQrCodeAction(item.id);
    setDeleting(false);
    if (result.ok) router.push("/qrcode");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Nom</p>
            <p className="font-medium">{item.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Type</p>
            <p className="font-medium">{typeLabel}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Contenu encodé</p>
            <pre className="mt-1 max-h-48 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs whitespace-pre-wrap break-all">
              {item.payload}
            </pre>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer ce QR code ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est définitive. Vous pourrez toujours en créer un nouveau.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={() => void handleDelete()} disabled={deleting}>
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Aperçu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <QrPreview ref={previewRef} payload={item.payload} design={design} />
          <DownloadActions
            disabled={false}
            onDownloadPng={() => void previewRef.current?.downloadPng()}
            onDownloadSvg={() => void previewRef.current?.downloadSvg()}
          />
        </CardContent>
      </Card>
    </div>
  );
}
