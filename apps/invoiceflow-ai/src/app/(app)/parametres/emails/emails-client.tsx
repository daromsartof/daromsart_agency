"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, toast } from "@daromsart/ui";
import type { EmailDefaults } from "@/db/schema";
import { updateEmailDefaults } from "@/modules/organization/actions";
import { EmailTemplateCard } from "./email-template-card";

export interface EmailsClientProps {
  replyTo: string;
  emailDefaults: EmailDefaults;
  defaults: EmailDefaults;
}

export function EmailsClient({ replyTo, emailDefaults, defaults }: EmailsClientProps) {
  const [replyToValue, setReplyToValue] = useState(replyTo);
  const [values, setValues] = useState<EmailDefaults>(emailDefaults);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function updateBlock(kind: keyof EmailDefaults, field: "subject" | "body", value: string) {
    setValues((v) => ({ ...v, [kind]: { ...v[kind], [field]: value } }));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const result = await updateEmailDefaults({ replyTo: replyToValue, ...values });
      if (!result.ok) {
        setErrors(result.errors);
        toast.error("Vérifiez les champs en erreur.");
        return;
      }
      toast.success("Textes d'emails mis à jour.");
    });
  }

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Réponse</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="reply-to">Adresse de réponse (reply-to)</Label>
          <Input
            id="reply-to"
            type="email"
            value={replyToValue}
            onChange={(e) => setReplyToValue(e.target.value)}
            placeholder="contact@exemple.fr"
          />
          {errors.replyTo ? <p className="text-xs text-destructive">{errors.replyTo}</p> : null}
        </CardContent>
      </Card>

      <EmailTemplateCard
        kind="quote"
        subject={values.quote.subject}
        body={values.quote.body}
        defaultSubject={defaults.quote.subject}
        defaultBody={defaults.quote.body}
        onSubjectChange={(v) => updateBlock("quote", "subject", v)}
        onBodyChange={(v) => updateBlock("quote", "body", v)}
      />
      <EmailTemplateCard
        kind="invoice"
        subject={values.invoice.subject}
        body={values.invoice.body}
        defaultSubject={defaults.invoice.subject}
        defaultBody={defaults.invoice.body}
        onSubjectChange={(v) => updateBlock("invoice", "subject", v)}
        onBodyChange={(v) => updateBlock("invoice", "body", v)}
      />
      <EmailTemplateCard
        kind="reminder"
        subject={values.reminder.subject}
        body={values.reminder.body}
        defaultSubject={defaults.reminder.subject}
        defaultBody={defaults.reminder.body}
        onSubjectChange={(v) => updateBlock("reminder", "subject", v)}
        onBodyChange={(v) => updateBlock("reminder", "body", v)}
      />

      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}
