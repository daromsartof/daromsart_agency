"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, toast } from "@daromsart/ui";
import { Upload } from "lucide-react";
import { uploadSignableDocumentAction } from "@/modules/signable-documents/actions";

const MAX_BYTES = 15 * 1024 * 1024;

export function UploadButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onPick() {
    inputRef.current?.click();
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_BYTES) {
      toast.error("Le fichier dépasse 15 Mo.");
      return;
    }
    if (file.type !== "application/pdf") {
      toast.error("Seuls les fichiers PDF sont acceptés.");
      return;
    }

    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await uploadSignableDocumentAction(formData);
      if (!result.ok) {
        toast.error(Object.values(result.errors)[0] ?? "Échec de l'envoi.");
        return;
      }
      toast.success("PDF importé.");
      router.push(`/signatures/${result.id}`);
    });
  }

  return (
    <>
      <Button type="button" size="sm" onClick={onPick} disabled={pending}>
        <Upload className="mr-2 h-4 w-4" />
        {pending ? "Import…" : "Importer un PDF"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={onFileSelected}
      />
    </>
  );
}
