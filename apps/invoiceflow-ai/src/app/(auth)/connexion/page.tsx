import Link from "next/link";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@daromsart/ui";

export const metadata = { title: "Connexion" };

export default function ConnexionPage() {
  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <div className="text-xl font-semibold tracking-tight">
          Invoice<span className="text-primary">Flow</span>
        </div>
        <CardTitle className="text-lg">Bienvenue 👋</CardTitle>
        <p className="text-sm text-muted-foreground">
          Connectez-vous à votre espace
        </p>
      </CardHeader>
      <CardContent>
        {/* Formulaire non branché — l'authentification arrive en story 03. */}
        <form className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="vous@exemple.fr" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Mot de passe</Label>
              <Link
                href="/mot-de-passe-oublie"
                className="text-xs text-primary hover:underline"
              >
                Mot de passe oublié ?
              </Link>
            </div>
            <Input id="password" type="password" />
          </div>
          <Button className="w-full" type="submit" disabled>
            Se connecter
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Accès sur invitation uniquement.
        </p>
      </CardContent>
    </Card>
  );
}
