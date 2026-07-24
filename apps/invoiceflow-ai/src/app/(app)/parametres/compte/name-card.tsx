"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, toast } from "@daromsart/ui";
import { updateUser } from "@/modules/auth/client";

export function NameCard({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const { error } = await updateUser({ name });
      if (error) {
        toast.error("Échec de la mise à jour.");
        return;
      }
      toast.success("Nom mis à jour.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profil</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="account-name">Nom</Label>
            <Input id="account-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
