"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button, toast } from "@daromsart/ui";

export interface CopyButtonProps {
  value: string;
  label?: string;
}

/** Bouton "copier" générique (IBAN, référence…) — page publique facture (story 14). */
export function CopyButton({ value, label = "Copier" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success("Copié dans le presse-papiers.");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
      {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
      {copied ? "Copié" : label}
    </Button>
  );
}
