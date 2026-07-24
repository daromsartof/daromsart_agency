"use client";

import { useRef } from "react";
import { Textarea, badgeVariants, cn } from "@daromsart/ui";
import type { EmailVariableName } from "@daromsart/core";

const VARIABLE_LABEL: Record<EmailVariableName, string> = {
  client: "Client",
  numero: "Numéro",
  total: "Montant",
  lien: "Lien",
  echeance: "Échéance",
  jours_retard: "Jours de retard",
};

export interface VariableTextareaProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  variables: EmailVariableName[];
  rows?: number;
}

/** Textarea + chips de variables (story 22) — clic = insertion au curseur,
 * jamais en fin de texte (le curseur peut être n'importe où). */
export function VariableTextarea({ id, value, onChange, variables, rows = 6 }: VariableTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function insertVariable(name: EmailVariableName) {
    const el = ref.current;
    const token = `{${name}}`;
    if (!el) {
      onChange(`${value}${token}`);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + token.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {variables.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => insertVariable(name)}
            className={cn(badgeVariants({ variant: "outline" }), "cursor-pointer select-none hover:bg-muted")}
          >
            {`{${name}}`} — {VARIABLE_LABEL[name]}
          </button>
        ))}
      </div>
      <Textarea
        id={id}
        ref={ref}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
