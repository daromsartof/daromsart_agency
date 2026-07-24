"use client";

import { useRef, useState, useTransition } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  toast,
} from "@daromsart/ui";
import { signInvoiceAction, signQuoteAction } from "@/modules/public/actions";
import { SignatureCanvas, type SignatureCanvasHandle } from "./signature-canvas";

export interface SignDialogProps {
  token: string;
  kind: "quote" | "invoice";
  defaultName?: string;
  defaultEmail?: string | null;
}

export function SignDialog({ token, kind, defaultName, defaultEmail }: SignDialogProps) {
  const noun = kind === "quote" ? "devis" : "facture";
  const article = kind === "quote" ? "le" : "la";
  const signedAdjective = kind === "quote" ? "signé" : "signée";
  const action = kind === "quote" ? signQuoteAction : signInvoiceAction;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName ?? "");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [consent, setConsent] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const canvasRef = useRef<SignatureCanvasHandle>(null);

  function handleSubmit() {
    setError(null);
    if (!name.trim()) {
      setError("Le nom est requis.");
      return;
    }
    if (!consent) {
      setError("Merci de confirmer votre accord avant de signer.");
      return;
    }
    const pngDataUrl = canvasRef.current?.toDataUrl();
    if (!pngDataUrl) {
      setError("Merci de tracer votre signature.");
      return;
    }

    startTransition(async () => {
      const result = await action(token, {
        name: name.trim(),
        email: email.trim() || undefined,
        pngDataUrl,
      });
      if (!result.ok) {
        setError(result.errors._root ?? "Échec de la signature.");
        return;
      }
      toast.success(`${kind === "quote" ? "Devis" : "Facture"} ${signedAdjective}.`);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">Signer {article} {noun}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Signer {article} {noun}</DialogTitle>
          <DialogDescription>
            Votre signature électronique vaut acceptation des termes de ce {noun}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sign-name">Nom et prénom</Label>
              <Input id="sign-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sign-email">Email (optionnel)</Label>
              <Input
                id="sign-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <SignatureCanvas ref={canvasRef} onChange={(isEmpty) => setHasSignature(!isEmpty)} />

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            Je certifie avoir pris connaissance de {article === "le" ? "ce" : "cette"} {noun} et
            donne mon accord pour signature électronique.
          </label>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={pending || !hasSignature}>
            {pending ? "Signature…" : "Confirmer la signature"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
