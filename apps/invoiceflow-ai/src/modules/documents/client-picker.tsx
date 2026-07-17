"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Button,
  cn,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@daromsart/ui";
import { searchClientsAction } from "@/modules/clients/actions";

type ClientOption = { id: string; displayName: string; email: string | null };

export interface ClientPickerProps {
  value: string | null;
  onChange: (clientId: string, label: string) => void;
  /** Client pré-sélectionné (ex. `?client=id` depuis la fiche client) : affiché
   * immédiatement sans attendre la recherche. */
  initialLabel?: string;
  disabled?: boolean;
}

export function ClientPicker({
  value,
  onChange,
  initialLabel,
  disabled,
}: ClientPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ClientOption[]>([]);
  const [label, setLabel] = useState(initialLabel ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const timeout = setTimeout(() => {
      searchClientsAction(query)
        .then(setOptions)
        .finally(() => setLoading(false));
    }, 150);
    return () => clearTimeout(timeout);
  }, [open, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {value && label ? label : "Sélectionner un client…"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Rechercher un client…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? "Recherche…" : "Aucun client trouvé."}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.id}
                  onSelect={() => {
                    onChange(option.id, option.displayName);
                    setLabel(option.displayName);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{option.displayName}</span>
                    {option.email ? (
                      <span className="text-xs text-muted-foreground">
                        {option.email}
                      </span>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
