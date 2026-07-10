import Link from "next/link";
import { Button } from "@daromsart/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-6xl font-bold text-primary">404</p>
      <h1 className="text-xl font-semibold">Page introuvable</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        La page que vous cherchez n'existe pas ou a été déplacée.
      </p>
      <Button asChild>
        <Link href="/">Retour à l'accueil</Link>
      </Button>
    </div>
  );
}
