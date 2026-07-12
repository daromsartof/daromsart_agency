import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@daromsart/ui";
import { LoginForm } from "./login-form";

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
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Accès sur invitation uniquement.
        </p>
      </CardContent>
    </Card>
  );
}
