"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Button, Input, Label, Switch } from "@daromsart/ui";

export interface ClientsToolbarProps {
  initialQuery: string;
  initialIncludeArchived: boolean;
  onNewClient: () => void;
}

const DEBOUNCE_MS = 300;

export function ClientsToolbar({
  initialQuery,
  initialIncludeArchived,
  onNewClient,
}: ClientsToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (query.trim()) {
        params.set("q", query.trim());
      } else {
        params.delete("q");
      }
      // La recherche change les résultats : on repart de la page 1.
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne réagit qu'à `query`
  }, [query]);

  function toggleArchived(checked: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (checked) {
      params.set("archives", "1");
    } else {
      params.delete("archives");
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un client…"
            className="pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="include-archived"
            checked={initialIncludeArchived}
            onCheckedChange={toggleArchived}
          />
          <Label htmlFor="include-archived" className="text-sm font-normal">
            Inclure les archivés
          </Label>
        </div>
      </div>
      <Button onClick={onNewClient}>Nouveau client</Button>
    </div>
  );
}
