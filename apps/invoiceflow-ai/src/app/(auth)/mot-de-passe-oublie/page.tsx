import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@daromsart/ui";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-lg">Mot de passe oublié</CardTitle>
        <p className="text-sm text-muted-foreground">
          Saisissez votre email pour recevoir un lien de réinitialisation.
        </p>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm />
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link href="/connexion" className="text-primary hover:underline">
            Retour à la connexion
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
