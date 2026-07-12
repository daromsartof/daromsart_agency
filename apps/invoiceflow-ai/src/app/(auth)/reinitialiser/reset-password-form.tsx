"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input, Label } from "@daromsart/ui";
import { resetPassword } from "@/modules/auth/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const linkError = searchParams.get("error");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!token || linkError) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive" role="alert">
          Ce lien de réinitialisation est invalide ou a expiré.
        </p>
        <p className="text-center text-xs text-muted-foreground">
          <Link
            href="/mot-de-passe-oublie"
            className="text-primary hover:underline"
          >
            Demander un nouveau lien
          </Link>
        </p>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    const { error: resetError } = await resetPassword({
      newPassword: password,
      token: token as string,
    });
    setLoading(false);

    if (resetError) {
      setError("Ce lien est invalide ou a expiré.");
      return;
    }
    router.replace("/connexion");
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="password">Nouveau mot de passe</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirmer le mot de passe</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button className="w-full" type="submit" disabled={loading}>
        {loading ? "Enregistrement…" : "Réinitialiser"}
      </Button>
    </form>
  );
}
