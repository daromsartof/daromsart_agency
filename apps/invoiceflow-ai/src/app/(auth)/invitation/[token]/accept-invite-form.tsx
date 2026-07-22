"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@daromsart/ui";
import { signIn } from "@/modules/auth/client";
import { acceptInviteAction } from "@/modules/auth/actions";

export interface AcceptInviteFormProps {
  token: string;
  email: string;
  existingUser: boolean;
}

/**
 * Cas rare (H4, mono-org) : un compte existe déjà pour cet email (ancien
 * membre retiré, réinvité) — pas de formulaire de création, juste une
 * confirmation ; l'auto-login n'est pas possible ici (on ne connaît pas son
 * mot de passe existant), direction /connexion.
 */
function ExistingUserConfirm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    setError(null);
    setLoading(true);
    const result = await acceptInviteAction(token, { name: "", password: "" });
    setLoading(false);
    if (!result.ok) {
      setError(result.errors._root ?? "Échec de l'acceptation.");
      return;
    }
    router.replace("/connexion");
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Un compte existe déjà pour cet email. Rejoignez l'organisation puis connectez-vous avec
        votre mot de passe habituel.
      </p>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button className="w-full" onClick={handleJoin} disabled={loading}>
        {loading ? "Confirmation…" : "Rejoindre l'organisation"}
      </Button>
    </div>
  );
}

export function AcceptInviteForm({ token, email, existingUser }: AcceptInviteFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (existingUser) {
    return <ExistingUserConfirm token={token} />;
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
    const result = await acceptInviteAction(token, { name, password });
    if (!result.ok) {
      setLoading(false);
      setError(result.errors._root ?? result.errors.name ?? result.errors.password ?? "Échec de la création du compte.");
      return;
    }

    const { error: signInError } = await signIn.email({ email, password });
    setLoading(false);
    if (signInError) {
      router.replace("/connexion");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="name">Nom</Label>
        <Input
          id="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Mot de passe</Label>
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
        {loading ? "Création…" : "Créer mon compte"}
      </Button>
    </form>
  );
}
