import Link from "next/link";
import { FileText } from "lucide-react";
import { Button, EmptyState } from "@daromsart/ui";

export default function DevisNotFound() {
  return (
    <EmptyState
      icon={FileText}
      title="Devis introuvable"
      description="Ce devis n'existe pas ou a été supprimé."
      action={
        <Button asChild variant="outline" size="sm">
          <Link href="/devis">Retour à la liste</Link>
        </Button>
      }
    />
  );
}
