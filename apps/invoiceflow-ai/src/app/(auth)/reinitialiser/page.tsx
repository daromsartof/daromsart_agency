import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@daromsart/ui";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Réinitialiser le mot de passe" };

export default function ResetPasswordPage() {
  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-lg">Nouveau mot de passe</CardTitle>
        <p className="text-sm text-muted-foreground">
          Choisissez un nouveau mot de passe pour votre compte.
        </p>
      </CardHeader>
      <CardContent>
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
