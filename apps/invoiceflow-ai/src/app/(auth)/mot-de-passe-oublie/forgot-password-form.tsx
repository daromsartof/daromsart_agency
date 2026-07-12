"use client";

import { useState } from "react";
import { Button, Input, Label } from "@daromsart/ui";
import { forgetPassword } from "@/modules/auth/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    // On envoie toujours la même réponse, que le compte existe ou non.
    await forgetPassword({ email, redirectTo: "/reinitialiser" });
    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Si un compte est associé à cet email, un lien de réinitialisation vient
        d’être envoyé.
      </p>
    );
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="vous@exemple.fr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <Button className="w-full" type="submit" disabled={loading}>
        {loading ? "Envoi…" : "Envoyer le lien"}
      </Button>
    </form>
  );
}
