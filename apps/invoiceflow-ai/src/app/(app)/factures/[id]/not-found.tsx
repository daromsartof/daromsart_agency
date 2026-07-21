import Link from "next/link";
import { Receipt } from "lucide-react";
import { Button, EmptyState } from "@daromsart/ui";

export default function FactureNotFound() {
  return (
    <EmptyState
      icon={Receipt}
      title="Facture introuvable"
      description="Cette facture n'existe pas ou a été supprimée."
      action={
        <Button asChild variant="outline" size="sm">
          <Link href="/factures">Retour à la liste</Link>
        </Button>
      }
    />
  );
}
