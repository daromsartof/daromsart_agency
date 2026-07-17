import Link from "next/link";
import { Users } from "lucide-react";
import { Button, EmptyState } from "@daromsart/ui";

export default function ClientNotFound() {
  return (
    <EmptyState
      icon={Users}
      title="Client introuvable"
      description="Ce client n'existe pas ou a été supprimé."
      action={
        <Button asChild variant="outline" size="sm">
          <Link href="/clients">Retour à la liste</Link>
        </Button>
      }
    />
  );
}
