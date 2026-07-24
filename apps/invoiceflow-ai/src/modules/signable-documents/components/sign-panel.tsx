"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilePenLine } from "lucide-react";
import { Button, Input, Label, toast } from "@daromsart/ui";
import { signSignableDocumentAction } from "@/modules/signable-documents/actions";
import type { SignaturePlacement } from "@/modules/signable-documents/signature-placement";
import {
  SignatureCanvas,
  type SignatureCanvasHandle,
} from "@/modules/public/components/signature-canvas";

export interface SignPanelProps {
  documentId: string;
  page: number;
  placement: SignaturePlacement | null;
  onSignaturePreview: (dataUrl: string | null) => void;
}

export function SignPanel({
  documentId,
  page,
  placement,
  onSignaturePreview,
}: SignPanelProps) {
  const [signerName, setSignerName] = useState("");
  const [hasSignature, setHasSignature] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const canvasRef = useRef<SignatureCanvasHandle>(null);
  const router = useRouter();

  function handleSignatureChange(isEmpty: boolean) {
    setHasSignature(!isEmpty);
    if (isEmpty) {
      onSignaturePreview(null);
      return;
    }
    onSignaturePreview(canvasRef.current?.toDataUrl() ?? null);
  }

  function handleSubmit() {
    setError(null);
    if (!signerName.trim()) {
      setError("Le nom est requis.");
      return;
    }
    const pngDataUrl = canvasRef.current?.toDataUrl();
    if (!pngDataUrl) {
      setError("Merci de tracer votre signature.");
      return;
    }
    if (!placement) {
      setError("Placez la signature sur le PDF.");
      return;
    }

    startTransition(async () => {
      const result = await signSignableDocumentAction(documentId, {
        signerName: signerName.trim(),
        pngDataUrl,
        page,
        placement,
      });
      if (!result.ok) {
        setError(
          result.errors._root ??
            result.errors.placement ??
            result.errors.signature ??
            "Échec de la signature.",
        );
        return;
      }
      toast.success("Document signé.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="signer-name">Nom et prénom</Label>
        <Input
          id="signer-name"
          value={signerName}
          placeholder="Ex. Marie Dupont"
          onChange={(e) => setSignerName(e.target.value)}
        />
      </div>

      <div className="border-t pt-5">
        <SignatureCanvas ref={canvasRef} onChange={handleSignatureChange} />
      </div>

      {hasSignature ? (
        <p className="text-xs text-muted-foreground">
          Sur le PDF : glissez la signature pour la placer, utilisez les coins pour
          l’agrandir ou la réduire.
        </p>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button
        className="w-full gap-2"
        onClick={handleSubmit}
        disabled={pending || !hasSignature || !placement}
      >
        <FilePenLine className="h-4 w-4" />
        {pending ? "Signature…" : "Signer le document"}
      </Button>
    </div>
  );
}
