"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Textarea,
  toast,
} from "@daromsart/ui";

const EMAIL_LIKE = /^\S+@\S+\.\S+$/;

export interface SendDialogSendResult {
  ok: boolean;
  errors?: Record<string, string>;
}

export interface SendDialogProps {
  trigger: React.ReactNode;
  defaultTo: string[];
  defaultSubject: string;
  defaultBody: string;
  /** Bannière "sera émis puis envoyé" (devis/facture encore brouillon). */
  willIssueFirst?: boolean;
  attachmentLabel?: string;
  onSend: (input: {
    to: string[];
    cc?: string[];
    subject: string;
    bodyText: string;
  }) => Promise<SendDialogSendResult>;
  onSuccess?: () => void;
}

function EmailTokens({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  function commitDraft() {
    const value = draft.trim().replace(/,$/, "");
    if (value && !values.includes(value)) {
      onChange([...values, value]);
    }
    setDraft("");
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5">
        {values.map((value) => (
          <Badge key={value} variant="secondary" className="gap-1">
            {value}
            <button
              type="button"
              aria-label={`Retirer ${value}`}
              onClick={() => onChange(values.filter((v) => v !== value))}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <input
          aria-label={label}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commitDraft();
            } else if (e.key === "Backspace" && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={commitDraft}
          placeholder={values.length ? "" : placeholder}
          className="min-w-[120px] flex-1 bg-transparent text-sm outline-none"
        />
      </div>
    </div>
  );
}

/** Dialog d'envoi de document par email (E-13) — partagé devis/facture. */
export function SendDialog({
  trigger,
  defaultTo,
  defaultSubject,
  defaultBody,
  willIssueFirst,
  attachmentLabel = "Le PDF du document sera joint automatiquement.",
  onSend,
  onSuccess,
}: SendDialogProps) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState<string[]>(defaultTo);
  const [cc, setCc] = useState<string[]>([]);
  const [subject, setSubject] = useState(defaultSubject);
  const [bodyText, setBodyText] = useState(defaultBody);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setTo(defaultTo);
      setCc([]);
      setSubject(defaultSubject);
      setBodyText(defaultBody);
      setErrors({});
    }
  }

  function handleSend() {
    if (to.length === 0 || !to.every((t) => EMAIL_LIKE.test(t))) {
      setErrors({ to: "Au moins un destinataire avec une adresse email valide." });
      return;
    }
    startTransition(async () => {
      const result = await onSend({ to, cc: cc.length ? cc : undefined, subject, bodyText });
      if (!result.ok) {
        setErrors(result.errors ?? { _root: "Échec de l'envoi." });
        toast.error(result.errors?._root ?? "Échec de l'envoi.");
        return;
      }
      toast.success("Email envoyé.");
      setOpen(false);
      onSuccess?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Envoyer par email</DialogTitle>
          {willIssueFirst ? (
            <DialogDescription>
              Ce document est encore un brouillon : il sera émis (numéro attribué) avant l'envoi.
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="space-y-4">
          <EmailTokens
            label="Destinataires"
            values={to}
            onChange={setTo}
            placeholder="email@exemple.fr"
          />
          {errors.to ? <p className="text-sm text-destructive">{errors.to}</p> : null}

          <EmailTokens label="Copie (Cc)" values={cc} onChange={setCc} placeholder="cc@exemple.fr" />

          <div className="space-y-1.5">
            <Label htmlFor="send-dialog-subject">Sujet</Label>
            <Input
              id="send-dialog-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="send-dialog-body">Corps</Label>
            <Textarea
              id="send-dialog-body"
              rows={8}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
            />
          </div>

          <p className="text-xs text-muted-foreground">{attachmentLabel}</p>

          {errors._root ? <p className="text-sm text-destructive">{errors._root}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Annuler
          </Button>
          <Button onClick={handleSend} disabled={pending}>
            {pending ? "Envoi…" : "Envoyer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
