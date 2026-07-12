"use client";

import { useRef, useState, useTransition } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, toast } from "@daromsart/ui";
import { deleteLogo, uploadLogo } from "@/modules/organization/actions";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/svg+xml", "image/jpeg"];

export function LogoCard({
  logoUrl,
  hasLogo,
}: {
  logoUrl: string | null;
  hasLogo: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(logoUrl);
  const [present, setPresent] = useState(hasLogo);
  const [pending, startTransition] = useTransition();

  function onPick() {
    inputRef.current?.click();
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_BYTES) {
      toast.error("Le fichier dépasse 2 Mo.");
      e.target.value = "";
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Formats acceptés : PNG, SVG, JPG.");
      e.target.value = "";
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await uploadLogo(formData);
      if (!result.ok) {
        toast.error(Object.values(result.errors)[0] ?? "Échec de l'envoi.");
        setPreview(logoUrl);
        return;
      }
      setPresent(true);
      toast.success("Logo mis à jour.");
    });
  }

  function onDelete() {
    startTransition(async () => {
      const result = await deleteLogo();
      if (!result.ok) {
        toast.error("Échec de la suppression.");
        return;
      }
      setPreview(null);
      setPresent(false);
      toast.success("Logo supprimé.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Logo</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md border border-dashed bg-muted">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:) non optimisable par next/image
              <img
                src={preview}
                alt="Logo de l'entreprise"
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="text-xs text-muted-foreground">Aucun</span>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onPick}
                disabled={pending}
              >
                {pending ? "…" : "Importer un logo"}
              </Button>
              {present ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onDelete}
                  disabled={pending}
                >
                  Supprimer
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              PNG, SVG ou JPG, 2 Mo maximum.
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/svg+xml,image/jpeg"
            className="hidden"
            onChange={onFileSelected}
          />
        </div>
      </CardContent>
    </Card>
  );
}
