"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@daromsart/ui";
import { createQrCodeAction } from "./actions";
import type { QrContentType, QrDesignOptions, QrFormValues } from "./types";
import { QR_TYPE_META } from "./types";

export interface SaveQrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: QrContentType;
  formValues: QrFormValues;
  design: QrDesignOptions;
  payload: string;
}

export function SaveQrDialog({
  open,
  onOpenChange,
  contentType,
  formValues,
  design,
  payload,
}: SaveQrDialogProps) {
  const router = useRouter();
  const typeLabel = QR_TYPE_META.find((t) => t.id === contentType)?.label ?? "QR";
  const [name, setName] = React.useState(`${typeLabel} — ${new Date().toLocaleDateString("fr-FR")}`);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setName(`${typeLabel} — ${new Date().toLocaleDateString("fr-FR")}`);
      setError(null);
    }
  }, [open, typeLabel]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await createQrCodeAction({
      name,
      contentType,
      formValues,
      design: {
        dotsColor: design.dotsColor,
        backgroundColor: design.backgroundColor,
        margin: design.margin,
        logoDataUrl: design.logoDataUrl,
      },
      payload,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.errors.name ?? result.errors._root ?? "Enregistrement impossible.");
      return;
    }
    onOpenChange(false);
    router.push(`/qrcode/${result.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sauvegarder le QR code</DialogTitle>
          <DialogDescription>
            Donnez un nom pour le retrouver dans votre liste.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="qr-save-name">Nom</Label>
          <Input
            id="qr-save-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !name.trim() || !payload}
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Enregistrement…" : "Sauvegarder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
