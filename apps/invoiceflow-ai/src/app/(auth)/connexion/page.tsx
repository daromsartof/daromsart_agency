import { Suspense } from "react";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
} from "@daromsart/ui";
import { LoginForm } from "./login-form";

export const metadata = { title: "Connexion" };

export default function ConnexionPage() {
  return (
    <Card>
      <CardHeader className="space-y-4 text-center">
        {/* Lockup empilé — prévu pour l'écran de connexion (charte : ~200px). */}
        <div className="flex justify-center">
          <Image
            src="/logo/lockup-empile-couleur.png"
            alt="Daroms'Art Systems"
            width={840}
            height={540}
            priority
            className="h-auto w-[220px] dark:hidden"
          />
          <Image
            src="/logo/lockup-empile-inverse.png"
            alt="Daroms'Art Systems"
            width={560}
            height={360}
            priority
            className="hidden h-auto w-[220px] dark:block"
          />
        </div>
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
