"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@daromsart/ui";
import { signSignableDocumentAction } from "@/modules/signable-documents/actions";
import type { SignatureAnchor } from "@/modules/signable-documents/mutations";
import {
  SignatureCanvas,
  type SignatureCanvasHandle,
} from "@/modules/public/components/signature-canvas";

const ANCHORS: { value: SignatureAnchor; label: string }[] = [
  { value: "haut-gauche", label: "Haut gauche" },
  { value: "centre", label: "Centre" },
  { value: "haut-droite", label: "Haut droite" },
  { value: "bas-gauche", label: "Bas gauche" },
  { value: "bas-centre", label: "Bas centre" },
  { value: "bas-droite", label: "Bas droite" },
];

export function SignPanel({ documentId, pageCount }: { documentId: string; pageCount: number }) {
  const [signerName, setSignerName] = useState("");
  const [page, setPage] = useState(1);
  const [anchor, setAnchor] = useState<SignatureAnchor>("bas-droite");
  const [hasSignature, setHasSignature] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const canvasRef = useRef<SignatureCanvasHandle>(null);
  const router = useRouter();

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

    startTransition(async () => {
      const result = await signSignableDocumentAction(documentId, {
        signerName: signerName.trim(),
        pngDataUrl,
        page,
        anchor,
      });
      if (!result.ok) {
        setError(result.errors._root ?? "Échec de la signature.");
        return;
      }
      toast.success("Document signé.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="signer-name">Nom et prénom</Label>
        <Input
          id="signer-name"
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Page</Label>
          <Select value={String(page)} onValueChange={(v) => setPage(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <SelectItem key={n} value={String(n)}>
                  Page {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Position</Label>
          <Select value={anchor} onValueChange={(v) => setAnchor(v as SignatureAnchor)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANCHORS.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <SignatureCanvas ref={canvasRef} onChange={(isEmpty) => setHasSignature(!isEmpty)} />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button onClick={handleSubmit} disabled={pending || !hasSignature}>
        {pending ? "Signature…" : "Signer le document"}
      </Button>
    </div>
  );
}
