"use client";

import * as React from "react";
import { Button } from "@daromsart/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Une erreur est survenue</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Quelque chose s'est mal passé. Vous pouvez réessayer.
      </p>
      <Button onClick={() => reset()}>Réessayer</Button>
    </div>
  );
}
